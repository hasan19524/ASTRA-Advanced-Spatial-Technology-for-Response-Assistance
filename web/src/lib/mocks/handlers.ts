/**
 * Mock request router (task 1.4) — maps API paths to fixtures.
 * Used by api/client.ts whenever the real endpoint does not exist yet.
 */
import {
  mockActivity,
  mockAlerts,
  mockIncidents,
  mockStats,
  mockTasks,
  mockTeams,
  mockTimeline,
  type MockIncident,
} from "./fixtures";

function paged<T>(items: T[]) {
  return { items, total: items.length, page: 1, page_size: items.length };
}

export async function mockRequest<T>(
  path: string,
  method: string,
  _body?: unknown,
): Promise<T> {
  void _body;
  // simulate a little latency so loading states are visible
  await new Promise((r) => setTimeout(r, 150));

  const [pathname] = path.split("?");
  const idMatch = pathname.match(/\/incidents\/([^/]+)$/);

  if (pathname === "/api/v1/incidents" && method === "GET") {
    // only PUBLIC incidents reach the public layer (sensitivity rule)
    const publicOnes = mockIncidents.filter((i) => i.visibility === "PUBLIC_UNVERIFIED");
    return paged(publicOnes) as T;
  }
  if (idMatch) {
    const found = mockIncidents.find((i) => i.id === idMatch[1]);
    if (found) return found as T;
  }
  if (pathname === "/api/v1/stats/overview") {
    return mockStats as T;
  }
  if (pathname === "/api/v1/activity/recent") {
    return paged(mockActivity) as T;
  }
  if (pathname === "/api/v1/teams") {
    return paged(mockTeams) as T;
  }
  if (pathname === "/api/v1/tasks") {
    return paged(mockTasks) as T;
  }
  if (pathname === "/api/v1/alerts") {
    return paged(mockAlerts) as T;
  }
  if (pathname.endsWith("/timeline")) {
    return paged(mockTimeline) as T;
  }
  if (pathname === "/api/v1/map/layers/incidents.geojson") {
    return {
      type: "FeatureCollection",
      features: mockIncidents
        .filter((i: MockIncident) => i.visibility === "PUBLIC_UNVERIFIED")
        .map((i) => ({
          type: "Feature",
          geometry: { type: "Point", coordinates: [i.lng, i.lat] },
          properties: { id: i.id, severity: i.severity, category: i.category },
        })),
    } as T;
  }

  throw Object.assign(new Error(`No mock for ${method} ${pathname}`), {
    status: 404,
  });
}
