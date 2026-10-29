"""Pluggable assessment backends (Day 4, AD-24).

The Day-3 deterministic stub stays byte-identical (pinned by tests) and is
wrapped as `RuleBackend`. Pluggability goes through the `AssessmentBackend`
protocol; `get_assessment_backend()` is the single seam used by
`create_incident`. A `DegradingBackend` wrapper is the single place where
primary failure -> rules fallback happens (logged, never fails a submission).

Future: when your LLM key arrives, flip `ASSESSMENT_BACKEND=llm` +
`LLM_API_KEY`/`LLM_MODEL` — zero code. The client is OpenAI-compatible, so
Groq / Gemini-proxy / Ollama / Evon-if-compatible work day one; a non-compatible
provider swaps in behind this same protocol.
"""

from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass
from typing import Protocol, runtime_checkable

import httpx

from app.core.config import settings
from app.core.constants import NCR_REGIONS

logger = logging.getLogger(__name__)

_JSON_BLOCK = re.compile(r"\{.*\}", re.DOTALL)


@runtime_checkable
class AssessmentBackend(Protocol):
    """One backend: a name + an async assessment judgment."""

    name: str

    async def assess(
        self,
        *,
        title: str,
        description: str | None,
        region: str | None,
        reporter_email: str,
    ) -> AssessmentResult: ...


@dataclass(frozen=True)
class AssessmentResult:
    """One judgment. `backend` is the truth of who decided — it lands in the
    `assessments.backend` column and is never rewritten by a fallback."""

    outcome: str  # DEFINITELY_FALSE | MAYBE_TRUE
    reason: str
    confidence: float | None
    backend: str
    model: str | None = None


# ---------------------------------------------------------------- rules backend


class RuleBackend:
    """The Day-3 deterministic stub, wrapped as an async backend."""

    name = "rules_stub"

    async def assess(
        self,
        *,
        title: str,
        description: str | None,
        region: str | None,
        reporter_email: str,
    ) -> AssessmentResult:
        from app.services.assessment_stub import assess_submission

        outcome, reason, confidence = assess_submission(
            title=title,
            description=description,
            region=region,
            reporter_email=reporter_email,
        )
        return AssessmentResult(outcome, reason, confidence, self.name)


# ---------------------------------------------------------------- LLM backend


class LlmBackend:
    """OpenAI-compatible chat backend (Groq / Gemini-proxy / Ollama / ...).

    Objective facts (rule 1: region allowlist) are decided deterministically
    and never cost a model call; the model only judges the ambiguous text.
    Any failure — bad key, network, timeout, garbage JSON, unknown outcome —
    raises and the wrapper degrades to `RuleBackend`.
    """

    def __init__(
        self,
        api_key: str,
        model: str,
        base_url: str,
        timeout_seconds: float,
        client: httpx.AsyncClient | None = None,
    ) -> None:
        self.api_key = api_key
        self.model = model
        self.base_url = base_url.rstrip("/")
        self.timeout_seconds = timeout_seconds
        # DI seam: tests inject httpx.MockTransport; production builds below.
        self._client = client or httpx.AsyncClient(timeout=timeout_seconds)

    @property
    def name(self) -> str:
        return f"llm:{self.model}"

    async def assess(
        self,
        *,
        title: str,
        description: str | None,
        region: str | None,
        reporter_email: str,
    ) -> AssessmentResult:
        # Rule 1 is an objective geography fact — no model needed.
        if region and region not in NCR_REGIONS:
            return AssessmentResult(
                "DEFINITELY_FALSE",
                f"Region {region!r} lies outside the Delhi-NCR coverage map "
                "(deterministic geography rule, llm path)",
                0.9,
                self.name,
                self.model,
            )

        system = (
            "You assess citizen safety reports for ASTRA (Delhi NCR only). "
            "Return STRICT JSON only, no markdown fences, no extra text: "
            '{"outcome": "DEFINITELY_FALSE" | "MAYBE_TRUE", "reason": string, '
            '"confidence": 0..1}. '
            "DEFINITELY_FALSE only when the text itself contradicts a real "
            "hazard (prank, joke, fake). Missing evidence is NOT counter-evidence "
            "— default to MAYBE_TRUE."
        )
        user = f"TITLE: {title}\nDESCRIPTION: {description or ''}\nREGION: {region or '(not given)'}"
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "temperature": 0,
        }
        try:
            resp = await self._client.post(
                f"{self.base_url}/chat/completions",
                headers={"Authorization": f"Bearer {self.api_key}"},
                json=payload,
            )
            resp.raise_for_status()
            data = resp.json()
            text = data["choices"][0]["message"]["content"]
        except Exception as exc:
            raise LlmBackendError(f"LLM call failed: {exc}") from exc

        parsed = _parse_llm_json(text)
        outcome = parsed.get("outcome")
        if outcome not in ("DEFINITELY_FALSE", "MAYBE_TRUE"):
            raise LlmBackendError(f"LLM returned unknown outcome {outcome!r}")
        return AssessmentResult(
            outcome,
            parsed.get("reason") or "Assessed by LLM",
            parsed.get("confidence"),
            self.name,
            self.model,
        )


class LlmBackendError(Exception):
    """Any LLM path failure — caught by DegradingBackend."""


def _parse_llm_json(text: str) -> dict:
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    match = _JSON_BLOCK.search(text)
    if not match:
        raise LlmBackendError("LLM returned no JSON object")
    try:
        return json.loads(match.group(0))
    except json.JSONDecodeError as exc:
        raise LlmBackendError(f"LLM returned unparseable JSON: {exc}") from exc


# ---------------------------------------------------------------- degradation wrapper


class DegradingBackend:
    """Try `primary`, fall back to `fallback`, log the degradation reason.
    The fallback's `backend` name is the truth of who decided."""

    def __init__(self, primary: AssessmentBackend, fallback: AssessmentBackend) -> None:
        self.primary = primary
        self.fallback = fallback

    @property
    def name(self) -> str:
        return self.primary.name

    async def assess(
        self,
        *,
        title: str,
        description: str | None,
        region: str | None,
        reporter_email: str,
    ) -> AssessmentResult:
        try:
            return await self.primary.assess(
                title=title,
                description=description,
                region=region,
                reporter_email=reporter_email,
            )
        except Exception as exc:
            logger.warning(
                "assessment degraded %s -> %s: %s",
                self.primary.name,
                self.fallback.name,
                exc,
            )
            return await self.fallback.assess(
                title=title,
                description=description,
                region=region,
                reporter_email=reporter_email,
            )


# ---------------------------------------------------------------- factory


def build_llm_backend() -> LlmBackend:
    """Production client; tests inject a fake via LlmBackend(client=...)."""
    return LlmBackend(
        api_key=settings.llm_api_key,
        model=settings.llm_model,
        base_url=settings.llm_base_url,
        timeout_seconds=settings.llm_timeout_seconds,
    )


def get_assessment_backend() -> AssessmentBackend:
    """Single seam: rules by default; LLM with automatic degradation."""
    rules = RuleBackend()
    if settings.assessment_backend != "llm" or not settings.llm_api_key:
        if settings.assessment_backend == "llm":
            logger.info(
                "LLM backend requested but LLM_API_KEY unset — using rules_stub"
            )
        return rules
    return DegradingBackend(build_llm_backend(), rules)
