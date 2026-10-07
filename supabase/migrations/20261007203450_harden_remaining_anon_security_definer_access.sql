revoke execute on function public.apply_pending_user_invitation() from public, anon, authenticated;
grant execute on function public.apply_pending_user_invitation() to service_role;

revoke execute on function public.get_vocabulary_lexical_rows(public.jlpt_level) from public, anon;
grant execute on function public.get_vocabulary_lexical_rows(public.jlpt_level) to authenticated, service_role;
