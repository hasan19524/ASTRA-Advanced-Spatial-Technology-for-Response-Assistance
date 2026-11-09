"""Deterministic, Pillow-based image quality validation (Phase 3)."""

from __future__ import annotations

import io
import statistics
from typing import Any

from PIL import Image, ImageFilter, ImageStat

SUPPORTED_FORMATS = {"JPEG", "PNG", "WEBP"}

BLACK_THRESHOLD = 8
WHITE_THRESHOLD = 247
BLANK_STD_THRESHOLD = 6.0
BLUR_THRESHOLD = 500.0
HASH_SIZE = 8


def _to_bytes(image_input: Any) -> bytes | None:
    if isinstance(image_input, (bytes, bytearray)):
        return bytes(image_input)
    if isinstance(image_input, str):
        try:
            with open(image_input, "rb") as f:
                return f.read()
        except OSError:
            return None
    if hasattr(image_input, "read"):
        try:
            data = image_input.read()
            if isinstance(data, str):
                data = data.encode()
            if hasattr(image_input, "seek"):
                try:
                    image_input.seek(0)
                except Exception:
                    pass
            return bytes(data) if data is not None else None
        except Exception:
            return None
    return None


def _open_image(image_input: Any) -> Image.Image | None:
    if isinstance(image_input, Image.Image):
        src = image_input
        out = src.copy()
        out.format = src.format
        return out
    data = _to_bytes(image_input)
    if data is not None:
        try:
            src = Image.open(io.BytesIO(data))
            src.load()
            out = src.copy()
            out.format = src.format
            return out
        except Exception:
            return None
    try:
        src = Image.open(image_input)
        src.load()
        out = src.copy()
        out.format = src.format
        return out
    except Exception:
        return None


