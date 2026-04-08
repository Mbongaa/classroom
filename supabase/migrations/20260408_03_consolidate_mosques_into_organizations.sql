-- =====================================================
-- Bayaan Hub × Pay.nl — Consolidate mosques into organizations
--
-- The earlier Phase 2 migration introduced a parallel `mosques` tenant table
-- alongside the existing `organizations` table that already powers
-- classrooms, sessions, members and Stripe billing. That was a mistake:
-- one tenant concept, two tables. This migration consolidates everything
-- back onto `organizations`.
--
-- What this does:
--   1. Adds Pay.nl + donation-related columns to `organizations`
--   2. Wipes Pay.nl test data (safe — confirmed with the user)
--   3. Repoints `campaigns.mosque_id` → `campaigns.organization_id` with FK
--      to `organizations(id)`
--   4. Replaces all RLS policies that used `mosque_members` with equivalents
--      against `organization_members`
--   5. Drops the `mosques` and `mosque_members` tables
--
-- Stripe-side fields (`stripe_customer_id`, `stripe_subscription_id`,
-- `subscription_status`, `subscription_tier`, `current_period_end`) are
-- intentionally untouched. Pay.nl donation infrastructure and Stripe billing
-- are independent concerns.
-- =====================================================

-- ---------------------------------------------------------------------------
-- Step 1: Add Pay.nl + donation columns to organizations
-- ---------------------------------------------------------------------------

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS contact_email text,
  ADD COLUMN IF NOT EXISTS contact_phone text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS country text NOT NULL DEFAULT 'NL',
  ADD COLUMN IF NOT EXISTS bank_iban text,
  ADD COLUMN IF NOT EXISTS bank_account_holder text,
  ADD COLUMN IF NOT EXISTS paynl_service_id text,
  ADD COLUMN IF NOT EXISTS paynl_merchant_id text,
  ADD COLUMN IF NOT EXISTS paynl_secret text,
  ADD COLUMN IF NOT EXISTS platform_fee_bps integer NOT NULL DEFAULT 200,
  ADD COLUMN IF NOT EXISTS kyc_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS donations_active boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS onboarded_at timestamptz,
  ADD COLUMN IF NOT EXISTS thankyou_animation_id text;

