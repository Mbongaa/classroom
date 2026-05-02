-- 30-day beta trial: every new (and existing) beta org gets a trial_ends_at
-- timestamp. Once expired, the dashboard layout redirects the org admin to
-- /billing/required where they enter card details via Stripe Checkout. The
-- existing Stripe webhook already handles the trialing -> active flip.
--
-- The two warning columns are used by the daily cron at
-- /api/cron/trial-warnings to fire one TrialEndingEmail at 7-days-out and a
-- second at 3-days-out, idempotently.

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS trial_warning_7d_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS trial_warning_3d_sent_at TIMESTAMPTZ;

COMMENT ON COLUMN public.organizations.trial_ends_at IS
  'When the 30-day beta trial ends. NULL = no trial (paid, legacy, or superadmin org).';
COMMENT ON COLUMN public.organizations.trial_warning_7d_sent_at IS
  'Set the moment the 7-days-before TrialEndingEmail was sent. Idempotency key for the trial-warnings cron.';
COMMENT ON COLUMN public.organizations.trial_warning_3d_sent_at IS
  'Set the moment the 3-days-before TrialEndingEmail was sent. Idempotency key for the trial-warnings cron.';

-- Index used by the trial-warnings cron and the dashboard expiry guard.
CREATE INDEX IF NOT EXISTS idx_organizations_trial_ends_at
  ON public.organizations (trial_ends_at)
  WHERE trial_ends_at IS NOT NULL;

-- Backfill: existing beta orgs (free tier, no Stripe subscription) start a
-- 30-day trial from today. Orgs with a Stripe subscription or non-free tier
-- are unaffected. The status flip to 'trialing' brings them in line with the
-- new sign-up behaviour.
UPDATE public.organizations
SET
  trial_ends_at = NOW() + INTERVAL '30 days',
  subscription_status = 'trialing'
WHERE
  trial_ends_at IS NULL
  AND subscription_tier = 'free'
  AND stripe_subscription_id IS NULL;
