# Translation Agent Implementation - Quick Start Guide

**Last Updated**: 2025-10-08

**Status**: Ready to implement

---

## 📚 Documentation Overview

### Planning Documents (Read First)
1. ✅ **`TRANSLATION_AGENT_NODEJS_MIGRATION_PLAN.md`** - Complete migration strategy
2. ✅ **`EXISTING_IMPLEMENTATION_INVENTORY.md`** - What's already built
3. ✅ **`DECOUPLING_PYTHON_AGENT.md`** - How to handle Python agent
4. ✅ **`SELECTIVE_DECOUPLING_STRATEGY.md`** - Keep Python for other apps

### Implementation Documents (Follow in Order)
1. ✅ **`PHASE_1_FOUNDATION.md`** - Agent setup + RPC endpoint (2-3 hours)
2. ✅ **`PHASE_2_VAD_INTEGRATION.md`** - Silero audio segmentation (2-3 hours)
3. ✅ **`PHASE_3_TRANSLATION.md`** - Gemini translation pipeline (3-4 hours)
4. ✅ **`PHASE_4_MULTI_LANGUAGE.md`** - Multi-language support (2-3 hours)
5. ✅ **`PHASE_5_PRODUCTION.md`** - Production polish + deployment (2-3 hours)

**Total implementation time**: 12-16 hours

---

## 🚀 Quick Start (30 Seconds)

### Prerequisites

```bash
# Check you have these installed
node --version   # Should be v18+
pnpm --version   # Should be 8+
```

### Install Dependencies

```bash
cd /mnt/c/Users/HP/Desktop/meet

pnpm add @livekit/agents \
         @livekit/agents-plugin-silero \
         @google/generative-ai \
         zod
```

### Environment Variables

Your `.env.local` already has everything needed:
```env
✅ LIVEKIT_URL=wss://jamaa-app-4bix2j1v.livekit.cloud
✅ LIVEKIT_API_KEY=API3iYYRirpXUmf
✅ LIVEKIT_API_SECRET=xRjjlSejz3XRaLosRxWX8hTgLsy7XivDauvjTz8wT7C
✅ GEMINI_API_KEY=AIzaSyDAx85_XNdhBOqTQF3crTT4iD6sbCHXBX0
```

---

## 📖 Implementation Workflow

### Step-by-Step Process:

```
Phase 1: Foundation
├─ Create agents/ directory structure
├─ Install dependencies
├─ Create config.ts
├─ Create translation-worker.ts
├─ Create logger.ts
└─ ✅ TEST: Language dropdown appears

Phase 2: VAD Integration
├─ Load Silero VAD in prewarm
├─ Subscribe to teacher audio tracks
├─ Detect teacher from metadata
├─ Process audio with VAD
└─ ✅ TEST: Speech segments logged

Phase 3: Translation
├─ Create gemini-translator.ts
├─ Create translator-manager.ts
├─ Create types/index.ts
├─ Integrate translation pipeline
├─ Publish to LiveKit Transcription API
└─ ✅ TEST: Students see live captions

Phase 4: Multi-Language
├─ Track language usage per participant
├─ Handle participant disconnection
├─ Dynamic source language switching
├─ Remove unused languages
└─ ✅ TEST: 5 students, 5 languages simultaneously

Phase 5: Production
├─ Add error handling and retries
├─ Implement circuit breaker
├─ Add metrics and monitoring
├─ Create deployment configs (Docker, PM2)
├─ Load testing
└─ ✅ TEST: 1-hour stress test passes
```

---

## ⚡ Implementation Tips

### Before Each Phase:

