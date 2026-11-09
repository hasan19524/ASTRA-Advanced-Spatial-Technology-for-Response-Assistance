"""Evidence analysis endpoint (Phase 3) — mocked vision provider."""

import io
import json

import httpx
import pytest

from app.main import app
from app.routers import evidence as evidence_router

from app.services.evidence_verification import EvidenceVerificationService
from app.services.image_validation import ImageQualityValidator
from app.services.vision_provider import VisionProviderInterface


def _sharp_image_bytes() -> bytes:
    from PIL import Image

    img = Image.new("RGB", (256, 256), (0, 0, 0))
    for y in range(0, 256, 16):
        for x in range(0, 256, 16):
            if (x // 16 + y // 16) % 2 == 0:
                for yy in range(y, y + 16):
                    for xx in range(x, x + 16):
                        img.putpixel((xx, yy), (255, 255, 255))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def _black_image_bytes() -> bytes:
    from PIL import Image

    img = Image.new("RGB", (128, 128), (0, 0, 0))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


class FakeProvider(VisionProviderInterface):
    def __init__(self, behavior: str = "relevant"):
        self.behavior = behavior
        self.calls = 0

    async def analyze(
        self, image_bytes, incident_description, category, content_type=None
    ):
        self.calls += 1
        if self.behavior == "timeout":
            raise httpx.TimeoutException("timed out")
        if self.behavior == "irrelevant":
            return json.dumps(
                {
                    "image_relevance": "IRRELEVANT",
                    "detected_objects": ["tree"],
                    "incident_consistency": "INCONSISTENT",
                    "authenticity_assessment": "UNDETERMINED",
                    "confidence": 0.7,
                    "explanation": "Image does not match incident.",
                    "human_review_required": True,
                }
            )
        if self.behavior == "suspicious":
            return json.dumps(
                {
                    "image_relevance": "RELEVANT",
                    "detected_objects": ["smoke"],
                    "incident_consistency": "CONSISTENT",
                    "authenticity_assessment": "SUSPICIOUS",
                    "confidence": 0.6,
                    "explanation": "Possible manipulation detected.",
                    "human_review_required": True,
                }
            )
        return json.dumps(
            {
                "image_relevance": "RELEVANT",
                "detected_objects": ["smoke", "fire"],
                "incident_consistency": "CONSISTENT",
                "authenticity_assessment": "UNDETERMINED",
                "confidence": 0.85,
                "explanation": "Image consistent with incident.",
                "human_review_required": True,
            }
        )


@pytest.fixture
def override_service():
    def _make(behavior="relevant"):
        fake = FakeProvider(behavior)
        service = EvidenceVerificationService(
            vision_provider=fake, validator=ImageQualityValidator()
        )
        app.dependency_overrides[evidence_router.get_evidence_service] = lambda: service
        return fake, service

    yield _make
    app.dependency_overrides.clear()


async def _auth_tokens(client):
    import uuid

    pw = "Str0ngPass!23"
    email = f"ev+{uuid.uuid4().hex[:8]}@test.example"
    r = await client.post(
        "/api/v1/auth/register",
        json={"email": email, "full_name": "Reporter", "password": pw},
    )
    assert r.status_code == 201, r.text
    r = await client.post("/api/v1/auth/login", json={"email": email, "password": pw})
    assert r.status_code == 200
    return r.json()


def _auth(tokens):
    return {"Authorization": f"Bearer {tokens['access_token']}"}


async def test_quality_fail_no_api_call(client, override_service):
    fake, _ = override_service("relevant")
    tokens = await _auth_tokens(client)
    r = await client.post(
        "/api/v1/evidence/analyze",
        data={"incident_description": "Fire near bus stand", "category": "Fire"},
        files={"image": ("black.png", _black_image_bytes(), "image/png")},
        headers=_auth(tokens),
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["image_quality"] == "FAIL"
    assert fake.calls == 0


async def test_quality_pass_api_called(client, override_service):
    fake, _ = override_service("relevant")
    tokens = await _auth_tokens(client)
    r = await client.post(
        "/api/v1/evidence/analyze",
        data={"incident_description": "Fire near bus stand", "category": "Fire"},
        files={"image": ("sharp.png", _sharp_image_bytes(), "image/png")},
        headers=_auth(tokens),
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["image_quality"] == "PASS"
    assert body["image_relevance"] == "RELEVANT"
    assert body["incident_consistency"] == "CONSISTENT"
    assert fake.calls == 1


async def test_provider_timeout_unavailable(client, override_service):
    fake, _ = override_service("timeout")
    tokens = await _auth_tokens(client)
    r = await client.post(
        "/api/v1/evidence/analyze",
        data={"incident_description": "Fire near bus stand", "category": "Fire"},
        files={"image": ("sharp.png", _sharp_image_bytes(), "image/png")},
        headers=_auth(tokens),
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["image_quality"] == "PASS"
    assert (
        "unavailable" in body["explanation"].lower()
        or "Unavailable" in body["explanation"]
    )
    assert body["human_review_required"] is True
    assert body["confidence"] == 0.0


async def test_irrelevant_image(client, override_service):
    fake, _ = override_service("irrelevant")
    tokens = await _auth_tokens(client)
    r = await client.post(
        "/api/v1/evidence/analyze",
        data={"incident_description": "Fire near bus stand", "category": "Fire"},
        files={"image": ("sharp.png", _sharp_image_bytes(), "image/png")},
        headers=_auth(tokens),
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["image_relevance"] == "IRRELEVANT"
    assert body["incident_consistency"] == "INCONSISTENT"


async def test_consistency_and_authenticity_cap(client, override_service):
    fake, _ = override_service("suspicious")
    tokens = await _auth_tokens(client)
    r = await client.post(
        "/api/v1/evidence/analyze",
        data={"incident_description": "Fire near bus stand", "category": "Fire"},
        files={"image": ("sharp.png", _sharp_image_bytes(), "image/png")},
        headers=_auth(tokens),
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["authenticity_assessment"] == "SUSPICIOUS"
    assert body["authenticity_assessment"] != "AUTHENTIC"
    assert body["human_review_required"] is True


async def test_requires_auth(client):
    r = await client.post(
        "/api/v1/evidence/analyze",
        data={"incident_description": "Fire", "category": "Fire"},
        files={"image": ("sharp.png", _sharp_image_bytes(), "image/png")},
    )
    assert r.status_code == 401
