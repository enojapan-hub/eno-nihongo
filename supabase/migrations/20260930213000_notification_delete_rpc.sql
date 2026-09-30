create or replace function public.delete_my_notification(p_notification_id uuid)
returns boolean language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  delete from public.user_notifications where id=p_notification_id and user_id=auth.uid();
  return found;
end;
$$;

create or replace function public.delete_my_read_notifications()
returns integer language plpgsql security definer set search_path = ''
as $$
declare v_count integer;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  delete from public.user_notifications where user_id=auth.uid() and read_at is not null;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.delete_my_notification(uuid) from public, anon;
revoke all on function public.delete_my_read_notifications() from public, anon;
grant execute on function public.delete_my_notification(uuid) to authenticated;
grant execute on function public.delete_my_read_notifications() to authenticated;
