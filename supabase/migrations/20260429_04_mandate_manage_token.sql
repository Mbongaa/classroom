-- Per-mandate management token. Sent in donor emails as a bearer credential
-- for /donate/manage/[token] (view details, change amount, cancel). The
-- magic-link trust model: possession of the email = ability to act. Donors
-- never see this token in our app's UI; it lives only in their inbox.
--
-- Token shape: 32-character URL-safe random string, generated app-side at
-- mandate creation time. NOT NULL after backfill.

ALTER TABLE public.mandates
  ADD COLUMN IF NOT EXISTS manage_token text;

CREATE UNIQUE INDEX IF NOT EXISTS mandates_manage_token_key
  ON public.mandates(manage_token)
  WHERE manage_token IS NOT NULL;

COMMENT ON COLUMN public.mandates.manage_token IS
  'URL-safe random token used as bearer credential for /donate/manage/[token]. Anyone in possession of the donor''s email can use it to view/edit/cancel the mandate.';
