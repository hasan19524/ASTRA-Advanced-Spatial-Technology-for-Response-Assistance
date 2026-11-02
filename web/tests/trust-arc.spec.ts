import { test, expect, type Page } from "@playwright/test";

const BASE = "http://localhost:3000";
const AMBER = "rgb(245, 158, 11)";
const GREEN = "rgb(34, 197, 94)";

async function pinColor(page: Page, incidentId: string) {
  return page.locator(`button[title*="${incidentId}"]`).evaluate(
    (el: HTMLElement) => getComputedStyle(el).backgroundColor,
  );
}

test.describe("citizen trust arc", () => {
  test("login -> report -> UNVERIFIED pin < 1s -> vote -> officer verifies -> pin flips < 1s", async ({
    page,
    context,
    browser,
  }) => {
    const timings: Record<string, number> = {};

    // ---- Citizen login ----
    const t0 = Date.now();    await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
    await page.click("text=Citizen");
    await page.waitForURL("**/dashboard", { timeout: 15000 });
    timings["citizen_login"] = Date.now() - t0;

    // ---- Open map so /ws/map is live, then report ----
    const mapPage = await context.newPage();
    await mapPage.goto(`${BASE}/map`, { waitUntil: "networkidle" });
    await mapPage.waitForTimeout(1000);

    const reportT0 = Date.now();
    await page.goto(`${BASE}/report`, { waitUntil: "networkidle" });
    await page.fill('input[placeholder*="title" i]', "Trust arc test fire");
    await page.fill("textarea", "Trust arc smoke test.");
    await page.locator("button:has-text('Fire')").first().click();
    await page.locator("button:has-text('Submit report'), button[type='submit']").first().click();
    await page.waitForURL(/\/incidents\//, { timeout: 15000 });
    timings["report_submit"] = Date.now() - reportT0;
    const incidentUrl = page.url();
    const incidentId = incidentUrl.split("/").pop()!;

    // ---- Pin appears (WS push) < 1s ----
    const pinT0 = Date.now();
    const pin = mapPage.locator(`button[title*="${incidentId}"]`);
    await pin.waitFor({ state: "visible", timeout: 15000 });
    timings["pin_appears"] = Date.now() - pinT0;
    expect(await pinColor(mapPage, incidentId)).toBe(AMBER);
    expect(timings["pin_appears"]).toBeLessThan(1000);

    // ---- Citizen votes Genuine ----
    const voteT0 = Date.now();
    await page.goto(incidentUrl, { waitUntil: "networkidle" });
    await page.locator("button:has-text('Vote Genuine')").first().click();
    await page.locator("text=You voted: Genuine").waitFor({ state: "visible", timeout: 10000 });
    timings["vote"] = Date.now() - voteT0;

    // ---- Officer logs in (separate context), verifies ----
    const officerCtx = await browser.newContext();
    const officerPage = await officerCtx.newPage();
    await officerPage.goto(`${BASE}/login`, { waitUntil: "networkidle" });
    await officerPage.click("text=Verification Officer");
    await officerPage.waitForURL("**/dashboard", { timeout: 15000 });

    await officerPage.goto(incidentUrl, { waitUntil: "networkidle" });
    await officerPage.locator("button:has-text('Mark Verified')").click();
    await officerPage.locator("button:has-text('Confirm VERIFIED')").click();
    await officerPage.locator("text=Verified — terminal state").waitFor({
      state: "visible",
      timeout: 15000,
    });

    // ---- Pin flips (WS push) < 1s ----
    const flipT0 = Date.now();
    const deadline = Date.now() + 10000;
    let flipped = false;
    while (Date.now() < deadline) {
      if ((await pinColor(mapPage, incidentId)) === GREEN) {
        flipped = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 50));
    }
    timings["pin_flips"] = Date.now() - flipT0;
    expect(flipped).toBe(true);
    expect(timings["pin_flips"]).toBeLessThan(1000);

    console.log("TRUST ARC TIMINGS", timings);
  });
});
