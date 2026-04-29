-- Track lifecycle of the SEPA direct-debit toggle on each org's Pay.nl
-- service. NULL means we haven't requested enablement yet. The donation
-- routes can also use this to surface "DD pending Pay.nl approval" to the
-- admin instead of failing silently with PAY-3000.
--
--   NULL          → never requested
--   'enabled'     → Pay.nl accepted enablePaymentOption (donations work)
--   'failed:<msg>'→ Pay.nl rejected the request (admin must retry / fix)

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS paynl_directdebit_status text;

COMMENT ON COLUMN public.organizations.paynl_directdebit_status IS
  'Lifecycle of SEPA direct-debit enablement on the org''s Pay.nl service. NULL = not requested, ''enabled'' = active, ''failed:<reason>'' = needs retry.';
