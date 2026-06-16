const { chromium } = require("playwright");
const fs = require("node:fs");

const TOKEN = process.env.SEED_SESSION_TOKEN;
const BASE = "http://localhost:3000";
const OUT = "/tmp/shots";

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({
    executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    colorScheme: "light",
  });
  // Inject the seeded database session cookie (dev => non-secure name).
  await ctx.addCookies([
    { name: "authjs.session-token", value: TOKEN, domain: "localhost", path: "/", httpOnly: true, sameSite: "Lax" },
  ]);
  const page = await ctx.newPage();

  async function shot(name, path, opts = {}) {
    await page.goto(BASE + path, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: opts.fullPage ?? true });
    console.log("shot", name, "<-", page.url());
  }

  // Sign-in needs no session; clear cookies just for this one.
  await ctx.clearCookies();
  await shot("01-signin", "/signin", { fullPage: false });
  await ctx.addCookies([
    { name: "authjs.session-token", value: TOKEN, domain: "localhost", path: "/", httpOnly: true, sameSite: "Lax" },
  ]);

  await shot("02-dashboard", "/");
  await shot("03-connectors", "/admin/connectors");
  await shot("04-connector-qbo", "/admin/connectors/QUICKBOOKS_ONLINE");
  await shot("05-clients", "/clients");

  // Client profile — click the first client card.
  await page.goto(BASE + "/clients", { waitUntil: "networkidle" });
  await page.locator("a[href^='/clients/']").first().click();
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/06-client-profile.png`, fullPage: true });
  console.log("shot 06-client-profile <-", page.url());

  await shot("07-mappings", "/mappings");
  await shot("08-billing", "/billing");

  // Billing run detail (pre-push report) — click first run.
  await page.goto(BASE + "/billing", { waitUntil: "networkidle" });
  await page.locator("a[href^='/billing/']").first().click();
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/09-prepush-report.png`, fullPage: true });
  console.log("shot 09-prepush-report <-", page.url());

  await shot("10-reports", "/reports");
  await shot("11-report-margin", "/reports/margin");
  await shot("12-exceptions", "/exceptions");
  await shot("13-audit-log", "/admin/audit");
  await shot("14-debug-logs", "/admin/debug-logs");
  await shot("15-security-sso", "/admin/security");

  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
