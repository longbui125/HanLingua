---
title: HanLingua Whisper API
emoji: 🎙️
colorFrom: red
colorTo: pink
sdk: docker
app_port: 7860
pinned: false
---

# HanLingua Whisper API

Korean speech-to-text transcription API powered by Whisper large-v3-turbo.

## API Endpoints

### `GET /`
Health check. Returns model info and device status.

### `POST /transcribe`
Upload an audio file and receive Korean transcript.

**Parameters:**
- `file` (form-data): Audio file (.mp3, .m4a, .wav, .ogg, .flac, .webm, .mp4)
- `api_key` (query, optional): API key for authentication

**Response:**
```json
{
  "transcript": ["sentence 1", "sentence 2"],
  "full_text": "sentence 1 sentence 2"
}
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `WHISPER_API_KEY` | Optional API key to protect the endpoint |
| `ALLOWED_ORIGINS` | Comma-separated list of allowed CORS origins |
