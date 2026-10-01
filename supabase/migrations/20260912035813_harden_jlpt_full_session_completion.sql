revoke all on function public.complete_jlpt_simulation_full(uuid,integer,boolean) from authenticated;
comment on function public.complete_jlpt_simulation_full(uuid,integer,boolean) is 'Internal only until full-session attempts are linked and score is computed server-side; never expose client-supplied score/pass.';
