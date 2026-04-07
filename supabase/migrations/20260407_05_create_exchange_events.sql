-- =====================================================
-- Bayaan Hub × Pay.nl — Phase 1
-- Create exchange_events table (webhook audit log)
--
-- Inserted on EVERY Pay.nl exchange webhook, BEFORE the main handler runs,
-- so we can debug retries and replay scenarios. Pay.nl retries webhooks up
-- to 6 times in 2 hours per the configured retry scheme — this log lets us
-- verify idempotency guards are working.
--
-- No policies — internal debugging table, service role only.
-- =====================================================

CREATE TABLE IF NOT EXISTS public.exchange_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text,                               -- 'new_ppt', 'incassocollected', etc.
  order_id text,
  paynl_directdebit_id text,
  paynl_mandate_id text,
  content_type text,
  payload jsonb NOT NULL,                    -- full parsed body
  remote_ip text,
  processed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_exchange_events_action
  ON public.exchange_events(action);

CREATE INDEX IF NOT EXISTS idx_exchange_events_order
  ON public.exchange_events(order_id);

CREATE INDEX IF NOT EXISTS idx_exchange_events_processed
  ON public.exchange_events(processed_at DESC);

-- Row Level Security
ALTER TABLE public.exchange_events ENABLE ROW LEVEL SECURITY;
-- No policies — internal debugging only.

COMMENT ON TABLE public.exchange_events IS
  'Audit log of every Pay.nl exchange webhook received. Inserted before the main handler runs so that retries and replays can be debugged. Service role only.';
COMMENT ON COLUMN public.exchange_events.payload IS
  'Full parsed webhook body as jsonb. PII fields should be redacted by the caller before insert (see lib/paynl.ts redactPII).';
COMMENT ON COLUMN public.exchange_events.remote_ip IS
  'Client IP from x-forwarded-for. Used later for IP allowlisting once Pay.nl publishes their production IP range.';
