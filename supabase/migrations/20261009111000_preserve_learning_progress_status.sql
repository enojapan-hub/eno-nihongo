-- Prevent initial learning from being prematurely marked mastered.
CREATE OR REPLACE FUNCTION public.force_mastered_progress()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO pg_catalog, public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
