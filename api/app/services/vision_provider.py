"""Hosted vision providers (Phase 3).

Only hosted APIs — no local models. OpenAI (gpt-4o) is the wired default;
Gemini is provided as a documented stub so a free Google AI Studio key can be
plugged in later without touching the orchestrator.
"""

from __future__ import annotations

import base64
import logging
from abc import ABC, abstractmethod

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

OPENAI_BASE_URL = "https://api.openai.com/v1"


class VisionProviderInterface(ABC):
    """Abstract hosted vision provider."""

    @abstractmethod
    async def analyze(
        self,
        image_bytes: bytes,
        incident_description: str,
        category: str,
        content_type: str | None = None,
    ) -> str:
        """Return the raw model text (expected to be JSON)."""
        raise NotImplementedError


class OpenAIVisionProvider(VisionProviderInterface):
    """OpenAI gpt-4o vision provider."""

    def __init__(
        self,
        api_key: str | None = None,
        model: str | None = None,
        base_url: str | None = None,
        timeout: float = 25.0,
        client: httpx.AsyncClient | None = None,
    ) -> None:
        self.api_key = api_key if api_key is not None else settings.openai_api_key
        self.model = model if model is not None else settings.openai_vision_model
        self.base_url = (base_url or OPENAI_BASE_URL).rstrip("/")
        self.timeout = timeout
        self._client = client

    async def analyze(
        self,
        image_bytes: bytes,
        incident_description: str,
        category: str,
        content_type: str | None = None,
    ) -> str:
        if not self.api_key:
            raise RuntimeError("OPENAI_API_KEY is not configured")
        ct = content_type or "image/jpeg"
        b64 = base64.b64encode(image_bytes).decode("ascii")
        data_url = f"data:{ct};base64,{b64}"

        payload = {
            "model": self.model,
            "messages": [
                {
                    "role": "system",
                    "content": (
                        "You are an evidence analyst for a civic incident reporting "
                        "system. Analyse the image against the incident description. "
                        "Return STRICT JSON only, no markdown fences, with keys: "
                        "image_relevance (RELEVANT|IRRELEVANT|UNCERTAIN), "
                        "detected_objects (list of strings), "
                        "incident_consistency (CONSISTENT|INCONSISTENT|UNCERTAIN), "
                        "authenticity_assessment (UNDETERMINED|SUSPICIOUS|POTENTIALLY_MANIPULATED), "
                        "confidence (0..1), explanation (string), "
                        "human_review_required (boolean). "
                        "Never claim the image is authentic. If unsure, use UNCERTAIN / "
                        "UNDETERMINED and human_review_required=true."
                    ),
                },
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": (
                                f"Incident category: {category}\n"
                                f"Incident description: {incident_description}\n"
                                "Analyse the attached image."
                            ),
                        },
                        {"type": "image_url", "image_url": {"url": data_url}},
                    ],
                },
            ],
            "temperature": 0,
            "max_tokens": 600,
        }

        client = self._client
        close = False
        if client is None:
            client = httpx.AsyncClient(timeout=self.timeout)
            close = True
        try:
            resp = await client.post(
                f"{self.base_url}/chat/completions",
                headers={"Authorization": f"Bearer {self.api_key}"},
                json=payload,
            )
            resp.raise_for_status()
            data = resp.json()
            content = data["choices"][0]["message"]["content"]
            if not content:
                raise RuntimeError("empty model response")
            return content
        finally:
            if close:
                await client.aclose()


class GeminiVisionProvider(VisionProviderInterface):
    """Documented stub for Google Gemini (free tier via Google AI Studio).

    To enable:
      1. Get a free API key from https://aistudio.google.com/app/apikey
      2. Set GEMINI_API_KEY and GEMINI_MODEL in .env
      3. Set VISION_PROVIDER=gemini
      4. Implement analyze() below using the google-generativeai SDK or the
         REST endpoint https://generativelanguage.googleapis.com/v1beta/...
         (kept as a stub so the orchestrator's UNAVAILABLE path is exercised
         honestly until then).
    """

    def __init__(
        self,
        api_key: str | None = None,
        model: str | None = None,
    ) -> None:
        self.api_key = api_key if api_key is not None else settings.gemini_api_key
        self.model = model if model is not None else settings.gemini_model

    async def analyze(
        self,
        image_bytes: bytes,
        incident_description: str,
        category: str,
        content_type: str | None = None,
    ) -> str:
        raise NotImplementedError(
            "GeminiVisionProvider is a stub. Implement it with a free key from "
            "Google AI Studio (https://aistudio.google.com/app/apikey) before "
            "setting VISION_PROVIDER=gemini."
        )


def get_vision_provider() -> VisionProviderInterface:
    name = (settings.vision_provider or "openai").lower()
    if name == "gemini":
        return GeminiVisionProvider()
    return OpenAIVisionProvider()
