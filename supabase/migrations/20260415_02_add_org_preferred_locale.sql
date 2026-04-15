-- =====================================================
-- organizations.preferred_locale
--
-- Stores each organization's default UI / transactional-email language.
-- Drives:
--   - The NEXT_LOCALE cookie fallback for members opening the app
--   - The locale used by /api/auth/email-hook and Stripe webhooks when
--     rendering transactional email templates
--
-- Constrained to the 5 supported locales. Default 'en' so existing rows
-- keep current behaviour.
-- =====================================================

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS preferred_locale TEXT NOT NULL DEFAULT 'en';

ALTER TABLE public.organizations
  DROP CONSTRAINT IF EXISTS organizations_preferred_locale_check;

ALTER TABLE public.organizations
  ADD CONSTRAINT organizations_preferred_locale_check
    CHECK (preferred_locale IN ('en', 'ar', 'nl', 'fr', 'de'));

COMMENT ON COLUMN public.organizations.preferred_locale IS
  'Default locale for this org: members'' UI language + transactional emails. One of en, ar, nl, fr, de.';
