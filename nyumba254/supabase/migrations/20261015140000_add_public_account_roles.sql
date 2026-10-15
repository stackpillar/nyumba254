ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS public_roles text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_public_roles_allowed
  CHECK (public_roles <@ ARRAY['caretaker', 'agent', 'landlord', 'seller', 'buyer']::text[]);
