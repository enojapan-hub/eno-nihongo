revoke execute on function public.get_competition_leaderboard(text,integer) from public, anon;
grant execute on function public.get_competition_leaderboard(text,integer) to authenticated;
revoke execute on function public.get_leaderboard(integer) from public, anon;
grant execute on function public.get_leaderboard(integer) to authenticated;
