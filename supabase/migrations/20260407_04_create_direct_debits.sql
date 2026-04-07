-- =====================================================
-- Bayaan Hub × Pay.nl — Phase 1
-- Create direct_debits table
--
-- One row per individual SEPA debit (IL-XXXX-XXXX-XXXX) against an active
-- mandate. Lifecycle:
--   PENDING   → COLLECTED (funds arrived — incassocollected webhook)
--   COLLECTED → STORNO    (reversed — incassostorno webhook, up to 56 days)
--   PENDING   → DECLINED  (bank rejected, future handling)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.direct_debits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mandate_id uuid REFERENCES public.mandates(id) ON DELETE RESTRICT,
  paynl_directdebit_id text UNIQUE NOT NULL, -- IL-XXXX-XXXX-XXXX
  paynl_order_id text,
  paynl_service_id text NOT NULL,
  amount integer NOT NULL,                   -- cents
  currency text NOT NULL DEFAULT 'EUR',
  process_date date,
  status text NOT NULL DEFAULT 'PENDING',    -- PENDING | COLLECTED | STORNO | DECLINED
  storno_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  collected_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_dd_mandate
  ON public.direct_debits(mandate_id);

CREATE INDEX IF NOT EXISTS idx_dd_status
  ON public.direct_debits(status);

CREATE INDEX IF NOT EXISTS idx_dd_process_date
  ON public.direct_debits(process_date);

CREATE INDEX IF NOT EXISTS idx_dd_paynl
  ON public.direct_debits(paynl_directdebit_id);

-- Row Level Security
ALTER TABLE public.direct_debits ENABLE ROW LEVEL SECURITY;
-- Intentionally NO policies — service role only.

CREATE TRIGGER direct_debits_updated_at
  BEFORE UPDATE ON public.direct_debits
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

COMMENT ON TABLE public.direct_debits IS
  'Individual SEPA debits against active mandates. RLS enabled, no policies — service role only.';
COMMENT ON COLUMN public.direct_debits.paynl_directdebit_id IS
  'Pay.nl direct-debit reference id (IL-XXXX-XXXX-XXXX) returned by POST /v2/directdebits.';
COMMENT ON COLUMN public.direct_debits.paynl_order_id IS
  'Pay.nl order id optionally returned alongside the direct-debit id.';
COMMENT ON COLUMN public.direct_debits.amount IS
  'Debit amount in cents (integer). Derived from webhook payload via parseAmountToCents().';
COMMENT ON COLUMN public.direct_debits.status IS
  'PENDING | COLLECTED | STORNO | DECLINED. Storno can happen up to 56 days after collection.';
