-- =====================================================
-- Add missing columns to session_recordings table
-- For LiveKit recording implementation with HLS playback
-- =====================================================

-- Add missing columns
ALTER TABLE public.session_recordings
  ADD COLUMN IF NOT EXISTS room_sid TEXT,
  ADD COLUMN IF NOT EXISTS room_name TEXT,
  ADD COLUMN IF NOT EXISTS session_id TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS hls_playlist_url TEXT,
  ADD COLUMN IF NOT EXISTS mp4_url TEXT,
  ADD COLUMN IF NOT EXISTS teacher_name TEXT;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_session_recordings_room_name
  ON public.session_recordings(room_name);

CREATE INDEX IF NOT EXISTS idx_session_recordings_session_id
  ON public.session_recordings(session_id);

CREATE INDEX IF NOT EXISTS idx_session_recordings_started_at
  ON public.session_recordings(started_at DESC);

-- Update status check constraint to match plan
ALTER TABLE public.session_recordings
  DROP CONSTRAINT IF EXISTS session_recordings_status_check;

ALTER TABLE public.session_recordings
  ADD CONSTRAINT session_recordings_status_check
  CHECK (status IN ('ACTIVE', 'COMPLETED', 'FAILED', 'processing', 'completed', 'failed'));

-- Add comment to table
COMMENT ON TABLE public.session_recordings IS 'Stores LiveKit recording sessions with HLS and MP4 output URLs';
