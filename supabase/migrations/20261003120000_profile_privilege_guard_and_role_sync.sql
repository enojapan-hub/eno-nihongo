-- Profile privilege guard + legacy/dynamic role alignment.
--
-- Problem 1 (security): `authenticated` holds UPDATE on all of public.profiles and the only
-- policy (profiles_update_own) restricts rows, not columns. Any signed-in user could therefore
-- run `update profiles set role='owner', app_role_id=<owner role>` on their own row, and could
-- equally set plan/premium_until/suspended_at. Privileged columns may only be changed by
-- SECURITY DEFINER admin functions or the service role.
--
-- Problem 2 (consistency): the project has two access models. Legacy checks read
-- profiles.role; newer RPCs (get_admin_action_queue, operations, settings, media, ...) use
-- has_permission() backed by app_roles/role_permissions. Role changes made through the legacy
-- path (admin_set_user_role, admin_update_user_access) never touched app_role_id, so an account
-- with role='admin' and app_role_id NULL passes legacy checks but has no dynamic permissions,
-- and a legacy demotion would leave stale dynamic permissions in place.
--
-- This migration keeps both models in step using the same-key system role only
-- (admin -> admin, editor -> editor, ...). It grants nothing beyond what the legacy role already
-- implied, never creates owner access from a lower role, and leaves custom roles that an owner
-- assigned through admin_assign_app_role untouched.

-- 1) Guard: runs as the caller (SECURITY INVOKER) so current_user tells API callers
--    (authenticated/anon) apart from definer functions and the service role.
create or replace function public.guard_profile_privileged_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.role is distinct from 'student'
       or new.app_role_id is not null
       or new.plan is distinct from 'free'
       or new.premium_until is not null
       or coalesce(new.referral_points, 0) <> 0
       or new.suspended_at is not null
       or new.admin_note is not null then
      raise exception 'Kolom akses/langganan profil tidak dapat diatur langsung' using errcode = '42501';
    end if;
    return new;
  end if;

  if new.role is distinct from old.role
     or new.app_role_id is distinct from old.app_role_id
     or new.plan is distinct from old.plan
     or new.premium_until is distinct from old.premium_until
     or new.referral_points is distinct from old.referral_points
     or new.suspended_at is distinct from old.suspended_at
     or new.admin_note is distinct from old.admin_note then
    raise exception 'Kolom akses/langganan profil hanya dapat diubah melalui fungsi admin' using errcode = '42501';
  end if;
  return new;
end
$$;

-- 2) Sync: keep app_role_id aligned with the legacy role (same-key system role only).
create or replace function public.sync_profile_app_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old_key text;
begin
  if tg_op = 'INSERT' then
    if new.app_role_id is null then
      select r.id into new.app_role_id
      from public.app_roles r
      where r.key = new.role and r.is_active;
    end if;
    return new;
  end if;

  if new.role is not distinct from old.role then
    return new;
  end if;
  -- Explicit assignment in the same statement (admin_assign_app_role) wins.
  if new.app_role_id is distinct from old.app_role_id then
    return new;
  end if;

  select r.key into v_old_key from public.app_roles r where r.id = old.app_role_id;
  -- Follow the legacy role only when the user holds no dynamic role or the system role that
  -- mirrored the previous legacy role. An owner-assigned custom role is kept as is.
  if old.app_role_id is null or v_old_key = old.role then
    select r.id into new.app_role_id
    from public.app_roles r
    where r.key = new.role and r.is_active;  -- no mirror role => NULL (least privilege)
  end if;
  return new;
end
$$;

revoke all on function public.guard_profile_privileged_columns() from public, anon, authenticated;
revoke all on function public.sync_profile_app_role() from public, anon, authenticated;

drop trigger if exists profiles_00_guard_privileged on public.profiles;
create trigger profiles_00_guard_privileged
  before insert or update of role, app_role_id, plan, premium_until, referral_points, suspended_at, admin_note
  on public.profiles
  for each row execute function public.guard_profile_privileged_columns();

drop trigger if exists profiles_10_sync_app_role on public.profiles;
create trigger profiles_10_sync_app_role
  before insert or update of role
  on public.profiles
  for each row execute function public.sync_profile_app_role();

-- 3) Backfill accounts whose legacy role has a same-key system role but no dynamic role.
--    Skipped on databases that do not have the dynamic role tables.
do $$
begin
  if to_regclass('public.app_roles') is not null
     and exists (
       select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'profiles' and column_name = 'app_role_id'
     ) then
    update public.profiles p
    set app_role_id = r.id
    from public.app_roles r
    where p.app_role_id is null and r.key = p.role and r.is_active;
  end if;
end
$$;
