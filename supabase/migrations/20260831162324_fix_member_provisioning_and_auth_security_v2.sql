alter table public.profiles add column if not exists ui_language text not null default 'id';

create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  daily_kanji_target integer not null default 5 check (daily_kanji_target between 0 and 100),
  daily_vocab_target integer not null default 10 check (daily_vocab_target between 0 and 200),
  daily_grammar_target integer not null default 5 check (daily_grammar_target between 0 and 100),
  furigana_enabled boolean not null default true,
  daily_reminder boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_settings enable row level security;
drop policy if exists "users can read own settings" on public.user_settings;
create policy "users can read own settings" on public.user_settings for select to authenticated using (auth.uid() = user_id);
drop policy if exists "users can insert own settings" on public.user_settings;
create policy "users can insert own settings" on public.user_settings for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "users can update own settings" on public.user_settings;
create policy "users can update own settings" on public.user_settings for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.set_user_settings_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end;
$$;
drop trigger if exists user_settings_updated_at on public.user_settings;
create trigger user_settings_updated_at before update on public.user_settings for each row execute function public.set_user_settings_updated_at();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_name text;
  v_avatar text;
  v_code text;
begin
  v_name := coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(coalesce(new.email, 'member'), '@', 1), 'ENO JAPAN Member');
  v_avatar := coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture');
  v_code := upper(substr(replace(new.id::text, '-', ''), 1, 12));

  insert into public.profiles (id, display_name, avatar_url, target_level, ui_language, referral_code, role)
  values (new.id, v_name, v_avatar, 'N5', 'id', v_code, 'student')
  on conflict (id) do nothing;

  insert into public.user_stats (user_id) values (new.id) on conflict (user_id) do nothing;
  insert into public.user_settings (user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

insert into public.profiles (id, display_name, avatar_url, target_level, ui_language, referral_code, role)
select u.id, coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', split_part(coalesce(u.email, 'member'), '@', 1), 'ENO JAPAN Member'), coalesce(u.raw_user_meta_data->>'avatar_url', u.raw_user_meta_data->>'picture'), 'N5', 'id', upper(substr(replace(u.id::text, '-', ''), 1, 12)), 'student'
from auth.users u on conflict (id) do nothing;
insert into public.user_stats (user_id) select u.id from auth.users u on conflict (user_id) do nothing;
insert into public.user_settings (user_id) select u.id from auth.users u on conflict (user_id) do nothing;

revoke execute on function public.submit_quiz_attempt(uuid, public.jlpt_level, public.content_skill, jsonb, integer) from anon;
