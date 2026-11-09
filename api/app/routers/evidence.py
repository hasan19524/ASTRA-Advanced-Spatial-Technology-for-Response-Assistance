"""Evidence analysis endpoint (Phase 3).

POST /api/v1/evidence/analyze — multipart image + incident_description + category.
Auth: report.create. Returns EvidenceAnalysis JSON.
"""

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status

from app.core.deps import require_permission
from app.models import User
from app.schemas.evidence import EvidenceAnalysis
from app.services import evidence_verification as svc

router = APIRouter(prefix="/evidence", tags=["evidence"])


def get_evidence_service() -> svc.EvidenceVerificationService:
    return svc.get_evidence_service()


@router.post(
    "/analyze", response_model=EvidenceAnalysis, status_code=status.HTTP_200_OK
)
async def analyze_evidence(
    image: UploadFile = File(...),
    incident_description: str = Form(...),
    category: str = Form(...),
    user: User = Depends(require_permission("report.create")),
    service: svc.EvidenceVerificationService = Depends(get_evidence_service),
) -> EvidenceAnalysis:
    data = await image.read()
    content_type = image.content_type
    try:
        return await service.analyze(
            data,
            incident_description,
            category,
            content_type=content_type,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Evidence analysis unavailable: {exc}",
        )
