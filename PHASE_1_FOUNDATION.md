# Phase 1: Agent Foundation

**Goal**: Create basic agent structure that connects to LiveKit and registers RPC endpoint

**Duration**: 2-3 hours

**Status**: Ready to implement

---

## 📋 Prerequisites Checklist

Before starting:

- [ ] Node.js 18+ installed
- [ ] pnpm package manager installed
- [ ] `.env.local` file with LiveKit + Gemini credentials
- [ ] Python Bayaan agent stopped or filtered (see `SELECTIVE_DECOUPLING_STRATEGY.md`)
- [ ] Next.js app running (`pnpm dev`)

---

## 🎯 Phase 1 Deliverables

1. ✅ Agent project structure created
2. ✅ Dependencies installed
3. ✅ Agent connects to LiveKit rooms
4. ✅ RPC method `get/languages` returns language list
5. ✅ Frontend `LanguageSelect` dropdown shows languages

---

## 📦 Step 1: Install Dependencies

```bash
cd /mnt/c/Users/HP/Desktop/meet

# Install LiveKit Agents and plugins
pnpm add @livekit/agents @livekit/agents-plugin-silero

# Install Gemini SDK (direct, not LiveKit plugin)
pnpm add @google/generative-ai

# Install utilities
pnpm add zod

# Install dev dependencies
pnpm add -D ts-node @types/node
```

**Verification**:
```bash
# Check package.json
grep -A 3 "@livekit/agents" package.json
```

Expected output:
```json
"@livekit/agents": "^0.x.x",
"@livekit/agents-plugin-silero": "^0.x.x",
"@google/generative-ai": "^0.x.x",
```

---

## 📁 Step 2: Create Project Structure

```bash
# Create directories
mkdir -p agents/translators
mkdir -p agents/vad
mkdir -p agents/utils
mkdir -p agents/types

# Verify structure
ls -R agents/
```

Expected output:
```
agents/:
translators/  vad/  utils/  types/

agents/translators:

agents/vad:

agents/utils:

agents/types:
```

---

## ⚙️ Step 3: Create Configuration File

**File**: `agents/config.ts`

```typescript
export const config = {
  // LiveKit Configuration
  livekit: {
    url: process.env.LIVEKIT_URL || '',
    apiKey: process.env.LIVEKIT_API_KEY || '',
    apiSecret: process.env.LIVEKIT_API_SECRET || ''
  },

  // Gemini Configuration
  gemini: {
    apiKey: process.env.GEMINI_API_KEY || '',
    model: 'gemini-1.5-flash',
    temperature: 0.3,
    maxOutputTokens: 500
  },

  // Translation Configuration
  translation: {
    supportedLanguages: [
      'en', // English
      'es', // Spanish
      'fr', // French
      'de', // German
      'nl', // Dutch
      'ar', // Arabic
      'zh', // Chinese
      'ja', // Japanese
      'ko', // Korean
      'pt', // Portuguese
      'ru'  // Russian
    ],
    defaultSourceLanguage: 'en',
    cacheEnabled: true,
    cacheSize: 1000
  },

  // Agent Configuration
  agent: {
    identity: 'agent',
    name: 'Translation Agent'
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info'
  }
};

// Validation
export function validateConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!config.livekit.url) errors.push('LIVEKIT_URL not set');
  if (!config.livekit.apiKey) errors.push('LIVEKIT_API_KEY not set');
  if (!config.livekit.apiSecret) errors.push('LIVEKIT_API_SECRET not set');
  if (!config.gemini.apiKey) errors.push('GEMINI_API_KEY not set');

  return {
    valid: errors.length === 0,
    errors
  };
}
```

---

## 🔧 Step 4: Create Logger Utility

**File**: `agents/utils/logger.ts`

