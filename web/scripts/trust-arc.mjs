import { chromium } from "@playwright/test";

const BASE = "http://localhost:3000";
const AMBER = "rgb(245, 158, 11)"; // UNVERIFIED
const GREEN = "rgb(34, 197, 94)"; // VERIFIED

function attachPageInstrumentation(page) {
  const errors = [];
  page.__wsFrames = [];
  page.on("pageerror", (e) => errors.push(`PAGEERROR: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`CONSOLE: ${m.text()}`);
  });
  page.on("websocket", (ws) => {
    if (!ws.url().includes("/ws/map")) return;
    ws.on("framereceived", (f) =>
      page.__wsFrames.push(`recv: ${String(f.payload).substring(0, 120)}`),
    );
    ws.on("close", () => page.__wsFrames.push("WS CLOSED"));
    ws.on("socketerror", (e) => page.__wsFrames.push(`WS ERR: ${e}`));
  });
  page.__errors = errors;
  return page;
}

async function newPage(browser) {
  const ctx = await browser.newContext({ serviceWorkers: "block", bypassCSP: true });
  const page = attachPageInstrumentation(await ctx.newPage());
  page.__ctx = ctx;
  return page;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const timings = {};
  const results = {};

  // === Citizen: login ===
  console.log("=== CITIZEN: login -> map open -> report ===");
  const citizen = await newPage(browser);

  let t0 = Date.now();
  await citizen.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await citizen.click("text=Citizen");
  await citizen.waitForURL("**/dashboard", { timeout: 15000 });
  timings["citizen_login"] = Date.now() - t0;
  console.log(`Login: ${timings["citizen_login"]}ms`);

  // Map tab stays open so /ws/map pushes the new pin (no reload in the loop)
  const mapTab = attachPageInstrumentation(await citizen.__ctx.newPage());
  await mapTab.goto(`${BASE}/map`, { waitUntil: "networkidle" });
  await mapTab.waitForTimeout(1500);

  // Submit a report in a second tab
  t0 = Date.now();
  await citizen.goto(`${BASE}/report`, { waitUntil: "networkidle" });
  await citizen.fill(
    'input[name="title"], input[placeholder*="title" i], input[placeholder*="Title"]',
    "Trust arc test fire",
  );
  await citizen.fill(
    'textarea[name="description"], textarea[placeholder*="description" i], textarea',
    "Smoke visible from two blocks away. Trust arc verification.",
  );
  const fireBtn = citizen.locator("button:has-text('Fire')").first();
  if (await fireBtn.count()) await fireBtn.click();
  await citizen
    .locator("button:has-text('Submit'), button[type='submit']")
    .first()
    .click();
  await citizen.waitForURL(/\/incidents\//, { timeout: 15000 });
  timings["report_submit"] = Date.now() - t0;
  const incidentUrl = citizen.url();
  const incidentId = incidentUrl.split("/").pop();
  console.log(`Report submitted: ${timings["report_submit"]}ms -> ${incidentId}`);

  // Map tab must show the UNVERIFIED (amber) pin for THIS incident — pushed live over /ws/map
  t0 = Date.now();
  const pin = mapTab.locator(`button[title*="${incidentId}"]`);
  await pin.waitFor({ state: "visible", timeout: 15000 });
  timings["pin_appears"] = Date.now() - t0;
  const pinColor = await pin.evaluate((el) => getComputedStyle(el).backgroundColor);
  results["pin_after_report"] = pinColor;
  console.log(
    `Pin appears (WS push): ${timings["pin_appears"]}ms color=${pinColor} (amber: ${pinColor === AMBER})`,
  );
  await mapTab.screenshot({ path: "trust-arc-1-citizen-report.png", fullPage: true });

  // === Citizen: vote Genuine ===
  console.log("\n=== CITIZEN: vote ===");
  t0 = Date.now();
  await citizen.goto(incidentUrl, { waitUntil: "networkidle" });
  const voteBtn = citizen.locator("button:has-text('Vote Genuine')").first();
  await voteBtn.waitFor({ state: "visible", timeout: 10000 });
  results["vote_eligible"] = true;
  await voteBtn.click();
  await citizen.locator("text=You voted: Genuine").waitFor({ state: "visible", timeout: 10000 });
  timings["vote"] = Date.now() - t0;
  console.log(`Vote Genuine recorded: ${timings["vote"]}ms`);
  await citizen.screenshot({ path: "trust-arc-2-citizen-vote.png", fullPage: true });

  // === Officer: login -> queue -> verify ===
  console.log("\n=== OFFICER: login -> queue -> verify ===");
  const officer = await newPage(browser);

  t0 = Date.now();
  await officer.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await officer.click("text=Verification Officer");
  await officer.waitForURL("**/dashboard", { timeout: 15000 });
  timings["officer_login"] = Date.now() - t0;
  console.log(`Officer login: ${timings["officer_login"]}ms`);

  t0 = Date.now();
  await officer.goto(`${BASE}/verification`, { waitUntil: "networkidle" });
  const queueRow = officer.locator(`text=${incidentId}`);
  await queueRow.first().waitFor({ state: "visible", timeout: 15000 });
  timings["queue_load"] = Date.now() - t0;
  results["queue_has_incident"] = true;
  console.log(`Queue shows new incident: ${timings["queue_load"]}ms`);
  await officer.screenshot({ path: "trust-arc-2b-queue.png", fullPage: true });

  // Open the officer's map tab BEFORE the verdict so /ws/map flips the pin live
  const officerMap = await officer.__ctx.newPage();
  attachPageInstrumentation(officerMap);
  await officerMap.goto(`${BASE}/map`, { waitUntil: "networkidle" });
  await officerMap.locator(`button[title*="${incidentId}"]`).waitFor({
    state: "visible",
    timeout: 15000,
  });

  // Investigate — the ROW containing OUR incident, never just the first row
  await officer
    .locator("tr", { hasText: incidentId })
    .first()
    .locator("button:has-text('Investigate')")
    .click();
  await officer.waitForURL(/\/incidents\//, { timeout: 15000 });
  await officer.locator("button:has-text('Mark Verified')").waitFor({
    state: "visible",
    timeout: 10000,
  });
  await officer.locator("button:has-text('Mark Verified')").click();

  // Verdict clock starts at Confirm — measures API + WS push to the open map tab
  t0 = Date.now();
  const flipStart = Date.now();
  await officer.locator("button:has-text('Confirm VERIFIED')").click();

  // Flip poll runs CONCURRENTLY with the badge wait (independent clocks)
  const flipLoc = officerMap.locator(`button[title*="${incidentId}"]`);
  const flipPromise = (async () => {
    const deadline = Date.now() + 10000;
    while (Date.now() < deadline) {
      const c = await flipLoc
        .evaluate((el) => getComputedStyle(el).backgroundColor)
        .catch(() => null);
      if (c === GREEN) return c;
      await new Promise((r) => setTimeout(r, 50));
    }
    return null;
  })();

  await officer.locator("text=Verified — terminal state").waitFor({
    state: "visible",
    timeout: 15000,
  });
  timings["verify"] = Date.now() - t0;
  results["verified_badge"] = true;
  console.log(`Verify verdict -> terminal badge: ${timings["verify"]}ms`);
  await officer.screenshot({ path: "trust-arc-3-officer-verify.png", fullPage: true });

  // === Pin flip: verdict pushed live over /ws/map on the already-open tab ===
  const flipColor = await flipPromise;
  timings["pin_flips"] = Date.now() - flipStart;
  results["pin_after_verify"] = flipColor ?? "timeout";
  results["pin_flip_ok"] = flipColor === GREEN;
  console.log(`Pin flip after Confirm: ${timings["pin_flips"]}ms color=${results["pin_after_verify"]} (green: ${flipColor === GREEN})`);
  console.log(`officerMap WS frames: ${JSON.stringify(officerMap.__wsFrames.slice(-8), null, 1)}`);
  await officerMap.screenshot({ path: "trust-arc-4-pin-flipped.png", fullPage: true });

  // === Summary ===
  console.log("\n=== TIMINGS SUMMARY ===");
  for (const [k, v] of Object.entries(timings)) console.log(`${k}: ${v}ms`);
  console.log("\n=== ASSERTIONS ===");
  console.log(JSON.stringify(results, null, 2));

  const allErrors = [...citizen.__errors, ...officer.__errors];
  // 401 on the pre-refresh first fetch is expected (AD-2 silent refresh)
  const realErrors = allErrors.filter((e) => !e.includes("401 (Unauthorized)"));
  console.log(`\nBrowser errors: ${allErrors.length} (non-401: ${realErrors.length})`);
  if (realErrors.length) console.log(realErrors.join("\n"));

  const pass =
    results["pin_after_report"] === AMBER &&
    results["pin_flip_ok"] === true &&
    results["vote_eligible"] === true &&
    results["queue_has_incident"] === true &&
    results["verified_badge"] === true &&
    timings["pin_appears"] < 1000 &&
    timings["pin_flips"] < 1000 &&
    realErrors.length === 0;
  console.log(`\nTRUST ARC: ${pass ? "PASS" : "FAIL"} (pin<1s: ${timings["pin_appears"] < 1000}, flip<1s: ${timings["pin_flips"] < 1000})`);

  await citizen.__ctx.close();
  await officer.__ctx.close();
  await browser.close();
  process.exit(pass ? 0 : 3);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
