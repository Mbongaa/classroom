-- =====================================================
-- Add organization_id to mandates
--
-- Membership mandates are not tied to a specific campaign.
-- This adds a direct organization link so:
--   * campaign-scoped mandates: organization_id = campaigns.organization_id
--   * membership mandates:      organization_id set, campaign_id NULL
--
-- campaign_id stays nullable. Existing rows are backfilled from their
-- linked campaign before the NOT NULL constraint is enforced.
-- =====================================================

ALTER TABLE public.mandates
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE RESTRICT;

UPDATE public.mandates m
SET organization_id = c.organization_id
FROM public.campaigns c
WHERE m.organization_id IS NULL
  AND m.campaign_id = c.id;

ALTER TABLE public.mandates
  ALTER COLUMN organization_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_mandates_organization
  ON public.mandates(organization_id);

COMMENT ON COLUMN public.mandates.organization_id IS
  'Owning organization. Required for both campaign-scoped donations and membership mandates (where campaign_id is NULL).';