class ImageQualityValidator:
    def __init__(
        self,
        black_threshold: int = BLACK_THRESHOLD,
        white_threshold: int = WHITE_THRESHOLD,
        blank_std_threshold: float = BLANK_STD_THRESHOLD,
        blur_threshold: float = BLUR_THRESHOLD,
    ) -> None:
        self.black_threshold = black_threshold
        self.white_threshold = white_threshold
        self.blank_std_threshold = blank_std_threshold
        self.blur_threshold = blur_threshold

    @staticmethod
    def _as_image(image_input: Any) -> Image.Image | None:
        return _open_image(image_input)

    def _rgb(self, img: Image.Image) -> Image.Image:
        if img.mode == "RGB":
            return img
        return img.convert("RGB")

    def _std_dev(self, rgb_img: Image.Image) -> float:
        try:
            stat = ImageStat.Stat(rgb_img)
            stds = stat.stddev
            if not stds:
                return 0.0
            return float(max(stds))
        except Exception:
            vals = []
            for px in rgb_img.getdata():
                if isinstance(px, tuple):
                    vals.extend(px[:3])
                else:
                    vals.append(px)
            if not vals:
                return 0.0
            return float(statistics.pstdev(vals))

    def is_corrupt(self, image_input: Any) -> bool:
        data = _to_bytes(image_input)
        if data is not None:
            try:
                with Image.open(io.BytesIO(data)) as im:
                    im.load()
                # verify separately
                with Image.open(io.BytesIO(data)) as im2:
                    im2.verify()
                return False
            except Exception:
                return True
        if isinstance(image_input, Image.Image):
            try:
                image_input.load()
                return False
            except Exception:
                return True
        try:
            with Image.open(image_input) as im:
                im.load()
                im.verify()
            return False
        except Exception:
            return True

    def is_unsupported_format(self, image_input: Any) -> bool:
        # Prefer PIL's recorded format. For bytes, open and inspect.
        img = self._as_image(image_input)
        if img is None:
            return True
        fmt = (getattr(img, "format", None) or "").upper()
        if not fmt:
            return False  # unknown -> don't claim unsupported
        if fmt == "JPG":
            fmt = "JPEG"
        return fmt not in SUPPORTED_FORMATS

    def is_too_small(self, image_input: Any) -> bool:
        img = self._as_image(image_input)
        if img is None:
            return True
        w, h = img.size
        return min(w, h) < 64

    def is_black(self, image_input: Any) -> bool:
        img = self._as_image(image_input)
        if img is None:
            return False
        rgb = self._rgb(img)
        try:
            extrema = rgb.getextrema()
        except Exception:
            return False
        if isinstance(extrema, tuple) and extrema and isinstance(extrema[0], tuple):
            max_val = max(ch[1] for ch in extrema)
        else:
            max_val = extrema[1]  # type: ignore[index]
        if max_val > self.black_threshold:
            return False
        # uniform: std dev must be low
        return self._std_dev(rgb) < 2.0

    def is_white(self, image_input: Any) -> bool:
        img = self._as_image(image_input)
        if img is None:
            return False
        rgb = self._rgb(img)
        try:
            extrema = rgb.getextrema()
        except Exception:
            return False
        if isinstance(extrema, tuple) and extrema and isinstance(extrema[0], tuple):
            min_val = min(ch[0] for ch in extrema)
        else:
            min_val = extrema[0]  # type: ignore[index]
        if min_val < self.white_threshold:
            return False
        return self._std_dev(rgb) < 2.0

    def is_blank_uniform(self, image_input: Any) -> bool:
        img = self._as_image(image_input)
        if img is None:
            return False
        rgb = self._rgb(img)
        return self._std_dev(rgb) < self.blank_std_threshold

    def is_blurry(self, image_input: Any) -> bool:
        img = self._as_image(image_input)
        if img is None:
            return False
        gray = img.convert("L")
        kernel = ImageFilter.Kernel(
            size=(3, 3),
            kernel=(0, 1, 0, 1, -4, 1, 0, 1, 0),
            scale=1,
            offset=0,
        )
        lap = gray.filter(kernel)
        vals = list(lap.getdata())
        if not vals:
            return True
        try:
            var = statistics.pvariance(vals)
        except Exception:
            var = 0.0
        return var < self.blur_threshold

    def perceptual_hash(self, image_input: Any) -> str:
        img = self._as_image(image_input)
        if img is None:
            return ""
        gray = img.convert("L").resize((HASH_SIZE, HASH_SIZE), Image.BILINEAR)
        pixels = list(gray.getdata())
        if not pixels:
            return ""
        mean = sum(pixels) / len(pixels)
        bits = "".join("1" if p >= mean else "0" for p in pixels)
        hex_str = ""
        for i in range(0, len(bits), 4):
            chunk = bits[i : i + 4].ljust(4, "0")
            hex_str += format(int(chunk, 2), "x")
        return hex_str

    def validate(self, image_input: Any, content_type: str | None = None) -> dict:
        return self.validate_image(image_input, content_type=content_type)

    def validate_image(self, image_input: Any, content_type: str | None = None) -> dict:
        issues: list[str] = []
        width = 0
        height = 0

        corrupt = self.is_corrupt(image_input)
        if corrupt:
            issues.append("is_corrupt (image could not be opened or verified)")
            return {
                "quality": "FAIL",
                "issues": issues,
                "hash": "",
                "width": width,
                "height": height,
            }

        img = self._as_image(image_input)
        if img is not None:
            width, height = img.size

        # format detection
        fmt = ""
        if img is not None:
            fmt = (getattr(img, "format", None) or "").upper()
        if not fmt and content_type:
            ct = content_type.lower()
            if "jpeg" in ct or "jpg" in ct:
                fmt = "JPEG"
            elif "png" in ct:
                fmt = "PNG"
            elif "webp" in ct:
                fmt = "WEBP"

        unsupported = False
        if fmt:
            check_fmt = "JPEG" if fmt == "JPG" else fmt
            if check_fmt not in SUPPORTED_FORMATS:
                unsupported = True
        elif content_type:
            if content_type.lower() not in ("image/jpeg", "image/png", "image/webp"):
                unsupported = True
        # content_type override check
        if content_type and content_type.lower() not in (
            "image/jpeg",
            "image/png",
            "image/webp",
        ):
            # only if format unknown; but if bytes format known, trust format?
            pass

        if unsupported:
            issues.append("is_unsupported_format (format not in {jpeg, png, webp})")

        if self.is_too_small(image_input):
            issues.append("is_too_small (min dimension < 64)")
        if self.is_black(image_input):
            issues.append("is_black (all pixels near 0)")
        if self.is_white(image_input):
            issues.append("is_white (all pixels near 255)")
        if self.is_blank_uniform(image_input):
            issues.append("is_blank_uniform (low std dev)")
        if self.is_blurry(image_input):
            issues.append("is_blurry (low Laplacian variance)")

        hash_str = self.perceptual_hash(image_input) if img is not None else ""
        quality = "PASS" if not issues else "FAIL"
        return {
            "quality": quality,
            "issues": issues,
            "hash": hash_str,
            "width": width,
            "height": height,
        }


def validate_image(image_input, content_type=None):
    return ImageQualityValidator().validate_image(
        image_input, content_type=content_type
    )
