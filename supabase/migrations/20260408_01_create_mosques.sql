-- =====================================================
-- Bayaan Hub × Pay.nl — Phase 2
-- Create mosques + mosque_members tables
--
-- Phase 2 introduces multi-tenant donation routing. Each mosque becomes a
-- Pay.nl sub-merchant (Alliance API) with their own SL-XXXX-XXXX serviceId.
-- Donations flow into the mosque's own Pay.nl wallet; Bayaan Hub deducts a
-- platform fee via Merchant:AddInvoice.
--
-- Backwards-compatibility with Phase 1: when a mosque's paynl_service_id is
-- NULL, the donation routes fall back to PAYNL_SERVICE_ID env var. This lets
-- the existing single-sales-location flow keep working until Alliance is
-- fully wired up.
-- =====================================================

-- ---------------------------------------------------------------------------
-- mosques — first-class tenant entity
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.mosques (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,

  -- Contact / location
  contact_email text,
  contact_phone text,
  city text,
  country text NOT NULL DEFAULT 'NL',

  -- Bank account where settlements are paid out
  bank_iban text,
  bank_account_holder text,

  -- Pay.nl Alliance sub-merchant fields. These stay NULL until the mosque
  -- has been onboarded via the Alliance API. NULL paynl_service_id signals
  -- "fall back to PAYNL_SERVICE_ID env var" to the donation routes.
  paynl_service_id text UNIQUE,
  paynl_merchant_id text UNIQUE,
  paynl_secret text,                                -- TODO Phase 2.5: encrypt at rest

  -- Bayaan Hub commission (basis points = % * 100, so 200 = 2.00%)
  platform_fee_bps integer NOT NULL DEFAULT 200
    CHECK (platform_fee_bps >= 0 AND platform_fee_bps <= 10000),

  -- KYC lifecycle for Alliance onboarding
  kyc_status text NOT NULL DEFAULT 'pending'
    CHECK (kyc_status IN ('pending', 'submitted', 'approved', 'rejected')),

  is_active boolean NOT NULL DEFAULT false,
  onboarded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mosques_slug ON public.mosques(slug);
CREATE INDEX IF NOT EXISTS idx_mosques_active
  ON public.mosques(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_mosques_paynl_service
  ON public.mosques(paynl_service_id) WHERE paynl_service_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mosques_kyc_status ON public.mosques(kyc_status);

ALTER TABLE public.mosques ENABLE ROW LEVEL SECURITY;

-- Public can view ACTIVE mosques (needed for /donate/[mosque]/[campaign]
-- to resolve mosque branding without auth).
CREATE POLICY "Public can view active mosques"
  ON public.mosques FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

-- Authenticated users can view a mosque if they're a member.
CREATE POLICY "Members can view their mosques"
  ON public.mosques FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT mosque_id FROM public.mosque_members WHERE user_id = auth.uid()
    )
  );

-- All writes go through the service role (mosque admin API endpoints).
-- Phase 2.5 will add scoped UPDATE policies for mosque admins on their
-- own row (description, contact info, branding).

CREATE TRIGGER mosques_updated_at
  BEFORE UPDATE ON public.mosques
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

COMMENT ON TABLE public.mosques IS
  'First-class tenant entity. Each mosque is a Pay.nl sub-merchant when Alliance is active.';
COMMENT ON COLUMN public.mosques.paynl_service_id IS
  'Pay.nl SL-XXXX-XXXX. NULL until Alliance onboarding completes; donation routes then fall back to PAYNL_SERVICE_ID env var.';
COMMENT ON COLUMN public.mosques.paynl_secret IS
  'Per-mosque API auth secret. Phase 2.5 must encrypt at rest with pgcrypto.';
COMMENT ON COLUMN public.mosques.platform_fee_bps IS
  'Bayaan Hub commission in basis points (200 = 2.00%). Deducted via Merchant:AddInvoice after each successful donation.';
COMMENT ON COLUMN public.mosques.kyc_status IS
  'pending (created, no docs yet) → submitted (docs uploaded) → approved (Alliance call succeeded, is_active flipped true) | rejected.';

-- ---------------------------------------------------------------------------
-- mosque_members — user ↔ mosque relationships with role
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.mosque_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mosque_id uuid NOT NULL REFERENCES public.mosques(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('admin', 'manager', 'viewer')),
  invited_by uuid REFERENCES public.profiles(id),
  joined_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE(mosque_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_mosque_members_mosque ON public.mosque_members(mosque_id);
CREATE INDEX IF NOT EXISTS idx_mosque_members_user ON public.mosque_members(user_id);

ALTER TABLE public.mosque_members ENABLE ROW LEVEL SECURITY;

-- A user can see all member rows for any mosque they belong to.
CREATE POLICY "Members can view their mosque membership"
  ON public.mosque_members FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR mosque_id IN (
      SELECT mosque_id FROM public.mosque_members WHERE user_id = auth.uid()
    )
  );

-- Mosque admins can add new members to their mosque.
CREATE POLICY "Mosque admins can invite members"
  ON public.mosque_members FOR INSERT
  TO authenticated
  WITH CHECK (
    mosque_id IN (
      SELECT mosque_id FROM public.mosque_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Mosque admins can remove members from their mosque.
CREATE POLICY "Mosque admins can remove members"
  ON public.mosque_members FOR DELETE
  TO authenticated
  USING (
    mosque_id IN (
      SELECT mosque_id FROM public.mosque_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

COMMENT ON TABLE public.mosque_members IS
  'Links users to mosques with a scoped role. A user can belong to multiple mosques.';
COMMENT ON COLUMN public.mosque_members.role IS
  'admin: full control + can invite. manager: campaigns + donations read/write. viewer: read-only dashboard.';

-- ---------------------------------------------------------------------------
-- Backfill: create one mosque row for every distinct mosque_id already
-- present in campaigns. This preserves the existing Phase 1 data without
-- breaking the FK we add in the next migration.
-- ---------------------------------------------------------------------------
INSERT INTO public.mosques (id, slug, name, paynl_service_id, is_active, kyc_status, onboarded_at)
SELECT DISTINCT
  c.mosque_id,
  'mosque-' || substring(c.mosque_id::text from 1 for 8),
  'Mosque ' || substring(c.mosque_id::text from 1 for 8),
  NULL,                                  -- falls back to PAYNL_SERVICE_ID env var
  true,                                  -- existing campaigns are active by definition
  'approved',                            -- Phase 1 sandbox = grandfathered
  now()
FROM public.campaigns c
WHERE c.mosque_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.mosques m WHERE m.id = c.mosque_id)
ON CONFLICT (id) DO NOTHING;
