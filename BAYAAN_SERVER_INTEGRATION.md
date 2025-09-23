# Bayaan Server Integration Guide

## Overview

This document explains how to integrate the **Bayaan LiveKit Agent** (production translation server) with the current classroom video conferencing system. The Bayaan server provides superior translation quality with advanced features like sentence context preservation and multi-language support.

## Architecture Comparison

### Current Local Translation Agent
- **Location**: `translation_agent/main.py`
- **Model**: OpenAI GPT-4o for transcription and translation
- **Architecture**: Runs as a local Python agent
- **Languages**: 11 supported languages
- **Features**: Real-time translation, participant language preferences
- **Limitations**: Requires local resources, simpler context handling

### Bayaan Server (Production)
- **Location**: Deployed on Render as a background worker
- **Model**: Speechmatics for transcription + OpenAI for translation
- **Architecture**: Cloud-based LiveKit agent with Supabase integration
- **Languages**: Arabic focus with multi-language translation support
- **Features**:
  - Advanced sentence context preservation
  - Database persistence for transcripts
  - Resource management with heartbeat monitoring
  - Production-grade error handling
  - Webhook support for room events

## Key Differences

| Feature | Local Translation Agent | Bayaan Server |
|---------|------------------------|---------------|
| Deployment | Local Python process | Cloud (Render) |
| Transcription | OpenAI Whisper | Speechmatics |
| Translation | OpenAI GPT | OpenAI GPT with context |
| Database | None | Supabase |
| Scalability | Limited to local resources | Cloud-scalable |
| Context Preservation | Basic | Advanced sentence buffering |
| Monitoring | Basic logging | Heartbeat monitoring + health checks |

## Integration Approach

### Option 1: Direct Bayaan Server Integration (Recommended)

The Bayaan server can be integrated directly with your classroom system:

1. **Deploy Bayaan Server**: Deploy the Bayaan server to Render or your preferred cloud provider
2. **Configure LiveKit**: Point your LiveKit instance to use the Bayaan agent
3. **Room Creation**: When creating rooms, the Bayaan agent automatically joins
4. **Translation Flow**:
   - Teacher speaks → Bayaan transcribes → Translates → Broadcasts to students
   - Students receive translations via LiveKit data channels

### Option 2: Hybrid Approach

Keep both systems and choose based on requirements:
- Use local agent for development/testing
- Use Bayaan server for production with better quality

## Configuration Steps

### 1. Deploy Bayaan Server

```bash
# Clone the Bayaan server repository
git clone <bayaan-server-repo>
cd mbongaa-bayaan-server

# Configure environment variables
cp .env.example .env
```

### 2. Set Environment Variables

Create a `.env` file with:

```env
# LiveKit Configuration (same as your classroom app)
LIVEKIT_URL=wss://your-livekit-server.livekit.cloud
LIVEKIT_API_KEY=your-api-key
LIVEKIT_API_SECRET=your-api-secret

# OpenAI for translation
OPENAI_API_KEY=your-openai-key

# Supabase for persistence
SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-supabase-key

# Speechmatics for transcription
SPEECHMATICS_API_KEY=your-speechmatics-key

# Optional: Configuration
TRANSLATION_DEFAULT_SOURCE_LANGUAGE=ar
TRANSLATION_DEFAULT_TARGET_LANGUAGES=["en","es","fr"]
```

### 3. Deploy to Render

1. Create a new Background Worker on Render
2. Connect your GitHub repository
3. Set build command: `pip install -r requirements.txt`
4. Set start command: `python main_production.py`
5. Add all environment variables from `.env`
6. Deploy

### 4. Update Classroom Application

In your classroom application (`app/api/connection-details/route.ts`), ensure the agent can join:

```typescript
// When creating tokens for classroom mode
if (isClassroom && role === 'teacher') {
  // Teacher tokens should include agent permissions
  grant = {
    ...existingGrant,
    roomAdmin: true,
    roomRecord: true,
    // Agent will join automatically via Bayaan server
  };
}
```

### 5. Agent Auto-Join Configuration

The Bayaan server automatically joins rooms when they're created. The `request_fnc` in Bayaan accepts all room requests:

```python
async def request_fnc(req: JobRequest):
    await req.accept(
        name="agent",
        identity="agent",
    )
```

## Benefits of Using Bayaan Server

