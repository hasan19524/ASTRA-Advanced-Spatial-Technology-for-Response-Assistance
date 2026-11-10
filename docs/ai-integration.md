# ASTRA — Gnani AI Integration

This document describes the Gnani AI integration honestly, distinguishing what
is implemented and verified from what is not integrated.

## Summary

| Component | Endpoint | Status | Integrated in product path? |
|-----------|----------|--------|-----------------------------|
| **Prisma STT** (speech-to-text) | `POST /api/v1/voice/stt` → `https://api.vachana.ai/stt/v3` | Implemented & live | Yes — report form → transcript → persisted incident |
| **Timbre TTS** (text-to-speech) | `POST /api/v1/voice/tts` → `https://api.vachana.ai/api/v1/tts/inference` | Implemented server-side | Yes — server-side; UI consumer exists ("Listen" on assistant answers) |
| **Evon LLM** | — | Not integrated | No — key returns `403 SCOPE_NOT_ALLOWED` (no LLM scope); fix is in the Gnani console, not the code |

## Prisma STT (speech-to-text)

**What it does.** Converts a citizen's voice report into text. The transcript is
inserted into the report description and persisted as incident content.

**Request flow.**
1. Browser records audio (prefers `audio/ogg`, Gnani-supported format; WebM
   fallback).
2. Frontend POSTs `multipart` audio + `language_code` to
   `POST /api/v1/voice/stt` (JWT required).
3. Backend (`api/app/services/voice_service.py`):
   - Validates the content type against Gnani-supported input types
     (wav, mp3, ogg, flac, aac, mp4).
   - Transcodes WebM/Opus → 16 kHz mono PCM WAV via ffmpeg (located on PATH or
     from the `imageio-ffmpeg` wheel) before forwarding. WebM is NOT a Gnani
     STT input format.
   - Rejects unsupported formats with 422 before burning a Gnani call.
   - Calls `POST {GNANI_BASE_URL}/stt/v3` with header `X-API-Key-ID` (not
     Bearer), multipart `audio_file` + `language_code`, 90 s timeout, one retry
     on HTTP 504.
4. Response JSON parsed for `transcript`, persisted as the incident description.

**Configuration.** Set in `api/.env` (never committed):

```
GNANI_API_KEY=<real key>
GNANI_BASE_URL=https://api.vachana.ai
```

The auth header is `X-API-Key-ID` — never `Authorization: Bearer`. The key
stays server-side.

## Timbre TTS (text-to-speech)

**What it does.** Synthesizes text into WAV audio. Server-side only; the
backend proxies Gnani and returns raw WAV bytes to the client.

**Request flow.**
1. Client POSTs `{"text", "language_code", "voice"}` to
   `POST /api/v1/voice/tts` (JWT required, validated `TtsIn` schema:
   text 1–5000 chars).
2. Backend calls `POST {GNANI_BASE_URL}/api/v1/tts/inference` with header
   `X-API-Key-ID`, JSON body (model `timbre-v2.5`, 48 kHz mono linear PCM
   WAV).
3. Raw WAV bytes returned to client.

**Configuration.** Same `GNANI_API_KEY` / `GNANI_BASE_URL` as STT.

## Evon LLM

**Status: not integrated.** The Gnani key provisioned for this project returns
`403 SCOPE_NOT_ALLOWED` — it has no LLM scope. Enabling Evon is an operational
action in the Gnani console, not a code change. No Evon code path exists in the
repository. Do not claim Evon functionality.

## Assistant LLM (separate from Gnani)

ASTRA's assistant chat uses a multi-provider chain independent of Gnani:
Groq → OpenRouter → NVIDIA → deterministic rules stub. Every reply returns
`{"reply", "provider"}` where `provider` is `llm:<model>` or `rules_stub`, so
the UI always discloses which engine answered.

## How to configure Gnani

1. Register at https://app.gnani.ai/voice/ and obtain a real API key.
2. Put the real value in `api/.env` (gitignored, never committed):

   ```
   GNANI_API_KEY=<real key>
   GNANI_BASE_URL=https://api.vachana.ai
   ```

3. Leave `GNANI_API_KEY` blank to degrade honestly (STT/TTS endpoints return a
   clear error instead of a fabricated transcript/audio).
4. Never put the key in `NEXT_PUBLIC_*`, response bodies, logs, or frontend
   code.

## Honest degradation

- STT/TTS are provider-backed. Without a configured key they return an error
  rather than faking a transcript or audio.
- A failed STT call (after one retry on 504) surfaces a clear error to the
  caller; the incident is not silently created with empty text.
- Unsupported audio formats are rejected with 422 before any Gnani spend.