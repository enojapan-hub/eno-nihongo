-- 20260929011535_jlpt_simulation_exam_no_support.sql replaced
-- get_published_simulation_questions(text, text) with a 3-argument version whose p_exam_no
-- defaults to 1, but the live database still carries the old 2-argument overload. A call that
-- passes only p_level and p_section matches both, so PostgREST answers HTTP 300 (PGRST203) and
-- the single-section simulation page cannot load its questions.
--
-- The 3-argument function keeps the same call surface through its default, so dropping the old
-- overload is behaviour-preserving. No-op where the overload is already gone.
drop function if exists public.get_published_simulation_questions(text, text);
