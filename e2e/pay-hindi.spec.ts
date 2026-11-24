import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

/** The Hindi switch changes words only: the amount, the UPI ID and the UPI link stay exactly the same. */
test("pay page: Hindi switch changes labels, not amounts or the UPI link, and is remembered", async ({ page, request }) => {
  const stamp = Date.now();
  const email = `e2e-hi-${stamp}@example.com`;
  const password = `E2E-${randomUUID()}`;
  await request.post("/api/auth/register", { data: { email, password, organization_name: "E2E Hindi Studio", accepted_terms: true } });
  const login = await (await request.post("/api/auth/login", { data: { email, password } })).json();
  const auth = { Authorization: `Bearer ${login.token}` };
  await request.put("/api/organizations/settings", { headers: auth, data: { upi_id: "e2ehindi@okdemo", payee_name: "E2E Hindi Studio" } });
  const customer = await (await request.post("/api/customers", { headers: auth, data: { name: "Sample Client", email: `c-${stamp}@example.com` } })).json();
  const inv = await (await request.post("/api/invoices", {
    headers: auth,
    data: { customer_id: customer.id, invoice_number: `HI-${stamp % 100000}`, amount: 12500, issued_at: "2026-11-01", due_at: "2026-12-01", status: "OPEN", external_invoice_id: "vault:https://example.com/hindi-files" },
  })).json();

  // Narrow viewport: the mobile "Pay with UPI app" link is the one a client taps.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/pay/${inv.id}`);
  await expect(page.getByText("Locked until paid")).toBeVisible();
  const upiLink = page.getByRole("link", { name: /Pay with UPI app/ });
  const hrefEn = await upiLink.getAttribute("href");
  expect(hrefEn).toContain("upi://pay");
  const amountEn = await page.getByText("INR 12,500.00").first().textContent();

  await page.getByRole("button", { name: "हिन्दी" }).click();
  await expect(page.getByText("भुगतान तक बंद")).toBeVisible();
  await expect(page.getByText("Locked until paid")).toHaveCount(0);
  await expect(page.getByRole("link", { name: /UPI ऐप से भुगतान करें/ })).toBeVisible();
  expect(await page.getByRole("link", { name: /UPI ऐप से भुगतान करें/ }).getAttribute("href")).toBe(hrefEn);
  expect(await page.getByText("INR 12,500.00").first().textContent()).toBe(amountEn);
  await expect(page.getByText("e2ehindi@okdemo")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.lang)).toBe("hi");

  // Remembered after a reload; the files link is still hidden.
  await page.reload();
  await expect(page.getByText("भुगतान तक बंद")).toBeVisible();
  expect(await page.content()).not.toContain("example.com/hindi-files");

  // And back to English.
  await page.getByRole("button", { name: "English" }).click();
  await expect(page.getByText("Locked until paid")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Locked until paid")).toBeVisible();
});

/** UPI links are rupee-only (cu=INR). A dollar invoice must never offer a UPI QR or link for a rupee amount. */
test("pay page: a non-INR invoice offers no UPI QR or link", async ({ page, request }) => {
  const stamp = Date.now();
  const email = `e2e-usd-${stamp}@example.com`;
  const password = `E2E-${randomUUID()}`;
  await request.post("/api/auth/register", { data: { email, password, organization_name: "E2E Dollar Studio", accepted_terms: true } });
  const login = await (await request.post("/api/auth/login", { data: { email, password } })).json();
  const auth = { Authorization: `Bearer ${login.token}` };
  await request.put("/api/organizations/settings", { headers: auth, data: { upi_id: "e2eusd@okdemo", payee_name: "E2E Dollar Studio" } });
  const customer = await (await request.post("/api/customers", { headers: auth, data: { name: "Overseas Client", email: `c-${stamp}@example.com` } })).json();
  const inv = await (await request.post("/api/invoices", {
    headers: auth,
    data: { customer_id: customer.id, invoice_number: `USD-${stamp % 100000}`, amount: 500, currency: "USD", issued_at: "2026-11-01", due_at: "2026-12-01", status: "OPEN" },
  })).json();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/pay/${inv.id}`);
  await expect(page.getByText("UPI is for rupee (INR) invoices only.")).toBeVisible();
  await expect(page.locator('a[href^="upi://"]')).toHaveCount(0);
  await expect(page.getByAltText("UPI Payment QR Code")).toHaveCount(0);
});
