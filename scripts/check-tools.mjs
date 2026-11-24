// Loads the built site (vite preview) and checks the three free tools work in a real browser. Local only.
// Usage: npm run build && npx vite preview --port 4173 (in another terminal), then: node scripts/check-tools.mjs
import { chromium } from "@playwright/test";

const base = process.argv[2] || "http://localhost:4173";
if (!/localhost|127\.0\.0\.1/.test(base)) throw new Error("local URLs only");
const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
const fail = (m) => { console.error("FAIL:", m); process.exitCode = 1; };

await page.goto(base + "/tools/gst-invoice-calculator");
await page.getByLabel("Rate (₹)").fill("10000");
await page.getByLabel("Discount (₹)").fill("1000");
const gst = await page.locator("dl").innerText();
if (!/₹810\.00/.test(gst) || !/CGST 9%/.test(gst) || !/₹10,620\.00/.test(gst)) fail("GST result: " + gst);
if (!/GST invoice calculator/i.test(await page.title()) && !/GST/.test(await page.title())) fail("title " + (await page.title()));

await page.goto(base + "/tools/tds-calculator");
await page.getByLabel("Invoice amount before GST (₹)").fill("50000");
await page.getByLabel("GST on the invoice (₹)").fill("9000");
await page.getByLabel("TDS rate (%)").fill("10");
const tds = await page.locator("dl").innerText();
if (!/₹5,000\.00/.test(tds) || !/₹54,000\.00/.test(tds)) fail("TDS result: " + tds);

await page.goto(base + "/tools/payment-reminder-writer");
await page.getByLabel("Client name").fill("Asha");
await page.getByLabel("Invoice number").fill("INV-7");
await page.getByLabel("Amount due (₹)").fill("25000");
const text = await page.getByLabel("Your message (you can edit it)").inputValue();
if (!/Asha/.test(text) || !/INV-7/.test(text) || !/₹25,000\.00/.test(text)) fail("reminder text: " + text);
const href = await page.getByRole("link", { name: "Open in WhatsApp" }).getAttribute("href");
if (!href?.startsWith("https://wa.me/?text=")) fail("whatsapp href " + href);

if (errors.length) fail("console/page errors: " + errors.join(" | "));
await browser.close();
console.log(process.exitCode ? "tools check FAILED" : "tools check OK");
