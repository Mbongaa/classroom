-- =========================================
-- Add Room Type Column to Classrooms
-- =========================================
-- This migration adds support for different room types:
-- - 'meeting': Regular video conference (no special features)
-- - 'classroom': Full classroom mode with teacher/student roles, translation, etc.
-- - 'speech': Speech-only mode for presentations/lectures
--
-- This fixes the bug where all rooms were being treated as classrooms
-- regardless of their intended type.

-- Add room_type column with constraint
ALTER TABLE classrooms
  ADD COLUMN IF NOT EXISTS room_type TEXT DEFAULT 'classroom'
    CHECK (room_type IN ('meeting', 'classroom', 'speech'));

-- Backfill existing rooms as 'classroom' type (already done by default)
-- This ensures backward compatibility with existing rooms
UPDATE classrooms
SET room_type = 'classroom'
WHERE room_type IS NULL;

-- Create index for faster room type filtering
CREATE INDEX IF NOT EXISTS idx_classrooms_room_type ON classrooms(room_type);

-- Add comments for documentation
COMMENT ON COLUMN classrooms.room_type IS 'Type of room: meeting (basic), classroom (full features), or speech (presentation mode)';

-- =========================================
-- Update RLS Policies (if needed)
-- =========================================
-- No changes to RLS policies needed - room type doesn't affect access control