```typescript
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

class Logger {
  private level: LogLevel;

  constructor(level: LogLevel = 'info') {
    this.level = level;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: Record<LogLevel, number> = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3
    };

    return levels[level] >= levels[this.level];
  }

  private formatMessage(level: LogLevel, message: string, data?: any): string {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;

    if (data) {
      return `${prefix} ${message} ${JSON.stringify(data)}`;
    }

    return `${prefix} ${message}`;
  }

  debug(message: string, data?: any) {
    if (this.shouldLog('debug')) {
      console.log(this.formatMessage('debug', message, data));
    }
  }

  info(message: string, data?: any) {
    if (this.shouldLog('info')) {
      console.log(this.formatMessage('info', message, data));
    }
  }

  warn(message: string, data?: any) {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', message, data));
    }
  }

  error(message: string, data?: any) {
    if (this.shouldLog('error')) {
      console.error(this.formatMessage('error', message, data));
    }
  }
}

export const logger = new Logger(process.env.LOG_LEVEL as LogLevel || 'info');
```

---

## 🤖 Step 5: Create Main Agent Worker

**File**: `agents/translation-worker.ts`

```typescript
import {
  type JobContext,
  type JobProcess,
  WorkerOptions,
  cli,
  defineAgent,
} from '@livekit/agents';
import { RoomEvent } from 'livekit-client';
import { config, validateConfig } from './config';
import { logger } from './utils/logger';
import { fileURLToPath } from 'node:url';

// Language metadata
interface Language {
  code: string;
  name: string;
  flag: string;
}

const LANGUAGES: Language[] = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'es', name: 'Spanish', flag: '🇪🇸' },
  { code: 'fr', name: 'French', flag: '🇫🇷' },
  { code: 'de', name: 'German', flag: '🇩🇪' },
  { code: 'nl', name: 'Dutch', flag: '🇳🇱' },
  { code: 'ar', name: 'Arabic', flag: '🇸🇦' },
  { code: 'zh', name: 'Chinese', flag: '🇨🇳' },
  { code: 'ja', name: 'Japanese', flag: '🇯🇵' },
  { code: 'ko', name: 'Korean', flag: '🇰🇷' },
  { code: 'pt', name: 'Portuguese', flag: '🇵🇹' },
  { code: 'ru', name: 'Russian', flag: '🇷🇺' }
];

export default defineAgent({
  prewarm: async (proc: JobProcess) => {
    logger.info('🔥 Prewarming agent...');

    // Validate configuration
    const validation = validateConfig();
    if (!validation.valid) {
      logger.error('❌ Configuration validation failed', { errors: validation.errors });
      throw new Error(`Configuration errors: ${validation.errors.join(', ')}`);
    }

    logger.info('✅ Configuration validated');
    logger.info('✅ Agent prewarmed successfully');
  },

  entry: async (ctx: JobContext) => {
    logger.info(`🚀 Agent starting for room: ${ctx.room.name}`);

    try {
      // Connect to room
      await ctx.connect();
      logger.info('✅ Connected to LiveKit room', {
        roomName: ctx.room.name,
        roomSid: ctx.room.sid
      });

      // Set agent identity
      logger.info(`🤖 Agent identity: ${config.agent.identity}`);

      // Register RPC method: get/languages
      ctx.room.localParticipant.registerRpcMethod(
        'get/languages',
        async (data: any) => {
          logger.info('📡 RPC call received: get/languages');

          const response = JSON.stringify(LANGUAGES);
          logger.debug('📤 Returning languages', { count: LANGUAGES.length });

          return response;
        }
      );

      logger.info('✅ RPC method registered: get/languages');

      // Log room state
      logger.info('📊 Room state', {
        participants: ctx.room.remoteParticipants.size,
        localIdentity: ctx.room.localParticipant.identity
      });

      // Listen for participant connections
      ctx.room.on(RoomEvent.ParticipantConnected, (participant: any) => {
        logger.info('👤 Participant connected', {
          identity: participant.identity,
          name: participant.name
        });
      });

      // Listen for participant disconnections
      ctx.room.on(RoomEvent.ParticipantDisconnected, (participant: any) => {
        logger.info('👋 Participant disconnected', {
          identity: participant.identity
        });
      });

      // Listen for participant attribute changes
      ctx.room.on(RoomEvent.ParticipantAttributesChanged, (
        changedAttributes: Record<string, string>,
        participant: any
      ) => {
        logger.info('🔄 Participant attributes changed', {
          identity: participant.identity,
          changes: changedAttributes
        });

        // Log speaking_language changes (teacher)
        if (changedAttributes['speaking_language']) {
          logger.info('🎤 Teacher language changed', {
            language: changedAttributes['speaking_language']
          });
        }

        // Log captions_language changes (student)
        if (changedAttributes['captions_language']) {
          logger.info('📝 Student caption language changed', {
            language: changedAttributes['captions_language']
          });
        }
      });

      logger.info('🎯 Agent ready and listening');

      // Keep agent alive
      await new Promise(() => {}); // Never resolves, keeps agent running

    } catch (error) {
      logger.error('❌ Agent error', { error });
      throw error;
    }
  },
});

// CLI entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  cli.runApp(new WorkerOptions({
    agent: fileURLToPath(import.meta.url)
  }));
}
```

