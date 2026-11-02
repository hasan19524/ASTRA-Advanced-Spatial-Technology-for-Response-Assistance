import { chromium } from "@playwright/test";
import { execSync } from "child_process";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Stop the API first
  console.log("=== Stopping API ===");
  execSync("docker compose stop api", { cwd: "C:\\Users\\Hamadan\\Desktop\\Astra\\ASTRA-Advanced-Spatial-Technology-for-Response-Assistance", stdio: "inherit" });
  await page.waitForTimeout(3000);

  // Try to log in with API down — should show error, not blank
  console.log("\n=== Login page with API down ===");
  await page.goto("http://localhost:3000/login");
  await page.waitForTimeout(4000);
  let body = await page.textContent("body");
  console.log("Login page renders:", body?.includes("Sign in"));
  console.log("Has demo buttons:", body?.includes("Demo login"));

  // Click a demo button — should show error
  await page.click("text=Citizen");
  await page.waitForTimeout(5000);
  body = await page.textContent("body");
  console.log("\nAfter clicking Citizen with API down:");
  console.log("Has error message:", body?.includes("API unreachable") || body?.includes("failed") || body?.includes("Demo login failed"));
  console.log("Has 'Sign in':", body?.includes("Sign in"));
  console.log("URL:", page.url());

  await page.screenshot({ path: "r1-direction2.png", fullPage: true });
  console.log("Screenshot saved: r1-direction2.png");

  // Restart API
  console.log("\n=== Restarting API ===");
  execSync("docker compose start api", { cwd: "C:\\Users\\Hamadan\\Desktop\\Astra\\ASTRA-Advanced-Spatial-Technology-for-Response-Assistance", stdio: "inherit" });
  await page.waitForTimeout(10000);
  console.log("API restarted");

  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
