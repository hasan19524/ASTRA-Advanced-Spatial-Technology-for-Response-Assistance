"""Simulation router — Phase 3 (PL-14)."""

from fastapi import APIRouter, Depends, HTTPException, Path, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db, require_permission
from app.models import User
from app.services import simulation_service as svc

router = APIRouter(prefix="/simulations", tags=["simulations"])


class SimRunIn(BaseModel):
    scenario: str
    mode: str = "PUBLIC"
    params: dict = {}


class SimRunOut(BaseModel):
    id: str
    mode: str
    scenario: str
    status: str
    summary: dict | None = None
    created_at: str


@router.post("", status_code=status.HTTP_201_CREATED)
async def run_simulation(
    payload: SimRunIn,
    user: User = Depends(require_permission("simulation.public")),
    db: AsyncSession = Depends(get_db),
):
    if payload.mode == "OPERATIONAL" and "simulation.operational" not in __import__(
        "app.core.permissions", fromlist=["permissions_for"]
    ).permissions_for(user.role):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Operational mode requires simulation.operational",
        )
    run = await svc.run_simulation(
        db, user, payload.mode, payload.scenario, payload.params
    )
    return {
        "id": run.id,
        "mode": run.mode,
        "scenario": run.scenario,
        "status": run.status,
        "summary": run.summary,
        "created_at": run.created_at.isoformat(),
    }


@router.get("/{run_id}")
async def get_run(
    run_id: str = Path(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    run = await svc.get_run(db, run_id)
    if run is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Run not found"
        )
    return {
        "id": run.id,
        "mode": run.mode,
        "scenario": run.scenario,
        "status": run.status,
        "summary": run.summary,
        "created_at": run.created_at.isoformat(),
    }


@router.get("")
async def list_runs(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    runs = await svc.list_runs(db, user)
    return [
        {
            "id": r.id,
            "mode": r.mode,
            "scenario": r.scenario,
            "status": r.status,
            "created_at": r.created_at.isoformat(),
        }
        for r in runs
    ]
