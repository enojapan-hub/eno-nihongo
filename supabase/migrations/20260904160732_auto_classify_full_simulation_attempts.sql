create or replace function public.enforce_simulation_membership()
returns trigger language plpgsql security definer set search_path='pg_catalog,public' as $$
declare v_plan text; v_used int; begin
 if new.attempt_kind='quiz' and new.quiz_id is null and new.level is not null then new.attempt_kind:='simulation_full'; end if;
 select case when p.plan='lifetime' then 'lifetime' when p.plan='premium' and (p.premium_until is null or p.premium_until>now()) then 'premium' else 'free' end into v_plan from public.profiles p where p.id=new.user_id;
 if new.attempt_kind='simulation_full' and v_plan='free' then
   select count(*) into v_used from public.quiz_attempts q where q.user_id=new.user_id and q.attempt_kind='simulation_full' and q.completed_at >= (date_trunc('month',now() at time zone 'Asia/Tokyo') at time zone 'Asia/Tokyo');
   if v_used>=1 then raise exception 'Akun Free hanya dapat mengerjakan 1 simulasi penuh per bulan.'; end if;
 end if;
 if new.attempt_kind='monthly_exam' and v_plan='free' then raise exception 'ENO Monthly Exam hanya untuk Premium atau Lifetime.'; end if;
 return new;
end $$;
