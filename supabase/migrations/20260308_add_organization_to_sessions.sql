-- =====================================================
-- Add organization_id to sessions table
-- Fixes ambiguity when multiple orgs share the same room_code
-- =====================================================

-- Add organization_id column (nullable for legacy sessions)
ALTER TABLE public.sessions
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;

-- Index for org-based lookups
CREATE INDEX IF NOT EXISTS idx_sessions_organization_id
ON public.sessions(organization_id);

-- Backfill: set organization_id for existing sessions where room_name
-- maps to exactly ONE classroom (unambiguous cases only)
UPDATE public.sessions s
SET organization_id = sub.organization_id
FROM (
  SELECT c.room_code, c.organization_id
  FROM public.classrooms c
  INNER JOIN (
    SELECT room_code
    FROM public.classrooms
    GROUP BY room_code
    HAVING COUNT(*) = 1
  ) uniq ON uniq.room_code = c.room_code
) sub
WHERE s.room_name = sub.room_code
  AND s.organization_id IS NULL;
