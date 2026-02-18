-- Add superadmin column to profiles table
-- This is a platform-level concept, separate from org-level roles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_superadmin BOOLEAN NOT NULL DEFAULT false;

-- Partial index for fast superadmin lookups (only indexes rows where true)
CREATE INDEX IF NOT EXISTS idx_profiles_is_superadmin
ON public.profiles(is_superadmin) WHERE is_superadmin = true;

-- To promote first superadmin:
-- UPDATE public.profiles SET is_superadmin = true WHERE id = '<user-uuid>';
