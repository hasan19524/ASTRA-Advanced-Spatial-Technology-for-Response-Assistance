import json, os, sys, asyncio, math

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "api"))
os.environ.setdefault(
    "DATABASE_URL", "postgresql+asyncpg://postgres:postgres@localhost:5433/astra"
)
from app.core.database import get_session_factory
from app.models import MapLocation, RoutingEdge


async def main():
    data = json.load(open(os.path.join(os.path.dirname(__file__), "..", "_delhi_roads.json")))
    nodes = {e["id"]: e for e in data["elements"] if e["type"] == "node"}
    ways = [e for e in data["elements"] if e["type"] == "way"]

    factory = get_session_factory()
    async with factory() as db:
        # clear existing
        from sqlalchemy import delete

        await db.execute(delete(RoutingEdge))
        await db.execute(delete(MapLocation))
        await db.commit()

        # insert nodes
        node_id_map = {}
        batch = []
        for nid, n in nodes.items():
            batch.append(
                MapLocation(
                    id=str(nid),
                    osm_id=str(nid),
                    latitude=n["lat"],
                    longitude=n["lon"],
                    kind="junction",
                    name=None,
                )
            )
            if len(batch) >= 5000:
                db.add_all(batch)
                await db.flush()
                batch = []
        if batch:
            db.add_all(batch)
            await db.flush()
        await db.commit()
        print(f"inserted {len(nodes)} nodes")

        # insert edges
        edge_batch = []
        count = 0
        for w in ways:
            nds = w.get("nodes", [])
            tags = w.get("tags", {})
            name = tags.get("name")
            for i in range(len(nds) - 1):
                a, b = nds[i], nds[i + 1]
                if a not in nodes or b not in nodes:
                    continue
                la, lo = nodes[a]["lat"], nodes[a]["lon"]
                lb, lo2 = nodes[b]["lat"], nodes[b]["lon"]
                d = math.hypot(
                    (la - lb) * 111000, (lo - lo2) * 111000 * math.cos(math.radians(la))
                )
                et = RoutingEdge(
                    from_location_id=str(a),
                    to_location_id=str(b),
                    name=name,
                    distance_m=d,
                    travel_time_s=d / 13.89,
                    is_closed=False,
                    traffic_factor=1.0,
                )
                edge_batch.append(et)
                count += 1
                if len(edge_batch) >= 5000:
                    db.add_all(edge_batch)
                    await db.flush()
                    edge_batch = []
        if edge_batch:
            db.add_all(edge_batch)
            await db.flush()
        await db.commit()
        print(f"inserted {count} edges")


asyncio.run(main())