---

## 📝 Step 6: Update package.json Scripts

**File**: `package.json`

Add these scripts:

```json
{
  "scripts": {
    "agent:dev": "node --loader ts-node/esm agents/translation-worker.ts dev",
    "agent:start": "node --loader ts-node/esm agents/translation-worker.ts start",
    "agent:build": "tsc agents/translation-worker.ts --outDir dist/agents"
  }
}
```

---

## ✅ Step 7: Verification Test

### Test 1: Configuration Validation

```bash
# Create test script
cat > agents/test-config.ts << 'EOF'
import { config, validateConfig } from './config';

console.log('Testing configuration...');
console.log('LiveKit URL:', config.livekit.url ? '✅ Set' : '❌ Missing');
console.log('LiveKit API Key:', config.livekit.apiKey ? '✅ Set' : '❌ Missing');
console.log('Gemini API Key:', config.gemini.apiKey ? '✅ Set' : '❌ Missing');

const validation = validateConfig();
if (validation.valid) {
  console.log('\n✅ Configuration is valid!');
} else {
  console.error('\n❌ Configuration errors:', validation.errors);
  process.exit(1);
}
EOF

# Run test
node --loader ts-node/esm agents/test-config.ts
```

**Expected output**:
```
Testing configuration...
LiveKit URL: ✅ Set
LiveKit API Key: ✅ Set
Gemini API Key: ✅ Set

✅ Configuration is valid!
```

---

### Test 2: Start Agent (Development Mode)

**Terminal 1** (Next.js app):
```bash
cd /mnt/c/Users/HP/Desktop/meet
pnpm dev
```

**Terminal 2** (Agent):
```bash
cd /mnt/c/Users/HP/Desktop/meet
pnpm agent:dev
```

**Expected agent logs**:
```
[2025-10-08T...] [INFO] 🔥 Prewarming agent...
[2025-10-08T...] [INFO] ✅ Configuration validated
[2025-10-08T...] [INFO] ✅ Agent prewarmed successfully
[2025-10-08T...] [INFO] 🚀 Agent starting for room: ...
[2025-10-08T...] [INFO] ✅ Connected to LiveKit room
[2025-10-08T...] [INFO] ✅ RPC method registered: get/languages
[2025-10-08T...] [INFO] 🎯 Agent ready and listening
```

---

### Test 3: Frontend Integration

1. **Open browser**: http://localhost:3000
2. **Navigate to**: `/t/test-room-123?classroom=true&role=teacher`
3. **Enter your name**: "Test Teacher"
4. **Join room**
5. **Look for language dropdown** (should appear after 3-5 seconds)

**Expected frontend behavior**:
- ⏳ Shows "Loading languages..." initially
- ✅ Language dropdown appears with flags
- ✅ Shows: 🇺🇸 English, 🇪🇸 Spanish, 🇫🇷 French, etc.

**Check browser console**:
```javascript
// Should see
"Found agent participant: agent"
"📡 Fetched languages from agent"
```

**Check agent logs**:
```
[INFO] 👤 Participant connected {"identity": "Test Teacher__..."}
[INFO] 📡 RPC call received: get/languages
[INFO] 📤 Returning languages {"count": 11}
```

