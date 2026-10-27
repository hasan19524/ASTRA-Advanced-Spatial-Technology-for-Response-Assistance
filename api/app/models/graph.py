"""Routing graph — AD-4: OSM nodes/edges in Postgres, adjacency list built in
memory at startup, Dijkstra runs in-process. Redis is NOT in the routing path.

`is_closed` / `traffic_factor` are the dynamic weights: closure ×∞, traffic penalty.
Changing them → rebuild the adjacency list (never a new service).
"""

import uuid

from sqlalchemy import Boolean, Float, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.user import Base


def _uuid() -> str:
    return str(uuid.uuid4())


class MapLocation(Base):
    """Graph node: junction / endpoint / landmark with NCR coordinates."""

    __tablename__ = "map_locations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    osm_id: Mapped[str | None] = mapped_column(String(32), unique=True, nullable=True)
    name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    # junction | endpoint | landmark | depot
    kind: Mapped[str] = mapped_column(String(32), nullable=False, default="junction")


class RoutingEdge(Base):
    __tablename__ = "routing_edges"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    from_location_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("map_locations.id"), nullable=False, index=True
    )
    to_location_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("map_locations.id"), nullable=False, index=True
    )
    name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    distance_m: Mapped[float] = mapped_column(Float, nullable=False)
    travel_time_s: Mapped[float] = mapped_column(Float, nullable=False)
    # dynamic weights — road closure makes the edge impassable at query time
    is_closed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    traffic_factor: Mapped[float] = mapped_column(Float, nullable=False, default=1.0)
