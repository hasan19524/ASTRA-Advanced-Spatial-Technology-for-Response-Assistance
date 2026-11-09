import { test } from "@playwright/test";

const BASE = "http://localhost:3000";

test.describe("officer trust arc", () => {
  test("login -> queue -> investigate -> reject verdict -> reopen", async ({ page }) => {
    // ---- Officer login ----
    await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
    await page.click("text=Verification Officer");
    await page.waitForURL("**/dashboard", { timeout: 15000 });

    // ---- Verification queue -> investigate first incident ----
    // "Investigate" is a LINK (an anchor styled as a button), not a
    // <button> nested inside one — see components/ui/LinkButton.tsx.
    await page.goto(`${BASE}/verification`, { waitUntil: "networkidle" });
    const investigate = page.getByRole("link", { name: "Investigate" }).first();
    await investigate.waitFor({ state: "visible", timeout: 15000 });
    await investigate.click();
    await page.waitForURL(/\/incidents\//, { timeout: 15000 });
    // ---- Verdict: REJECT ----
    await page.locator("button:has-text('Mark Rejected')").waitFor({ state: "visible", timeout: 10000 });
    await page.locator("button:has-text('Mark Rejected')").waitFor({ state: "visible", timeout: 10000 });
    await page.locator("button:has-text('Mark Rejected')").click();
    await page.locator('textarea[placeholder="Why this verdict?"]').waitFor({ state: "visible", timeout: 5000 });
    await page.locator('textarea[placeholder="Why this verdict?"]').fill("Officer test rejection");
    await page.locator("button:has-text('Confirm REJECTED')").click();
    await page
      .locator("text=Rejected. Reopen to UNVERIFIED if new evidence appears.")
      .waitFor({ state: "visible", timeout: 15000 });

    // ---- Reopen ----
    await page.locator("button:has-text('Reopen Incident')").click();
    await page.locator("button:has-text('Confirm REOPENED')").click();
    await page.locator("text=Awaiting verification").waitFor({
      state: "visible",
      timeout: 15000,
    });
  });
});
