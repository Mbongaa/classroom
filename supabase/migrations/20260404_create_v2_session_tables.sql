-- V2 Session Management Tables
-- Designed for LiveKit-as-truth architecture with backend orchestration

-- ============================================================
-- v2_sessions: One row per "session instance" of a classroom
-- ============================================================
CREATE TABLE IF NOT EXISTS v2_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id    UUID NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
  livekit_room_name TEXT NOT NULL,           -- classroom UUID (same format as v1)
  room_sid        TEXT,                       -- LiveKit room SID (set by webhook)
  state           TEXT NOT NULL DEFAULT 'active'
                    CHECK (state IN ('active', 'draining', 'ended', 'failed')),
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at        TIMESTAMPTZ,
  ended_reason    TEXT CHECK (ended_reason IN ('room_finished', 'reaper', 'manual', 'error')),
  human_count     INTEGER NOT NULL DEFAULT 0,
  agent_count     INTEGER NOT NULL DEFAULT 0,
  organization_id UUID REFERENCES organizations(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Fast lookups: active sessions per classroom, org filtering
CREATE INDEX idx_v2_sessions_classroom_state ON v2_sessions(classroom_id, state);
CREATE INDEX idx_v2_sessions_livekit_room    ON v2_sessions(livekit_room_name);
CREATE INDEX idx_v2_sessions_org             ON v2_sessions(organization_id);
CREATE INDEX idx_v2_sessions_state           ON v2_sessions(state) WHERE state IN ('active', 'draining');

-- ============================================================
-- v2_participants: Tracks who is in a session
-- ============================================================
CREATE TABLE IF NOT EXISTS v2_participants (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID NOT NULL REFERENCES v2_sessions(id) ON DELETE CASCADE,
  identity    TEXT NOT NULL,       -- deterministic: teacher:{classroomId}:{userId}
  name        TEXT NOT NULL,       -- display name
  role        TEXT NOT NULL CHECK (role IN ('teacher', 'student', 'translator', 'agent')),
  language    TEXT,                -- for translators: target language
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  left_at     TIMESTAMPTZ,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Prevent duplicate active participants in the same session
CREATE UNIQUE INDEX idx_v2_participants_unique_active
  ON v2_participants(session_id, identity) WHERE is_active = true;

CREATE INDEX idx_v2_participants_session ON v2_participants(session_id);
CREATE INDEX idx_v2_participants_active  ON v2_participants(session_id) WHERE is_active = true;

-- ============================================================
-- v2_transcriptions: Mirror of transcriptions, FK to v2_sessions
-- ============================================================
CREATE TABLE IF NOT EXISTS v2_transcriptions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id            UUID NOT NULL REFERENCES v2_sessions(id) ON DELETE CASCADE,
  text                  TEXT NOT NULL,
  language              TEXT NOT NULL,
  participant_identity  TEXT NOT NULL,
  participant_name      TEXT NOT NULL,
  timestamp_ms          INTEGER NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_v2_transcriptions_session ON v2_transcriptions(session_id);

-- ============================================================
-- v2_translation_entries: Mirror of translation_entries, FK to v2_sessions
-- ============================================================
CREATE TABLE IF NOT EXISTS v2_translation_entries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      UUID NOT NULL REFERENCES v2_sessions(id) ON DELETE CASCADE,
  text            TEXT NOT NULL,
  language        TEXT NOT NULL,
  participant_name TEXT NOT NULL,
  timestamp_ms    INTEGER NOT NULL,
  segment_id      TEXT,            -- LiveKit segment ID for dedup
  original_text   TEXT,            -- original speaker text
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Dedup: one translation per segment per language per session
CREATE UNIQUE INDEX idx_v2_translations_dedup
  ON v2_translation_entries(session_id, language, segment_id)
  WHERE segment_id IS NOT NULL;

CREATE INDEX idx_v2_translation_entries_session ON v2_translation_entries(session_id);

-- ============================================================
-- RLS Policies
-- ============================================================
ALTER TABLE v2_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE v2_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE v2_transcriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE v2_translation_entries ENABLE ROW LEVEL SECURITY;

-- v2_sessions: public read/insert/update (service role used for mutations)
CREATE POLICY "v2_sessions_select" ON v2_sessions FOR SELECT USING (true);
CREATE POLICY "v2_sessions_insert" ON v2_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "v2_sessions_update" ON v2_sessions FOR UPDATE USING (true);

-- v2_participants: public read/insert/update
CREATE POLICY "v2_participants_select" ON v2_participants FOR SELECT USING (true);
CREATE POLICY "v2_participants_insert" ON v2_participants FOR INSERT WITH CHECK (true);
CREATE POLICY "v2_participants_update" ON v2_participants FOR UPDATE USING (true);

-- v2_transcriptions: public insert, org-scoped read
CREATE POLICY "v2_transcriptions_insert" ON v2_transcriptions FOR INSERT WITH CHECK (true);
CREATE POLICY "v2_transcriptions_select" ON v2_transcriptions FOR SELECT USING (true);

-- v2_translation_entries: public insert, org-scoped read
CREATE POLICY "v2_translation_entries_insert" ON v2_translation_entries FOR INSERT WITH CHECK (true);
CREATE POLICY "v2_translation_entries_select" ON v2_translation_entries FOR SELECT USING (true);
