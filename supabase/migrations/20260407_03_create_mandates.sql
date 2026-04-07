-- =====================================================
-- Bayaan Hub × Pay.nl — Phase 1
-- Create mandates table
--
-- One row per SEPA mandate (IO-XXXX-XXXX-XXXX). Lifecycle:
--   PENDING   → ACTIVE    (after first incassocollected webhook)
--   PENDING   → CANCELLED (donor cancels before first debit)
--   ACTIVE    → CANCELLED (donor cancels, mosque admin cancels)
--   ACTIVE    → EXPIRED   (SEPA mandate expiry, future cleanup)
--
-- ⚠️ Full IBAN is NEVER persisted here. Pay.nl stores the IBAN; we only
-- store `iban_owner` (the name on the account) for display. See
-- lib/paynl.ts redactPII() for the field allowlist.
-- =====================================================

CREATE TABLE IF NOT EXISTS public.mandates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE RESTRICT,
  paynl_mandate_id text UNIQUE NOT NULL,     -- IO-XXXX-XXXX-XXXX
  paynl_service_id text NOT NULL,            -- stored per-mandate for Phase 2 Alliance swap
  mandate_type text NOT NULL DEFAULT 'FLEXIBLE',  -- SINGLE | RECURRING | FLEXIBLE
  donor_name text NOT NULL,
  donor_email text,
  iban_owner text NOT NULL,                  -- name on bank account ONLY — never the IBAN
  status text NOT NULL DEFAULT 'PENDING',    -- PENDING | ACTIVE | CANCELLED | EXPIRED
  monthly_amount integer,                    -- cents, display-only
  stats_extra1 text,
  stats_extra2 text,
  stats_extra3 text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  first_debit_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_mandates_campaign
  ON public.mandates(campaign_id);

CREATE INDEX IF NOT EXISTS idx_mandates_status
  ON public.mandates(status);

CREATE INDEX IF NOT EXISTS idx_mandates_paynl
  ON public.mandates(paynl_mandate_id);

-- Row Level Security
ALTER TABLE public.mandates ENABLE ROW LEVEL SECURITY;
-- Intentionally NO policies — donor PII, service-role-only access.

CREATE TRIGGER mandates_updated_at
  BEFORE UPDATE ON public.mandates
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

COMMENT ON TABLE public.mandates IS
  'SEPA Direct Debit mandates. RLS is enabled with NO policies; service role only. Contains donor PII minus the IBAN.';
COMMENT ON COLUMN public.mandates.paynl_mandate_id IS
  'Pay.nl mandate code (IO-XXXX-XXXX-XXXX) returned by POST /v2/directdebits/mandates.';
COMMENT ON COLUMN public.mandates.iban_owner IS
  'Name on bank account ONLY. Full IBAN is stored at Pay.nl, never in our DB.';
COMMENT ON COLUMN public.mandates.status IS
  'PENDING | ACTIVE | CANCELLED | EXPIRED. Flips PENDING → ACTIVE on first incassocollected webhook.';
COMMENT ON COLUMN public.mandates.monthly_amount IS
  'Display-only expected monthly amount in cents. Actual debit amounts are triggered per-call via /api/mandates/:id/debit.';
