-- =====================================================
-- Bayaan Hub × Pay.nl — v2 Alliance tracking columns
--
-- Phase 2b: align with the real Pay.nl REST v2 Alliance API:
--   • POST /v2/merchants            → returns merchantCode (M-XXXX)
--   • POST /v2/licenses             → returns licenseCode per person
--   • GET  /v2/merchants/{code}/info → returns dynamic list of required
--                                       documents (each with its own `code`)
--   • POST /v2/documents            → upload a file keyed by that code
--   • PATCH /v2/boarding/{code}/ready → submit for review
--
-- This migration:
--   1. Adds paynl_boarding_status to organizations
--   2. Adds paynl_license_code to organization_persons
--   3. Replaces the enum doc_type CHECK with a free-text column (Pay.nl
--      owns the taxonomy: coc_extract, id_front, id_back, …) and adds
--      paynl_document_code + paynl_required fields
--   4. Extends the status CHECK to include 'requested' (Pay.nl has asked
--      for a doc but the mosque hasn't uploaded it yet)
-- =====================================================

-- ---------------------------------------------------------------------------
-- 1. organizations: boarding status
-- ---------------------------------------------------------------------------
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS paynl_boarding_status text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'organizations_paynl_boarding_status_check'
  ) THEN
    ALTER TABLE public.organizations
      ADD CONSTRAINT organizations_paynl_boarding_status_check
      CHECK (
        paynl_boarding_status IS NULL OR paynl_boarding_status IN (
          'REGISTERED','ONBOARDING','ACCEPTED','SUSPENDED','OFFBOARDED'
        )
      );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. organization_persons: license code from POST /v2/licenses
-- ---------------------------------------------------------------------------
ALTER TABLE public.organization_persons
  ADD COLUMN IF NOT EXISTS paynl_license_code text;

CREATE INDEX IF NOT EXISTS idx_organization_persons_license_code
  ON public.organization_persons(paynl_license_code)
  WHERE paynl_license_code IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 3. organization_kyc_documents: align with Pay.nl's dynamic doc taxonomy
--
-- Pay.nl returns the list of required documents per merchant from the
-- `/merchants/{code}/info` endpoint. Each has its own `code` (upload
-- identifier), `type` (classification string like 'coc_extract'), and
-- `status` (REQUESTED → UPLOADED → ACCEPTED/REJECTED).
--
-- We drop the enum CHECK on doc_type since we cannot predict every
-- classification Pay.nl may emit. paynl_document_code becomes the
-- federation key for uploads.
-- ---------------------------------------------------------------------------

-- Drop the enum check — Pay.nl owns the taxonomy
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'organization_kyc_documents_doc_type_check'
  ) THEN
    ALTER TABLE public.organization_kyc_documents
      DROP CONSTRAINT organization_kyc_documents_doc_type_check;
  END IF;
END $$;

-- New tracking columns
ALTER TABLE public.organization_kyc_documents
  ADD COLUMN IF NOT EXISTS paynl_document_code text,
  ADD COLUMN IF NOT EXISTS paynl_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS translations jsonb,
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz NOT NULL DEFAULT now();

-- Required rows exist before a file is attached — storage_path / mime / size
-- must be nullable for the 'requested' state.
ALTER TABLE public.organization_kyc_documents
  ALTER COLUMN storage_path DROP NOT NULL,
  ALTER COLUMN mime_type DROP NOT NULL,
  ALTER COLUMN file_size_bytes DROP NOT NULL;

-- Expand status CHECK to include 'requested'
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'organization_kyc_documents_status_check'
  ) THEN
    ALTER TABLE public.organization_kyc_documents
      DROP CONSTRAINT organization_kyc_documents_status_check;
  END IF;

  ALTER TABLE public.organization_kyc_documents
    ADD CONSTRAINT organization_kyc_documents_status_check
    CHECK (status IN ('requested','uploaded','forwarded','accepted','rejected'));
END $$;

-- Relax the person_required constraint — the hard-coded id_front/id_back
-- rule was based on our old enum. Pay.nl will indicate person-scoped docs
-- via merchants/info (we persist that in the requested row). For now, we
-- drop the constraint entirely; the API route enforces per-upload rules
-- based on the row's metadata.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'organization_kyc_documents_person_required'
  ) THEN
    ALTER TABLE public.organization_kyc_documents
      DROP CONSTRAINT organization_kyc_documents_person_required;
  END IF;
END $$;

-- Per-merchant uniqueness on paynl_document_code — each required doc is a
-- single row keyed by Pay.nl's code.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_kyc_documents_paynl_code_per_org
  ON public.organization_kyc_documents (organization_id, paynl_document_code)
  WHERE paynl_document_code IS NOT NULL;
