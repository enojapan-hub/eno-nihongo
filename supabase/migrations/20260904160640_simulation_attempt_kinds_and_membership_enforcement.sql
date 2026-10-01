alter table public.quiz_attempts add column if not exists attempt_kind text not null default 'quiz';
DO $$ BEGIN
  alter table public.quiz_attempts add constraint quiz_attempts_attempt_kind_check check (attempt_kind in ('quiz','simulation_section','simulation_full','monthly_exam'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

create or replace function public.enforce_simulation_membership()
returns trigger language plpgsql security definer set search_path='pg_catalog,public' as $$
declare v_plan text; v_used int; begin
 if new.attempt_kind <> 'simulation_full' then return new; end if;
 select case when p.plan='lifetime' then 'lifetime' when p.plan='premium' and (p.premium_until is null or p.premium_until>now()) then 'premium' else 'free' end into v_plan from public.profiles p where p.id=new.user_id;
 if v_plan='free' then
   select count(*) into v_used from public.quiz_attempts q where q.user_id=new.user_id and q.attempt_kind='simulation_full' and q.completed_at >= (date_trunc('month',now() at time zone 'Asia/Tokyo') at time zone 'Asia/Tokyo');
   if v_used>=1 then raise exception 'Akun Free hanya dapat mengerjakan 1 simulasi penuh per bulan.'; end if;
 end if;
 if new.attempt_kind='monthly_exam' and v_plan='free' then raise exception 'ENO Monthly Exam hanya untuk Premium atau Lifetime.'; end if;
 return new;
end $$;
drop trigger if exists trg_enforce_simulation_membership on public.quiz_attempts;
create trigger trg_enforce_simulation_membership before insert on public.quiz_attempts for each row execute function public.enforce_simulation_membership();

create or replace function public.award_simulation_attempt_points()
returns trigger language plpgsql security definer set search_path='pg_catalog,public' as $$
declare v_points int; v_activity text; begin
 if new.attempt_kind not in ('simulation_section','simulation_full','monthly_exam') then return new; end if;
 if exists(select 1 from public.learning_activity where user_id=new.user_id and metadata->>'attempt_id'=new.id::text) then return new; end if;
 v_points:=case when new.attempt_kind='simulation_section' then least(40,greatest(10,new.total_questions)) when new.attempt_kind='simulation_full' then least(100,greatest(50,new.total_questions*2)) else least(150,greatest(75,new.total_questions*2)) end;
 v_activity:=case when new.attempt_kind='simulation_section' then 'simulation_section_completed' when new.attempt_kind='simulation_full' then 'simulation_full_completed' else 'monthly_exam_completed' end;
 insert into public.learning_activity(user_id,activity_type,points,xp,metadata) values(new.user_id,v_activity,v_points,0,jsonb_build_object('attempt_id',new.id::text,'level',new.level::text,'total',new.total_questions,'correct',new.correct_count,'duration_seconds',new.duration_seconds));
 insert into public.user_stats(user_id,reward_points) values(new.user_id,v_points) on conflict(user_id) do update set reward_points=public.user_stats.reward_points+v_points,updated_at=now();
 update public.user_learning_stats u set total_points=s.reward_points,updated_at=now() from public.user_stats s where u.user_id=new.user_id and s.user_id=new.user_id;
 insert into public.user_notifications(user_id,title,body,kind,action_url) values(new.user_id,case when new.attempt_kind='monthly_exam' then 'ENO Monthly Exam selesai' else 'Simulasi selesai' end,'Kamu mendapat +'||v_points||' Poin.','reward','/progress');
 return new;
end $$;
