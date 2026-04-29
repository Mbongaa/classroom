-- =====================================================
-- Make campaign slug unique per organization, not globally.
--
-- The donate URL is `/donate/[org-slug]/[campaign-slug]`, so the slug only
-- needs to be unique within an org. A global UNIQUE constraint blocked two
-- different mosques from both having (e.g.) a "zakat" or "ramadan-2026"
-- campaign, which is the normal expected case.
--
-- Replaces the global `campaigns_slug_key` unique constraint with a composite
-- unique index on (organization_id, slug).
-- =====================================================

ALTER TABLE public.campaigns
  DROP CONSTRAINT IF EXISTS campaigns_slug_key;

CREATE UNIQUE INDEX IF NOT EXISTS campaigns_org_slug_key
  ON public.campaigns(organization_id, slug);

COMMENT ON COLUMN public.campaigns.slug IS
  'URL-friendly identifier. Unique per organization (composite index with organization_id), not globally.';
