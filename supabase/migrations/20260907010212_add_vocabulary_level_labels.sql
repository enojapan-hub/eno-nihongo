CREATE TABLE IF NOT EXISTS public.vocabulary_level_labels (
  vocabulary_id uuid NOT NULL REFERENCES public.vocabulary(id) ON DELETE CASCADE,
  level public.jlpt_level NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (vocabulary_id, level)
);

CREATE INDEX IF NOT EXISTS vocabulary_level_labels_level_idx ON public.vocabulary_level_labels(level, vocabulary_id);

ALTER TABLE public.vocabulary_level_labels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read vocabulary level labels" ON public.vocabulary_level_labels;
CREATE POLICY "Public can read vocabulary level labels"
ON public.vocabulary_level_labels FOR SELECT
USING (true);

INSERT INTO public.vocabulary_level_labels(vocabulary_id, level)
SELECT v.id, x.level::public.jlpt_level
FROM public.vocabulary v
CROSS JOIN LATERAL (
  SELECT DISTINCT v2.level::text AS level
  FROM public.vocabulary v2
  WHERE btrim(v2.term)=btrim(v.term)
    AND v2.is_published=true
) x
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.sync_vocabulary_level_labels()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.vocabulary_level_labels(vocabulary_id, level)
  SELECT v2.id, NEW.level
  FROM public.vocabulary v2
  WHERE btrim(v2.term)=btrim(NEW.term)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.vocabulary_level_labels(vocabulary_id, level)
  SELECT NEW.id, v2.level
  FROM public.vocabulary v2
  WHERE btrim(v2.term)=btrim(NEW.term)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_vocabulary_level_labels ON public.vocabulary;
CREATE TRIGGER trg_sync_vocabulary_level_labels
AFTER INSERT OR UPDATE OF term, level ON public.vocabulary
FOR EACH ROW EXECUTE FUNCTION public.sync_vocabulary_level_labels();
