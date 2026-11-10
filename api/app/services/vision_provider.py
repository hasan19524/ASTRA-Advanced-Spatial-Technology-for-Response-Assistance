"""Hosted vision providers (Phase 3).

Only hosted APIs — no local models. Provider is chosen by VISION_PROVIDER:

  * "openai"  — gpt-4o via api.openai.com (the original default)
  * "nvidia"  — a vision-capable model on NVIDIA NIM (integrate.api.nvidia.com).
                NIM speaks the OpenAI chat-completions dialect, so this reuses
                OpenAIVisionProvider with a different base URL + key. The
                default model is a reasoning VL model, which is why the
                max_tokens budget is generous: the reasoning tokens are spent
                before the JSON answer lands in `content`.
  * "gemini"  — documented stub for a free Google AI Studio key (see below).

The orchestrator (evidence_verification) is provider-agnostic: any of these
can be swapped without touching it, and a provider failure degrades to an
honest UNAVAILABLE state.
"""

from __future__ import annotations

import base64
import logging
from abc import ABC, abstractmethod

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

OPENAI_BASE_URL = "https://api.openai.com/v1"

# A reasoning VL model spends tokens thinking before it answers, so the JSON
# reply needs headroom. 600 truncated the answer mid-sentence; 1500 fits the
# reasoning plus the ~200-token JSON object.
VISION_MAX_TOKENS = 1500


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
            "max_tokens": VISION_MAX_TOKENS,
            # JSON mode: the reply must be a parseable JSON object. Supported
            # by OpenAI chat models and by NVIDIA NIM; without it a small
            # model will occasionally emit an unquoted string inside the
            # object and the orchestrator would have to throw the whole
            # analysis away.
            "response_format": {"type": "json_object"},
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
    if name == "nvidia":
        # NVIDIA NIM speaks the OpenAI chat-completions dialect, so the same
        # provider class is reused with the NIM base URL and key. No key, no
        # call — the orchestrator degrades honestly instead.
        return OpenAIVisionProvider(
            api_key=settings.nvidia_api_key or None,
            model=settings.nvidia_vision_model,
            base_url=settings.nvidia_base_url,
        )
    if name == "gemini":
        return GeminiVisionProvider()
    return OpenAIVisionProvider()
