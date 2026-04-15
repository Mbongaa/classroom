-- =====================================================
-- Bayaan Hub × Pay.nl — KYC persons + documents
--
-- Pay.nl's Alliance createMerchant endpoint requires more than just business
-- details: it needs one or more natural persons (signees and UBOs) with DOB,
-- nationality and home address, plus supporting documents (KvK extract, UBO
-- extract, ID copies, bank proof). Dutch Wwft/Wft + DNB compliance.
--
-- This migration:
--   1. Adds the remaining business-level fields to organizations
--      (legal_form, mcc, vat_number, business_description, website_url,
--       address_street, address_house_number, address_postal_code)
--   2. Creates organization_persons — one row per signee / UBO / director
--   3. Creates organization_kyc_documents — metadata for each file uploaded
--      to Pay.nl (file itself lives in the `kyc-documents` Storage bucket)
--   4. Adds RLS: service-role can write; org admins can SELECT their own
--
-- Following the existing pattern (20260407_03, 20260408_03): write policies
-- live on the service role only — mutations happen in API routes running
-- with the admin client, not directly from the browser.
-- =====================================================

-- ---------------------------------------------------------------------------
-- Step 1: Add remaining business-level columns to organizations
-- ---------------------------------------------------------------------------

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS legal_form text,
  ADD COLUMN IF NOT EXISTS mcc text,
  ADD COLUMN IF NOT EXISTS vat_number text,
  ADD COLUMN IF NOT EXISTS business_description text,
  ADD COLUMN IF NOT EXISTS website_url text,
  ADD COLUMN IF NOT EXISTS address_street text,
  ADD COLUMN IF NOT EXISTS address_house_number text,
  ADD COLUMN IF NOT EXISTS address_postal_code text,
  ADD COLUMN IF NOT EXISTS kvk_number text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'organizations_legal_form_check'
  ) THEN
    ALTER TABLE public.organizations
      ADD CONSTRAINT organizations_legal_form_check
      CHECK (legal_form IS NULL OR legal_form IN (
        'eenmanszaak','vof','maatschap','bv','nv','stichting','vereniging','cooperatie','other'
      ));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'organizations_kvk_number_check'
  ) THEN
    ALTER TABLE public.organizations
      ADD CONSTRAINT organizations_kvk_number_check
      CHECK (kvk_number IS NULL OR kvk_number ~ '^[0-9]{8}$');
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Step 2: organization_persons
--
-- One row per natural person involved in the merchant relationship:
--   - signees (authorised to sign on behalf of the company)
--   - UBOs (Ultimate Beneficial Owners, ≥25% ownership/control)
-- A single person may be both, flagged by is_signee + is_ubo.
--
-- Pay.nl will return a per-person id after createMerchant; we store it in
-- paynl_person_id so document uploads can reference it.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.organization_persons (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

  -- Identity
  full_name         text NOT NULL,
  date_of_birth     date NOT NULL,
  nationality       text NOT NULL,          -- ISO 3166-1 alpha-2
  email             text,
  phone             text,

  -- Home address (must match the ID document)
  address_street        text NOT NULL,
  address_house_number  text NOT NULL,
  address_postal_code   text NOT NULL,
  address_city          text NOT NULL,
  address_country       text NOT NULL,      -- ISO 3166-1 alpha-2

  -- Role flags
  is_signee         boolean NOT NULL DEFAULT false,
  is_ubo            boolean NOT NULL DEFAULT false,
  ubo_percentage    numeric(5,2),           -- 0..100, required when is_ubo

  -- Pay.nl reference (populated after successful createMerchant)
  paynl_person_id   text,

  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT organization_persons_role_required
    CHECK (is_signee OR is_ubo),

  CONSTRAINT organization_persons_ubo_percentage_check
    CHECK (
      (NOT is_ubo) OR
      (ubo_percentage IS NOT NULL AND ubo_percentage > 0 AND ubo_percentage <= 100)
    ),

  CONSTRAINT organization_persons_nationality_check
    CHECK (length(nationality) = 2),

  CONSTRAINT organization_persons_address_country_check
    CHECK (length(address_country) = 2)
);

