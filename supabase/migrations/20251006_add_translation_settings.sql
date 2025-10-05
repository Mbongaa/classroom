-- =========================================
-- Translation Prompt Templates System
-- =========================================
-- This migration adds support for custom translation prompts
-- that can be configured per classroom and reused across rooms.

-- Create translation_prompt_templates table
CREATE TABLE IF NOT EXISTS translation_prompt_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  prompt_text TEXT NOT NULL,
  category TEXT, -- 'formal', 'conversational', 'technical', 'religious', etc.
  is_public BOOLEAN DEFAULT false, -- Public templates available to all organizations
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Organization-scoped unique names (null organization_id for public templates)
  CONSTRAINT unique_template_name_per_org UNIQUE(organization_id, name)
);

-- Add translation settings columns to classrooms table
ALTER TABLE classrooms
  ADD COLUMN IF NOT EXISTS translation_prompt_id UUID REFERENCES translation_prompt_templates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS transcription_language TEXT DEFAULT 'ar',
  ADD COLUMN IF NOT EXISTS context_window_size INT DEFAULT 12;

-- Create index for faster prompt lookups
CREATE INDEX IF NOT EXISTS idx_classrooms_translation_prompt ON classrooms(translation_prompt_id);
CREATE INDEX IF NOT EXISTS idx_prompt_templates_org ON translation_prompt_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_prompt_templates_public ON translation_prompt_templates(is_public) WHERE is_public = true;

-- Add comments for documentation
COMMENT ON TABLE translation_prompt_templates IS 'Reusable translation prompt templates for customizing AI translation behavior';
COMMENT ON COLUMN translation_prompt_templates.prompt_text IS 'Translation prompt with {source_lang} and {target_lang} placeholders';
COMMENT ON COLUMN translation_prompt_templates.is_public IS 'Public templates are available to all organizations as defaults';
COMMENT ON COLUMN classrooms.translation_prompt_id IS 'Custom translation prompt template for this classroom';
COMMENT ON COLUMN classrooms.transcription_language IS 'Source language code for speech-to-text (e.g., ar, en)';
COMMENT ON COLUMN classrooms.context_window_size IS 'Number of previous sentence pairs to include in translation context (default: 12)';

-- =========================================
-- Seed Default Public Templates
-- =========================================

INSERT INTO translation_prompt_templates (
  organization_id,
  name,
  description,
  prompt_text,
  category,
  is_public
) VALUES
  -- Formal Academic Template
  (
    NULL,
    'Formal Academic',
    'Scholarly language suitable for university lectures and academic content',
    'You are an expert simultaneous interpreter specializing in formal academic discourse. Translate from {source_lang} to {target_lang} using scholarly language suitable for university lectures. Preserve technical terminology and maintain a professional, educational tone. Be concise for real-time delivery.',
    'formal',
    true
  ),

  -- Conversational Template
  (
    NULL,
    'Conversational',
    'Natural, engaging language for interactive discussions and casual learning',
    'Translate from {source_lang} to {target_lang} using natural, conversational language. Make the translation engaging and easy to understand, suitable for interactive classroom discussions. Use simple language while maintaining accuracy. Be concise for real-time delivery.',
    'conversational',
    true
  ),

  -- Technical Workshop Template
  (
    NULL,
    'Technical Workshop',
    'Precision-focused translation for technical content and workshops',
    'You are translating a technical workshop from {source_lang} to {target_lang}. Preserve all technical terms, code references, and specific terminology in their standard form. Maintain precision while ensuring the explanation is clear for technical learners. Be concise for real-time delivery.',
    'technical',
    true
  ),

  -- Religious/Spiritual Template
  (
    NULL,
    'Religious/Spiritual',
    'Reverent translation for religious content maintaining spiritual atmosphere',
    'You are translating religious content from {source_lang} to {target_lang}. Maintain appropriate reverence and respect for religious concepts. Preserve the spiritual tone and devotional atmosphere of the original. Use terminology that honors the sacred nature of the content. Be concise for real-time delivery.',
    'religious',
    true
  )
ON CONFLICT DO NOTHING;

-- =========================================
-- Row Level Security (RLS) Policies
-- =========================================

ALTER TABLE translation_prompt_templates ENABLE ROW LEVEL SECURITY;

-- Users can view public templates or templates from their organization
CREATE POLICY "Users can view public templates or org templates"
  ON translation_prompt_templates FOR SELECT
  USING (
    is_public = true
    OR organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

-- Teachers/Admins can create templates in their organization
CREATE POLICY "Teachers can create templates in their org"
  ON translation_prompt_templates FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('teacher', 'admin')
    )
  );

-- Teachers/Admins can update templates they created in their organization
CREATE POLICY "Teachers can update their org templates"
  ON translation_prompt_templates FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('teacher', 'admin')
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('teacher', 'admin')
    )
  );

-- Teachers/Admins can delete templates from their organization
CREATE POLICY "Teachers can delete their org templates"
  ON translation_prompt_templates FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('teacher', 'admin')
    )
  );

-- =========================================
-- Helper Function for Bayaan Server
-- =========================================
-- This function allows Bayaan to retrieve the full prompt text
-- by querying with the classroom UUID

CREATE OR REPLACE FUNCTION get_classroom_translation_prompt(classroom_uuid UUID)
RETURNS TABLE (
  prompt_text TEXT,
  transcription_language TEXT,
  context_window_size INT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    pt.prompt_text,
    c.transcription_language,
    c.context_window_size
  FROM classrooms c
  LEFT JOIN translation_prompt_templates pt ON c.translation_prompt_id = pt.id
  WHERE c.id = classroom_uuid
    AND c.is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to service role (used by Bayaan server)
GRANT EXECUTE ON FUNCTION get_classroom_translation_prompt(UUID) TO service_role;

COMMENT ON FUNCTION get_classroom_translation_prompt IS 'Retrieve translation prompt and settings for a classroom (used by Bayaan server)';
