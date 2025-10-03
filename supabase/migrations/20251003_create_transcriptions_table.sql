-- =====================================================
-- Create transcriptions table
-- For storing original speech-to-text (speaker's language)
-- Separate from translation_entries (translated languages)
-- =====================================================

-- Create transcriptions table
CREATE TABLE IF NOT EXISTS public.transcriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recording_id UUID NOT NULL REFERENCES public.session_recordings(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  language TEXT NOT NULL,  -- Speaker's original language (e.g., 'ar')
  participant_identity TEXT NOT NULL,  -- LiveKit participant identity
  participant_name TEXT NOT NULL,      -- Display name
  timestamp_ms INTEGER NOT NULL,       -- Milliseconds from recording start
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for fast playback queries
CREATE INDEX idx_transcriptions_recording_id
  ON public.transcriptions(recording_id);

-- Composite index for playback
CREATE INDEX idx_transcriptions_playback
  ON public.transcriptions(recording_id, timestamp_ms);

-- Enable RLS (Row Level Security)
ALTER TABLE public.transcriptions ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Organization members can view transcriptions
CREATE POLICY "Organization members can view transcriptions"
  ON public.transcriptions FOR SELECT
  TO authenticated
  USING (
    recording_id IN (
      SELECT id FROM public.session_recordings
      WHERE classroom_id IN (
        SELECT id FROM public.classrooms
        WHERE organization_id IN (
          SELECT organization_id
          FROM public.organization_members
          WHERE user_id = auth.uid()
        )
      )
    )
  );

-- RLS Policy: Anyone can insert transcriptions (sessions are unauthenticated)
-- Note: Adjust this based on your security requirements
CREATE POLICY "Allow transcription inserts"
  ON public.transcriptions FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Add comment
COMMENT ON TABLE public.transcriptions IS 'Stores original speech-to-text transcriptions in speaker language (separate from translations)';
