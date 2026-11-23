// Captures marketing/demo screenshots into docs/gtm/assets/ using clearly fictional demo data.
// Needs the backend on :5000 and the frontend (npm run dev) on :5173, both against a LOCAL database.
// Run: node scripts/screenshots.mjs
import { chromium } from "@playwright/test";
import { mkdirSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = resolve(root, "docs/gtm/assets");
const WEB = process.env.WEB_URL || "http://localhost:5173";
const API = `${WEB}/api`;
mkdirSync(OUT, { recursive: true });

if (!/localhost|127\.0\.0\.1/.test(WEB)) throw new Error("Refusing to run against a non-local URL");

async function api(method, path, body, token) {
  const res = await fetch(API + path, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${JSON.stringify(json)}`);
  return json;
}

// --- Fictional demo data (no real people or businesses) ---
const stamp = Date.now();
const email = `demo-studio-${stamp}@example.com`;
const password = "Demo-Studio-Pass-2468";
await api("POST", "/auth/register", { email, password, name: "Demo Owner", organization_name: "Sample Studio (demo)", accepted_terms: true });
const login = await api("POST", "/auth/login", { email, password });
const token = login.token;
const orgId = login.user.organization_id;
await api("PUT", "/organizations/settings", { upi_id: "samplestudio@okdemo", payee_name: "Sample Studio", gstin: "", brand_color: "#6366f1" }, token).catch((e) => console.warn("settings:", e.message));
const customer = await api("POST", "/customers", { organization_id: orgId, name: "Sample Client", email: `client-${stamp}@example.com`, company_name: "Example Co (demo)" }, token);
const day = 86400000;
const mk = (n, amount, issuedDays, dueDays) => api("POST", "/invoices", {
  organization_id: orgId, customer_id: customer.id, invoice_number: n, amount, currency: "INR", status: "OPEN",
  issued_at: new Date(Date.now() + issuedDays * day).toISOString(), due_at: new Date(Date.now() + dueDays * day).toISOString(),
  external_invoice_id: "vault:https://example.com/demo-final-files",
}, token);
const locked = await mk(`DEMO-${stamp % 10000}-A`, 45000, -3, 11);
const toConfirm = await mk(`DEMO-${stamp % 10000}-B`, 12500, -5, 9);
await mk(`DEMO-${stamp % 10000}-C`, 30000, -20, -6);

// Client submits a UTR for invoice B, the seller confirms it (the real flow, via the API).
await api("POST", `/public/invoices/${toConfirm.id}/submit-proof`, { utr: "DEMO123456789012", amount: 12500, notes: "Paid via UPI (demo)" }).catch((e) => console.warn("proof:", e.message));
let confirmed = false;
try {
  const actions = await api("GET", `/collection-actions?organization_id=${orgId}&invoice_id=${toConfirm.id}&action_type=VERIFY_PAYMENT_PROOF`, undefined, token);
  const list = Array.isArray(actions) ? actions : actions.value || actions.actions || actions.data || [];
  const proof = list[0];
  if (!proof) console.warn("no proof action found; response keys:", Object.keys(actions));
  if (proof) { await api("POST", `/collection-actions/${proof.id}/verify-proof`, {}, token); confirmed = true; }
} catch (e) { console.warn("confirm:", e.message); }

// --- Screenshots ---
const browser = await chromium.launch();
const sizes = { desktop: { width: 1440, height: 900 }, mobile: { width: 390, height: 844 } };
const saved = [];
async function shot(page, name, size) {
  await page.waitForTimeout(700);
  const file = resolve(OUT, `${name}-${size}.png`);
  await page.screenshot({ path: file, fullPage: false });
  const kb = Math.round(statSync(file).size / 1024);
  saved.push(`${name}-${size}.png (${kb} KB)`);
}

for (const [size, viewport] of Object.entries(sizes)) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, isMobile: size === "mobile" });
  await ctx.addInitScript(([t, u]) => { localStorage.setItem("ledgerlane_token", t); localStorage.setItem("ledgerlane_user", u); }, [token, JSON.stringify(login.user)]);
  const anon = await browser.newContext({ viewport, deviceScaleFactor: 1, isMobile: size === "mobile" });
  const pub = await anon.newPage();
  for (const [name, path] of [["landing", "/"], ["pricing", "/pricing"], ["signup", "/register"], ["pay-locked", `/pay/${locked.id}`], ["pay-unlocked", `/pay/${toConfirm.id}`]]) {
    if (name === "pay-unlocked" && !confirmed) continue;
    await pub.goto(WEB + path, { waitUntil: "networkidle" });
    await shot(pub, name, size);
  }
  const page = await ctx.newPage();
  for (const [name, path] of [["dashboard", "/dashboard"], ["invoices", "/invoices"], ["invoice-detail", `/invoices/${locked.id}`]]) {
    await page.goto(WEB + path, { waitUntil: "networkidle" });
    await shot(page, name, size);
  }
  await page.goto(WEB + "/invoices", { waitUntil: "networkidle" });
  const btn = page.getByRole("button", { name: /new invoice/i }).first();
  if (await btn.count()) { await btn.click(); await shot(page, "invoice-create", size); }
  await ctx.close(); await anon.close();
}
await browser.close();
console.log("Saved:\n" + saved.join("\n"));
