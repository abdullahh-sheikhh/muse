ALTER TABLE public.artifacts ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT '';
ALTER TABLE public.artwork_facts ADD COLUMN IF NOT EXISTS source_title text;
CREATE TABLE public.artwork_guides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artwork_id uuid NOT NULL REFERENCES public.artifacts(id) ON DELETE CASCADE,
  language text NOT NULL,
  script_text text NOT NULL,
  audio_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (artwork_id, language)
);
GRANT SELECT ON public.artwork_guides TO anon, authenticated;
GRANT ALL ON public.artwork_guides TO service_role;
ALTER TABLE public.artwork_guides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Guides are readable by everyone" ON public.artwork_guides FOR SELECT TO anon, authenticated USING (true);