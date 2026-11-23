import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";
import { verifyUnsubscribeToken } from "../lib/unsubscribe";

const router = Router();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const page = (res: Response, status: number, title: string, body: string) =>
  res
    .status(status)
    .type("html")
    .send(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(title)}</title></head><body style="font-family:Arial,sans-serif;max-width:440px;margin:15vh auto;padding:0 20px;color:#0f172a;line-height:1.6"><h1 style="font-size:22px">${esc(title)}</h1>${body}</body></html>`);

function parse(req: Request) {
  const o = String(req.query.o || "");
  const e = String(req.query.e || "").toLowerCase().trim();
  const t = String(req.query.t || "");
  if (!UUID.test(o) || !e || e.length > 320 || !verifyUnsubscribeToken(o, e, t)) return null;
  return { o, e, t };
}

// GET only shows a confirm button, so mail scanners that pre-open links can't unsubscribe anyone by accident.
router.get("/", (req, res) => {
  const p = parse(req);
  if (!p) return page(res, 400, "Link not valid", "<p>This unsubscribe link is invalid or incomplete.</p>");
  const q = new URLSearchParams({ o: p.o, e: p.e, t: p.t }).toString();
  return page(
    res,
    200,
    "Unsubscribe",
    `<p>Stop payment reminder emails sent to <b>${esc(p.e)}</b> through Paivo?</p><form method="post" action="/api/unsubscribe?${esc(q)}"><button style="background:#4f46e5;color:#fff;border:0;padding:10px 18px;border-radius:8px;font-size:14px;font-weight:bold;cursor:pointer">Yes, unsubscribe me</button></form>`,
  );
});

// POST is both the confirm button and the mail-client "one-click unsubscribe" request.
router.post("/", async (req, res) => {
  const p = parse(req);
  if (!p) return page(res, 400, "Link not valid", "<p>This unsubscribe link is invalid or incomplete.</p>");
  try {
    await prisma.suppressions.upsert({
      where: { organization_id_address: { organization_id: p.o, address: p.e } },
      create: { organization_id: p.o, channel: "EMAIL", address: p.e, reason: "Recipient unsubscribed via email link" },
      update: {},
    });
    return page(res, 200, "You're unsubscribed", "<p>You won't receive further reminder emails from this sender through Paivo.</p>");
  } catch (e) {
    console.error("unsubscribe failed", e);
    return page(res, 500, "Something went wrong", "<p>Please try again in a moment.</p>");
  }
});

export default router;
