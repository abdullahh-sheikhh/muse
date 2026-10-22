CREATE TABLE public.museums (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  intro text NOT NULL DEFAULT '',
  source_language text NOT NULL DEFAULT 'fr',
  languages text[] NOT NULL DEFAULT '{fr,en}',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.museums TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.museums TO authenticated;
GRANT ALL ON public.museums TO service_role;
ALTER TABLE public.museums ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view museums" ON public.museums FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Owners insert museums" ON public.museums FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Owners update museums" ON public.museums FOR UPDATE TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Owners delete museums" ON public.museums FOR DELETE TO authenticated USING (owner_id = auth.uid());

CREATE OR REPLACE FUNCTION public.owns_museum(_museum_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.museums WHERE id = _museum_id AND owner_id = auth.uid())
$$;

CREATE TABLE public.stops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  museum_id uuid NOT NULL REFERENCES public.museums(id) ON DELETE CASCADE,
  number int NOT NULL,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (museum_id, number)
);
GRANT SELECT ON public.stops TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stops TO authenticated;
GRANT ALL ON public.stops TO service_role;
ALTER TABLE public.stops ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view stops" ON public.stops FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Owners insert stops" ON public.stops FOR INSERT TO authenticated WITH CHECK (public.owns_museum(museum_id));
CREATE POLICY "Owners update stops" ON public.stops FOR UPDATE TO authenticated USING (public.owns_museum(museum_id)) WITH CHECK (public.owns_museum(museum_id));
CREATE POLICY "Owners delete stops" ON public.stops FOR DELETE TO authenticated USING (public.owns_museum(museum_id));

CREATE TABLE public.stop_audio (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stop_id uuid NOT NULL REFERENCES public.stops(id) ON DELETE CASCADE,
  museum_id uuid NOT NULL REFERENCES public.museums(id) ON DELETE CASCADE,
  language text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  audio_url text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (stop_id, language)
);
GRANT SELECT ON public.stop_audio TO anon;
GRANT SELECT, DELETE ON public.stop_audio TO authenticated;
GRANT ALL ON public.stop_audio TO service_role;
ALTER TABLE public.stop_audio ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view audio" ON public.stop_audio FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Owners delete audio" ON public.stop_audio FOR DELETE TO authenticated USING (public.owns_museum(museum_id));