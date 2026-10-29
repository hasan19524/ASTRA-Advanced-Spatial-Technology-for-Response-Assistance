"""Pluggable assessment backends (AD-24): factory seams, LLM degradation,
deterministic facts, strict JSON parsing. LLM network calls are faked with
httpx.MockTransport — no real key, no network."""

import logging

import httpx
import pytest

from app.core.config import settings
from app.services.assessment_backend import (
    AssessmentResult,
    DegradingBackend,
    LlmBackend,
    RuleBackend,
    get_assessment_backend,
)


def _fake_client(text: str) -> httpx.AsyncClient:
    calls = {"n": 0}

    async def handler(request: httpx.Request) -> httpx.Response:
        calls["n"] += 1
        return httpx.Response(200, json={"choices": [{"message": {"content": text}}]})

    client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    client._astra_calls = calls  # type: ignore[attr-defined]
    return client


def _patch_settings(monkeypatch: pytest.MonkeyPatch, **overrides) -> None:
    for key, value in overrides.items():
        monkeypatch.setattr(settings, key, value)


# ---------------------------------------------------------------- factory


def test_factory_defaults_to_rules(monkeypatch):
    _patch_settings(monkeypatch, assessment_backend="rules", llm_api_key="")
    backend = get_assessment_backend()
    assert isinstance(backend, RuleBackend)
    assert backend.name == "rules_stub"


def test_llm_requested_without_key_degrades_to_rules(monkeypatch, caplog):
    _patch_settings(monkeypatch, assessment_backend="llm", llm_api_key="")
    with caplog.at_level(logging.INFO):
        backend = get_assessment_backend()
    assert isinstance(backend, RuleBackend)
    assert "using rules_stub" in caplog.text


# ---------------------------------------------------------------- rule backend


def test_rule_backend_matches_stub_outcome():
    import asyncio

    result = asyncio.get_event_loop().run_until_complete(
        RuleBackend().assess(
            title="prank call",
            description="lol jk asdf",
            region="Central Delhi",
            reporter_email="x@y.dev",
        )
    )
    assert result.outcome == "DEFINITELY_FALSE"
    assert result.backend == "rules_stub"
    assert "blacklist" in result.reason


# ---------------------------------------------------------------- llm backend


def test_llm_region_outside_ncr_never_calls_model():
    client = _fake_client('{"outcome": "MAYBE_TRUE", "reason": "x", "confidence": 0.5}')
    backend = LlmBackend("sk-test", "gpt-4", "http://llm.example", 5.0, client=client)

    import asyncio

    result = asyncio.get_event_loop().run_until_complete(
        backend.assess(
            title="anything",
            description="whatever",
            region="Mumbai",  # outside NCR
            reporter_email="x@y.dev",
        )
    )
    assert result.outcome == "DEFINITELY_FALSE"
    assert result.backend == "llm:gpt-4"
    assert result.model == "gpt-4"
    assert client._astra_calls["n"] == 0  # deterministic fact, no model call


def test_llm_valid_json_trusts_model():
    client = _fake_client(
        '{"outcome": "MAYBE_TRUE", "reason": "plausible hazard text", "confidence": 0.85}'
    )
    backend = LlmBackend("sk-test", "gpt-4", "http://llm.example", 5.0, client=client)

    import asyncio

    result = asyncio.get_event_loop().run_until_complete(
        backend.assess(
            title="Fire near bus stand",
            description="Thick smoke visible",
            region="Central Delhi",
            reporter_email="x@y.dev",
        )
    )
    assert result.outcome == "MAYBE_TRUE"
    assert result.backend == "llm:gpt-4"
    assert result.model == "gpt-4"
    assert result.confidence == 0.85
    assert client._astra_calls["n"] == 1


def test_llm_garbage_json_degrades(caplog):
    primary = LlmBackend(
        "sk-test", "gpt-4", "http://llm.example", 5.0, client=_fake_client("{not json")
    )
    backend = DegradingBackend(primary, RuleBackend())

    import asyncio

    with caplog.at_level(logging.WARNING):
        result = asyncio.get_event_loop().run_until_complete(
            backend.assess(
                title="prank lol asdf",
                description=None,
                region="Central Delhi",
                reporter_email="x@y.dev",
            )
        )
    assert result.backend == "rules_stub"
    assert result.outcome == "DEFINITELY_FALSE"  # rules caught the blacklist
    assert "degraded" in caplog.text


def test_llm_connection_error_degrades():
    async def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("boom")

    primary = LlmBackend(
        "sk-test",
        "gpt-4",
        "http://llm.example",
        5.0,
        client=httpx.AsyncClient(transport=httpx.MockTransport(handler)),
    )
    backend = DegradingBackend(primary, RuleBackend())

    import asyncio

    result = asyncio.get_event_loop().run_until_complete(
        backend.assess(
            title="Fire near bus stand",
            description="smoke",
            region="Central Delhi",
            reporter_email="x@y.dev",
        )
    )
    assert result.backend == "rules_stub"


def test_llm_unknown_outcome_degrades():
    primary = LlmBackend(
        "sk-test",
        "gpt-4",
        "http://llm.example",
        5.0,
        client=_fake_client(
            '{"outcome": "MAYBE_FAKE", "reason": "x", "confidence": 0.5}'
        ),
    )
    backend = DegradingBackend(primary, RuleBackend())

    import asyncio

    result = asyncio.get_event_loop().run_until_complete(
        backend.assess(
            title="Fire near bus stand",
            description="smoke",
            region="Central Delhi",
            reporter_email="x@y.dev",
        )
    )
    assert result.backend == "rules_stub"


def test_degrading_backend_name_is_primary():
    primary = LlmBackend("sk-test", "gpt-4", "http://llm.example", 5.0)
    backend = DegradingBackend(primary, RuleBackend())
    assert backend.name == "llm:gpt-4"


def test_assessment_result_is_dataclass():
    r = AssessmentResult("MAYBE_TRUE", "r", 0.5, "rules_stub", None)
    assert (r.outcome, r.backend) == ("MAYBE_TRUE", "rules_stub")
    assert r.model is None
