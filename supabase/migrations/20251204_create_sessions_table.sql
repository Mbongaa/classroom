-- =====================================================
-- Create sessions table for ALL room sessions
-- Separates transcription sessions from video recordings
-- =====================================================

-- Create sessions table
CREATE TABLE IF NOT EXISTS public.sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_sid TEXT NOT NULL,
  room_name TEXT NOT NULL,
  session_id TEXT UNIQUE NOT NULL, -- e.g., "MATH101_2025-01-31_14-30"
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_sessions_room_sid ON public.sessions(room_sid);
CREATE INDEX idx_sessions_session_id ON public.sessions(session_id);
CREATE INDEX idx_sessions_room_name ON public.sessions(room_name);
CREATE INDEX idx_sessions_started_at ON public.sessions(started_at DESC);

-- Add session reference to transcriptions table
ALTER TABLE public.transcriptions
  ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE;

-- Add session reference to translation_entries table
ALTER TABLE public.translation_entries
  ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE;

-- Migrate existing data from fake recordings to sessions
-- This handles all the transcript-only sessions that were incorrectly stored as recordings
INSERT INTO public.sessions (room_sid, room_name, session_id, started_at, created_at)
SELECT
  room_sid,
  -- Fix room names that were incorrectly saved as room_sid
  CASE
    WHEN room_name = room_sid THEN
      -- Try to extract actual room name from session_id if possible
      CASE
        WHEN position('_' IN session_id) > 0
        THEN split_part(session_id, '_', 1)
        ELSE room_sid
      END
    ELSE room_name
  END as room_name,
  session_id,
  started_at,
  created_at
FROM public.session_recordings
WHERE livekit_egress_id LIKE 'transcript-%'
ON CONFLICT (session_id) DO NOTHING; -- Skip if session already exists

-- Update transcriptions with new session_id reference
UPDATE public.transcriptions t
SET session_id = s.id
FROM public.sessions s
JOIN public.session_recordings r ON r.session_id = s.session_id
WHERE t.recording_id = r.id
  AND t.session_id IS NULL;

-- Update translation_entries with new session_id reference
UPDATE public.translation_entries te
SET session_id = s.id
FROM public.sessions s
JOIN public.session_recordings r ON r.session_id = s.session_id
WHERE te.recording_id = r.id
  AND te.session_id IS NULL;

-- Now make recording_id nullable since we have session_id
ALTER TABLE public.transcriptions
  ALTER COLUMN recording_id DROP NOT NULL;

ALTER TABLE public.translation_entries
  ALTER COLUMN recording_id DROP NOT NULL;

-- Add session reference to real recordings (for linking video recordings to sessions)
ALTER TABLE public.session_recordings
  ADD COLUMN IF NOT EXISTS session_uuid UUID REFERENCES public.sessions(id);

-- Link existing real recordings to their sessions
UPDATE public.session_recordings sr
SET session_uuid = s.id
FROM public.sessions s
WHERE sr.session_id = s.session_id
  AND sr.livekit_egress_id LIKE 'EG_%'
  AND sr.session_uuid IS NULL;

-- Create sessions for real recordings that don't have a session yet
INSERT INTO public.sessions (room_sid, room_name, session_id, started_at)
SELECT
  room_sid,
  room_name,
  session_id,
  started_at
FROM public.session_recordings
WHERE livekit_egress_id LIKE 'EG_%'
  AND session_id NOT IN (SELECT session_id FROM public.sessions)
ON CONFLICT (session_id) DO NOTHING;

-- Link these newly created sessions back to recordings
UPDATE public.session_recordings sr
SET session_uuid = s.id
FROM public.sessions s
WHERE sr.session_id = s.session_id
  AND sr.livekit_egress_id LIKE 'EG_%'
  AND sr.session_uuid IS NULL;

-- Clean up fake recording entries (after migration is complete)
DELETE FROM public.session_recordings
WHERE livekit_egress_id LIKE 'transcript-%'
  OR livekit_egress_id = 'transcript-only';

-- Enable RLS on sessions table
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Anyone can insert sessions (unauthenticated participants need this)
CREATE POLICY "Anyone can insert sessions"
  ON public.sessions FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- RLS Policy: Anyone can view sessions
CREATE POLICY "Anyone can view sessions"
  ON public.sessions FOR SELECT
  TO anon, authenticated
  USING (true);

-- RLS Policy: Anyone can update sessions (for ending sessions)
CREATE POLICY "Anyone can update sessions"
  ON public.sessions FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Add indexes for the new session_id columns
CREATE INDEX IF NOT EXISTS idx_transcriptions_session_id
  ON public.transcriptions(session_id);

CREATE INDEX IF NOT EXISTS idx_translation_entries_session_id
  ON public.translation_entries(session_id);

-- Add comment to table
COMMENT ON TABLE public.sessions IS 'Stores all room sessions (with or without video recording) for transcription and translation tracking';
COMMENT ON COLUMN public.sessions.session_id IS 'Unique session identifier format: ROOMNAME_YYYY-MM-DD_HH-MM';
COMMENT ON COLUMN public.session_recordings.session_uuid IS 'Reference to parent session (null for legacy recordings)';