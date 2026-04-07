-- =====================================================
-- Bayaan Hub × Pay.nl — Phase 1
-- Create transactions table
--
-- One row per Pay.nl order (one-time donation). Lifecycle:
--   PENDING  → PAID     (via new_ppt exchange webhook)
--   PENDING  → CANCEL   (via cancel exchange webhook)
--   PENDING  → EXPIRED  (manual / future cleanup)
--
-- ⚠️ Contains donor PII. RLS is enabled with NO policies, so only the
-- service role can read or write. Phase 2 may add a mosque-admin view
-- policy, but Phase 1 has no mosque-scoped admin role yet.
-- =====================================================

CREATE TABLE IF NOT EXISTS public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE RESTRICT,
  paynl_order_id text UNIQUE NOT NULL,
  paynl_service_id text NOT NULL,
  amount integer NOT NULL,                   -- cents
  currency text NOT NULL DEFAULT 'EUR',
  payment_method text,                       -- 'ideal', 'card', 'bancontact', etc.
  status text NOT NULL DEFAULT 'PENDING',    -- PENDING | PAID | CANCEL | EXPIRED
  donor_name text,
  donor_email text,
  stats_extra1 text,                         -- campaign_id
  stats_extra2 text,                         -- cause_type
  stats_extra3 text,                         -- mosque_id
  is_test boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_transactions_campaign
  ON public.transactions(campaign_id);

CREATE INDEX IF NOT EXISTS idx_transactions_status
  ON public.transactions(status);

CREATE INDEX IF NOT EXISTS idx_transactions_paynl_order
  ON public.transactions(paynl_order_id);

-- Row Level Security
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
-- Intentionally NO policies — donor PII, service-role-only access.

CREATE TRIGGER transactions_updated_at
  BEFORE UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

COMMENT ON TABLE public.transactions IS
  'One-time donations. RLS is enabled with NO policies; service role only. Contains donor PII.';
COMMENT ON COLUMN public.transactions.paynl_order_id IS
  'Pay.nl order id returned from POST /v1/orders. Globally unique.';
COMMENT ON COLUMN public.transactions.paynl_service_id IS
  'Pay.nl sales location (SL-code) used for this transaction. Stored per-row to support Phase 2 per-mosque serviceId swap.';
COMMENT ON COLUMN public.transactions.amount IS
  'Donation amount in cents (integer). Pay.nl accepts + returns cents.';
COMMENT ON COLUMN public.transactions.status IS
  'PENDING | PAID | CANCEL | EXPIRED. Updated idempotently by webhook handler.';
COMMENT ON COLUMN public.transactions.is_test IS
  'True if the order was created in Pay.nl sandbox mode (PAYNL_SANDBOX_MODE=true).';
