"""Gnani voice proxy — Phase 2 (T3)."""

from __future__ import annotations

import asyncio
import logging
import os
import subprocess
import tempfile

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

LANGUAGES = [
    {"code": "hi-IN", "name": "Hindi"},
    {"code": "en-IN", "name": "English (India)"},
    {"code": "bn-IN", "name": "Bengali"},
    {"code": "ta-IN", "name": "Tamil"},
    {"code": "te-IN", "name": "Telugu"},
    {"code": "mr-IN", "name": "Marathi"},
    {"code": "gu-IN", "name": "Gujarati"},
    {"code": "kn-IN", "name": "Kannada"},
    {"code": "ml-IN", "name": "Malayalam"},
    {"code": "pa-IN", "name": "Punjabi"},
]

# Gnani-documented STT input formats. WebM is NOT on this list — if the
# browser sends WebM we transcode to WAV before forwarding (audit finding G4).
SUPPORTED_INPUT_TYPES: frozenset[str] = frozenset(
    {
        "audio/wav",
        "audio/x-wav",
        "audio/mpeg",
        "audio/mp3",
        "audio/ogg",
        "audio/flac",
        "audio/aac",
        "audio/mp4",
    }
)


def _headers() -> dict:
    return {"X-API-Key-ID": settings.gnani_api_key}


def _transcode_webm_to_wav(audio_bytes: bytes) -> bytes:
    """Transcode WebM/Opus to 16 kHz mono 16-bit PCM WAV using ffmpeg.

    ffmpeg is a system dependency (already present on the host and in the
    build image); no new Python package is introduced.
    """
    with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as webm_file:
        webm_file.write(audio_bytes)
        webm_path = webm_file.name
    wav_path = webm_path.removesuffix(".webm") + ".wav"
    try:
        subprocess.run(
            [
                "ffmpeg",
                "-v",
                "error",
                "-i",
                webm_path,
                "-ar",
                "16000",
                "-ac",
                "1",
                "-c:a",
                "pcm_s16le",
                "-y",
                wav_path,
            ],
            check=True,
            capture_output=True,
            timeout=30,
        )
        with open(wav_path, "rb") as f:
            return f.read()
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired, OSError) as exc:
        logger.warning("WebM→WAV transcoding failed: %s", exc)
        # Return the original bytes as a last resort — Gnani may still accept
        # them, or will return a clear 4xx that we surface honestly.
        return audio_bytes
    finally:
        for path in (webm_path, wav_path):
            try:
                os.unlink(path)
            except OSError:
                pass


async def stt(
    audio_bytes: bytes,
    filename: str,
    language_code: str,
    content_type: str | None = None,
) -> str:
    url = f"{settings.gnani_base_url.rstrip('/')}/stt/v3"

    # Validate the content type. WebM is transcoded; anything else
    # unsupported is rejected with a clear error before we burn a Gnani call.
    if content_type and content_type not in SUPPORTED_INPUT_TYPES:
        if content_type in ("audio/webm", "video/webm"):
            logger.info("Transcoding WebM audio to WAV for Gnani STT")
            audio_bytes = _transcode_webm_to_wav(audio_bytes)
            filename = filename.removesuffix(".webm") + ".wav"
        else:
            raise ValueError(
                f"Unsupported audio format: {content_type}. "
                f"Supported: {sorted(SUPPORTED_INPUT_TYPES)}"
            )

    files = {"audio_file": (filename, audio_bytes)}
    data = {"language_code": language_code}
    async with httpx.AsyncClient(timeout=90.0) as client:
        for attempt in range(2):
            resp = await client.post(url, headers=_headers(), files=files, data=data)
            if resp.status_code == 504 and attempt == 0:
                await asyncio.sleep(0.5)
                continue
            resp.raise_for_status()
            payload = resp.json()
            return payload.get("transcript", "") or payload.get("text", "")
    raise RuntimeError("STT failed")


async def tts(text: str, language_code: str, voice: str = "Nalini") -> bytes:
    url = f"{settings.gnani_base_url.rstrip('/')}/api/v1/tts/inference"
    body = {
        "text": text,
        "voice": voice,
        "model": "timbre-v2.5",
        "language": language_code,
        "speed": 1.0,
        "audio_config": {
            "sample_rate": 48000,
            "num_channels": 1,
            "sample_width": 2,
            "encoding": "linear_pcm",
            "container": "wav",
        },
    }
    async with httpx.AsyncClient(timeout=90.0) as client:
        resp = await client.post(url, headers=_headers(), json=body)
        resp.raise_for_status()
        return resp.content


def languages() -> list[dict]:
    return LANGUAGES