1. **Read the phase document completely**
2. **Check prerequisites** (previous phase must pass all tests)
3. **Create a git branch** (e.g., `git checkout -b agent/phase-1`)
4. **Follow steps exactly** (don't skip verification tests)

### During Implementation:

- **Test frequently** (after each major change)
- **Check agent logs** (Terminal 2)
- **Check browser console** (Student tab)
- **Compare with Python agent** (if still running)

### After Each Phase:

- **Run all verification tests**
- **Commit your work**: `git add . && git commit -m "Phase X complete"`
- **Take a break!** (5-10 minutes)
- **Review next phase document**

---

## 🧪 Testing Strategy

### Test Hierarchy:

**Level 1: Unit Tests**
- Individual components (Gemini translator, manager)
- Run: `node --loader ts-node/esm agents/test-gemini.ts`

**Level 2: Integration Tests**
- Agent + LiveKit + Frontend
- Manual: Join room, test features

**Level 3: Load Tests**
- Multiple languages, high volume
- Run: `node --loader ts-node/esm agents/test-load.ts`

**Level 4: Stress Tests**
- 1 hour continuous operation
- Manual: Leave running, monitor

---

## 🐛 Common Issues & Quick Fixes

### "Cannot find module '@livekit/agents'"

**Fix**:
```bash
pnpm install @livekit/agents
```

---

### "GEMINI_API_KEY not set"

**Fix**:
```bash
# Check .env.local exists
cat .env.local | grep GEMINI

# If missing, add:
echo "GEMINI_API_KEY=YOUR_KEY_HERE" >> .env.local
```

---

### Agent doesn't connect to room

**Fix**:
```bash
# Check LiveKit credentials
echo $LIVEKIT_URL
echo $LIVEKIT_API_KEY

# Test connection
pnpm agent:dev
# Look for "✅ Connected to LiveKit room" in logs
```

---

### Language dropdown doesn't appear

**Checklist**:
- [ ] Agent running? (`pnpm agent:dev`)
- [ ] Agent logs show "RPC method registered: get/languages"?
- [ ] Student joined room?
- [ ] Check browser console for RPC errors

**Quick test**:
```javascript
// Browser console (student tab)
const agent = Array.from(room.remoteParticipants.values()).find(p => p.identity === 'agent');
console.log('Agent found:', agent ? 'YES' : 'NO');
```

---

### Translations don't appear

**Checklist**:
- [ ] Language selected? (Check dropdown has value)
- [ ] Teacher speaking? (Audio waveform visible)
- [ ] Agent logs show "Speech segment detected"?
- [ ] Agent logs show "Translations published"?

**Debug**:
```javascript
// Student browser console
room.on('TranscriptionReceived', (segments) => {
  console.log('📥 Received segments:', segments);
});
```

---

## 📊 Performance Benchmarks

### Expected Performance:

| Metric | Target | Good | Excellent |
|--------|--------|------|-----------|
| **Translation Latency** | <500ms | <300ms | <200ms |
| **Error Rate** | <1% | <0.5% | <0.1% |
| **Cache Hit Rate** | >30% | >50% | >70% |
| **Memory Usage** | <500MB | <300MB | <200MB |
| **API Cost/Hour** | <$1 | <$0.50 | <$0.25 |

### Your Results:

After Phase 5 load test, record your results here:

- Translation Latency: ___ms (avg)
- Error Rate: ___%
- Cache Hit Rate: ___%
- Memory Usage: ___MB
- API Cost/Hour: $___

---

## 🎯 Implementation Checklist

### Setup (Before Phase 1):
- [ ] Read all planning documents
- [ ] Understand Python agent architecture
- [ ] Verify frontend is ready (inventory doc)
- [ ] Check environment variables set

### Phase 1 (Foundation):
- [ ] Install dependencies
- [ ] Create project structure
- [ ] Implement basic agent
- [ ] RPC endpoint working
- [ ] **TEST**: Language dropdown appears

### Phase 2 (VAD):
- [ ] Load Silero VAD
- [ ] Subscribe to audio tracks
- [ ] Detect teacher
- [ ] Segment speech
- [ ] **TEST**: Segments logged

### Phase 3 (Translation):
- [ ] Create Gemini translator
- [ ] Integrate translation pipeline
- [ ] Publish transcriptions
- [ ] **TEST**: Live captions visible

### Phase 4 (Multi-Language):
- [ ] Track language per participant
- [ ] Handle disconnections
- [ ] Dynamic source language
- [ ] **TEST**: 5 languages simultaneously

### Phase 5 (Production):
- [ ] Error handling + retries
- [ ] Circuit breaker
- [ ] Metrics and monitoring
- [ ] Deployment config
- [ ] **TEST**: 1-hour stress test

---

## 🎓 Learning Resources

### LiveKit Agents JS:
- Official docs: https://docs.livekit.io/agents/
- GitHub: https://github.com/livekit/agents-js
- Examples: https://github.com/livekit/agents-js/tree/main/examples

### Gemini API:
- Get API key: https://aistudio.google.com/apikey
- Documentation: https://ai.google.dev/docs
- Pricing: https://ai.google.dev/pricing

### Silero VAD:
- GitHub: https://github.com/snakers4/silero-vad
- Paper: https://arxiv.org/abs/2104.04045

---

## 💰 Cost Estimation

### Development:
- Time: 12-16 hours
- Gemini API (testing): ~$10-20

### Production (Monthly):
- Gemini API: ~$750/month (100 hours of classrooms)
- Hosting: $0-25/month (same server or separate)
- **Total**: ~$750-775/month

**vs Python agent**: $7,867/month → **90% savings!**

---

## 🎉 Success! What's Next?

### Immediate:
1. Monitor for 1 week
2. Gather user feedback
3. Fine-tune based on usage

### Future Enhancements:
- [ ] Add real STT (replace mock text with actual speech-to-text)
- [ ] Custom terminology dictionaries
- [ ] Translation quality ratings
- [ ] Subtitle export (SRT/VTT files)
- [ ] Multi-teacher support
- [ ] Advanced caching strategies

---

## 📞 Getting Help

### If you get stuck:

1. **Check the phase document** for that specific step
2. **Review troubleshooting section** in the phase doc
3. **Check agent logs** for error messages
4. **Check browser console** for frontend errors
5. **Compare with working Python agent** (if available)

### Debugging Checklist:

```bash
# Agent side
pnpm agent:dev                  # Check logs
node --loader ts-node/esm agents/test-gemini.ts  # Test Gemini

# Frontend side
# Browser console → Network tab → Check WebSocket
# Browser console → Run: Array.from(room.remoteParticipants.values())

# Environment
echo $GEMINI_API_KEY            # Verify set
echo $LIVEKIT_URL               # Verify set
```

---

## 🏁 Final Notes

**You're building**:
- A production-grade real-time translation system
- With professional tools (LiveKit, Gemini, TypeScript)
- Following best practices (error handling, monitoring, testing)
- That will save 90% in costs vs Python agent

**Take your time with each phase**. Testing thoroughly at each step prevents issues later.

**Good luck! 🚀**

---

## 📋 Phase Document Links

Jump directly to implementation:

- 📘 **[PHASE_1_FOUNDATION.md](./PHASE_1_FOUNDATION.md)** ← Start here!
- 📘 **[PHASE_2_VAD_INTEGRATION.md](./PHASE_2_VAD_INTEGRATION.md)**
- 📘 **[PHASE_3_TRANSLATION.md](./PHASE_3_TRANSLATION.md)**
- 📘 **[PHASE_4_MULTI_LANGUAGE.md](./PHASE_4_MULTI_LANGUAGE.md)**
- 📘 **[PHASE_5_PRODUCTION.md](./PHASE_5_PRODUCTION.md)**