---

## 🐛 Troubleshooting

### Issue: "LIVEKIT_URL not set"

**Solution**: Check `.env.local`:
```bash
grep LIVEKIT_URL .env.local
```

Make sure variables are set without quotes:
```env
LIVEKIT_URL=wss://your-project.livekit.cloud
```

---

### Issue: Agent doesn't connect to room

**Solution**: Check LiveKit credentials:

1. **Verify URL format**:
   ```bash
   echo $LIVEKIT_URL
   # Should be: wss://...livekit.cloud (not https://)
   ```

2. **Test credentials**:
   ```bash
   # Try joining a test room
   pnpm agent:dev
   # Check logs for connection errors
   ```

3. **Check firewall**: Make sure port 443 (WSS) is open

---

### Issue: Frontend doesn't find agent

**Symptoms**:
- Language dropdown shows "⏳ Waiting for translation service..."
- Never changes to dropdown

**Solution**:

1. **Check agent identity**:
   ```typescript
   // agents/translation-worker.ts
   // Verify agent uses identity="agent"
   ```

2. **Check frontend**:
   ```typescript
   // app/components/LanguageSelect.tsx line 44
   // Verify it looks for identity === 'agent'
   ```

3. **Check agent is in room**:
   ```javascript
   // Browser console
   const room = window.room;
   Array.from(room.remoteParticipants.values()).map(p => p.identity);
   // Should include "agent"
   ```

---

### Issue: RPC call fails

**Symptoms**:
- Frontend console: "Failed to get languages from agent"
- Agent doesn't log RPC call

**Solution**:

1. **Check RPC registration**:
   ```typescript
   // Verify in translation-worker.ts
   ctx.room.localParticipant.registerRpcMethod('get/languages', ...)
   ```

2. **Check method name** (case-sensitive):
   ```typescript
   // Must be exactly: "get/languages"
   // NOT: "get_languages" or "getLanguages"
   ```

3. **Check response format**:
   ```typescript
   // Must return JSON string, not object
   return JSON.stringify(LANGUAGES); // ✅ Correct
   return LANGUAGES;                  // ❌ Wrong
   ```

---

## ✅ Phase 1 Success Criteria

Before proceeding to Phase 2, verify:

- [x] Agent starts without errors
- [x] Agent connects to LiveKit room
- [x] Agent logs show "Agent ready and listening"
- [x] Frontend language dropdown appears (3-5 seconds after joining)
- [x] Dropdown shows 11 languages with flags
- [x] No errors in browser console
- [x] No errors in agent logs

---

## 🎉 Phase 1 Complete!

**What we built**:
- ✅ Agent project structure
- ✅ Configuration system
- ✅ Logger utility
- ✅ Main agent worker
- ✅ RPC endpoint for languages
- ✅ Frontend integration working

**What's working**:
- ✅ Agent joins rooms automatically
- ✅ Frontend discovers agent
- ✅ Language selection UI functional

**What's NOT working yet** (expected):
- ❌ No audio processing (Phase 2)
- ❌ No translation (Phase 3)
- ❌ No live captions (Phase 3)

---

## 📚 Next Steps

**Ready for Phase 2?**

Once all Phase 1 success criteria are met, proceed to:

**`PHASE_2_VAD_INTEGRATION.md`** - Silero VAD audio segmentation

Phase 2 will add:
- Audio track subscription
- Silero VAD integration
- Speech segment extraction
- Teacher audio processing

---

## 📞 Need Help?

**Common issues**:
- Configuration errors → Check `.env.local`
- Connection failures → Verify LiveKit credentials
- RPC failures → Check agent identity and method name
- Frontend issues → Check browser console

**Logs to check**:
1. Agent terminal output
2. Next.js terminal output
3. Browser developer console
4. Network tab (for WebSocket connection)

**Files to review**:
- `agents/config.ts` - Configuration
- `agents/translation-worker.ts` - Main logic
- `app/components/LanguageSelect.tsx` - Frontend integration
