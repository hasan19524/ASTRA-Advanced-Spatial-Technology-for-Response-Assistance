"""Stats router — Phase 2 (PL-10)."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, require_permission
from app.models import User
from app.schemas.stats import StatsOut
from app.services import stats_service as svc

router = APIRouter(prefix="/stats", tags=["stats"])


@router.get("/overview", response_model=StatsOut)
async def overview(
    user: User = Depends(require_permission("stats.view")),
    db: AsyncSession = Depends(get_db),
) -> StatsOut:
    data = await svc.overview(db, user)
    return StatsOut(**data)
