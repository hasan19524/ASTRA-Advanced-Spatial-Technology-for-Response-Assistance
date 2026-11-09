import { test, expect } from "@playwright/test";

/**
 * AI Assistant — E2E coverage for the provider disclosure.
 *
 * The screen must say WHICH engine answered. A chat bubble with no
 * attribution would let a deterministic string pass for a model's answer
 * (AGENTS.md hard rule 5: the UI must never claim what the system did
 * not do).
 */

const BASE = "http://localhost:3000";

test.describe("assistant provider disclosure", () => {
  test("names the engine that answered, or says it was the rules stub", async ({
    page,
  }) => {
    await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
    await page.click("text=Admin");
    await page.waitForURL("**/dashboard", { timeout: 20000 });

    await page.goto(`${BASE}/assistant`, { waitUntil: "networkidle" });

    // A starter question exercises the real backend chain.
    await page.locator("button:has-text('Explain the ASTRA incident lifecycle')").click();

    // The reply arrives.
    await expect(page.locator("text=Last answer came from")).toBeVisible({
      timeout: 60000,
    });

    // The attribution names either the model or the deterministic stub.
    const attribution = await page.locator("text=Last answer came from").innerText();
    expect(
      attribution.includes("rules stub") ||
        attribution.includes("llm:") ||
        /gpt-oss|gemma|openrouter|groq|nvidia/i.test(attribution),
    ).toBe(true);
  });
});
