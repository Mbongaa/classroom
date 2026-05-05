-- Finance dashboard public-production hardening for Pay.nl Alliance.
-- Keep Pay.nl as the source of truth for sensitive banking details and
-- manual payout exceptions.

alter table public.organizations
  add column if not exists bank_iban_last4 text,
  add column if not exists paynl_manual_payout_approved boolean not null default false;

update public.organizations
set bank_iban_last4 = right(regexp_replace(bank_iban, '\s+', '', 'g'), 4)
where bank_iban is not null
  and bank_iban_last4 is null;

update public.organizations
set bank_iban = null
where bank_iban is not null;

update public.organizations
set paynl_secret = null
where paynl_secret is not null;

comment on column public.organizations.bank_iban is
  'Deprecated. Full merchant IBANs must not be stored locally; Pay.nl is the source of truth.';

comment on column public.organizations.bank_iban_last4 is
  'Display-only last four characters of the merchant IBAN.';

comment on column public.organizations.paynl_secret is
  'Deprecated. Per-merchant Pay.nl secrets must not be stored locally.';

comment on column public.organizations.paynl_manual_payout_approved is
  'Superadmin override for merchants with an explicitly approved manual-payout operating state.';
