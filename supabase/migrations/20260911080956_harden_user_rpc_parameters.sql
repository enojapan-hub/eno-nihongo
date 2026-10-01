create or replace function public.is_premium(p_user_id uuid default auth.uid()) returns boolean language sql stable security definer set search_path to 'pg_catalog, public, auth' as $$ select case when auth.uid() is null or p_user_id is distinct from auth.uid() then false else exists(select 1 from public.profiles p where p.id=auth.uid() and (p.plan in ('premium','lifetime') or p.premium_until>now())) end; $$;

create or replace function public.record_learning_activity(p_activity_type text,p_points integer default 0,p_xp integer default 0,p_metadata jsonb default '{}'::jsonb) returns public.user_learning_stats language plpgsql security definer set search_path to 'pg_catalog,public,auth' as $$
declare v_user_id uuid:=auth.uid(); v_allowed_points int:=0; v_xp int:=least(greatest(coalesce(p_xp,0),0),500); v_result public.user_learning_stats; v_today date:=current_date; v_last date; v_streak int;
begin
 if v_user_id is null then raise exception 'User belum login'; end if;
 if p_activity_type not in ('lesson_completed','quiz_completed','quiz_answered','daily_target_completed','simulation_section_completed','simulation_full_completed') then raise exception 'invalid_activity_type'; end if;
 if p_activity_type in ('daily_target_completed','simulation_section_completed','simulation_full_completed') then v_allowed_points:=least(greatest(coalesce(p_points,0),0),1000); end if;
 insert into public.learning_activity(user_id,activity_type,points,xp,metadata) values(v_user_id,p_activity_type,v_allowed_points,v_xp,coalesce(p_metadata,'{}'::jsonb));
 insert into public.user_stats(user_id) values(v_user_id) on conflict(user_id) do nothing;
 select last_activity_date,current_streak into v_last,v_streak from public.user_stats where user_id=v_user_id for update;
 if v_last=v_today then v_streak:=coalesce(v_streak,0); elsif v_last=v_today-1 then v_streak:=coalesce(v_streak,0)+1; else v_streak:=1; end if;
 update public.user_stats set total_xp=total_xp+v_xp,reward_points=reward_points+v_allowed_points,current_streak=v_streak,longest_streak=greatest(longest_streak,v_streak),last_activity_date=v_today,updated_at=now() where user_id=v_user_id;
 update public.user_learning_stats set lessons_completed=lessons_completed+case when p_activity_type='lesson_completed' then 1 else 0 end,quizzes_completed=quizzes_completed+case when p_activity_type in ('quiz_completed','simulation_section_completed','simulation_full_completed') then 1 else 0 end,correct_answers=correct_answers+coalesce((p_metadata->>'correct')::int,0),total_answers=total_answers+coalesce((p_metadata->>'total')::int,0),study_minutes=study_minutes+greatest(coalesce((p_metadata->>'duration_seconds')::int,0),0)/60,last_activity_at=now(),updated_at=now() where user_id=v_user_id;
 select * into v_result from public.user_learning_stats where user_id=v_user_id; return v_result;
end $$;
