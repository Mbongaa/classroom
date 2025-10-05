# Dual Database Custom Prompts Implementation Guide

## Executive Summary

This document describes how to enable custom translation prompts for the classroom module by implementing dual database support in the Bayaan translation server, following the same proven pattern used by the mosque dashboard.

**Implementation Complexity**: ⭐⭐☆☆☆ (2/5 - Simple)
**Estimated Effort**: 2-3 hours
**Database Changes**: Minimal (1-2 columns)
**Server Code Changes**: ~60 lines (purely additive)

---

## Table of Contents

1. [Background: How Mosque Dashboard Works](#background-how-mosque-dashboard-works)
2. [Current Classroom Structure](#current-classroom-structure)
3. [Dual Database Architecture](#dual-database-architecture)
4. [Database Schema Changes](#database-schema-changes)
5. [Bayaan Server Implementation](#bayaan-server-implementation)
6. [Classroom UI Implementation](#classroom-ui-implementation)
7. [Testing & Verification](#testing--verification)
8. [Comparison: Database vs Metadata Approach](#comparison-database-vs-metadata-approach)

---

## Background: How Mosque Dashboard Works

### Database Structure (Mosque Supabase)

```sql
-- Rooms table
CREATE TABLE rooms (
  id INT PRIMARY KEY,
  Livekit_room_name TEXT UNIQUE,
  mosque_id INT REFERENCES mosques(id),
  Title TEXT,
  transcription_language TEXT DEFAULT 'ar',
  translation__language TEXT DEFAULT 'nl',
  context_window_size INT DEFAULT 6,
  created_at TIMESTAMPTZ
);

-- Prompt templates table
CREATE TABLE prompt_templates (
  id INT PRIMARY KEY,
  name TEXT,
  mosque_id INT REFERENCES mosques(id),
  prompt_template TEXT,
  template_variables JSONB,
  is_default BOOLEAN
);

-- PostgreSQL RPC Function
CREATE OR REPLACE FUNCTION get_room_prompt_template(room_id_param INT)
RETURNS TABLE (...) AS $$
  -- Returns the prompt template for a given room
  -- Looks up room → mosque → template hierarchy
$$;
```

### Data Flow (Mosque Dashboard)

```
1. Mosque admin creates room in dashboard
   └─ Saves to mosque Supabase: rooms table
   └─ Selects custom prompt template

2. Teacher starts session
   └─ LiveKit room created with Livekit_room_name

3. Bayaan agent joins
   └─ Queries: SELECT * FROM rooms WHERE Livekit_room_name = 'xyz'
   └─ Gets: room_id, mosque_id, languages

4. Bayaan fetches prompt
   └─ Calls: get_room_prompt_template(room_id)
   └─ Gets: Custom prompt template

5. Translation uses custom prompt
   └─ Prompt formatted with language variables
   └─ Applied to all translations in session
```

**Key Insight**: The room lookup happens by `Livekit_room_name`, and the database returns all configuration including which prompt template to use.

---

## Current Classroom Structure

### Existing Schema (Classroom Supabase)

```sql
CREATE TABLE classrooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),
  room_code TEXT NOT NULL,           -- User-facing (e.g., "aqeedah", "MATH101")
  teacher_id UUID REFERENCES auth.users(id),
  name TEXT NOT NULL,                -- Teacher name or class title
  description TEXT,
  settings JSONB DEFAULT '{
    "language": "ar",
    "enable_recording": true,
    "enable_chat": true,
    "max_participants": 100
  }',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(organization_id, room_code)
);
```

### Current LiveKit Integration

**Critical Mapping**: `classroom.id` (UUID) is used as the LiveKit room name

```typescript
// connection-details/route.ts
const classroom = await getClassroomByRoomCode('aqeedah');
livekitRoomName = classroom.id;  // e.g., '8b13fc9f-5002-4508-9bec-1d385facf782'

await roomService.createRoom({
  name: livekitRoomName,  // UUID, not 'aqeedah'
  ...
});
```

So when Bayaan queries by `Livekit_room_name`, it receives the UUID (e.g., `8b13fc9f-5002-4508-9bec-1d385facf782`), NOT the user-facing room code.

---

## Dual Database Architecture

### Overview

Bayaan will support **two independent database connections**:

1. **Mosque Database** (existing): For mosque dashboard rooms
2. **Classroom Database** (new): For classroom module rooms

Query logic: Try mosque DB first → If not found, try classroom DB → Fallback to defaults

### Configuration Strategy

**Environment Variables**:
```bash
# Existing (mosque)
SUPABASE_URL=https://bpsahvbdlkzemwjdgxmq.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhb...

# New (classroom)
CLASSROOM_SUPABASE_URL=https://your-classroom-project.supabase.co
CLASSROOM_SUPABASE_SERVICE_ROLE_KEY=eyJhb...
```

### Query Flow

```
Bayaan Agent Joins Room (LiveKit name = UUID)
    ↓
1. Query Mosque Database
   SELECT * FROM rooms WHERE Livekit_room_name = 'UUID'
   ↓
   Found? → Use mosque flow (EXISTING BEHAVIOR)
   ↓
2. Not Found → Query Classroom Database
   SELECT * FROM classrooms WHERE id = 'UUID'
   ↓
   Found? → Use classroom flow (NEW BEHAVIOR)
   ↓
3. Not Found → Use default fallbacks
```

---

## Database Schema Changes

### Option A: Simple Columns (RECOMMENDED)

**Add directly to existing `classrooms` table**:

```sql
-- Migration: 20251006_add_translation_settings.sql

-- Add translation configuration columns
ALTER TABLE classrooms
  ADD COLUMN transcription_language TEXT DEFAULT 'ar',
  ADD COLUMN translation_language TEXT DEFAULT 'nl',
  ADD COLUMN translation_prompt TEXT,
  ADD COLUMN context_window_size INT DEFAULT 12;

-- Add index for faster lookups by Bayaan
CREATE INDEX IF NOT EXISTS idx_classrooms_id ON classrooms(id);

-- Optional: Add comments for documentation
COMMENT ON COLUMN classrooms.translation_prompt IS 'Custom prompt for AI translation. Supports {source_lang} and {target_lang} variables.';
```

**Pros**:
- ✅ Simple (just add columns)
- ✅ No joins needed
- ✅ Fast queries

**Cons**:
- ❌ One prompt per classroom (can't have multiple templates)
- ❌ No reusable prompt library

### Option B: Separate Prompts Table

**Create reusable prompt templates**:

```sql
-- Migration: 20251006_create_translation_prompts.sql

-- Translation language settings on classrooms
ALTER TABLE classrooms
  ADD COLUMN transcription_language TEXT DEFAULT 'ar',
  ADD COLUMN translation_language TEXT DEFAULT 'nl',
  ADD COLUMN context_window_size INT DEFAULT 12,
  ADD COLUMN active_prompt_id UUID;  -- Link to active prompt

-- Reusable prompt templates
CREATE TABLE translation_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),
  name TEXT NOT NULL,                -- e.g., "Formal Academic", "Conversational"
  prompt_text TEXT NOT NULL,
  description TEXT,
  is_default BOOLEAN DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(organization_id, name)
);

-- Link table (if you want multiple prompts per classroom)
CREATE TABLE classroom_prompts (
  classroom_id UUID REFERENCES classrooms(id) ON DELETE CASCADE,
  prompt_id UUID REFERENCES translation_prompts(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  PRIMARY KEY (classroom_id, prompt_id)
);

-- Index for fast lookups
CREATE INDEX idx_classroom_prompts_active ON classroom_prompts(classroom_id, is_active);
```

**Pros**:
- ✅ Reusable prompt library
- ✅ Multiple prompts per classroom
- ✅ Organization-wide templates

**Cons**:
- ❌ More complex (joins required)
- ❌ More tables to manage

### Recommended: Start with Option A

Use Option A (simple columns) to get working quickly, then migrate to Option B if you need reusable templates later.

---

## Bayaan Server Implementation

### File Changes Overview

**Files to modify**:
1. `config.py` - Add classroom database config
2. `database.py` - Add classroom query function
3. `main.py` - Add classroom query fallback
4. `translator.py` - NO CHANGES (already supports custom prompts)

### 1. Config Changes (`config.py`)

**Location**: After `SupabaseConfig` class definition (~line 45)

```python
@dataclass
class ApplicationConfig:
    """Main application configuration."""
    # Component configurations
    supabase: SupabaseConfig  # Existing mosque database
    classroom_supabase: Optional[SupabaseConfig] = None  # NEW: Classroom database
    translation: TranslationConfig
    speechmatics: SpeechmaticsConfig

    # ... rest of config

    @classmethod
    def from_env(cls) -> 'ApplicationConfig':
        """Load configuration from environment variables."""
        # Existing mosque database
        supabase_config = SupabaseConfig.from_env()

        # NEW: Optional classroom database
        classroom_config = None
        classroom_url = os.getenv('CLASSROOM_SUPABASE_URL')
        classroom_key = os.getenv('CLASSROOM_SUPABASE_SERVICE_ROLE_KEY')
        if classroom_url and classroom_key:
            classroom_config = SupabaseConfig(
                url=classroom_url,
                service_role_key=classroom_key
            )
            print(f"   CLASSROOM DB: ✅ CONFIGURED ({classroom_url[:50]}...)")
        else:
            print(f"   CLASSROOM DB: ⚠️ NOT CONFIGURED (mosque-only mode)")

        return cls(
            supabase=supabase_config,
            classroom_supabase=classroom_config,  # NEW
            # ... rest of config
        )
```

### 2. Database Query Function (`database.py`)

**Location**: After `query_room_by_name` function (~line 280)

```python
async def query_classroom_by_id(classroom_uuid: str, classroom_config: 'SupabaseConfig') -> Optional[Dict[str, Any]]:
    """
    Query classroom information by UUID (which is used as LiveKit room name).
    Adapts classroom schema to Bayaan's expected room data format.

    Args:
        classroom_uuid: The classroom UUID (same as LiveKit room name)
        classroom_config: Classroom database configuration

    Returns:
        Room data dictionary in Bayaan format, or None if not found
    """
    try:
        session = await _pool.get_session()

        # Build headers for classroom database
        headers = {
            'apikey': classroom_config.service_role_key,
            'Authorization': f'Bearer {classroom_config.service_role_key}',
            'Content-Type': 'application/json'
        }

        # Query classroom by UUID
        url = f"{classroom_config.url}/rest/v1/classrooms"
        params = {
            "id": f"eq.{classroom_uuid}",
            "is_active": "eq.true",
            "select": "*"
        }

        timeout = aiohttp.ClientTimeout(total=5.0)

        try:
            async with session.get(url, headers=headers, params=params, timeout=timeout) as response:
                if response.status == 200:
                    classrooms = await response.json()
                    if classrooms and len(classrooms) > 0:
                        classroom = classrooms[0]

                        # Extract settings from JSONB
                        settings = classroom.get('settings', {})
                        if isinstance(settings, str):
                            import json
                            settings = json.loads(settings)

                        # Adapt classroom structure to Bayaan's expected format
                        adapted_data = {
                            "id": classroom['id'],  # UUID but Bayaan treats as room_id
                            "mosque_id": classroom.get('organization_id'),  # Map org_id to mosque_id
                            "Title": classroom.get('name', 'Classroom'),
                            "transcription_language": classroom.get('transcription_language', settings.get('language', 'ar')),
                            "translation__language": classroom.get('translation_language', 'nl'),
                            "context_window_size": classroom.get('context_window_size', 12),
                            "created_at": classroom.get('created_at'),
                            # NEW: Direct prompt from classroom table
                            "translation_prompt": classroom.get('translation_prompt')
                        }

                        logger.info(f"✅ Found classroom in classroom database: {classroom.get('room_code')}")
                        return adapted_data
                else:
                    error_text = await response.text()
                    logger.debug(f"Classroom not found in classroom DB: {response.status} - {error_text}")
        except asyncio.TimeoutError:
            logger.warning("Timeout querying classroom database")
        except Exception as e:
            logger.warning(f"Error querying classroom database: {e}")

        return None

    except Exception as e:
        logger.error(f"❌ Classroom query failed: {e}")
        return None
```

### 3. Main Entry Point Changes (`main.py`)

**Location**: After mosque database query (~line 186)

**BEFORE** (existing code):
```python
room_data = await query_room_by_name(job.room.name)

if room_data:
    tenant_context = {
        "room_id": room_data.get("id"),
        "mosque_id": room_data.get("mosque_id"),
        # ... etc
    }
except Exception as e:
    logger.warning(f"⚠️ Could not query Supabase: {e}")
```

**AFTER** (with classroom fallback):
```python
room_data = await query_room_by_name(job.room.name)

# NEW: If not found in mosque DB, try classroom DB
if not room_data and config.classroom_supabase:
    logger.info("🔍 Room not found in mosque DB, trying classroom DB...")
    room_data = await query_classroom_by_id(job.room.name, config.classroom_supabase)

    if room_data:
        logger.info("🎓 Using classroom database configuration")

if room_data:
    tenant_context = {
        "room_id": room_data.get("id"),
        "mosque_id": room_data.get("mosque_id"),
        "room_title": room_data.get("Title"),
        "transcription_language": room_data.get("transcription_language", "ar"),
        "translation_language": room_data.get("translation__language", "nl"),
        "context_window_size": room_data.get("context_window_size", 6),
        "created_at": room_data.get("created_at"),
        # NEW: Store direct prompt if available
        "translation_prompt": room_data.get("translation_prompt")  # ADD THIS
    }
    # ... rest of existing code
except Exception as e:
    logger.warning(f"⚠️ Could not query Supabase: {e}")
```

### 4. Translator Changes (`translator.py`)

**Location**: `_initialize_prompt` method (~line 169)

**BEFORE** (existing code):
```python
# PRIORITY 1: Custom prompt from metadata (classroom flow)
custom_prompt = self.tenant_context.get('customPrompt')
if custom_prompt:
    # ... use custom prompt
```

**AFTER** (add direct prompt support):
```python
# PRIORITY 1A: Direct prompt from database (classroom database flow)
direct_prompt = self.tenant_context.get('translation_prompt')
if direct_prompt:
    try:
        self.system_prompt = direct_prompt.format(
            source_lang=source_lang_name,
            source_language=source_lang_name,
            target_lang=target_lang_name,
            target_language=target_lang_name
        )
        logger.info(f"✅ Using direct prompt from classroom database: {source_lang_name} → {target_lang_name}")
        logger.info(f"📝 Prompt: {self.system_prompt[:100]}...")
        self._prompt_initialized = True
        return
    except KeyError as e:
        logger.warning(f"Direct prompt missing variable {e}, falling back")

# PRIORITY 1B: Custom prompt from metadata (LiveKit metadata flow)
custom_prompt = self.tenant_context.get('customPrompt')
if custom_prompt:
    # ... existing metadata flow

# PRIORITY 2: Database template lookup (mosque flow)
# ... existing code
```

**Priority System**:
1. Direct prompt from classroom DB (new)
2. Custom prompt from metadata (fallback)
3. Template lookup via RPC (mosque flow)
4. Default prompt (final fallback)

---

## Database Schema Changes

### Required Migration (Classroom Database)

**File**: `supabase/migrations/20251006_add_translation_settings.sql`

```sql
-- =========================================
-- Translation Settings for Classrooms
-- =========================================

-- Add translation configuration columns to classrooms table
ALTER TABLE classrooms
  ADD COLUMN IF NOT EXISTS transcription_language TEXT DEFAULT 'ar',
  ADD COLUMN IF NOT EXISTS translation_language TEXT DEFAULT 'nl',
  ADD COLUMN IF NOT EXISTS translation_prompt TEXT,
  ADD COLUMN IF NOT EXISTS context_window_size INT DEFAULT 12;

-- Add indexes for Bayaan queries (UUID lookups are already indexed via PRIMARY KEY)
-- No additional indexes needed since we query by id (PRIMARY KEY)

-- Add helpful comments
COMMENT ON COLUMN classrooms.transcription_language IS 'Source language code for speech-to-text (e.g., ar, en)';
COMMENT ON COLUMN classrooms.translation_language IS 'Target language code for translation (e.g., nl, en, fr)';
COMMENT ON COLUMN classrooms.translation_prompt IS 'Custom AI translation prompt. Supports {source_lang} and {target_lang} placeholders.';
COMMENT ON COLUMN classrooms.context_window_size IS 'Number of previous sentence pairs to include in translation context (default: 12)';

-- =========================================
-- Sample Data for Testing
-- =========================================

-- Example: Add custom prompt to an existing classroom
UPDATE classrooms
SET
  translation_prompt = 'You are an expert simultaneous interpreter specializing in formal academic discourse. Translate from {source_lang} to {target_lang} using scholarly language suitable for university lectures. Preserve technical terminology and maintain a professional, educational tone.',
  transcription_language = 'ar',
  translation_language = 'nl'
WHERE room_code = 'aqeedah';
```

**That's it!** No new tables, no RPC functions, no complex migrations.

### Optional: Prompt Templates Library (Future Enhancement)

If you want reusable prompt templates across classrooms:

```sql
-- Migration: 20251006_create_prompt_templates.sql

CREATE TABLE translation_prompt_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  prompt_text TEXT NOT NULL,
  category TEXT,  -- 'formal', 'conversational', 'technical', etc.
  is_public BOOLEAN DEFAULT false,  -- Available to all orgs
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(organization_id, name)
);

-- Seed with default templates
INSERT INTO translation_prompt_templates (organization_id, name, description, prompt_text, category, is_public)
VALUES
  (NULL, 'Formal Academic', 'Scholarly language for university lectures',
   'You are an expert simultaneous interpreter specializing in formal academic discourse. Translate from {source_lang} to {target_lang} using scholarly language suitable for university lectures. Preserve technical terminology and maintain a professional, educational tone.',
   'formal', true),
  (NULL, 'Conversational', 'Natural language for discussions',
   'Translate from {source_lang} to {target_lang} using natural, conversational language. Make the translation engaging and easy to understand, suitable for interactive classroom discussions. Use simple language while maintaining accuracy.',
   'conversational', true),
  (NULL, 'Technical Workshop', 'Precision for technical content',
   'You are translating a technical workshop from {source_lang} to {target_lang}. Preserve all technical terms, code references, and specific terminology in their standard form. Maintain precision while ensuring the explanation is clear for technical learners.',
   'technical', true);

-- RLS Policies
ALTER TABLE translation_prompt_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view public templates or their org templates"
  ON translation_prompt_templates FOR SELECT
  USING (is_public = true OR organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Teachers can create templates in their org"
  ON translation_prompt_templates FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('teacher', 'admin')
    )
  );
```

---

## Bayaan Server Implementation

### Summary of Changes

**Total Lines**: ~60 lines
**Files Modified**: 3
**Breaking Changes**: None (purely additive)

### Detailed Code Changes

#### File 1: `config.py` (~15 lines)

```python
# Line ~18 - Update SupabaseConfig to be reusable
@dataclass
class SupabaseConfig:
    """Supabase database configuration."""
    url: str
    service_role_key: str
    anon_key: Optional[str] = None

    # Timeouts
    http_timeout: float = 5.0
    broadcast_timeout: float = 2.0

    # NO CHANGES to from_env - keep as is for backward compatibility

# Line ~47 - Update ApplicationConfig
@dataclass
class ApplicationConfig:
    """Main application configuration."""
    # Component configurations
    supabase: SupabaseConfig  # Mosque database
    classroom_supabase: Optional[SupabaseConfig] = None  # NEW: Classroom database
    translation: TranslationConfig
    speechmatics: SpeechmaticsConfig

    # ... existing fields

    @classmethod
    def from_env(cls) -> 'ApplicationConfig':
        """Load configuration from environment variables."""
        # Mosque database (existing)
        supabase_config = SupabaseConfig.from_env()

        # Classroom database (NEW - optional)
        classroom_config = None
        try:
            classroom_url = os.getenv('CLASSROOM_SUPABASE_URL')
            classroom_key = os.getenv('CLASSROOM_SUPABASE_SERVICE_ROLE_KEY')
            if classroom_url and classroom_key:
                classroom_config = SupabaseConfig(
                    url=classroom_url,
                    service_role_key=classroom_key
                )
        except Exception as e:
            print(f"   CLASSROOM DB: ⚠️ Configuration error: {e}")

        # Build config
        config = cls(
            supabase=supabase_config,
            classroom_supabase=classroom_config,  # NEW
            translation=TranslationConfig(),
            speechmatics=SpeechmaticsConfig(),
            # ... rest
        )

        # Print configuration status
        print("🔧 Configuration loaded:")
        print(f"   MOSQUE SUPABASE_URL: {config.supabase.url[:50]}...")
        print(f"   MOSQUE SERVICE_KEY: {'✅ SET' if config.supabase.service_role_key else '❌ NOT SET'}")
        if config.classroom_supabase:
            print(f"   CLASSROOM SUPABASE_URL: {config.classroom_supabase.url[:50]}...")
            print(f"   CLASSROOM SERVICE_KEY: {'✅ SET' if config.classroom_supabase.service_role_key else '❌ NOT SET'}")
        else:
            print(f"   CLASSROOM DB: ⚠️ NOT CONFIGURED (mosque-only mode)")
        # ... rest of print statements

        return config
```

#### File 2: `database.py` (~40 lines)

```python
# Add after query_room_by_name function (~line 280)

async def query_classroom_by_id(classroom_uuid: str, classroom_config) -> Optional[Dict[str, Any]]:
    """
    Query classroom information by UUID (which is used as LiveKit room name).
    Adapts classroom schema to Bayaan's expected room data format.

    Args:
        classroom_uuid: The classroom UUID (same as LiveKit room name)
        classroom_config: Classroom database SupabaseConfig

    Returns:
        Room data dictionary in Bayaan-compatible format, or None if not found
    """
    try:
        session = await _pool.get_session()

        # Build headers for classroom database
        headers = {
            'apikey': classroom_config.service_role_key,
            'Authorization': f'Bearer {classroom_config.service_role_key}',
            'Content-Type': 'application/json'
        }

        # Query classroom by UUID (which is the LiveKit room name)
        url = f"{classroom_config.url}/rest/v1/classrooms"
        params = {
            "id": f"eq.{classroom_uuid}",
            "is_active": "eq.true",
            "select": "id,organization_id,room_code,name,transcription_language,translation_language,translation_prompt,context_window_size,created_at,settings"
        }

        timeout = aiohttp.ClientTimeout(total=classroom_config.http_timeout)

        try:
            async with session.get(url, headers=headers, params=params, timeout=timeout) as response:
                if response.status == 200:
                    classrooms = await response.json()
                    if classrooms and len(classrooms) > 0:
                        classroom = classrooms[0]

                        # Extract settings from JSONB if it's a string
                        settings = classroom.get('settings', {})
                        if isinstance(settings, str):
                            import json
                            settings = json.loads(settings)

                        # Adapt classroom structure to Bayaan's expected room format
                        # This allows Bayaan to work with classroom data without knowing the difference
                        adapted_data = {
                            # Core identifiers
                            "id": classroom['id'],  # UUID used as room_id in tenant_context
                            "mosque_id": classroom.get('organization_id'),  # Map organization_id → mosque_id
                            "Title": classroom.get('name', 'Classroom'),

                            # Language settings (with fallbacks)
                            "transcription_language": classroom.get('transcription_language') or settings.get('language', 'ar'),
                            "translation__language": classroom.get('translation_language', 'nl'),

                            # Translation settings
                            "context_window_size": classroom.get('context_window_size', 12),
                            "translation_prompt": classroom.get('translation_prompt'),  # Direct prompt

                            # Metadata
                            "created_at": classroom.get('created_at'),
                            "room_code": classroom.get('room_code')  # For logging
                        }

                        logger.info(f"✅ Found classroom in classroom database: room_code={classroom.get('room_code')}, id={classroom['id']}")
                        logger.info(f"🎓 Classroom translation config: {adapted_data.get('transcription_language')} → {adapted_data.get('translation__language')}")

                        if adapted_data.get('translation_prompt'):
                            logger.info(f"📝 Classroom has custom prompt: {adapted_data['translation_prompt'][:80]}...")

                        return adapted_data
                    else:
                        logger.debug(f"Classroom UUID {classroom_uuid} not found in classroom database")
                else:
                    error_text = await response.text()
                    logger.debug(f"Classroom query failed: {response.status} - {error_text}")
        except asyncio.TimeoutError:
            logger.warning(f"Timeout querying classroom database for {classroom_uuid}")
        except Exception as e:
            logger.warning(f"Error querying classroom database: {e}")

        return None

    except Exception as e:
        logger.error(f"❌ Classroom query failed for {classroom_uuid}: {e}")
        return None
```

#### File 3: `main.py` (~5 lines)

```python
# Location: ~line 161, AFTER mosque database query

# Existing mosque query
logger.info(f"🔍 Querying database for room: {job.room.name}")
room_data = await query_room_by_name(job.room.name)

# NEW: Add classroom database fallback (INSERT AFTER LINE 161)
if not room_data and config.classroom_supabase:
    logger.info("🔍 Room not found in mosque DB, trying classroom DB...")
    from database import query_classroom_by_id  # Import if not already
    room_data = await query_classroom_by_id(job.room.name, config.classroom_supabase)

# Rest of existing code continues as normal...
if room_data:
    tenant_context = {
        "room_id": room_data.get("id"),
        # ... existing code
        "translation_prompt": room_data.get("translation_prompt")  # ADD THIS LINE
    }
```

#### File 4: `translator.py` (~10 lines)

```python
# Location: ~line 169, in _initialize_prompt method

# BEFORE existing custom prompt check, ADD:

# PRIORITY 1: Direct prompt from database (classroom database flow)
direct_prompt = self.tenant_context.get('translation_prompt')
if direct_prompt:
    try:
        # Format prompt with language variables
        self.system_prompt = direct_prompt.format(
            source_lang=source_lang_name,
            source_language=source_lang_name,
            target_lang=target_lang_name,
            target_language=target_lang_name
        )
        logger.info(f"✅ Using direct prompt from database: {source_lang_name} → {target_lang_name}")
        logger.info(f"📝 Direct prompt: {self.system_prompt[:100]}...")
        self._prompt_initialized = True
        return
    except KeyError as e:
        logger.warning(f"Direct prompt missing variable {e}, falling back to next priority")

# Existing PRIORITY 2: Custom prompt from metadata (keep as is)
custom_prompt = self.tenant_context.get('customPrompt')
if custom_prompt:
    # ... existing code

# Existing PRIORITY 3: Database template (mosque flow - keep as is)
room_id = self.tenant_context.get('room_id')
if room_id:
    # ... existing code
```

---

## Classroom UI Implementation

### Prompt Management UI

**Create**: `app/components/TranslationPromptEditor.tsx`

```typescript
'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const PRESET_PROMPTS = {
  formal: 'You are an expert simultaneous interpreter specializing in formal academic discourse. Translate from {source_lang} to {target_lang} using scholarly language suitable for university lectures.',
  conversational: 'Translate from {source_lang} to {target_lang} using natural, conversational language. Make the translation engaging and easy to understand.',
  technical: 'You are translating a technical workshop from {source_lang} to {target_lang}. Preserve all technical terms in their standard form.',
  religious: 'You are translating religious content from {source_lang} to {target_lang}. Maintain reverence and respect for religious concepts.',
};

export function TranslationPromptEditor({ classroomId }: { classroomId: string }) {
  const [prompt, setPrompt] = useState('');
  const [sourceLanguage, setSourceLanguage] = useState('ar');
  const [targetLanguage, setTargetLanguage] = useState('nl');

  const handleSave = async () => {
    const response = await fetch(`/api/classrooms/${classroomId}/translation`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        translation_prompt: prompt,
        transcription_language: sourceLanguage,
        translation_language: targetLanguage,
      }),
    });

    if (response.ok) {
      alert('Translation settings saved!');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Translation Settings</CardTitle>
        <CardDescription>Configure custom AI translation for this classroom</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Preset selector */}
        <Select onValueChange={(value) => setPrompt(PRESET_PROMPTS[value as keyof typeof PRESET_PROMPTS])}>
          <SelectTrigger><SelectValue placeholder="Choose preset..." /></SelectTrigger>
          <SelectContent>
            <SelectItem value="formal">Formal Academic</SelectItem>
            <SelectItem value="conversational">Conversational</SelectItem>
            <SelectItem value="technical">Technical Workshop</SelectItem>
            <SelectItem value="religious">Religious/Spiritual</SelectItem>
          </SelectContent>
        </Select>

        {/* Custom prompt editor */}
        <div>
          <Label>Custom Prompt</Label>
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Enter custom translation prompt. Use {source_lang} and {target_lang} as placeholders."
            rows={6}
          />
        </div>

        {/* Language selectors */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Source Language</Label>
            <Select value={sourceLanguage} onValueChange={setSourceLanguage}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ar">Arabic</SelectItem>
                <SelectItem value="en">English</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Target Language</Label>
            <Select value={targetLanguage} onValueChange={setTargetLanguage}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="nl">Dutch</SelectItem>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="fr">French</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button onClick={handleSave}>Save Translation Settings</Button>
      </CardContent>
    </Card>
  );
}
```

### API Endpoint

**Create**: `app/api/classrooms/[roomCode]/translation/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { roomCode: string } }
) {
  const supabase = await createClient();
  const { translation_prompt, transcription_language, translation_language } = await request.json();

  const { data, error } = await supabase
    .from('classrooms')
    .update({
      translation_prompt,
      transcription_language,
      translation_language,
      updated_at: new Date().toISOString(),
    })
    .eq('room_code', params.roomCode)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true, classroom: data });
}
```

---

## Testing & Verification

### Step 1: Database Setup

```sql
-- Run migration in classroom Supabase
psql> \i supabase/migrations/20251006_add_translation_settings.sql

-- Verify columns added
psql> \d classrooms
-- Should show: translation_prompt, transcription_language, translation_language

-- Add test prompt to aqeedah classroom
UPDATE classrooms
SET translation_prompt = 'Explain concepts clearly and simply in {target_lang}. Avoid complex terminology.'
WHERE room_code = 'aqeedah';
```

### Step 2: Bayaan Server Configuration

**Update `.env` file**:
```bash
# Existing mosque database
SUPABASE_URL=https://bpsahvbdlkzemwjdgxmq.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...

# NEW: Classroom database
CLASSROOM_SUPABASE_URL=https://your-classroom-project.supabase.co
CLASSROOM_SUPABASE_SERVICE_ROLE_KEY=eyJhbG...
```

**Restart Bayaan server**:
```bash
# Should see in startup logs:
🔧 Configuration loaded:
   MOSQUE SUPABASE_URL: https://bpsahvbdlkzemwjdgxmq.supabase.co...
   MOSQUE SERVICE_KEY: ✅ SET
   CLASSROOM SUPABASE_URL: https://your-classroom-project.supabase.co...
   CLASSROOM SERVICE_KEY: ✅ SET
```

### Step 3: Test Classroom Flow

1. **Join classroom as teacher**:
   ```
   http://localhost:3000/rooms/aqeedah?classroom=true&role=teacher
   ```

2. **Check Bayaan logs** - should see:
   ```
   🔍 Looking up room context for: 8b13fc9f-5002-4508-9bec-1d385facf782
   🔍 Querying database for room: 8b13fc9f-5002-4508-9bec-1d385facf782
   (mosque query fails - no match)
   🔍 Room not found in mosque DB, trying classroom DB...
   ✅ Found classroom in classroom database: room_code=aqeedah, id=8b13fc9f...
   🎓 Classroom translation config: ar → nl
   📝 Classroom has custom prompt: Explain concepts clearly and simply...
   ```

3. **Verify translation uses custom prompt**:
   ```
   ✅ Using direct prompt from database: Arabic → Dutch
   📝 Direct prompt: Explain concepts clearly and simply in Dutch...
   ```

4. **Teacher speaks Arabic** → Student receives explanation-style translations

### Step 4: Test Mosque Flow (Backward Compatibility)

1. **Create mosque room** via mosque dashboard
2. **Join mosque room** → Bayaan should use mosque database
3. **Verify logs**:
   ```
   ✅ Found room in database: room_id=123, mosque_id=546012
   📝 Initialized translation prompt for room 123
   (Uses mosque template - existing behavior unchanged)
   ```

---

## Environment Variables Reference

### Bayaan Server `.env`

```bash
# ===========================================
# Mosque Database (Existing - Required)
# ===========================================
SUPABASE_URL=https://bpsahvbdlkzemwjdgxmq.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# ===========================================
# Classroom Database (New - Optional)
# ===========================================
CLASSROOM_SUPABASE_URL=https://your-classroom-project.supabase.co
CLASSROOM_SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# ===========================================
# Other Settings (Existing)
# ===========================================
LIVEKIT_URL=wss://jamaa-app-4bix2j1v.livekit.cloud
LIVEKIT_API_KEY=...
LIVEKIT_API_SECRET=...
SPEECHMATICS_API_KEY=...
```

**Note**: If `CLASSROOM_SUPABASE_*` variables are not set, Bayaan runs in mosque-only mode (backward compatible).

---

## Comparison: Database vs Metadata Approach

### Database Approach (This Document)

**Pros**:
- ✅ Uses proven pattern (mosque dashboard architecture)
- ✅ Persistent storage of prompts
- ✅ Simple adapter code (~60 lines)
- ✅ No LiveKit metadata complexity
- ✅ Both mosque + classroom work independently
- ✅ Easy to manage prompts via admin UI
- ✅ Tested and reliable architecture

**Cons**:
- ⚠️ Requires database schema changes (but minimal)
- ⚠️ Requires Bayaan server code changes (~60 lines)
- ⚠️ Needs classroom database credentials in Bayaan

**Complexity**:
- Database: ⭐⭐☆☆☆ (Add 3 columns)
- Server: ⭐⭐☆☆☆ (~60 lines)
- Testing: ⭐⭐⭐☆☆ (Need to verify both flows)

### Metadata Approach (Previously Attempted)

**Pros**:
- ✅ No database changes
- ✅ Stateless (metadata travels with room)
- ✅ Self-contained in LiveKit

**Cons**:
- ❌ Complex LiveKit metadata timing issues
- ❌ Metadata may be empty when agent joins
- ❌ Room creation vs room update race conditions
- ❌ No persistent storage (lost when room deleted)
- ❌ Harder to debug (metadata buried in LiveKit)
- ❌ Non-standard pattern (not proven)

**Complexity**:
- Database: ⭐☆☆☆☆ (None)
- Server: ⭐⭐⭐⭐☆ (Complex metadata handling)
- Testing: ⭐⭐⭐⭐⭐ (Many edge cases)

### Recommendation

**Use the Database Approach** - it's simpler, proven, and more reliable despite requiring minimal schema changes.

---

## Implementation Checklist

### Phase 1: Database Setup (10 minutes)

- [ ] Run migration in classroom Supabase
- [ ] Verify columns added: `\d classrooms`
- [ ] Add test prompt to aqeedah classroom
- [ ] Verify data: `SELECT room_code, translation_prompt FROM classrooms WHERE room_code = 'aqeedah';`

### Phase 2: Bayaan Server Changes (30 minutes)

- [ ] Update `config.py` - add classroom database config
- [ ] Update `database.py` - add `query_classroom_by_id` function
- [ ] Update `main.py` - add classroom query fallback
- [ ] Update `translator.py` - add direct prompt priority
- [ ] Add environment variables to `.env`
- [ ] Restart Bayaan server
- [ ] Verify startup logs show both databases configured

### Phase 3: Testing (30 minutes)

- [ ] Test mosque flow (ensure no regression)
- [ ] Test classroom flow with custom prompt
- [ ] Test classroom flow without custom prompt (uses default)
- [ ] Test database fallback chain
- [ ] Verify logs show correct prompt being used

### Phase 4: UI Implementation (1 hour)

- [ ] Create `TranslationPromptEditor` component
- [ ] Create API endpoint for updating classroom translation settings
- [ ] Add to classroom management UI
- [ ] Test saving and loading custom prompts

---

## Troubleshooting

### Issue: Bayaan still using default prompt

**Check**:
1. Classroom database columns exist:
   ```sql
   SELECT column_name FROM information_schema.columns
   WHERE table_name = 'classrooms'
   AND column_name IN ('translation_prompt', 'transcription_language', 'translation_language');
   ```

2. Classroom has prompt set:
   ```sql
   SELECT room_code, translation_prompt FROM classrooms WHERE room_code = 'aqeedah';
   ```

3. Bayaan environment variables set:
   ```bash
   echo $CLASSROOM_SUPABASE_URL
   echo $CLASSROOM_SUPABASE_SERVICE_ROLE_KEY
   ```

4. Bayaan logs show classroom query:
   ```
   🔍 Room not found in mosque DB, trying classroom DB...
   ✅ Found classroom in classroom database
   ```

### Issue: Mosque dashboard broken after changes

**Verify**:
- Mosque database queries still work (no code changes to mosque flow)
- Environment variables for mosque database unchanged
- Logs show mosque rooms being found: `✅ Found room in database: room_id=...`

### Issue: Can't connect to classroom database

**Check**:
1. Service role key has correct permissions
2. Supabase URL is correct
3. Network connectivity to classroom Supabase project
4. RLS policies don't block service role key

---

## Data Flow Diagrams

### Mosque Dashboard Flow (Unchanged)

```
Mosque Dashboard
    ↓
Creates room in mosque Supabase
    ↓
rooms table: {
  Livekit_room_name: "mosque_546012_khutbah_20251006"
  mosque_id: 546012
}
    ↓
Bayaan joins room
    ↓
Queries mosque DB by Livekit_room_name
    ↓
Gets room_id → Queries prompt_templates
    ↓
Uses custom mosque prompt
```

### Classroom Module Flow (New)

```
Teacher creates classroom in UI
    ↓
Saved to classroom Supabase
    ↓
classrooms table: {
  id: "8b13fc9f-5002-4508-9bec-1d385facf782" (UUID)
  room_code: "aqeedah"
  translation_prompt: "Explain concepts..."
}
    ↓
Teacher joins via /rooms/aqeedah?classroom=true
    ↓
connection-details API:
  - Looks up classroom by room_code
  - Uses classroom.id as LiveKit room name
    ↓
LiveKit room created with name: "8b13fc9f-5002-4508-9bec-1d385facf782"
    ↓
Bayaan joins room
    ↓
Queries mosque DB: Not found (mosque doesn't have this UUID)
    ↓
Queries classroom DB by id (UUID)
    ↓
Gets classroom data + translation_prompt
    ↓
Uses custom classroom prompt
```

---

## Security Considerations

### Database Access

**Bayaan needs**:
- READ access to `classrooms` table
- NO WRITE access needed

**Recommended RLS Policy**:
```sql
-- Create service role that can only read classrooms
-- Service role key bypasses RLS by default, so no policy needed
-- But for extra security, you can create a custom role:

CREATE ROLE bayaan_agent;
GRANT SELECT ON classrooms TO bayaan_agent;
-- Then create a custom JWT for this role
```

### Data Privacy

**What Bayaan can access**:
- ✅ Classroom UUID, room_code, name
- ✅ Translation settings (languages, prompt)
- ✅ Organization ID (mapped to mosque_id)

**What Bayaan CANNOT access** (not queried):
- ❌ Teacher personal info
- ❌ Student data
- ❌ Chat history
- ❌ Recordings

---

## Migration Path

### Phase 1: Dual Database Support (This Document)

- Add classroom database connection to Bayaan
- Query classroom DB as fallback
- Store prompts in classroom database

### Phase 2: Prompt Templates Library (Future)

- Create `translation_prompt_templates` table
- Build UI for creating/managing templates
- Allow teachers to select from library

### Phase 3: Advanced Features (Future)

- Per-user prompt preferences
- A/B testing different prompts
- Analytics on prompt effectiveness
- Multi-language pair support

---

## Appendix: Complete File Diffs

### A. config.py Changes

```python
# BEFORE
@dataclass
class ApplicationConfig:
    supabase: SupabaseConfig
    translation: TranslationConfig
    speechmatics: SpeechmaticsConfig

# AFTER
@dataclass
class ApplicationConfig:
    supabase: SupabaseConfig
    classroom_supabase: Optional[SupabaseConfig] = None  # NEW
    translation: TranslationConfig
    speechmatics: SpeechmaticsConfig
```

### B. database.py - New Function

```python
# ADD AFTER query_room_by_name() function

async def query_classroom_by_id(classroom_uuid: str, classroom_config) -> Optional[Dict[str, Any]]:
    """Query classroom by UUID and adapt to Bayaan format."""
    # Full implementation shown in section above
    pass
```

### C. main.py - Fallback Query

```python
# BEFORE
room_data = await query_room_by_name(job.room.name)
if room_data:
    tenant_context = { ... }

# AFTER
room_data = await query_room_by_name(job.room.name)

# NEW: Classroom database fallback
if not room_data and config.classroom_supabase:
    logger.info("🔍 Room not found in mosque DB, trying classroom DB...")
    room_data = await query_classroom_by_id(job.room.name, config.classroom_supabase)

if room_data:
    tenant_context = {
        # ... existing fields
        "translation_prompt": room_data.get("translation_prompt")  # NEW
    }
```

### D. translator.py - Direct Prompt Priority

```python
# BEFORE
async def _initialize_prompt(self):
    # PRIORITY 1: Custom prompt from metadata
    custom_prompt = self.tenant_context.get('customPrompt')

# AFTER
async def _initialize_prompt(self):
    # PRIORITY 1: Direct prompt from database (NEW)
    direct_prompt = self.tenant_context.get('translation_prompt')
    if direct_prompt:
        # ... use direct prompt (implementation shown above)
        return

    # PRIORITY 2: Custom prompt from metadata (existing)
    custom_prompt = self.tenant_context.get('customPrompt')
```

---

## Success Criteria

### Mosque Dashboard

- ✅ Existing mosque rooms continue to work
- ✅ No changes to mosque database required
- ✅ Mosque custom prompts still function
- ✅ No regression in mosque flow

### Classroom Module

- ✅ Classroom rooms query classroom database
- ✅ Custom prompts stored in classroom table
- ✅ Translation uses classroom-specific prompts
- ✅ Easy to update prompts via UI
- ✅ Organization isolation maintained

### Both Systems

- ✅ Can run simultaneously
- ✅ Independent database access
- ✅ No conflicts or interference
- ✅ Each system queries its own database

---

## Conclusion

**The dual database approach is simpler and more reliable** than LiveKit metadata because:

1. **Proven Pattern**: Uses the same architecture as the working mosque dashboard
2. **Minimal Changes**: Only ~60 lines of adapter code + 3 database columns
3. **Persistent Storage**: Prompts survive room deletion/recreation
4. **Easy Management**: Simple UI to update prompts
5. **Backward Compatible**: Mosque dashboard completely unaffected

**Next Steps**:
1. Run database migration (5 minutes)
2. Update Bayaan server code (30 minutes)
3. Add environment variables (2 minutes)
4. Test with aqeedah classroom (15 minutes)
5. Build classroom management UI (1 hour)

Total implementation time: ~2-3 hours