/**
 * page-text-audit.mjs — dump the visible text of each page so broken or
 * placeholder copy ("—", "undefined", "NaN", literal template expressions)
 * is caught without reading screenshots.
 *
 * Usage: node scripts/page-text-audit.mjs
 */
import { chromium } from "@playwright/test";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const API = process.env.API_BASE_URL ?? "http://localhost:8000";

const ROUTES = [
  "/dashboard",
  "/incidents",
  "/map",
  "/report",
  "/reports",
  "/teams",
  "/departments",
  "/verification",
  "/alerts",
  "/settings",
  "/assistant",
  "/simulation",
  "/audit",
];

const SUSPICIOUS = [
  /\bundefined\b/,
  /\bNaN\b/,
  /\[object Object\]/,
  /\$\{/,
  /\? "s" :/,
];

async function main() {
  const res = await fetch(`${API}/api/v1/auth/demo-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@astra.dev" }),
  });
  const { refresh_token } = await res.json();

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript(([t]) => {
    window.localStorage.setItem("astra.refresh_token", t);
  }, [refresh_token]);
  const page = await context.newPage();

  for (const route of ROUTES) {
    const errors = [];
    page.removeAllListeners("console");
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text().slice(0, 120));
    });
    await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(1200);

    const text = await page.evaluate(() => {
      const main = document.querySelector("main") ?? document.body;
      return (main.innerText ?? "").replace(/\n{2,}/g, "\n").trim();
    });

    const suspicious = SUSPICIOUS.filter((re) => re.test(text)).map(String);
    const dashes = (text.match(/—/g) ?? []).length;
    console.log(`\n===== ${route} =====`);
    console.log(`len=${text.length} dashes=${dashes} errors=${errors.length} suspicious=${suspicious.join(",") || "none"}`);
    if (errors.length) console.log("  errors: " + [...new Set(errors)].slice(0, 3).join(" | "));
    const lines = text.split("\n");
    console.log(lines.slice(0, 14).map((l) => "  " + l).join("\n"));
    if (process.env.FULL === "1") {
      console.log("  ... (" + Math.max(0, lines.length - 14) + " more lines)");
      console.log(lines.slice(14).map((l) => "  " + l).join("\n"));
    }
  }
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
