"""Evidence media (AD-8) — signed URLs and the pluggable storage backend.

The contract this file protects:
  * the API hands the client a ready-to-use signed path (`media_url`);
  * an unsigned or tampered request is refused with 403;
  * the bytes are served from whichever backend MEDIA_STORAGE selects, so the
    access rule is identical on local disk and on an S3-compatible bucket.
"""

import time
from urllib.parse import parse_qs, urlparse

from app.services import media_storage


def _split(signed_url: str) -> tuple[str, str, str]:
    parsed = urlparse(signed_url)
    name = parsed.path.rsplit("/", 1)[-1]
    qs = parse_qs(parsed.query)
    return name, qs["exp"][0], qs["sig"][0]


def test_signed_media_url_carries_a_valid_signature():
    signed = media_storage.signed_media_url("/uploads/abc123.png")
    assert signed and signed.startswith("/uploads/abc123.png?")
    name, exp, sig = _split(signed)
    assert name == "abc123.png"
    assert media_storage.verify(name, exp, sig) is None
    assert int(exp) > int(time.time())


def test_signed_media_url_is_absent_without_media():
    assert media_storage.signed_media_url(None) is None
    assert media_storage.signed_media_url("") is None


def test_signature_rejects_missing_expired_and_wrong_sig():
    name, exp, sig = _split(media_storage.signed_media_url("/uploads/x.jpg"))
    assert media_storage.verify(name, None, None) == "Missing signature"
    # expired: the signature is valid for that timestamp, the timestamp is past
    past = int(time.time()) - 10
    assert (
        media_storage.verify(name, past, media_storage.sign(name, past))
        == "Signed URL expired"
    )
    assert media_storage.verify(name, exp, "0" * 64) == "Invalid signature"
    # a signature for one file must not work for another
    assert media_storage.verify("other.jpg", exp, sig) == "Invalid signature"


async def test_upload_is_served_through_the_signed_url(client):
    """End to end: upload → detail carries `media_url` → GET it returns bytes."""
    from tests.test_incidents import JPEG, _auth, _register, _report_fields

    tokens = await _register(client, "citizen")
    created = await client.post(
        "/api/v1/incidents",
        data=_report_fields(
            title="Evidence upload signed URL check",
            description="A deliberately unique event description for this test",
        ),
        files={"photo": ("proof.jpg", JPEG, "image/jpeg")},
        headers=_auth(tokens),
    )
    assert created.status_code == 201, created.text
    incident_id = created.json()["id"]

    detail = await client.get(f"/api/v1/incidents/{incident_id}", headers=_auth(tokens))
    assert detail.status_code == 200
    report = detail.json()["reports"][0]
    assert report["media_path"].startswith("/uploads/")
    assert report["media_url"], "the API must hand the client a signed URL"

    served = await client.get(report["media_url"])
    assert served.status_code == 200
    assert served.content == JPEG
    assert served.headers["content-type"].startswith("image/")

    # The unsigned path (what the frontend used to build) stays refused.
    unsigned = await client.get(report["media_path"])
    assert unsigned.status_code == 403
    assert "signature" in unsigned.json()["detail"].lower()