CREATE INDEX IF NOT EXISTS idx_organization_persons_org
  ON public.organization_persons(organization_id);

CREATE INDEX IF NOT EXISTS idx_organization_persons_ubo
  ON public.organization_persons(organization_id) WHERE is_ubo;

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION public.organization_persons_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_organization_persons_touch ON public.organization_persons;
CREATE TRIGGER trg_organization_persons_touch
BEFORE UPDATE ON public.organization_persons
FOR EACH ROW EXECUTE FUNCTION public.organization_persons_touch_updated_at();

-- ---------------------------------------------------------------------------
-- Step 3: organization_kyc_documents
--
-- Metadata only. Files themselves live in the `kyc-documents` private
-- Storage bucket (created by a separate bucket-policy seed, not here — a
-- migration cannot INSERT into storage.buckets without service role).
--
-- doc_type enumerates the fixed set Pay.nl expects. person_id is nullable
-- because some docs are org-level (kvk_extract, ubo_extract, bank_statement,
-- power_of_attorney) and others person-level (id_front, id_back).
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.organization_kyc_documents (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  person_id         uuid REFERENCES public.organization_persons(id) ON DELETE CASCADE,

  doc_type          text NOT NULL,
  storage_path      text NOT NULL,          -- path within the kyc-documents bucket
  mime_type         text NOT NULL,
  file_size_bytes   integer NOT NULL,

  paynl_document_id text,                   -- populated after successful upload
  status            text NOT NULL DEFAULT 'uploaded',
  uploaded_by       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  uploaded_at       timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT organization_kyc_documents_doc_type_check
    CHECK (doc_type IN (
      'kvk_extract','ubo_extract','id_front','id_back',
      'bank_statement','power_of_attorney','other'
    )),

  CONSTRAINT organization_kyc_documents_status_check
    CHECK (status IN ('uploaded','forwarded','accepted','rejected')),

  CONSTRAINT organization_kyc_documents_person_required
    CHECK (
      (doc_type NOT IN ('id_front','id_back')) OR (person_id IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_organization_kyc_documents_org
  ON public.organization_kyc_documents(organization_id);

CREATE INDEX IF NOT EXISTS idx_organization_kyc_documents_person
  ON public.organization_kyc_documents(person_id) WHERE person_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Step 4: RLS — service-role for writes, org-admin SELECT, public denied
-- ---------------------------------------------------------------------------

ALTER TABLE public.organization_persons        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_kyc_documents  ENABLE ROW LEVEL SECURITY;

-- Org admins can SELECT their own persons
DROP POLICY IF EXISTS "org admins read their persons"
  ON public.organization_persons;
CREATE POLICY "org admins read their persons"
  ON public.organization_persons
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members m
      WHERE m.organization_id = organization_persons.organization_id
        AND m.user_id = auth.uid()
        AND m.role = 'admin'
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_superadmin = true
    )
  );

-- Org admins can SELECT their own documents (metadata only — file access
-- is gated by Storage bucket policies, signed URLs from API routes)
DROP POLICY IF EXISTS "org admins read their kyc documents"
  ON public.organization_kyc_documents;
CREATE POLICY "org admins read their kyc documents"
  ON public.organization_kyc_documents
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members m
      WHERE m.organization_id = organization_kyc_documents.organization_id
        AND m.user_id = auth.uid()
        AND m.role = 'admin'
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_superadmin = true
    )
  );

-- No INSERT/UPDATE/DELETE policies: mutations happen via API routes using
-- the admin client (service role), which bypasses RLS.

-- ---------------------------------------------------------------------------
-- Step 5: Storage bucket for KYC documents
--
-- Private bucket. Direct client uploads are blocked — only the admin client
-- from /api/organizations/[id]/merchant/documents can write here.
-- ---------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'kyc-documents',
  'kyc-documents',
  false,
  10 * 1024 * 1024,   -- 10 MB per file
  ARRAY['image/png','image/jpeg','image/webp','application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- No Storage RLS policies: the service role bypasses them. Signed URLs are
-- generated on demand by the API when a superadmin needs to review a doc.
