-- =====================================================
-- Bayaan Hub × Pay.nl — Phase 2
-- Link campaigns → mosques and add mosque-admin RLS policies
--
-- After the previous migration created the mosques table and backfilled
-- rows for every distinct mosque_id in campaigns, we can safely add the
-- foreign key and the RLS policies that gate reads to mosque members.
--
-- Ordering matters: these ALTER/POLICY statements assume mosques exist.
-- Run 20260408_01_create_mosques.sql BEFORE this file.
-- =====================================================

-- ---------------------------------------------------------------------------
-- Foreign key: campaigns.mosque_id → mosques.id
-- ---------------------------------------------------------------------------

-- Drop the Phase 1 "not-nil" check constraint since the FK now enforces
-- validity more strictly.
ALTER TABLE public.campaigns
  DROP CONSTRAINT IF EXISTS campaigns_mosque_id_not_nil;

ALTER TABLE public.campaigns
  ADD CONSTRAINT campaigns_mosque_id_fkey
  FOREIGN KEY (mosque_id) REFERENCES public.mosques(id) ON DELETE RESTRICT;

COMMENT ON COLUMN public.campaigns.mosque_id IS
  'Phase 2: FK to mosques(id). Cascade is RESTRICT so a mosque with campaigns cannot be deleted.';

-- ---------------------------------------------------------------------------
-- Campaign RLS: mosque admins/managers can CRUD their own campaigns
-- ---------------------------------------------------------------------------

-- The Phase 1 "Public can view active campaigns" policy stays in place for
-- the donor-facing donate page. We ADD authenticated-side policies on top.

CREATE POLICY "Mosque members can view their campaigns"
  ON public.campaigns FOR SELECT
  TO authenticated
  USING (
    mosque_id IN (
      SELECT mosque_id FROM public.mosque_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Mosque admins can create campaigns"
  ON public.campaigns FOR INSERT
  TO authenticated
  WITH CHECK (
    mosque_id IN (
      SELECT mosque_id FROM public.mosque_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Mosque admins can update their campaigns"
  ON public.campaigns FOR UPDATE
  TO authenticated
  USING (
    mosque_id IN (
      SELECT mosque_id FROM public.mosque_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'manager')
    )
  )
  WITH CHECK (
    mosque_id IN (
      SELECT mosque_id FROM public.mosque_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Mosque admins can delete their campaigns"
  ON public.campaigns FOR DELETE
  TO authenticated
  USING (
    mosque_id IN (
      SELECT mosque_id FROM public.mosque_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- ---------------------------------------------------------------------------
-- Transaction RLS: mosque admins can READ their own donations. Writes stay
-- service-role only — money state is only ever mutated by webhook handlers.
-- ---------------------------------------------------------------------------

CREATE POLICY "Mosque members can view their transactions"
  ON public.transactions FOR SELECT
  TO authenticated
  USING (
    campaign_id IN (
      SELECT c.id
      FROM public.campaigns c
      WHERE c.mosque_id IN (
        SELECT mosque_id FROM public.mosque_members WHERE user_id = auth.uid()
      )
    )
  );

-- ---------------------------------------------------------------------------
-- Mandate RLS: same pattern as transactions.
-- ---------------------------------------------------------------------------

CREATE POLICY "Mosque members can view their mandates"
  ON public.mandates FOR SELECT
  TO authenticated
  USING (
    campaign_id IN (
      SELECT c.id
      FROM public.campaigns c
      WHERE c.mosque_id IN (
        SELECT mosque_id FROM public.mosque_members WHERE user_id = auth.uid()
      )
    )
  );

-- ---------------------------------------------------------------------------
-- Direct-debit RLS: goes through mandates → campaigns → mosques.
-- ---------------------------------------------------------------------------

CREATE POLICY "Mosque members can view their direct debits"
  ON public.direct_debits FOR SELECT
  TO authenticated
  USING (
    mandate_id IN (
      SELECT m.id
      FROM public.mandates m
      WHERE m.campaign_id IN (
        SELECT c.id
        FROM public.campaigns c
        WHERE c.mosque_id IN (
          SELECT mosque_id FROM public.mosque_members WHERE user_id = auth.uid()
        )
      )
    )
  );

-- ---------------------------------------------------------------------------
-- Notes
-- ---------------------------------------------------------------------------
-- - exchange_events intentionally has NO policy — it's a debug audit log,
--   service-role access only. Mosque admins should query their data via
--   the above SELECT policies on transactions/mandates/direct_debits.
-- - Superadmins (profiles.is_superadmin = true) already bypass RLS via
--   the service-role admin client used in API routes, so they retain
--   full visibility without additional policies.
-- - All INSERT/UPDATE/DELETE on transactions/mandates/direct_debits stay
--   service-role only. Mosque admins cannot rewrite history.
