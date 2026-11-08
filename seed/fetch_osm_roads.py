"""Fetch the Delhi OSM road network from the public Overpass API.

Downloads every ``highway`` way inside a bounding box, plus every node those
ways reference, and saves the raw Overpass JSON to ``_delhi_roads.json`` in the
repository root - the exact input for ``seed/seed_osm.py``, which reads the
top-level ``"elements"`` list (``type == "node"`` entries become map locations,
``type == "way"`` entries become roads whose consecutive node ids are edges).
The User-Agent header is mandatory: public Overpass instances reject requests
that do not identify themselves and answer HTTP 406 Not Acceptable instead of
data, so this script always sends ``User-Agent: ASTRA/1.0``.

Run from the repository root::

    python seed/fetch_osm_roads.py
    python seed/fetch_osm_roads.py --out path.json --bbox "28.533759,77.0007004,28.7884243,77.3194465"
    python seed/fetch_osm_roads.py --dry-run

The download takes minutes and yields ~47 MB; the file is written to a temp
path then atomically renamed, so an interrupted run cannot leave a half-written
file that would corrupt the seed step.  No API keys - Overpass is public.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from pathlib import Path

import httpx

OVERPASS_URL = "https://overpass-api.de/api/interpreter"
USER_AGENT = "ASTRA/1.0"
DEFAULT_BBOX = "28.533759,77.0007004,28.7884243,77.3194465"
DEFAULT_OUT = Path(__file__).resolve().parent.parent / "_delhi_roads.json"
TIMEOUT_SECONDS = 900.0
MAX_ATTEMPTS = 3
RETRY_STATUS_CODES = {429, 504}
BACKOFF_SECONDS = 5.0


def build_query(raw_bbox: str) -> str:
    """Parse a ``south,west,north,east`` bbox and build the Overpass QL query."""
    parts = [part.strip() for part in raw_bbox.split(",")]
    if len(parts) != 4:
        raise ValueError(f"bbox must be 'south,west,north,east', got {raw_bbox!r}")
    try:
        south, west, north, east = (float(part) for part in parts)
    except ValueError as exc:
        raise ValueError(f"bbox has a non-numeric value: {raw_bbox!r}") from exc
    if not south < north or not west < east:
        raise ValueError(f"bbox must be south<north and west<east, got {raw_bbox!r}")
    box = f"{south!r},{west!r},{north!r},{east!r}"
    body = f'  way["highway"]({box});\n  node(w);\n'
    return f"[out:json][timeout:600];\n(\n{body});\nout body;"


def fetch(query: str) -> dict:
    """POST the query to Overpass, retrying transient failures."""
    headers = {"User-Agent": USER_AGENT}
    last_error = "unknown error"
    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            with httpx.Client(timeout=TIMEOUT_SECONDS, headers=headers) as client:
                response = client.post(OVERPASS_URL, data={"data": query})
        except httpx.HTTPError as exc:
            last_error = f"{type(exc).__name__}: {exc}"
        else:
            status = response.status_code
            if status in RETRY_STATUS_CODES:
                last_error = f"HTTP {status} from Overpass"
            elif response.is_error:
                raise RuntimeError(
                    f"Overpass returned HTTP {status}: {response.text[:300].strip()}"
                )
            else:
                try:
                    return response.json()
                except ValueError as exc:
                    last_error = f"response was not valid JSON: {exc}"
        if attempt < MAX_ATTEMPTS:
            delay = BACKOFF_SECONDS * (2 ** (attempt - 1))
            print(
                f"[attempt {attempt}/{MAX_ATTEMPTS}] {last_error}; "
                f"retrying in {delay:.0f}s",
                file=sys.stderr,
            )
            time.sleep(delay)
    fail = f"Overpass request failed after {MAX_ATTEMPTS} attempts: {last_error}"
    raise RuntimeError(fail)


def validate(payload: object) -> tuple[int, int]:
    """Ensure the payload has the shape ``seed/seed_osm.py`` expects."""
    if not isinstance(payload, dict):
        raise ValueError(
            f"invalid Overpass response: expected a JSON object, got "
            f"{type(payload).__name__}"
        )
    elements = payload.get("elements")
    if not isinstance(elements, list):
        raise ValueError('invalid Overpass response: no "elements" list')
    kinds = [el.get("type") for el in elements if isinstance(el, dict)]
    nodes, ways = kinds.count("node"), kinds.count("way")
    if not nodes or not ways:
        raise ValueError(
            f"invalid Overpass response: need >=1 node and >=1 way, "
            f"got {nodes} nodes / {ways} ways"
        )
    return nodes, ways


def write_atomic(payload: dict, out_path: Path) -> int:
    """Write the JSON to a temp file, then atomically rename it into place."""
    out_path = Path(out_path).expanduser().resolve()
    out_path.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = out_path.with_name(out_path.name + ".tmp")
    try:
        with tmp_path.open("w", encoding="utf-8") as handle:
            json.dump(payload, handle, separators=(",", ":"))
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(tmp_path, out_path)
    finally:
        tmp_path.unlink(missing_ok=True)
    return out_path.stat().st_size


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Fetch Delhi OSM roads from Overpass.")
    parser.add_argument("--out", default=str(DEFAULT_OUT), help="output JSON path")
    parser.add_argument("--bbox", default=DEFAULT_BBOX, help="south,west,north,east")
    parser.add_argument("--dry-run", action="store_true", help="print query and exit")
    args = parser.parse_args(argv)

    try:
        query = build_query(args.bbox)
    except ValueError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2

    if args.dry_run:
        print(f"Overpass URL: {OVERPASS_URL}\nUser-Agent: {USER_AGENT}")
        print(f"--- query ---\n{query}\n--- end query ---")
        print("--dry-run: no request was made.")
        return 0

    print(f"Fetching OSM roads from {OVERPASS_URL} (this can take minutes)...")
    print(f"bbox (south,west,north,east): {args.bbox}")
    try:
        payload = fetch(query)
        nodes, ways = validate(payload)
    except (RuntimeError, ValueError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1

    out_path = Path(args.out).expanduser().resolve()
    size_bytes = write_atomic(payload, out_path)
    print(f"nodes: {nodes}")
    print(f"ways: {ways}")
    print(f"output: {out_path}")
    print(f"size: {size_bytes / (1024 * 1024):.2f} MB")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
