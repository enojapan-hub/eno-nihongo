create or replace function public.can_start_full_simulation()
returns jsonb language plpgsql security definer set search_path='pg_catalog,public,auth' as $$
declare p public.profiles; v_plan text; v_used int; begin
 if auth.uid() is null then raise exception 'not authenticated'; end if;
 select * into p from public.profiles where id=auth.uid();
 v_plan:=case when p.plan='lifetime' then 'lifetime' when p.plan='premium' and (p.premium_until is null or p.premium_until>now()) then 'premium' else 'free' end;
 select count(*) into v_used from public.quiz_attempts where user_id=auth.uid() and attempt_kind='simulation_full' and completed_at >= (date_trunc('month',now() at time zone 'Asia/Tokyo') at time zone 'Asia/Tokyo');
 return jsonb_build_object('allowed',v_plan in ('premium','lifetime') or v_used<1,'plan',v_plan,'used_this_month',v_used,'monthly_limit',case when v_plan='free' then 1 else null end,'monthly_exam',v_plan in ('premium','lifetime'));
end $$;
