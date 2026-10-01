create or replace function public.admin_update_user_access(p_user_id uuid, p_role text default null, p_plan text default null)
returns jsonb
language plpgsql
security definer
set search_path = 'pg_catalog,public,auth'
as $$
declare
 v_caller_role text;
 v_target_role text;
begin
 if auth.uid() is null then raise exception 'not authenticated'; end if;
 select role into v_caller_role from public.profiles where id=auth.uid();
 if coalesce(v_caller_role,'student') not in ('admin','owner') then raise exception 'forbidden'; end if;
 select role into v_target_role from public.profiles where id=p_user_id;
 if v_target_role is null then raise exception 'user not found'; end if;
 if p_role is not null and p_role not in ('student','teacher','admin','owner') then raise exception 'invalid role'; end if;
 if p_plan is not null and p_plan not in ('free','premium','lifetime') then raise exception 'invalid plan'; end if;
 if p_role='owner' and v_caller_role<>'owner' then raise exception 'only owner can assign owner'; end if;
 if v_target_role='owner' and v_caller_role<>'owner' then raise exception 'only owner can modify owner'; end if;
 if p_user_id=auth.uid() and p_role is not null and p_role not in ('admin','owner') then raise exception 'cannot remove own admin access'; end if;
 update public.profiles set role=coalesce(p_role,role),plan=coalesce(p_plan,plan),updated_at=now() where id=p_user_id;
 return jsonb_build_object('ok',true,'role',coalesce(p_role,v_target_role));
end $$;
revoke all on function public.admin_update_user_access(uuid,text,text) from public, anon;
grant execute on function public.admin_update_user_access(uuid,text,text) to authenticated;

create or replace function public.get_teacher_console_data()
returns jsonb
language plpgsql
security definer
set search_path = 'pg_catalog,public,auth'
as $$
declare v_role text;
begin
 if auth.uid() is null then raise exception 'not authenticated'; end if;
 select role into v_role from public.profiles where id=auth.uid();
 if coalesce(v_role,'student') not in ('teacher','admin','owner') then raise exception 'forbidden'; end if;
 return jsonb_build_object('role',v_role,'can_manage_learning_content',true);
end $$;
revoke all on function public.get_teacher_console_data() from public, anon;
grant execute on function public.get_teacher_console_data() to authenticated;
