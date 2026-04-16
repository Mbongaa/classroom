-- Adds refund and chargeback tracking columns to transactions.
--
-- The status column is a free text field (no CHECK constraint), so no ALTER
-- is needed to allow 'REFUND', 'PARTIAL_REFUND', or 'CHARGEBACK' values.
-- This migration adds two columns to support partial refund tracking.

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS refunded_at timestamptz,
  ADD COLUMN IF NOT EXISTS refund_amount integer;

COMMENT ON COLUMN public.transactions.refunded_at IS 'Timestamp of the refund event from Pay.nl (full or partial).';
COMMENT ON COLUMN public.transactions.refund_amount IS 'Amount refunded in cents. For full refunds this equals amount; for partial refunds the actual refund value.';
