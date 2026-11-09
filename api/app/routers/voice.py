"""Voice router — Phase 2 (T3, Gnani proxy)."""

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import Response
from pydantic import BaseModel, Field

from app.core.deps import get_current_user
from app.models import User
from app.services import voice_service as svc


class TtsIn(BaseModel):
    text: str = Field(..., min_length=1, max_length=5000)
    language_code: str = "hi-IN"
    voice: str = "Nalini"


router = APIRouter(prefix="/voice", tags=["voice"])


@router.get("/languages")
async def list_languages():
    return svc.languages()


@router.post("/stt")
async def speech_to_text(
    audio: UploadFile = File(...),
    language_code: str = Form("hi-IN"),
    user: User = Depends(get_current_user),
):
    data = await audio.read()
    try:
        transcript = await svc.stt(
            data,
            audio.filename or "audio.wav",
            language_code,
            audio.content_type,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)
        )
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc))
    return {"transcript": transcript, "language_code": language_code}


@router.post("/tts")
async def text_to_speech(payload: TtsIn, user: User = Depends(get_current_user)):
    text = payload.text
    language_code = payload.language_code
    voice = payload.voice
    try:
        audio = await svc.tts(text, language_code, voice)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc))
    return Response(content=audio, media_type="audio/wav")
