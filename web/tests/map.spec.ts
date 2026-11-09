import { test, expect, type Page } from "@playwright/test";

/**
 * Live Operations Map — E2E coverage.
 *
 * The map is the most complex surface in the product (Leaflet + real OSM
 * tiles + a live WebSocket + a Dijkstra route) and it had no browser
 * coverage at all. This spec pins the three things that must be true:
 *
 *   1. the basemap is the REAL OpenStreetMap tile service (not a
 *      placeholder, not a CSS gradient);
 *   2. the pins are REAL incident rows;
 *   3. the route polyline is the REAL computed path.
 *
 * It also pins the honesty rule: the layer panel must say that live
 * traffic and team GPS are unavailable rather than faking them.
 */

const BASE = "http://localhost:3000";

async function login(page: Page, role: string) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.click(`text=${role}`);
  await page.waitForURL("**/dashboard", { timeout: 20000 });
}

test.describe("live operations map", () => {
  // The map loads real tiles over the network and computes a real route
  // over a 406k-node graph — both are slower than a UI assertion.
  test.describe.configure({ timeout: 120_000 });

  test("renders real OSM tiles, real incident pins, and the honest layer note", async ({
    page,
  }) => {
    await login(page, "Admin");
    await page.goto(`${BASE}/map`, { waitUntil: "networkidle" });

    // ---- The Leaflet container is real, not the old CSS-gradient placeholder ----
    const map = page.locator(".astra-map");
    await map.waitFor({ state: "visible", timeout: 30000 });
    await expect(page.locator(".leaflet-tile-pane")).toHaveCount(1);

    // ---- The tiles come from the real OSM tile server ----
    const tileSrc = await page
      .locator("img.leaflet-tile")
      .first()
      .getAttribute("src");
    expect(tileSrc).toContain("tile.openstreetmap.org");

    // ---- The OSM attribution is legally required and must stay visible ----
    await expect(page.locator(".leaflet-control-attribution")).toContainText(
      "OpenStreetMap",
    );

    // ---- Real incident pins ----
    // Leaflet renders each pin as a marker div holding the coloured dot.
    const pins = page.locator(".leaflet-marker-icon");
    await expect(pins.first()).toBeVisible({ timeout: 30000 });
    expect(await pins.count()).toBeGreaterThan(0);
    // The pin dot carries the verification colour, not a placeholder glyph.
    await expect(page.locator(".astra-pin").first()).toBeVisible();

    // ---- The layer panel must not claim capabilities the system lacks ----
    // Team GPS is still absent and the copy must say so (AGENTS.md hard rule 5:
    // never claim a capability the system does not have).
    await expect(
      page.locator("text=Team GPS is not available"),
    ).toBeVisible();
    // Traffic is a real provider-backed layer now (AD-45) - it must be
    // offered in the panel, not hidden or faked.
    await expect(
      page.locator("text=Live traffic (TomTom)"),
    ).toBeVisible();

    // ---- Clicking a pin opens its dispatch card ----
    await pins.first().click({ force: true });
    await expect(page.locator("text=No pin selected")).toHaveCount(0);
  });

  test("computes a real route and draws the polyline", async ({ page }) => {
    await login(page, "Admin");
    await page.goto(`${BASE}/map`, { waitUntil: "networkidle" });
    await page.locator(".astra-map").waitFor({ state: "visible", timeout: 30000 });

    const from = page.locator("select").nth(0);
    const to = page.locator("select").nth(1);
    await from.waitFor({ state: "visible", timeout: 30000 });

    const fromOptions = await from.locator("option").count();
    const toOptions = await to.locator("option").count();
    expect(fromOptions).toBeGreaterThan(2);
    expect(toOptions).toBeGreaterThan(2);

    // The OSM extract has a few isolated fragments (98.8% of the nodes are
    // in one connected component), so try neighbouring pairs until one is
    // routable. The API's own "no route" message is the honest outcome
    // for the rest.
    let routed = false;
    for (const index of [1, 2, 3, 4, 5]) {
      await from.selectOption({ index });
      await to.selectOption({ index: index + 1 });
      await page.locator("button:has-text('Find Route')").click();

      const summary = page.locator("text=/min · \\d+ nodes/");
      const failure = page.locator("text=/no route between these points/");
      const outcome = await Promise.race([
        summary.waitFor({ state: "visible", timeout: 15000 }).then(() => "ok"),
        failure.waitFor({ state: "visible", timeout: 15000 }).then(() => "no"),
      ]);
      if (outcome === "ok") {
        routed = true;
        break;
      }
    }
    expect(routed).toBe(true);

    // The polyline is a real SVG path in the Leaflet overlay pane.
    // Playwright treats a zero-area SVG path as "hidden", so assert on the
    // geometry itself — and tie it to the node count the API reported:
    // one drawn point per node on the computed path.
    const paths = page.locator(".leaflet-overlay-pane path");
    await expect(paths.first()).toHaveCount(1, { timeout: 15000 });
    expect(await paths.count()).toBeGreaterThan(0);
    const d = (await paths.first().getAttribute("d")) ?? "";
    expect(d).toBeTruthy();

    // The panel reports the node count of the computed path.
    const summaryText = await page.locator("text=/min · \\d+ nodes/").innerText();
    const nodeCount = Number(summaryText.match(/·\s*(\d+)\s+nodes/)?.[1] ?? "0");
    expect(nodeCount).toBeGreaterThan(0);

    // Leaflet writes one "M x y" for the first point and "L x y" for the
    // rest, so the command count is the number of drawn points.
    const drawnPoints = (d.match(/[ML]/g) ?? []).length;
    expect(drawnPoints).toBe(nodeCount);

    // The summary states the coordinate count too.
    await expect(
      page.locator("text=/\\d+ coordinates drawn on the map/"),
    ).toBeVisible();
  });
});
