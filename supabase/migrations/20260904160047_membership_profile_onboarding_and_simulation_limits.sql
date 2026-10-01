alter table public.profiles add column if not exists country text; alter table public.profiles add column if not exists onboarding_completed boolean not null default false;
update public.profiles set onboarding_completed=true where country is not null;

create table if not exists public.point_redemptions (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 reward_type text not null, points_spent integer not null check(points_spent>0), status text not null default 'pending', created_at timestamptz not null default now()
);
alter table public.point_redemptions enable row level security;
drop policy if exists point_redemptions_select_own on public.point_redemptions;
create policy point_redemptions_select_own on public.point_redemptions for select to authenticated using(auth.uid()=user_id);

grant select on public.point_redemptions to authenticated;

create or replace function public.get_my_membership()
returns jsonb language plpgsql security definer set search_path='pg_catalog,public,auth' as $$
declare p public.profiles; v_plan text; v_active boolean; begin
 if auth.uid() is null then raise exception 'not authenticated'; end if;
 select * into p from public.profiles where id=auth.uid();
 v_plan:=coalesce(p.plan,'free');
 v_active:= v_plan='lifetime' or (v_plan='premium' and (p.premium_until is null or p.premium_until>now()));
 return jsonb_build_object('plan',case when v_plan='lifetime' then 'lifetime' when v_active then 'premium' else 'free' end,'premium_until',p.premium_until,'country',p.country,'onboarding_completed',p.onboarding_completed);
end $$;
revoke all on function public.get_my_membership() from public,anon;
grant execute on function public.get_my_membership() to authenticated;

create or replace function public.can_start_full_simulation()
returns jsonb language plpgsql security definer set search_path='pg_catalog,public,auth' as $$
declare p public.profiles; v_plan text; v_used int; begin
 if auth.uid() is null then raise exception 'not authenticated'; end if;
 select * into p from public.profiles where id=auth.uid();
 v_plan:=case when p.plan='lifetime' then 'lifetime' when p.plan='premium' and (p.premium_until is null or p.premium_until>now()) then 'premium' else 'free' end;
 select count(*) into v_used from public.learning_activity where user_id=auth.uid() and activity_type='simulation_full_completed' and created_at>=date_trunc('month',now() at time zone 'Asia/Tokyo') at time zone 'Asia/Tokyo';
 return jsonb_build_object('allowed',v_plan in ('premium','lifetime') or v_used<1,'plan',v_plan,'used_this_month',v_used,'monthly_limit',case when v_plan='free' then 1 else null end,'monthly_exam',v_plan in ('premium','lifetime'));
end $$;
revoke all on function public.can_start_full_simulation() from public,anon;
grant execute on function public.can_start_full_simulation() to authenticated;
