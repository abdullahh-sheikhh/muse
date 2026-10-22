ALTER TABLE public.museums ADD COLUMN IF NOT EXISTS country text NOT NULL DEFAULT '';
UPDATE public.museums SET country = 'France' WHERE city IN ('Paris','Lyon') AND country = '';