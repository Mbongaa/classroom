-- V2 host links + active-session integrity.
--
-- This migration intentionally fails before creating the unique index if the
-- production database already has duplicate active/draining sessions. Resolve
-- those manually first so we do not silently end or hide a live lecture.

ALTER TABLE public.classrooms
  ADD COLUMN IF NOT EXISTS host_link_nonce UUID NOT NULL DEFAULT gen_random_uuid();

DO $$
DECLARE
  duplicate_classroom_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO duplicate_classroom_count
  FROM (
    SELECT classroom_id
    FROM public.v2_sessions
    WHERE state IN ('active', 'draining')
    GROUP BY classroom_id
    HAVING COUNT(*) > 1
  ) duplicates;

  IF duplicate_classroom_count > 0 THEN
    RAISE EXCEPTION
      'Cannot create idx_v2_sessions_one_live_per_classroom: % classrooms have duplicate active/draining sessions',
      duplicate_classroom_count;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_v2_sessions_one_live_per_classroom
  ON public.v2_sessions(classroom_id)
  WHERE state IN ('active', 'draining');
