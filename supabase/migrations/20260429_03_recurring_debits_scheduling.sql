-- Recurring SEPA direct-debit scheduling.
--
-- Pay.nl FLEXIBLE mandates do not auto-charge monthly: each cycle requires
-- an explicit DirectDebits:Add call. We track when the next debit is due
-- on each mandate, advance it as collections arrive, and let a cron job
-- pick up due rows and trigger the next debit.
--
-- Idempotency: a unique (mandate_id, process_date) index on direct_debits
-- prevents the cron from inserting two debits with the same target date,
-- even on retry-after-error.

ALTER TABLE public.mandates
  ADD COLUMN IF NOT EXISTS next_debit_at timestamptz;

COMMENT ON COLUMN public.mandates.next_debit_at IS
  'Earliest UTC time at which the recurring-debit cron should trigger the next monthly debit. NULL when the mandate has not yet completed its first collection (Pay.nl auto-triggers the first cycle from processDate at create time). Advanced by one month each time directdebit.collected fires.';

-- Useful for the cron query: ACTIVE mandates ordered by due date.
CREATE INDEX IF NOT EXISTS idx_mandates_next_debit_due
  ON public.mandates(next_debit_at)
  WHERE status = 'ACTIVE' AND next_debit_at IS NOT NULL;

-- Defense-in-depth idempotency: same mandate cannot have two debits with
-- the same target process_date, regardless of how many times the cron
-- retries. Pay.nl side already returns a unique paynl_directdebit_id per
-- successful trigger, but we want to block double-call on transient errors.
CREATE UNIQUE INDEX IF NOT EXISTS direct_debits_mandate_processdate_key
  ON public.direct_debits(mandate_id, process_date);
