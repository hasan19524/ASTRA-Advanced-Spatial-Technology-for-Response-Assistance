/**
 * responsive-audit.mjs — measure the responsive behaviour of every route.
 *
 * For each route × viewport it records:
 *   • horizontal overflow (document.scrollWidth vs innerWidth)
 *   • the widest offending elements (so the fix is obvious)
 *   • interactive elements smaller than 40×40 px (mobile tap targets)
 *   • console errors and page errors
 *   • a screenshot
 *
 * Usage (the API and the dev server must be running):
 *   node scripts/responsive-audit.mjs [outDir]
 */
import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const API = process.env.API_BASE_URL ?? "http://localhost:8000";
const OUT = process.argv[2] ?? join(process.cwd(), "audit-out");

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

const VIEWPORTS = [
  { name: "mobile", width: 375, height: 812 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1440, height: 900 },
];

async function login() {
  const res = await fetch(`${API}/api/v1/auth/demo-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@astra.dev" }),
  });
  if (!res.ok) throw new Error(`demo-login failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  // The access token lives in memory; the refresh token in localStorage — the
  // app silently refreshes on mount, which is what we rely on here.
  return data.refresh_token;
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const token = await login();
  console.log("logged in via demo-login");
  const browser = await chromium.launch();
  const findings = [];

  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 1,
      isMobile: vp.name === "mobile",
      hasTouch: vp.name === "mobile",
    });
    await context.addInitScript(
      ([t]) => {
        window.localStorage.setItem("astra.refresh_token", t);
      },
      [token],
    );
    const page = await context.newPage();
    const errors = [];
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(`console: ${m.text().slice(0, 160)}`);
    });
    page.on("pageerror", (e) => errors.push(`pageerror: ${String(e).slice(0, 160)}`));

    for (const route of ROUTES) {
      errors.length = 0;
      try {
        await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded", timeout: 30000 });
        await page.waitForTimeout(1500);
      } catch (e) {
        findings.push({ route, vp: vp.name, issue: `navigation failed: ${String(e).slice(0, 120)}` });
        continue;
      }

      const metrics = await page.evaluate(() => {
        const vw = window.innerWidth;
        const de = document.documentElement;
        const offenders = [];
        for (const el of document.querySelectorAll("body *")) {
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) continue;
          if (r.right > vw + 1 || r.left < -1) {
            const cs = getComputedStyle(el);
            if (cs.position === "fixed" && cs.visibility === "hidden") continue;
            offenders.push({
              tag: el.tagName.toLowerCase(),
              cls: (el.className?.baseVal ?? el.className ?? "").toString().slice(0, 60),
              left: Math.round(r.left),
              right: Math.round(r.right),
              text: (el.textContent ?? "").trim().slice(0, 40),
            });
          }
        }
        const small = [];
        for (const el of document.querySelectorAll("button, a, input, select, textarea")) {
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) continue;
          if (r.height < 32 || r.width < 24) {
            small.push({
              tag: el.tagName.toLowerCase(),
              text: (el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 30),
              w: Math.round(r.width),
              h: Math.round(r.height),
            });
          }
        }
        return {
          vw,
          scrollWidth: de.scrollWidth,
          bodyScrollWidth: document.body.scrollWidth,
          overflow: de.scrollWidth - vw,
          offenders: offenders.slice(0, 6),
          small: small.slice(0, 6),
          smallCount: small.length,
          text: (document.body.innerText ?? "").trim().length,
        };
      });

      const name = `${vp.name}-${route.replace(/\//g, "_") || "_root"}.png`;
      await page.screenshot({ path: join(OUT, name), fullPage: false });

      findings.push({
        route,
        vp: vp.name,
        overflow: metrics.overflow,
        offenders: metrics.offenders,
        smallCount: metrics.smallCount,
        small: metrics.small,
        errors: [...errors],
        textLen: metrics.text,
      });

      const flags = [];
      if (metrics.overflow > 1) flags.push(`OVERFLOW +${metrics.overflow}px`);
      if (metrics.smallCount > 0) flags.push(`${metrics.smallCount} small targets`);
      if (errors.length) flags.push(`${errors.length} errors`);
      console.log(
        `${vp.name.padEnd(7)} ${route.padEnd(14)} ${flags.length ? flags.join(" | ") : "ok"}`,
      );
    }
    await context.close();
  }

  await browser.close();
  console.log(`\nscreenshots: ${OUT}`);
  console.log(JSON.stringify(findings, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
