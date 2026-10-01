revoke execute on function public.get_admin_overview() from public, anon, authenticated;
grant execute on function public.get_admin_overview() to service_role;
