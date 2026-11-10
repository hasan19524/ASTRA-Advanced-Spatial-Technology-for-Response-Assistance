FROM python:3.13-slim

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

# ffmpeg is a RUNTIME dependency, not a build one: browsers record voice
# reports as WebM/Opus and Gnani's STT endpoint only accepts raw PCM
# (WAV/MP3/OGG/FLAC/AAC), so app/services/voice_service.py transcodes
# WebM -> WAV with ffmpeg on every browser voice report.
#
# We do NOT `apt-get install ffmpeg`: the Debian mirrors are unreliable in this
# build environment (the install looped for 12 minutes and the build died), and
# a build that can't complete means voice reporting silently breaks in the
# container. Instead `imageio-ffmpeg` (pinned in requirements.txt) ships a
# static ffmpeg binary on the wheel, so the binary is present on every platform
# with no apt step to fail. `voice_service._ffmpeg_bin()` prefers an ffmpeg on
# PATH (a developer's machine) and falls back to the bundled binary.

COPY . .

EXPOSE 8000

# Migrations run on boot so `docker compose up` always yields a current schema.
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"]
