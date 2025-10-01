# LiveKit Translation Agent Integration Guide

## Overview

This guide documents the integration of a real-time translation agent into the mbongaa-classroom application. The system provides live transcription and translation of teacher speech, delivering captions to students in their preferred language.

## Architecture

### Components

1. **Python Translation Agent** (`translation_agent/`)
   - Connects to LiveKit rooms as an agent participant
   - Identifies and transcribes teacher audio using OpenAI STT
   - Translates transcriptions to student-selected languages using OpenAI LLM
   - Publishes translations as LiveKit transcriptions

2. **Frontend Components**
   - `LanguageSelect`: Language selection dropdown with RPC integration
   - `Captions`: Live caption display overlay
   - `usePartyState`: State management for caption settings

3. **Integration Points**
   - Teacher identification via participant metadata (`role: "teacher"`)
   - Language selection via participant attributes
   - RPC for fetching available languages
   - Transcription events for caption delivery

## Setup Instructions

### Prerequisites

- Python 3.8+
- Node.js 18+
- LiveKit Cloud account or self-hosted LiveKit server
- OpenAI API key

### Step 1: Configure the Translation Agent

1. Navigate to the translation agent directory:

```bash
cd translation_agent
```

2. Install Python dependencies:

```bash
pip install -r requirements.txt
```

3. Configure environment variables in `.env`:

```env
# LiveKit Configuration
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=YOUR_API_KEY
LIVEKIT_API_SECRET=YOUR_API_SECRET

# OpenAI Configuration
OPENAI_API_KEY=YOUR_OPENAI_KEY
```

Replace the values with your actual LiveKit and OpenAI credentials.

### Step 2: Run the Translation Agent

Start the agent in development mode:

```bash
python main.py dev
```

The agent will:

- Connect to your LiveKit instance
- Automatically join any room created
- Wait for a teacher to join
- Begin transcribing and translating when teacher speaks

For production deployment:

```bash
python main.py start
```

### Step 3: Frontend Configuration

The frontend components are already integrated into the classroom application. No additional setup required.

### Step 4: Testing the Integration

1. **Start the Next.js application**:

```bash
pnpm dev
```

2. **Create a classroom session**:
   - Navigate to http://localhost:3000
   - Teacher: Use `/t/[roomName]` URL
   - Students: Use `/s/[roomName]` URL

3. **Verify the translation flow**:
   - Teacher joins and enables microphone
   - Agent automatically detects teacher and starts transcription
   - Students select their preferred language from the dropdown
   - Teacher speaks → transcriptions appear as captions for students

## Features

### Supported Languages

- 🇺🇸 English
- 🇪🇸 Spanish
- 🇫🇷 French
- 🇩🇪 German
- 🇯🇵 Japanese

To add more languages, edit `SUPPORTED_LANGUAGES` in `translation_agent/main.py`.

### UI Controls

- **Caption Toggle**: Enable/disable caption display
- **Language Selector**: Choose translation language
- **Caption Display**: Shows last 2 translation segments with fade effect

## Technical Details

### Teacher Detection

The agent identifies teachers by checking participant metadata:

```python
metadata = json.loads(participant.metadata)
if metadata.get("role") == "teacher":
    # Start transcription
```

### Translation Flow

1. Teacher audio → OpenAI STT → Transcription
2. Transcription → OpenAI LLM → Translation
3. Translation → LiveKit Transcription API → Student captions

### RPC Communication

Students fetch available languages via RPC:

```typescript
await room.localParticipant.performRpc({
  destinationIdentity: 'agent',
  method: 'get/languages',
  payload: '',
});
```

### Participant Attributes

Language selection is communicated via attributes:

```typescript
await room.localParticipant.setAttributes({
  captions_language: 'es', // Spanish
});
```

## Troubleshooting

### Agent Not Connecting

- Verify LiveKit credentials in `.env`
- Check network connectivity to LiveKit server
- Ensure agent has permission to join rooms

### No Transcriptions Appearing

- Confirm teacher has microphone enabled
- Check OpenAI API key is valid and has credits
- Verify teacher metadata contains `role: "teacher"`

### Language Selection Not Working

- Ensure agent is connected (check for "agent" participant)
- Verify RPC method is accessible
- Check browser console for errors

### Performance Issues

- Monitor OpenAI API rate limits
- Consider implementing caching for repeated phrases
- Adjust transcription segment length if needed

## Production Deployment

### Agent Deployment Options

1. **Docker Container**:

```dockerfile
FROM python:3.8-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
CMD ["python", "main.py", "start"]
```

2. **Process Manager (PM2)**:

```bash
pm2 start main.py --interpreter python3 --name translation-agent
```

3. **Systemd Service**:
   Create `/etc/systemd/system/translation-agent.service`:

```ini
[Unit]
Description=LiveKit Translation Agent
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/path/to/translation_agent
ExecStart=/usr/bin/python3 main.py start
Restart=always

[Install]
WantedBy=multi-user.target
```

### Scaling Considerations

- Run multiple agent instances for load balancing
- Implement Redis for shared state if needed
- Monitor OpenAI API usage and costs
- Consider caching common translations

### Security Best Practices

- Store credentials in environment variables or secrets management
- Implement rate limiting for API calls
- Validate and sanitize all user inputs
- Use HTTPS for all communications
- Regularly rotate API keys

## Monitoring

### Recommended Metrics

- Agent connection status
- Transcription latency
- Translation accuracy
- API usage and costs
- Error rates and types

### Logging

The agent logs important events:

- Teacher detection
- Language additions
- Translation completions
- Connection status

Monitor logs for debugging:

```bash
python main.py dev 2>&1 | tee agent.log
```

## API Integration Notes

### LiveKit Token Generation

Ensure tokens include metadata for role identification:

```typescript
const metadata = JSON.stringify({ role: userRole });
// Include metadata when generating token
```

### OpenAI Optimization

- Use streaming for lower latency
- Batch translations when possible
- Monitor token usage for cost control
- Consider using GPT-3.5 for cost savings

## Future Enhancements

### Potential Improvements

1. Add more language support
2. Implement translation caching
3. Add subtitle file export
4. Support multiple teachers
5. Add translation quality settings
6. Implement custom terminology dictionaries
7. Add speech rate adjustment
8. Support dialect variations

### Performance Optimizations

1. Implement local STT for lower latency
2. Use WebSockets for faster updates
3. Add translation pre-fetching
4. Implement segment batching
5. Add client-side caching

## Support

For issues or questions:

1. Check the troubleshooting section
2. Review agent logs for errors
3. Verify all credentials are correct
4. Ensure all dependencies are installed

## License

This integration follows the LiveKit and OpenAI terms of service. Ensure compliance with both platforms' usage policies.