### 1. Superior Translation Quality
- **Speechmatics transcription**: Industry-leading accuracy for Arabic and other languages
- **Sentence context preservation**: Maintains context across sentence boundaries
- **Domain-specific models**: Supports specialized vocabulary (medical, legal, etc.)

### 2. Production-Ready Features
- **Database persistence**: All transcripts stored in Supabase
- **Health monitoring**: Automatic cleanup of ghost sessions
- **Resource management**: Efficient handling of multiple concurrent translations
- **Error recovery**: Robust error handling with automatic retries

### 3. Scalability
- **Cloud deployment**: Scales with your user base
- **Parallel processing**: Handles multiple languages simultaneously
- **Optimized performance**: Production-grade optimizations

### 4. Advanced Features
- **Webhook support**: Integration with external systems
- **Broadcast channels**: Real-time updates to all participants
- **Session management**: Tracks active sessions and participants

## Migration Path

### Phase 1: Parallel Testing
1. Keep existing local translation agent
2. Deploy Bayaan server in staging
3. Test with subset of classrooms
4. Compare translation quality

### Phase 2: Gradual Migration
1. Enable Bayaan for new classrooms
2. Monitor performance and feedback
3. Migrate existing classrooms gradually
4. Keep local agent as fallback

### Phase 3: Full Migration
1. All classrooms use Bayaan server
2. Local agent kept for development only
3. Monitor and optimize Bayaan configuration

## Testing Instructions

### 1. Test Bayaan Server Connection

```bash
# Check if Bayaan server is running
curl https://your-bayaan-server.onrender.com/health

# Should return: {"status": "healthy"}
```

### 2. Test with LiveKit Room

1. Create a test room in your classroom app
2. Join as teacher with Arabic language selected
3. Check Bayaan server logs for connection:
   ```
   🎯 Received job request for room: [room-name]
   ✅ Agent joined room successfully
   ```

### 3. Verify Translation Flow

1. Teacher speaks in Arabic
2. Check Bayaan logs for transcription:
   ```
   📝 Transcription: [Arabic text]
   🌍 Translation to English: [English text]
   ```
3. Students should receive translations in TranslationPanel

### 4. Monitor Performance

Check Bayaan server metrics:
- Transcription latency: Should be <500ms
- Translation latency: Should be <1s
- Memory usage: Should be stable
- Error rate: Should be <1%

## Integration with Current TranslationPanel

The current `TranslationPanel.tsx` uses LiveKit's transcription events. To integrate with Bayaan:

1. **No changes needed**: Bayaan publishes transcriptions via LiveKit's standard transcription API
2. **Data flow**:
   - Bayaan transcribes → Publishes to LiveKit → TranslationPanel receives via `RoomEvent.Transcription`
3. **Language selection**: Still works via participant attributes

## Troubleshooting

### Common Issues

1. **Agent not joining rooms**
   - Check LiveKit credentials in Bayaan server
   - Verify room creation includes agent webhook
   - Check Bayaan server logs for errors

2. **No translations appearing**
   - Verify Speechmatics API key
   - Check OpenAI API key and credits
   - Monitor Bayaan server logs for transcription events

3. **High latency**
   - Check Render server region (should be close to LiveKit)
   - Monitor resource usage on Render
   - Consider upgrading Render instance

### Debug Commands

```bash
# Check Bayaan logs on Render
render logs --tail

# Test Speechmatics connection
curl -X POST https://api.speechmatics.com/v2/jobs \
  -H "Authorization: Bearer YOUR_API_KEY"

# Test OpenAI connection
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer YOUR_API_KEY"
```

## Conclusion

The Bayaan server provides a production-ready, scalable solution for real-time translation in your classroom system. Its advanced features like sentence context preservation and Speechmatics transcription offer superior quality compared to the local agent. The integration is straightforward as it uses LiveKit's standard agent framework, requiring minimal changes to your existing codebase.

## References

- Bayaan Server Source: `Gitingest - ZOOM MODULE BRAINSTORM/mbongaa-bayaan-server-8a5edab282632443.txt`
- Local Translation Agent: `translation_agent/main.py`
- LiveKit Agents Documentation: https://docs.livekit.io/agents/
- Speechmatics API: https://docs.speechmatics.com/
- Render Deployment: https://render.com/docs/background-workers