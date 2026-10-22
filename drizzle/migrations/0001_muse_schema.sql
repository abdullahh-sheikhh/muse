-- Extend museums for Muse (visitor app)
ALTER TABLE public.museums
  ADD COLUMN city text NOT NULL DEFAULT '',
  ADD COLUMN lat double precision,
  ADD COLUMN lng double precision,
  ADD COLUMN image_url text,
  ADD COLUMN is_partner boolean NOT NULL DEFAULT false,
  ADD COLUMN ref_label text NOT NULL DEFAULT 'Inventory no.';

-- Visitor profiles (anonymous auth users)
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  preferred_language text NOT NULL DEFAULT 'en',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own profile" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- Artworks
CREATE TABLE public.artifacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  museum_id uuid NOT NULL REFERENCES public.museums(id) ON DELETE CASCADE,
  ref text NOT NULL,
  title text NOT NULL,
  artist text NOT NULL DEFAULT '',
  year text NOT NULL DEFAULT '',
  room text NOT NULL DEFAULT '',
  image_url text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (museum_id, ref)
);
GRANT SELECT ON public.artifacts TO anon, authenticated;
GRANT ALL ON public.artifacts TO service_role;
ALTER TABLE public.artifacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view artifacts" ON public.artifacts FOR SELECT TO anon, authenticated USING (true);

-- Downloadable audio packs (partner museums)
CREATE TABLE public.audio_packs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  museum_id uuid NOT NULL REFERENCES public.museums(id) ON DELETE CASCADE,
  language text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  manifest jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (museum_id, language)
);
GRANT SELECT ON public.audio_packs TO anon, authenticated;
GRANT ALL ON public.audio_packs TO service_role;
ALTER TABLE public.audio_packs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view audio packs" ON public.audio_packs FOR SELECT TO anon, authenticated USING (true);

-- Sources / facts per artwork
CREATE TABLE public.artwork_facts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artwork_id uuid NOT NULL REFERENCES public.artifacts(id) ON DELETE CASCADE,
  label text NOT NULL,
  source_url text,
  sort_order integer NOT NULL DEFAULT 0
);
GRANT SELECT ON public.artwork_facts TO anon, authenticated;
GRANT ALL ON public.artwork_facts TO service_role;
ALTER TABLE public.artwork_facts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view artwork facts" ON public.artwork_facts FOR SELECT TO anon, authenticated USING (true);

-- Analytics events
CREATE TABLE public.visit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  museum_id uuid REFERENCES public.museums(id) ON DELETE CASCADE,
  artwork_id uuid REFERENCES public.artifacts(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  visitor_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.visit_events TO anon, authenticated;
GRANT ALL ON public.visit_events TO service_role;
ALTER TABLE public.visit_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can log visit events" ON public.visit_events FOR INSERT TO anon, authenticated WITH CHECK (true);

-- Nearby museums RPC (haversine, radius in km)
CREATE OR REPLACE FUNCTION public.nearby_museums(_lat double precision, _lng double precision, _radius_km double precision DEFAULT 25)
RETURNS TABLE (id uuid, name text, slug text, city text, image_url text, is_partner boolean, distance_km double precision)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT * FROM (
    SELECT m.id, m.name, m.slug, m.city, m.image_url, m.is_partner,
      (6371 * acos(least(1, cos(radians(_lat)) * cos(radians(m.lat)) * cos(radians(m.lng) - radians(_lng)) + sin(radians(_lat)) * sin(radians(m.lat))))) AS distance_km
    FROM public.museums m
    WHERE m.lat IS NOT NULL AND m.lng IS NOT NULL
  ) s
  WHERE s.distance_km <= _radius_km
  ORDER BY s.distance_km;
$$;
GRANT EXECUTE ON FUNCTION public.nearby_museums(double precision, double precision, double precision) TO anon, authenticated;

-- Lookup an artwork by its printed ref number
CREATE OR REPLACE FUNCTION public.lookup_artifact(_slug text, _ref text)
RETURNS TABLE (museum_slug text, artifact_ref text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT m.slug, a.ref
  FROM public.artifacts a
  JOIN public.museums m ON m.id = a.museum_id
  WHERE m.slug = _slug AND lower(a.ref) = lower(btrim(_ref))
  LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.lookup_artifact(text, text) TO anon, authenticated;

-- Demo content so the app has something to show
INSERT INTO public.museums (id, owner_id, name, slug, intro, city, lat, lng, is_partner, ref_label) VALUES
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Musée Lumière', 'musee-lumiere', 'A journey through light in painting, from the Impressionists to today.', 'Paris', 48.8606, 2.3376, true, 'Inventory no.'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Galerie Saint-Roch', 'galerie-saint-roch', 'Sacred art and sculpture across five centuries.', 'Paris', 48.8630, 2.3320, false, 'Catalogue no.'),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'Maison des Brumes', 'maison-des-brumes', 'Photography and mist: a century of atmospheric images.', 'Lyon', 45.7640, 4.8357, true, 'Plate no.');

INSERT INTO public.artifacts (museum_id, ref, title, artist, year, room, sort_order) VALUES
  ('10000000-0000-0000-0000-000000000001', 'INV-001', 'Morning Fog over the Seine', 'Claire Vautrin', '1874', 'Room 1', 1),
  ('10000000-0000-0000-0000-000000000001', 'INV-002', 'The Glass Choir', 'Henri Ballu', '1889', 'Room 1', 2),
  ('10000000-0000-0000-0000-000000000001', 'INV-003', 'Sunstudy No. 7', 'Mara Ilsen', '1922', 'Room 2', 3),
  ('10000000-0000-0000-0000-000000000002', 'CAT-12', 'Madonna of the Rose Hedge', 'Atelier de Colmar', '1473', 'Chapel', 1),
  ('10000000-0000-0000-0000-000000000002', 'CAT-13', 'Saint Roch and the Dog', 'Unknown master', '1520', 'Nave', 2),
  ('10000000-0000-0000-0000-000000000003', 'PL-01', 'Bridge in the Mist', 'Sonia Delaunay-Roche', '1931', 'Gallery A', 1);

INSERT INTO public.audio_packs (museum_id, language, status, manifest) VALUES
  ('10000000-0000-0000-0000-000000000001', 'fr', 'ready', '[]'::jsonb),
  ('10000000-0000-0000-0000-000000000001', 'en', 'ready', '[]'::jsonb),
  ('10000000-0000-0000-0000-000000000003', 'fr', 'ready', '[]'::jsonb);

INSERT INTO public.artwork_facts (artwork_id, label, source_url, sort_order)
SELECT a.id, v.label, v.source_url, v.sort_order
FROM public.artifacts a
JOIN (VALUES
  ('INV-001', 'Painted en plein air during the artist''s first Paris winter.', 'https://example.org/vautrin-notes', 1),
  ('INV-001', 'Acquired by the museum in 1911 from the artist''s estate.', NULL, 2),
  ('CAT-12', 'One of the earliest panel paintings in the collection.', 'https://example.org/colmar-archive', 1)
) AS v(ref, label, source_url, sort_order) ON a.ref = v.ref;