import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { recordedTdsLines } from "../src/pdfTds";
import { buildInvoicePdf } from "../src/invoicePdf";

test("recordedTdsLines: nothing recorded means no lines (the PDF prints nothing about TDS)", () => {
  assert.deepEqual(recordedTdsLines([]), []);
  assert.deepEqual(recordedTdsLines(undefined), []);
  assert.deepEqual(recordedTdsLines([{ status: "SUCCEEDED", tds_amount: 0 }, { status: "SUCCEEDED" }, { status: "SUCCEEDED", tds_amount: "0.00", tds_section: "194J" }]), []);
});

test("recordedTdsLines: only SUCCEEDED payments count, amount and section exactly as recorded", () => {
  const lines = recordedTdsLines([
    { status: "SUCCEEDED", tds_amount: "5000.00", tds_section: "194J" },
    { status: "PENDING", tds_amount: 999, tds_section: "194C" }, // a client's unconfirmed claim is not a recorded deduction
    { status: "FAILED", tds_amount: 50 },
  ]);
  assert.deepEqual(lines, [{ section: "194J", amount: 5000 }]);
});

test("recordedTdsLines: payments with the same section add up; a missing section stays missing", () => {
  const lines = recordedTdsLines([
    { status: "SUCCEEDED", tds_amount: 100.1, tds_section: "194J" },
    { status: "SUCCEEDED", tds_amount: 200.2, tds_section: "194J" },
    { status: "SUCCEEDED", tds_amount: 40, tds_section: null },
  ]);
  assert.deepEqual(lines, [{ section: "194J", amount: 300.3 }, { section: null, amount: 40 }]);
});

test("the invoice PDF source assumes no TDS rate or section", () => {
  const src = readFileSync(new URL("../src/invoicePdf.ts", import.meta.url), "utf8");
  assert.ok(!/TDS deduction summary|to be withheld|Net bank deposit/i.test(src), "the old fixed TDS box is gone");
  assert.ok(!/194[A-Z]|tdsRate|tdsSection/.test(src), "no hard-coded section or rate");
  assert.match(src, /recordedTdsLines\(data\.payments\)/);
});

const pdfData = (payments: any[], tds = 0): any => ({
  invoice: { id: "11111111-1111-1111-1111-111111111111", invoice_number: "INV-1", status: "OPEN", issued_at: "2026-11-01", due_at: "2026-12-01", created_at: "2026-11-01", currency: "INR", external_invoice_id: null },
  customer: { name: "C", email: "c@example.com", company_name: null, phone: null },
  financial_summary: { invoice_amount: 50000, paid_amount: 0, tds_amount: tds, outstanding_amount: 50000 - tds, currency: "INR" },
  payments, details: null,
});

test("PDF: an invoice with no recorded TDS says nothing about TDS", async () => {
  const text = (await buildInvoicePdf(pdfData([]), { organizationName: "Org" })).output();
  assert.ok(!/TDS/.test(text), "no TDS wording at all");
  assert.ok(!text.includes("194J"), "no assumed section");
  // A client's unconfirmed claim (PENDING) is not a recorded deduction either.
  const pending = (await buildInvoicePdf(pdfData([{ status: "PENDING", tds_amount: 5000, tds_section: "194C" }]), { organizationName: "Org" })).output();
  assert.ok(!/TDS/.test(pending));
});

test("PDF: recorded TDS is printed with the amount and section as recorded, not an assumed rate", async () => {
  const payments = [{ status: "SUCCEEDED", amount: 45000, tds_amount: 5000, tds_section: "194C" }];
  const text = (await buildInvoicePdf(pdfData(payments, 5000), { organizationName: "Org" })).output();
  assert.match(text, /TDS deducted by client/);
  assert.match(text, /Section 194C: INR 5,000\.00/);
  assert.ok(!text.includes("194J"), "the old default section is gone");
  assert.ok(!/%/.test(text.slice(text.indexOf("Section 194C"), text.indexOf("Section 194C") + 40)), "no assumed percentage next to it");
});
