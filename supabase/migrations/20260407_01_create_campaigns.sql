-- =====================================================
-- Bayaan Hub × Pay.nl — Phase 1
-- Create campaigns table
--
-- A campaign is a donation "cause" owned by a mosque. Phase 1 uses a loose
-- mosque_id uuid (no FK) because the `mosques` table lands in Phase 2 with
-- Alliance onboarding. When Alliance activates, we'll add the FK.
-- =====================================================

CREATE TABLE IF NOT EXISTS public.campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mosque_id uuid NOT NULL,
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  description text,
  goal_amount integer,                       -- cents
  cause_type text,                           -- 'zakat', 'sadaqah', 'renovation', etc.
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT campaigns_mosque_id_not_nil
    CHECK (mosque_id <> '00000000-0000-0000-0000-000000000000'::uuid)
);

-- Partial index: most queries filter by active campaigns for a mosque.
CREATE INDEX IF NOT EXISTS idx_campaigns_mosque_active
  ON public.campaigns(mosque_id, is_active)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_campaigns_slug
  ON public.campaigns(slug);

-- Row Level Security
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

-- Public can view ACTIVE campaigns only (anon + authenticated). This is the
-- only donor-facing read. All writes go through the service role.
CREATE POLICY "Public can view active campaigns"
  ON public.campaigns FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

-- No INSERT/UPDATE/DELETE policies → service role only.

-- updated_at trigger (reuses handle_updated_at() from auth schema migration)
CREATE TRIGGER campaigns_updated_at
  BEFORE UPDATE ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

COMMENT ON TABLE public.campaigns IS
  'Donation campaigns for mosques. Phase 1: single mosque per deployment. Phase 2: mosque_id becomes FK to mosques(id) when Alliance onboarding lands.';
COMMENT ON COLUMN public.campaigns.mosque_id IS
  'Phase 1: loose uuid. Phase 2: will become FK to mosques(id) once Alliance sub-merchant onboarding lands.';
COMMENT ON COLUMN public.campaigns.goal_amount IS
  'Optional donation goal in cents (integer).';
COMMENT ON COLUMN public.campaigns.cause_type IS
  'Free-text cause tag stored on every transaction as stats_extra2 for reporting.';
