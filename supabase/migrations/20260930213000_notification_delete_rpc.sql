create or replace function public.delete_my_notification(p_notification_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  delete from public.user_notifications where id = p_notification_id and user_id = v_uid;
  return found;
end;
$$;

revoke all on function public.delete_my_notification(uuid) from public, anon;
grant execute on function public.delete_my_notification(uuid) to authenticated;
