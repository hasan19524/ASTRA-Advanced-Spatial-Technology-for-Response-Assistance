"""Gnani voice proxy — Phase 2 (T3)."""

from __future__ import annotations

import asyncio

import httpx

from app.core.config import settings


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


def _headers() -> dict:
    return {"X-API-Key-ID": settings.gnani_api_key}


async def stt(audio_bytes: bytes, filename: str, language_code: str) -> str:
    url = f"{settings.gnani_base_url.rstrip('/')}/stt/v3"
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
