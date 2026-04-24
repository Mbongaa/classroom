-- Add audit columns to organization_kyc_documents for the drawn-signature
-- agreement flow. `uploaded_at` is reused by every KYC doc; dedicated
-- `signed_*` columns make the audit trail explicit and survive schema
-- changes to the generic upload flow.

alter table organization_kyc_documents
  add column if not exists signed_by    text,
  add column if not exists signed_at    timestamptz,
  add column if not exists signed_place text;

comment on column organization_kyc_documents.signed_by is
  'Human-readable name of the person who signed the agreement (from the dashboard signature form).';
comment on column organization_kyc_documents.signed_at is
  'Timestamp at which the agreement was digitally signed.';
comment on column organization_kyc_documents.signed_place is
  'City / place (Plaats) entered by the signee in the signature form.';
