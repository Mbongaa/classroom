-- =====================================================
-- Bayaan Hub — Products table
--
-- A product is a purchasable item owned by an organization (mosque).
-- Mirrors the campaigns table structure but adds price, stock, and
-- category fields specific to e-commerce.
--
-- Payments reuse the same Pay.nl Order:Create flow as donations —
-- the difference is a fixed price and PRODUCT- reference prefix.
-- =====================================================

CREATE TABLE IF NOT EXISTS public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL
    REFERENCES public.organizations(id) ON DELETE RESTRICT,
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  description text,
  price integer NOT NULL,                       -- cents (fixed price)
  category text,                                -- 'books', 'clothing', 'food', etc.
  image_url text,                               -- product image URL
  stock integer,                                -- NULL = unlimited, 0 = sold out
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT products_org_id_not_nil
    CHECK (organization_id <> '00000000-0000-0000-0000-000000000000'::uuid),
  CONSTRAINT products_price_positive
    CHECK (price > 0),
  CONSTRAINT products_stock_non_negative
    CHECK (stock IS NULL OR stock >= 0)
);

-- Partial index: most queries filter by active products for an org.
CREATE INDEX IF NOT EXISTS idx_products_organization_active
  ON public.products(organization_id, is_active)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_products_slug
  ON public.products(slug);

-- Row Level Security
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Public can view ACTIVE products only (anon + authenticated).
CREATE POLICY "Public can view active products"
  ON public.products FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

-- Org members can view all products (including inactive) for their org.
CREATE POLICY "Org members can view their products"
  ON public.products FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_members.organization_id = products.organization_id
        AND organization_members.user_id = auth.uid()
    )
  );

-- No INSERT/UPDATE/DELETE policies → service role only.

-- updated_at trigger
CREATE TRIGGER products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

COMMENT ON TABLE public.products IS
  'Purchasable items for organizations. Uses same Pay.nl Order:Create flow as donations with PRODUCT- reference prefix.';
COMMENT ON COLUMN public.products.price IS
  'Fixed price in cents (integer). Always positive.';
COMMENT ON COLUMN public.products.stock IS
  'Available stock count. NULL = unlimited, 0 = sold out.';
COMMENT ON COLUMN public.products.category IS
  'Free-text category tag for grouping and filtering.';
