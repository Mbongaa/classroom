-- =====================================================
-- Superadmin audit log
--
-- Records every superadmin "act as organization" event so we have a paper
-- trail of who entered which org, when, and why. Used by the impersonation
-- feature in /superadmin/organizations.
--
-- Action values:
--   'enter'   — superadmin started impersonating an organization
--   'exit'    — superadmin explicitly stopped impersonating
--   'denied'  — an attempt to enter an org failed validation (defence in depth)
--
-- RLS:
--   - SELECT: only superadmins (so they can review the log from the portal)
--   - INSERT: only the service_role key (writes happen from the server, never
--     directly from the client). No UPDATE/DELETE policies — log is append-only.
-- =====================================================

CREATE TABLE IF NOT EXISTS public.superadmin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  superadmin_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('enter', 'exit', 'denied')),
  target_organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_superadmin_audit_log_superadmin_id
  ON public.superadmin_audit_log(superadmin_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_superadmin_audit_log_target_org
  ON public.superadmin_audit_log(target_organization_id, created_at DESC);

ALTER TABLE public.superadmin_audit_log ENABLE ROW LEVEL SECURITY;

-- Only superadmins can read the audit log
DROP POLICY IF EXISTS "Superadmins can read audit log" ON public.superadmin_audit_log;
CREATE POLICY "Superadmins can read audit log"
  ON public.superadmin_audit_log
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.is_superadmin = true
    )
  );

-- No INSERT/UPDATE/DELETE policies for authenticated users — the table is
-- write-only via the service_role key from server-side code. service_role
-- bypasses RLS by design, so no policy is needed for it.
