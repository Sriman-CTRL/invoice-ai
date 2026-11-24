import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { totalsFor, emptyItem } from "../src/invoiceMath";
import { computeTotals } from "../backend/src/lib/invoiceDetails";
import { GST_SLABS } from "../src/gstSlabs";
import { computeTds } from "../src/tdsMath";
import { buildReminderText, whatsappShareUrl } from "../src/reminderText";

test("GST calculator maths is identical to the server's computeTotals", () => {
  const cases: Array<[Array<[string, string]>, string, number, "NONE" | "GST_INTRA" | "GST_INTER"]> = [
    [[["1", "10000"]], "1000", 18, "GST_INTRA"],
    [[["3", "333.33"], ["2", "199.99"]], "0", 5, "GST_INTER"],
    [[["1", "999.99"]], "5000", 18, "GST_INTRA"],
    [[["7", "0.1"], ["1", "0.2"]], "0.05", 40, "GST_INTRA"],
    [[["1", "1234.5"]], "", 18, "NONE"],
    [[["1", "1"]], "", 5, "GST_INTRA"],
  ];
  for (const [rows, discount, rate, mode] of cases) {
    const drafts = rows.map(([quantity, rate2]) => ({ ...emptyItem(), quantity, rate: rate2 }));
    const mine = totalsFor(drafts, discount, rate, mode);
    const items = drafts.map((d) => ({ description: "x", quantity: Number(d.quantity), rate: Number(d.rate), amount: Math.round(Number(d.quantity) * Number(d.rate) * 100) / 100 }));
    const server = computeTotals(items, Number(discount) || 0, rate, mode);
    assert.deepEqual(mine, server);
  }
});

test("GST slabs are the verified ones", () => {
  assert.deepEqual([...GST_SLABS], [0, 5, 18, 40]);
});

test("TDS calculator: before-GST and with-GST bases, clamps, no hidden rate", () => {
  const a = computeTds({ amount: 50000, gst: 9000, ratePercent: 10, excludeGst: true });
  assert.deepEqual(a, { invoiceTotal: 59000, tdsBase: 50000, tds: 5000, netReceived: 54000 });
  const b = computeTds({ amount: 50000, gst: 9000, ratePercent: 10, excludeGst: false });
  assert.deepEqual(b, { invoiceTotal: 59000, tdsBase: 59000, tds: 5900, netReceived: 53100 });
  assert.equal(computeTds({ amount: 1000, gst: 0, ratePercent: 0, excludeGst: true }).tds, 0, "no rate typed means no TDS, never a default");
  assert.equal(computeTds({ amount: 1000, gst: 0, ratePercent: 500, excludeGst: true }).tds, 1000, "rate clamps at 100%");
  assert.equal(computeTds({ amount: -5, gst: NaN, ratePercent: 10, excludeGst: true }).netReceived, 0);
  const src = fs.readFileSync("src/tdsMath.ts", "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  assert.ok(!/194[CJ]/.test(src), "no section rates hard-coded in code");
});

test("reminder writer: all tones are polite and carry the details", () => {
  for (const tone of ["friendly", "firm", "final"] as const) {
    const t = buildReminderText({ tone, clientName: "Asha", invoiceNumber: "INV-7", amount: 25000, daysOverdue: 9, yourName: "Ravi", payLink: "https://paivo.in/pay/x" });
    assert.match(t, /Asha/);
    assert.match(t, /INV-7/);
    assert.match(t, /₹25,000\.00/);
    assert.match(t, /9 days overdue/);
    assert.match(t, /https:\/\/paivo\.in\/pay\/x/);
    assert.match(t, /UTR/);
    assert.ok(!/legal|lawyer|court|police|notice|penalt|blacklist|sue|action against/i.test(t), tone + " must not threaten");
  }
  assert.match(buildReminderText({ tone: "friendly", clientName: "", invoiceNumber: "", amount: 0, daysOverdue: 0, yourName: "", }), /Hi there/);
  assert.match(buildReminderText({ tone: "friendly", clientName: "A", invoiceNumber: "1", amount: 10, daysOverdue: 1, yourName: "" }), /was due yesterday/);
  const url = whatsappShareUrl("a b&c");
  assert.equal(url, "https://wa.me/?text=a%20b%26c");
});
