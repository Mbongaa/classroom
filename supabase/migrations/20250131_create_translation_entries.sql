-- =====================================================
-- Create translation_entries table
-- For storing timestamped translation cards during recording
-- Phase 2 feature (not used yet, but table ready)
-- =====================================================

-- Create translation_entries table
CREATE TABLE IF NOT EXISTS public.translation_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recording_id UUID NOT NULL REFERENCES public.session_recordings(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  language TEXT NOT NULL,
  participant_name TEXT NOT NULL,
  timestamp_ms INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for fast playback queries
CREATE INDEX idx_translation_entries_recording_id
  ON public.translation_entries(recording_id);

-- Composite index for playback (critical for performance)
-- When student selects language, we query by recording_id + language + timestamp_ms
CREATE INDEX idx_translation_playback
  ON public.translation_entries(recording_id, language, timestamp_ms);

-- Enable RLS (Row Level Security)
ALTER TABLE public.translation_entries ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Organization members can view translations
CREATE POLICY "Organization members can view translations"
  ON public.translation_entries FOR SELECT
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

-- RLS Policy: Teachers can insert translations
CREATE POLICY "Teachers can insert translations"
  ON public.translation_entries FOR INSERT
  TO authenticated
  WITH CHECK (
    recording_id IN (
      SELECT id FROM public.session_recordings
      WHERE created_by = auth.uid()
    )
  );

-- Add comment
COMMENT ON TABLE public.translation_entries IS 'Stores timestamped translation cards for video playback synchronization (Phase 2 feature)';
