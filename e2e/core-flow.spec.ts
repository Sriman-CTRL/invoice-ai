import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

/**
 * The core money flow with fictional data, through the real UI:
 * register -> add UPI ID in Settings -> create an invoice with a final-files link -> client opens the pay page
 * (link hidden) -> client submits a UTR -> seller confirms in the Action Queue -> pay page shows the files link.
 */
test("core flow: pay, submit UTR, seller confirms, files unlock", async ({ page, browser }) => {
  const stamp = Date.now();
  const email = `e2e-${stamp}@example.com`;
  const password = `E2E-${randomUUID()}`;
  const filesUrl = `https://example.com/e2e-final-files-${stamp}`;
  const invoiceNumber = `E2E-${stamp % 100000}`;

  // 1. Register (fictional studio).
  await page.goto("/register");
  await page.locator("#name").fill("Demo Owner");
  await page.locator("#organization").fill("E2E Sample Studio");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByLabel(/I am 18 or older/).check();
  await page.getByRole("button", { name: "Initialize Organization Workspace" }).click();
  await page.waitForURL(/\/(dashboard|login)/);
  if (page.url().includes("/login")) {
    await page.locator("#email").fill(email);
    await page.locator("#password").fill(password);
    await page.getByRole("button", { name: "Enter Collection Dashboard" }).click();
  }
  await page.waitForURL(/\/dashboard/);

  // 2. Add a UPI ID in Settings.
  await page.goto("/settings");
  await page.getByLabel("Your UPI ID").fill("e2estudio@okdemo");
  await page.getByRole("button", { name: "Save payment details" }).click();
  await expect(page.getByText("Payment details saved")).toBeVisible();

  // 3. Create an invoice with a final-files link.
  await page.goto("/invoices");
  await page.getByRole("button", { name: /New Invoice/ }).click();
  await expect(page.getByRole("heading", { name: "Create New Invoice" })).toBeVisible();
  await page.getByPlaceholder("e.g. Acme Corp").fill("E2E Sample Client");
  await page.getByPlaceholder("billing@acme.com").fill(`client-${stamp}@example.com`);
  await page.getByPlaceholder("INV-1001").fill(invoiceNumber);
  await page.getByPlaceholder("e.g. Brand identity design").first().fill("Logo design");
  await page.getByLabel("Rate").first().fill("5000");
  await page.getByPlaceholder(/Figma file, Google Drive/).fill(filesUrl);
  await page.getByRole("button", { name: "Create Invoice" }).click();
  await expect(page.getByRole("heading", { name: "Create New Invoice" })).toBeHidden();
  await expect(page.getByText(invoiceNumber).first()).toBeVisible();

  // The public pay link uses the invoice's random id; read it from the seller's own API session.
  const invoiceId = await page.evaluate(async (num) => {
    const token = localStorage.getItem("ledgerlane_token");
    const res = await fetch("/api/invoices", { headers: { Authorization: `Bearer ${token}` } });
    const list = (await res.json()) as Array<{ id: string; invoice_number: string }>;
    return list.find((i) => i.invoice_number === num)?.id ?? "";
  }, invoiceNumber);
  expect(invoiceId).toMatch(/^[0-9a-f-]{36}$/);

  // 4. The client opens the pay page in a fresh browser (not signed in): the link is hidden.
  const clientCtx = await browser.newContext();
  const client = await clientCtx.newPage();
  await client.goto(`/pay/${invoiceId}`);
  await expect(client.getByText("Locked until paid")).toBeVisible();
  await expect(client.locator(`a[href="${filesUrl}"]`)).toHaveCount(0);
  expect(await client.content()).not.toContain(filesUrl);
  await expect(client.locator(".paivo-closing")).toHaveCount(0); // the closing mark only exists once paid
  await expect(client.locator("footer").getByText("Powered by")).toBeVisible(); // small Paivo credit; the seller stays the main brand

  // 5. The client submits a UTR.
  await client.getByRole("button", { name: /Submit UTR/ }).first().click();
  await client.getByPlaceholder(/e\.g\. 332410982734/).fill(`E2EUTR${stamp % 1000000}`);
  const submitted = client.waitForResponse((r) => r.url().includes("/submit-proof") && r.request().method() === "POST");
  await client.getByRole("button", { name: "Confirm Payment Submission" }).click();
  expect((await submitted).status()).toBe(200);
  await client.reload();
  await expect(client.locator(`a[href="${filesUrl}"]`)).toHaveCount(0); // a UTR alone unlocks nothing

  // 6. The seller confirms in the Action Queue.
  await page.goto("/collection-actions");
  await page.getByRole("button", { name: "1-Click Settle" }).first().click();
  await expect(page.getByText(/Payment Settled/)).toBeVisible();

  // 7. The pay page now shows the files link.
  await client.reload();
  await expect(client.locator(`a[href="${filesUrl}"]`)).toBeVisible();
  await expect(client.locator(".paivo-closing")).toHaveCount(1); // mark shown next to the paid state
  await expect(client.getByText("Your final files are unlocked.")).toBeVisible(); // wording must hold on every screen size
  await expect(client.locator("footer")).not.toContainText("•"); // no standalone separators to wrap onto their own lines
  await client.emulateMedia({ reducedMotion: "reduce" });
  expect(await client.locator(".paivo-closing").evaluate((el) => getComputedStyle(el).animationName)).toBe("none");
  await clientCtx.close();
});
