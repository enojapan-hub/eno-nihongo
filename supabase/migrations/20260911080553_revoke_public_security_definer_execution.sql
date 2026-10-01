revoke execute on function public.get_target_page_metrics() from public;
revoke execute on function public.sync_vocabulary_level_labels() from public;
grant execute on function public.get_target_page_metrics() to authenticated, service_role;
grant execute on function public.sync_vocabulary_level_labels() to service_role;
