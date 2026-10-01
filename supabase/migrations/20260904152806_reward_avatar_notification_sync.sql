-- Canonical rewards: Materi gives XP only; points only from daily targets and simulations.

-- Public avatar bucket for user-controlled profile photos.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('avatars','avatars',true,5242880,array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update set public=true,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "avatars_public_read" on storage.objects;
create policy "avatars_public_read" on storage.objects for select using (bucket_id='avatars');
drop policy if exists "avatars_insert_own" on storage.objects;
create policy "avatars_insert_own" on storage.objects for insert to authenticated with check (bucket_id='avatars' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists "avatars_update_own" on storage.objects;
create policy "avatars_update_own" on storage.objects for update to authenticated using (bucket_id='avatars' and (storage.foldername(name))[1]=auth.uid()::text) with check (bucket_id='avatars' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists "avatars_delete_own" on storage.objects;
create policy "avatars_delete_own" on storage.objects for delete to authenticated using (bucket_id='avatars' and (storage.foldername(name))[1]=auth.uid()::text);

-- Fill missing avatars from Google metadata, but never overwrite an existing/custom avatar.
update public.profiles p
set avatar_url = coalesce(u.raw_user_meta_data->>'avatar_url',u.raw_user_meta_data->>'picture')
from auth.users u
where p.id=u.id and (p.avatar_url is null or btrim(p.avatar_url)='')
  and coalesce(u.raw_user_meta_data->>'avatar_url',u.raw_user_meta_data->>'picture') is not null;

create or replace function public.sync_google_profile_metadata()
returns trigger language plpgsql security definer set search_path='pg_catalog,public,auth' as $$
begin
  update public.profiles
  set display_name=coalesce(nullif(display_name,''),new.raw_user_meta_data->>'full_name',new.raw_user_meta_data->>'name'),
      avatar_url=case when avatar_url is null or btrim(avatar_url)='' then coalesce(new.raw_user_meta_data->>'avatar_url',new.raw_user_meta_data->>'picture') else avatar_url end,
      updated_at=now()
  where id=new.id;
  return new;
end $$;
drop trigger if exists trg_sync_google_profile_metadata on auth.users;
create trigger trg_sync_google_profile_metadata after update of raw_user_meta_data on auth.users for each row execute function public.sync_google_profile_metadata();

-- In-app notifications used by the bell.
create table if not exists public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text not null,
  kind text not null default 'info',
  action_url text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists user_notifications_user_created_idx on public.user_notifications(user_id,created_at desc);
alter table public.user_notifications enable row level security;
drop policy if exists "notifications_select_own" on public.user_notifications;
create policy "notifications_select_own" on public.user_notifications for select to authenticated using (auth.uid()=user_id);
drop policy if exists "notifications_update_own" on public.user_notifications;
create policy "notifications_update_own" on public.user_notifications for update to authenticated using (auth.uid()=user_id) with check (auth.uid()=user_id);

insert into public.user_notifications(user_id,title,body,kind,action_url)
select p.id,'Selamat datang di ENO NIHONGO','Notifikasi target, progres, dan hasil simulasi akan muncul di sini.','welcome','/target'
from public.profiles p
where not exists (select 1 from public.user_notifications n where n.user_id=p.id);

-- Keep leaderboard totals synchronized whenever canonical account stats change.
create or replace function public.sync_user_stats_to_learning_stats()
returns trigger language plpgsql security definer set search_path='pg_catalog,public' as $$
begin
  insert into public.user_learning_stats(user_id,display_name,avatar_url,jlpt_level,ui_language,xp,total_points,current_streak,longest_streak,updated_at)
  select new.user_id,p.display_name,p.avatar_url,coalesce(p.target_level::text,'N5'),coalesce(p.ui_language,'id'),new.total_xp,new.reward_points,new.current_streak,new.longest_streak,now()
  from public.profiles p where p.id=new.user_id
  on conflict(user_id) do update set xp=excluded.xp,total_points=excluded.total_points,current_streak=excluded.current_streak,longest_streak=excluded.longest_streak,display_name=excluded.display_name,avatar_url=excluded.avatar_url,jlpt_level=excluded.jlpt_level,ui_language=excluded.ui_language,updated_at=now();
  return new;
end $$;
drop trigger if exists trg_sync_user_stats_learning_stats on public.user_stats;
create trigger trg_sync_user_stats_learning_stats after insert or update on public.user_stats for each row execute function public.sync_user_stats_to_learning_stats();

-- Existing accidental material points are invalid under the clarified reward policy.
update public.user_stats set reward_points=0,updated_at=now();
update public.user_learning_stats set total_points=0,updated_at=now();

-- Daily task completion awards points once per task, independent of material XP.
create unique index if not exists learning_activity_daily_task_unique
on public.learning_activity(user_id,activity_type,(metadata->>'task_id')) where activity_type='daily_target_completed';

create or replace function public.award_daily_target_points()
returns trigger language plpgsql security definer set search_path='pg_catalog,public' as $$
declare v_awarded boolean:=false; v_points int:=5;
begin
  if new.target_count>0 and new.completed_count>=new.target_count and (tg_op='INSERT' or old.completed_count<old.target_count) then
    insert into public.learning_activity(user_id,activity_type,points,xp,metadata)
    values(new.user_id,'daily_target_completed',v_points,0,jsonb_build_object('task_id',new.id::text,'task_type',new.task_type,'study_date',new.study_date))
    on conflict do nothing;
    get diagnostics v_points = row_count;
    if v_points>0 then
      insert into public.user_stats(user_id,reward_points) values(new.user_id,5)
      on conflict(user_id) do update set reward_points=public.user_stats.reward_points+5,updated_at=now();
      insert into public.user_notifications(user_id,title,body,kind,action_url)
      values(new.user_id,'Target harian selesai','Kamu mendapat +5 Poin dari target '||replace(new.task_type,'_',' ')||'.','reward','/target');
    end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_award_daily_target_points on public.daily_study_tasks;
create trigger trg_award_daily_target_points after insert or update of completed_count on public.daily_study_tasks for each row execute function public.award_daily_target_points();

-- Canonical activity recorder. Server ignores point requests from non-eligible activities.
create or replace function public.record_learning_activity(p_activity_type text,p_points integer default 0,p_xp integer default 0,p_metadata jsonb default '{}'::jsonb)
returns public.user_learning_stats language plpgsql security definer set search_path='pg_catalog,public,auth' as $$
declare
  v_user_id uuid:=auth.uid(); v_allowed_points int:=0; v_xp int:=greatest(coalesce(p_xp,0),0); v_result public.user_learning_stats;
  v_today date:=current_date; v_last date; v_streak int;
begin
  if v_user_id is null then raise exception 'User belum login'; end if;
  if p_activity_type in ('daily_target_completed','simulation_section_completed','simulation_full_completed') then v_allowed_points:=greatest(coalesce(p_points,0),0); end if;

  insert into public.learning_activity(user_id,activity_type,points,xp,metadata)
  values(v_user_id,p_activity_type,v_allowed_points,v_xp,coalesce(p_metadata,'{}'::jsonb));

  insert into public.user_stats(user_id) values(v_user_id) on conflict(user_id) do nothing;
  select last_activity_date,current_streak into v_last,v_streak from public.user_stats where user_id=v_user_id for update;
  if v_last=v_today then v_streak:=coalesce(v_streak,0); elsif v_last=v_today-1 then v_streak:=coalesce(v_streak,0)+1; else v_streak:=1; end if;
  update public.user_stats set total_xp=total_xp+v_xp,reward_points=reward_points+v_allowed_points,current_streak=v_streak,longest_streak=greatest(longest_streak,v_streak),last_activity_date=v_today,updated_at=now() where user_id=v_user_id;

  update public.user_learning_stats
  set lessons_completed=lessons_completed+case when p_activity_type='lesson_completed' then 1 else 0 end,
      quizzes_completed=quizzes_completed+case when p_activity_type in ('quiz_completed','simulation_section_completed','simulation_full_completed') then 1 else 0 end,
      correct_answers=correct_answers+coalesce((p_metadata->>'correct')::int,0),
      total_answers=total_answers+coalesce((p_metadata->>'total')::int,0),
      study_minutes=study_minutes+greatest(coalesce((p_metadata->>'duration_seconds')::int,0),0)/60,
      last_activity_at=now(),updated_at=now()
  where user_id=v_user_id;

  if p_activity_type in ('simulation_section_completed','simulation_full_completed') then
    insert into public.user_notifications(user_id,title,body,kind,action_url)
    values(v_user_id,'Simulasi selesai','Hasil simulasi tersimpan. +'||v_allowed_points||' Poin dan +'||v_xp||' XP.','reward','/progress');
  end if;
  select * into v_result from public.user_learning_stats where user_id=v_user_id;
  return v_result;
end $$;
