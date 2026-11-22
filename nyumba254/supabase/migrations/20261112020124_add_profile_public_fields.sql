ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS display_name text,
  ADD COLUMN IF NOT EXISTS areas_covered text[],
  ADD COLUMN IF NOT EXISTS avatar_url text;
