"""Evidence media storage (AD-8) — pluggable backend + signed URLs.

AD-8 says evidence photos are served **only** through a signed URL
(`/uploads/<name>?exp=…&sig=…`, audit S5). That rule is about *access*, not
about *where the bytes live*, so this module keeps the rule and makes the
bytes location swappable:

    MEDIA_STORAGE=local  → api/uploads/ on disk (development default)
    MEDIA_STORAGE=s3     → any S3-compatible bucket (Cloudflare R2, AWS S3,
                           MinIO…) — required on Render's free tier, whose
                           filesystem is ephemeral: a redeploy or a spin-down
                           would otherwise delete every evidence photo.

The API always proxies the bytes (it never hands out a public bucket URL), so
the signed-URL contract and the audit trail are identical on both backends.

Client-side note: the frontend must never build the URL itself — it receives
the ready-to-use signed path in `ReportOut.media_url`.
"""

from __future__ import annotations

import asyncio
import hashlib
import hmac
import time
from pathlib import Path

from app.core.config import settings

# AD-8: api/uploads/ (gitignored) — resolved from this file so it works both
# on the host venv and inside the container (/app/uploads).
UPLOADS_DIR = Path(__file__).resolve().parents[2] / "uploads"

_EXT_BY_TYPE = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}

_s3_client = None


def extension_for(content_type: str) -> str:
    return _EXT_BY_TYPE.get(content_type, ".bin")


def _s3():
    """Lazily build the boto3 client (import is deferred so the local
    backend never pays for it)."""
    global _s3_client
    if _s3_client is None:
        import boto3

        _s3_client = boto3.client(
            "s3",
            endpoint_url=settings.s3_endpoint_url or None,
            region_name=settings.s3_region or "auto",
            aws_access_key_id=settings.s3_access_key_id or None,
            aws_secret_access_key=settings.s3_secret_access_key or None,
        )
    return _s3_client


def using_s3() -> bool:
    return settings.media_storage.lower() == "s3"


def _s3_key(name: str) -> str:
    prefix = (settings.s3_key_prefix or "").strip("/")
    return f"{prefix}/{name}" if prefix else name


async def save_bytes(name: str, data: bytes) -> None:
    """Persist one evidence file under `name`."""
    if using_s3():
        await asyncio.to_thread(
            _s3().put_object,
            Bucket=settings.s3_bucket,
            Key=_s3_key(name),
            Body=data,
            ContentType=_guess_content_type(name),
        )
        return
    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    (UPLOADS_DIR / name).write_bytes(data)


async def read_bytes(name: str) -> tuple[bytes, str] | None:
    """Read one evidence file → (bytes, content_type) or None when missing."""
    if using_s3():
        try:
            obj = await asyncio.to_thread(
                _s3().get_object, Bucket=settings.s3_bucket, Key=_s3_key(name)
            )
        except Exception:
            return None
        body = await asyncio.to_thread(obj["Body"].read)
        return body, obj.get("ContentType") or _guess_content_type(name)
    path = UPLOADS_DIR / name
    if not path.is_file():
        return None
    return path.read_bytes(), _guess_content_type(name)


def _guess_content_type(name: str) -> str:
    lowered = name.lower()
    if lowered.endswith(".jpg") or lowered.endswith(".jpeg"):
        return "image/jpeg"
    if lowered.endswith(".png"):
        return "image/png"
    if lowered.endswith(".webp"):
        return "image/webp"
    return "application/octet-stream"


# --- signed URLs ------------------------------------------------------------
# The signature is HMAC-SHA256 over "<filename>:<exp>" keyed by JWT_SECRET —
# the exact contract AD-8 froze, unchanged.


def sign(filename: str, exp: int) -> str:
    return hmac.new(
        settings.jwt_secret.encode(), f"{filename}:{exp}".encode(), hashlib.sha256
    ).hexdigest()


def verify(filename: str, exp: int | None, sig: str | None) -> str | None:
    """Return an error message when the signature is not acceptable."""
    if exp is None or sig is None:
        return "Missing signature"
    try:
        exp_i = int(exp)
    except (TypeError, ValueError):
        return "Invalid signature"
    if exp_i < int(time.time()):
        return "Signed URL expired"
    expected = sign(filename, exp_i)
    if not hmac.compare_digest(expected, sig):
        return "Invalid signature"
    return None


def signed_media_url(media_path: str | None) -> str | None:
    """Build the signed, ready-to-use path for a stored evidence file.

    `media_path` is the stored value ("/uploads/<name>"); the returned value
    is what the client should request ("/uploads/<name>?exp=…&sig=…").
    """
    if not media_path:
        return None
    filename = media_path.rsplit("/", 1)[-1]
    if not filename:
        return None
    exp = int(time.time()) + max(60, settings.media_url_ttl_seconds)
    return f"/uploads/{filename}?exp={exp}&sig={sign(filename, exp)}"
