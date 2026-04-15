-- =====================================================
-- Bayaan Hub — Appointments module
--
-- Paid 1-on-1 sessions with sheikhs. An organization admin creates
-- one or more "offerings" (a sheikh profile + price + duration). End
-- users book a slot on the public mobile booking page and pay via the
-- same Pay.nl Order:Create flow used for donations and products.
--
-- Tables:
--   appointment_offerings         — sheikh profile + pricing
--   appointment_availability_rules — recurring weekly slots + date overrides
--   appointments                   — actual bookings (linked to transactions)
--
-- Pay.nl convention: stats_extra2 = 'appointment' to distinguish from
-- campaign/product transactions. stats_extra1 = offering_id, stats_extra3
-- = organization_id (same as donations/products).
-- =====================================================

-- -----------------------------------------------------
-- 1. Offerings
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.appointment_offerings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL
    REFERENCES public.organizations(id) ON DELETE RESTRICT,
  slug text NOT NULL UNIQUE,
  sheikh_name text NOT NULL,
  sheikh_email text NOT NULL,                   -- for booking notifications
  sheikh_bio text,
  sheikh_avatar_url text,
  price integer NOT NULL,                        -- cents (fixed price)
  duration_minutes integer NOT NULL,             -- session length
  location text,                                 -- in-person address; NULL for TBD
  timezone text NOT NULL DEFAULT 'Europe/Amsterdam',
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT appt_offerings_org_id_not_nil
    CHECK (organization_id <> '00000000-0000-0000-0000-000000000000'::uuid),
  CONSTRAINT appt_offerings_price_positive
    CHECK (price > 0),
  CONSTRAINT appt_offerings_duration_bounds
    CHECK (duration_minutes > 0 AND duration_minutes <= 480)
);

CREATE INDEX IF NOT EXISTS idx_appt_offerings_organization_active
  ON public.appointment_offerings(organization_id, is_active)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_appt_offerings_slug
  ON public.appointment_offerings(slug);

ALTER TABLE public.appointment_offerings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view active appointment offerings"
  ON public.appointment_offerings FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

CREATE POLICY "Org members can view their appointment offerings"
  ON public.appointment_offerings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_members.organization_id = appointment_offerings.organization_id
        AND organization_members.user_id = auth.uid()
    )
  );

-- No INSERT/UPDATE/DELETE policies → service role only.

CREATE TRIGGER appointment_offerings_updated_at
  BEFORE UPDATE ON public.appointment_offerings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

COMMENT ON TABLE public.appointment_offerings IS
  '1-on-1 paid session offerings. One row per sheikh per organization.';
COMMENT ON COLUMN public.appointment_offerings.price IS
  'Fixed session price in cents. Always positive.';
COMMENT ON COLUMN public.appointment_offerings.timezone IS
  'IANA timezone used to interpret weekly availability rules (e.g. "Europe/Amsterdam").';


-- -----------------------------------------------------
-- 2. Availability rules
--   kind = 'weekly'        → recurring weekly slot
--     day_of_week 0..6 (0=Sun), start_time, end_time required
--   kind = 'date_override' → specific date add/block
--     specific_date required; is_blocking=true removes a slot (block the
--     whole day if start/end_time null, or a sub-range otherwise);
--     is_blocking=false adds extra availability on that date
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.appointment_availability_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offering_id uuid NOT NULL
    REFERENCES public.appointment_offerings(id) ON DELETE CASCADE,
  kind text NOT NULL,
  day_of_week smallint,
  specific_date date,
  start_time time,
  end_time time,
  is_blocking boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT appt_rule_kind_valid
    CHECK (kind IN ('weekly', 'date_override')),
  CONSTRAINT appt_rule_shape
    CHECK (
      (
        kind = 'weekly'
        AND day_of_week BETWEEN 0 AND 6
        AND specific_date IS NULL
        AND start_time IS NOT NULL
        AND end_time IS NOT NULL
        AND is_blocking = false
      )
      OR
      (
        kind = 'date_override'
        AND specific_date IS NOT NULL
        AND day_of_week IS NULL
      )
    ),
  CONSTRAINT appt_rule_time_order
    CHECK (start_time IS NULL OR end_time IS NULL OR start_time < end_time)
);

CREATE INDEX IF NOT EXISTS idx_appt_rules_offering
  ON public.appointment_availability_rules(offering_id);

CREATE INDEX IF NOT EXISTS idx_appt_rules_offering_date
  ON public.appointment_availability_rules(offering_id, specific_date)
  WHERE kind = 'date_override';

ALTER TABLE public.appointment_availability_rules ENABLE ROW LEVEL SECURITY;

-- Public read — needed by the booking page to compute open slots.
-- Scoped to rules for active offerings only.
CREATE POLICY "Public can view rules for active offerings"
  ON public.appointment_availability_rules FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.appointment_offerings o
      WHERE o.id = appointment_availability_rules.offering_id
        AND o.is_active = true
    )
  );

CREATE POLICY "Org members can view their availability rules"
  ON public.appointment_availability_rules FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.appointment_offerings o
      JOIN public.organization_members m
        ON m.organization_id = o.organization_id
      WHERE o.id = appointment_availability_rules.offering_id
        AND m.user_id = auth.uid()
    )
  );

COMMENT ON TABLE public.appointment_availability_rules IS
  'Recurring weekly slots and one-off date overrides that define when a sheikh is available for bookings.';


-- -----------------------------------------------------
-- 3. Appointments (bookings)
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offering_id uuid NOT NULL
    REFERENCES public.appointment_offerings(id) ON DELETE RESTRICT,
  organization_id uuid NOT NULL
    REFERENCES public.organizations(id) ON DELETE RESTRICT,
  scheduled_at timestamptz NOT NULL,             -- stored in UTC
  duration_minutes integer NOT NULL,             -- snapshot of offering at booking time
  customer_name text NOT NULL,
  customer_email text NOT NULL,
  customer_phone text,
  notes text,
  transaction_id uuid
    REFERENCES public.transactions(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending',
  confirmed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT appointments_status_valid
    CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed')),
  CONSTRAINT appointments_duration_positive
    CHECK (duration_minutes > 0),
  -- Prevent double-booking the same slot for an offering while still
  -- allowing cancelled appointments to sit alongside a fresh booking.
  CONSTRAINT appointments_unique_active_slot
    UNIQUE (offering_id, scheduled_at, status)
);

CREATE INDEX IF NOT EXISTS idx_appointments_offering_time
  ON public.appointments(offering_id, scheduled_at);

CREATE INDEX IF NOT EXISTS idx_appointments_org_status
  ON public.appointments(organization_id, status);

CREATE INDEX IF NOT EXISTS idx_appointments_transaction
  ON public.appointments(transaction_id)
  WHERE transaction_id IS NOT NULL;

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- Org members can view their organization's appointments.
CREATE POLICY "Org members can view their appointments"
  ON public.appointments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_members.organization_id = appointments.organization_id
        AND organization_members.user_id = auth.uid()
    )
  );

-- No public SELECT (contains customer PII). Writes via service role only.

CREATE TRIGGER appointments_updated_at
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

COMMENT ON TABLE public.appointments IS
  'Paid appointment bookings. Auto-confirmed on Pay.nl PAID webhook; sheikh is emailed.';
COMMENT ON COLUMN public.appointments.scheduled_at IS
  'Appointment start time in UTC. Presentation uses offering.timezone.';
COMMENT ON COLUMN public.appointments.status IS
  'pending = awaiting payment; confirmed = paid and scheduled; cancelled = refunded or abandoned; completed = session finished.';