-- Add CHECK constraints + UNIQUE indexes (separately so IF NOT EXISTS works)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'organizations_platform_fee_bps_check'
  ) THEN
    ALTER TABLE public.organizations
      ADD CONSTRAINT organizations_platform_fee_bps_check
      CHECK (platform_fee_bps >= 0 AND platform_fee_bps <= 10000);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'organizations_kyc_status_check'
  ) THEN
    ALTER TABLE public.organizations
      ADD CONSTRAINT organizations_kyc_status_check
      CHECK (kyc_status IN ('pending', 'submitted', 'approved', 'rejected'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS organizations_paynl_service_id_key
  ON public.organizations(paynl_service_id)
  WHERE paynl_service_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS organizations_paynl_merchant_id_key
  ON public.organizations(paynl_merchant_id)
  WHERE paynl_merchant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_organizations_kyc_status
  ON public.organizations(kyc_status);

CREATE INDEX IF NOT EXISTS idx_organizations_donations_active
  ON public.organizations(donations_active)
  WHERE donations_active = true;

COMMENT ON COLUMN public.organizations.paynl_service_id IS
  'Pay.nl SL-XXXX-XXXX. NULL until Alliance onboarding completes; donation routes then fall back to PAYNL_SERVICE_ID env var.';
COMMENT ON COLUMN public.organizations.paynl_secret IS
  'Per-org Pay.nl API auth secret. Phase 2.5 must encrypt at rest with pgcrypto.';
COMMENT ON COLUMN public.organizations.platform_fee_bps IS
  'Bayaan Hub commission in basis points (200 = 2.00%). Deducted via Merchant:AddInvoice after each successful donation.';
COMMENT ON COLUMN public.organizations.kyc_status IS
  'Pay.nl KYC: pending → submitted → approved | rejected. Independent from subscription_tier (Stripe).';
COMMENT ON COLUMN public.organizations.donations_active IS
  'Pay.nl donation feature flag. Independent from organizations.subscription_status (Stripe).';
COMMENT ON COLUMN public.organizations.thankyou_animation_id IS
  'Slug from THANK_YOU_ANIMATIONS catalog (lib/thankyou-animations.ts). NULL = use default. Org admins can change this from /mosque-admin/[slug]/settings.';

-- ---------------------------------------------------------------------------
-- Step 2: Wipe Pay.nl test data (FK-safe order)
-- ---------------------------------------------------------------------------
-- Confirmed with the user: the existing 8 transactions, 1 mandate,
-- 1 direct_debit, 44 exchange_events, and 1 campaign are all sandbox test
-- data with no real-world value. Wiping them lets us cleanly repoint
-- campaigns.mosque_id without backfilling mosque rows.

DELETE FROM public.exchange_events;
DELETE FROM public.direct_debits;
DELETE FROM public.transactions;
DELETE FROM public.mandates;
DELETE FROM public.campaigns;

-- ---------------------------------------------------------------------------
-- Step 3: Drop old mosque-based RLS policies on shared tables
-- ---------------------------------------------------------------------------
-- These reference public.mosque_members which we are about to drop.

DROP POLICY IF EXISTS "Mosque members can view their campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Mosque admins can create campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Mosque admins can update their campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Mosque admins can delete their campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Mosque members can view their transactions" ON public.transactions;
DROP POLICY IF EXISTS "Mosque members can view their mandates" ON public.mandates;
DROP POLICY IF EXISTS "Mosque members can view their direct debits" ON public.direct_debits;

-- ---------------------------------------------------------------------------
-- Step 4: Repoint campaigns.mosque_id → campaigns.organization_id
-- ---------------------------------------------------------------------------

-- Drop the FK created by 20260408_02 before renaming the column
ALTER TABLE public.campaigns
  DROP CONSTRAINT IF EXISTS campaigns_mosque_id_fkey;

-- Drop the Phase 1 not-nil check too — we'll re-add it on the renamed column
ALTER TABLE public.campaigns
  DROP CONSTRAINT IF EXISTS campaigns_mosque_id_not_nil;

-- Drop the partial index that referenced the old column name
DROP INDEX IF EXISTS public.idx_campaigns_mosque_active;

ALTER TABLE public.campaigns
  RENAME COLUMN mosque_id TO organization_id;

ALTER TABLE public.campaigns
  ADD CONSTRAINT campaigns_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE RESTRICT;

ALTER TABLE public.campaigns
  ADD CONSTRAINT campaigns_organization_id_not_nil
  CHECK (organization_id <> '00000000-0000-0000-0000-000000000000'::uuid);

CREATE INDEX IF NOT EXISTS idx_campaigns_organization_active
  ON public.campaigns(organization_id, is_active)
  WHERE is_active = true;

COMMENT ON COLUMN public.campaigns.organization_id IS
  'FK to organizations(id). Cascade is RESTRICT so an organization with campaigns cannot be deleted.';

-- ---------------------------------------------------------------------------
-- Step 5: Re-create RLS policies against organization_members
-- ---------------------------------------------------------------------------
-- organization_members.role enum is ('admin', 'teacher', 'student').
-- Mapping: admin → full control, teacher → can manage campaigns, student → read-only.

CREATE POLICY "Org members can view their campaigns"
  ON public.campaigns FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Org admins can create campaigns"
  ON public.campaigns FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'teacher')
    )
  );

CREATE POLICY "Org admins can update their campaigns"
  ON public.campaigns FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'teacher')
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'teacher')
    )
  );

CREATE POLICY "Org admins can delete their campaigns"
  ON public.campaigns FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Org members can view their transactions"
  ON public.transactions FOR SELECT
  TO authenticated
  USING (
    campaign_id IN (
      SELECT c.id
      FROM public.campaigns c
      WHERE c.organization_id IN (
        SELECT organization_id FROM public.organization_members
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Org members can view their mandates"
  ON public.mandates FOR SELECT
  TO authenticated
  USING (
    campaign_id IN (
      SELECT c.id
      FROM public.campaigns c
      WHERE c.organization_id IN (
        SELECT organization_id FROM public.organization_members
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Org members can view their direct debits"
  ON public.direct_debits FOR SELECT
  TO authenticated
  USING (
    mandate_id IN (
      SELECT m.id
      FROM public.mandates m
      WHERE m.campaign_id IN (
        SELECT c.id
        FROM public.campaigns c
        WHERE c.organization_id IN (
          SELECT organization_id FROM public.organization_members
          WHERE user_id = auth.uid()
        )
      )
    )
  );

-- ---------------------------------------------------------------------------
-- Step 6: Public read for donation-active organizations
-- ---------------------------------------------------------------------------
-- The public donate page and thank-you page need to fetch the org by slug
-- as anon. We add this as an additive policy alongside the existing
-- "Users view their organization" policy so members still see their orgs.

CREATE POLICY "Public can view donation-active organizations"
  ON public.organizations FOR SELECT
  TO anon, authenticated
  USING (donations_active = true);

-- ---------------------------------------------------------------------------
-- Step 7: Drop the parallel mosque tables
-- ---------------------------------------------------------------------------
-- mosque_members has 0 rows, mosques has 1 row (mosque-0e807aa0). Both
-- safe to drop since we wiped the dependent campaign data above.

DROP TABLE IF EXISTS public.mosque_members CASCADE;
DROP TABLE IF EXISTS public.mosques CASCADE;
