"""Deterministic image validation (Phase 3) — Pillow-generated fixtures."""

import io

from PIL import Image, ImageFilter

from app.services.image_validation import ImageQualityValidator


def _png_bytes(img: Image.Image) -> bytes:
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def _jpeg_bytes(img: Image.Image) -> bytes:
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=90)
    return buf.getvalue()


def test_black_image_rejected():
    img = Image.new("RGB", (128, 128), (0, 0, 0))
    v = ImageQualityValidator()
    r = v.validate(_png_bytes(img))
    assert r["quality"] == "FAIL"
    assert any("is_black" in i for i in r["issues"])


def test_white_image_rejected():
    img = Image.new("RGB", (128, 128), (255, 255, 255))
    v = ImageQualityValidator()
    r = v.validate(_png_bytes(img))
    assert r["quality"] == "FAIL"
    assert any("is_white" in i for i in r["issues"])


def test_blank_uniform_rejected():
    img = Image.new("RGB", (128, 128), (128, 128, 128))
    v = ImageQualityValidator()
    r = v.validate(_png_bytes(img))
    assert r["quality"] == "FAIL"
    assert any("is_blank_uniform" in i for i in r["issues"])


def test_blurry_rejected():
    # sharp checkerboard then heavy blur
    img = Image.new("RGB", (256, 256), (0, 0, 0))
    for y in range(0, 256, 16):
        for x in range(0, 256, 16):
            if (x // 16 + y // 16) % 2 == 0:
                for yy in range(y, y + 16):
                    for xx in range(x, x + 16):
                        img.putpixel((xx, yy), (255, 255, 255))
    blurry = img.filter(ImageFilter.GaussianBlur(radius=8))
    v = ImageQualityValidator()
    r = v.validate(_png_bytes(blurry))
    assert r["quality"] == "FAIL"
    assert any("is_blurry" in i for i in r["issues"])


def test_sharp_image_passes():
    img = Image.new("RGB", (256, 256), (0, 0, 0))
    for y in range(0, 256, 16):
        for x in range(0, 256, 16):
            if (x // 16 + y // 16) % 2 == 0:
                for yy in range(y, y + 16):
                    for xx in range(x, x + 16):
                        img.putpixel((xx, yy), (255, 255, 255))
    v = ImageQualityValidator()
    r = v.validate(_png_bytes(img))
    assert r["quality"] == "PASS", r["issues"]


def test_corrupt_rejected():
    v = ImageQualityValidator()
    r = v.validate(b"not an image at all")
    assert r["quality"] == "FAIL"
    assert any("is_corrupt" in i for i in r["issues"])


def test_too_small_rejected():
    img = Image.new("RGB", (32, 32), (10, 20, 30))
    # make it non-uniform to avoid blank/black false positives
    for x in range(32):
        img.putpixel((x, x), (200, 100, 50))
    v = ImageQualityValidator()
    r = v.validate(_png_bytes(img))
    assert r["quality"] == "FAIL"
    assert any("is_too_small" in i for i in r["issues"])


def test_unsupported_format_rejected():
    img = Image.new("RGB", (128, 128), (10, 20, 30))
    for x in range(128):
        img.putpixel((x, x % 128), (200, 100, 50))
    buf = io.BytesIO()
    img.save(buf, format="BMP")
    v = ImageQualityValidator()
    r = v.validate(buf.getvalue())
    assert r["quality"] == "FAIL"
    assert any("is_unsupported_format" in i for i in r["issues"])


def test_dark_night_photo_not_rejected_for_black():
    # dim but not all-zero: should not be flagged black
    img = Image.new("RGB", (128, 128), (18, 20, 22))
    # add a bright spot
    for x in range(10, 20):
        for y in range(10, 20):
            img.putpixel((x, y), (120, 130, 140))
    v = ImageQualityValidator()
    assert v.is_black(img) is False


def test_perceptual_hash_duplicate_detection():
    img = Image.new("RGB", (128, 128), (50, 60, 70))
    for x in range(0, 128, 8):
        for y in range(0, 128, 8):
            if (x // 8 + y // 8) % 2 == 0:
                for yy in range(y, y + 8):
                    for xx in range(x, x + 8):
                        img.putpixel((xx, yy), (200, 100, 50))
    v = ImageQualityValidator()
    h1 = v.perceptual_hash(_png_bytes(img))
    h2 = v.perceptual_hash(_png_bytes(img.copy()))
    assert h1 and h1 == h2
    # different image -> different hash (best effort)
    img2 = Image.new("RGB", (128, 128), (10, 10, 10))
    h3 = v.perceptual_hash(_png_bytes(img2))
    assert h3 != h1


def test_validate_returns_dimensions_and_hash():
    img = Image.new("RGB", (100, 80), (10, 20, 30))
    for x in range(100):
        img.putpixel((x, x % 80), (200, 100, 50))
    v = ImageQualityValidator()
    r = v.validate(_png_bytes(img))
    assert r["width"] == 100
    assert r["height"] == 80
    assert isinstance(r["hash"], str)
