import { emailEnabled } from "../lib/mailer";
import { Router } from "express";
import prisma from "../lib/prisma";
import { ensureOrgSettingsSchema, getOrgSettings, updateOrgSettings, validateSettingsPatch } from "../lib/orgSettings";
import { serverError } from "../lib/monitoring";

const router = Router();

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// Get the authenticated user's organization. Never enumerates other tenants.
router.get("/me", async (req, res) => {
  try {
    const organization_id = String(req.query.organization_id || req.body?.organization_id || "");
    if (!organization_id) {
      return res.status(400).json({ error: "organization_id is required" });
    }

    const organization = await prisma.organizations.findUnique({
      where: { id: organization_id },
    });

    if (!organization) {
      return res.status(404).json({ error: "Organization not found" });
    }

    res.json({
      organization,
      // The address customers should forward replies to (used by the inbound webhook)
      inbox_address: `${organization.slug}@${process.env.INBOUND_DOMAIN || "in.ar.ledgerlane.local"}`,
    });
  } catch (error) {
    console.error(error);
    return serverError(res, error, "Failed to fetch organization");
  }
});

// Update the organization's inbox slug (and display name). Tenant-scoped.
router.patch("/me", async (req, res) => {
  try {
    const organization_id = String(req.body?.organization_id || "");
    const { name, slug } = req.body;

    if (!organization_id) {
      return res.status(400).json({ error: "organization_id is required" });
    }

    const data: { name?: string; slug?: string } = {};
    if (name && typeof name === "string") {
      data.name = name.trim().slice(0, 255);
    }
    if (slug && typeof slug === "string") {
      const normalized = slug.trim().toLowerCase();
      if (!SLUG_REGEX.test(normalized) || normalized.length < 3 || normalized.length > 40) {
        return res.status(400).json({
          error: "Slug must be 3-40 characters, lower-case letters, digits and hyphens only",
        });
      }
      const clash = await prisma.organizations.findUnique({ where: { slug: normalized } });
      if (clash && clash.id !== organization_id) {
        return res.status(409).json({ error: "This address is already taken" });
      }
      data.slug = normalized;
    }

    const organization = await prisma.organizations.update({
      where: { id: organization_id },
      data,
    });

    res.json({
      organization,
      inbox_address: `${organization.slug}@${process.env.INBOUND_DOMAIN || "in.ar.ledgerlane.local"}`,
    });
  } catch (error) {
    console.error(error);
    return serverError(res, error, "Failed to update organization");
  }
});

// Payment details & plan for the authenticated tenant (id always comes from the JWT).
router.get("/settings", async (req, res) => {
  try {
    res.json(await getOrgSettings(req.user!.organization_id));
  } catch (error) {
    console.error(error);
    return serverError(res, error, "Failed to load settings");
  }
});

router.put("/settings", async (req, res) => {
  try {
    const current = await getOrgSettings(req.user!.organization_id);
    const checked = validateSettingsPatch(req.body ?? {}, current);
    if ("error" in checked) return res.status(400).json({ error: checked.error });
    if (checked.data.auto_reminders === true) {
      // Switching automatic reminders on only makes sense when mail can go out and the client has a way to pay.
      const has = (k: "upi_id" | "bank_account_number" | "bank_ifsc") => (k in checked.data ? checked.data[k] : current[k]);
      if (!emailEnabled()) return res.status(400).json({ error: "Email sending isn't switched on yet, so automatic reminders can't be turned on." });
      if (!(has("upi_id") || (has("bank_account_number") && has("bank_ifsc")))) {
        return res.status(400).json({ error: "Add your UPI ID or bank details first, so clients can pay when they read a reminder." });
      }
    }
    res.json(await updateOrgSettings(req.user!.organization_id, checked.data));
  } catch (error) {
    console.error(error);
    return serverError(res, error, "Failed to save settings");
  }
});

// Manual UPI upgrade: the org pays the platform via UPI and submits the UTR for verification.
router.post("/upgrade-request", async (req, res) => {
  try {
    const plan = String(req.body?.plan || "").toUpperCase();
    const utr = String(req.body?.utr || "").trim();
    if (!["PRO", "AGENCY"].includes(plan)) return res.status(400).json({ error: "Choose a valid plan" });
    if (!/^[A-Za-z0-9]{12,22}$/.test(utr)) return res.status(400).json({ error: "Enter the 12-digit UTR from your payment receipt" });
    await ensureOrgSettingsSchema();
    await prisma.$executeRawUnsafe(
      "INSERT INTO plan_requests (organization_id, plan, utr) VALUES ($1::uuid, $2, $3)",
      req.user!.organization_id, plan, utr,
    );
    res.status(201).json({ success: true, message: "Payment proof received. Your plan activates once verified, usually within a few hours." });
  } catch (error) {
    console.error(error);
    return serverError(res, error, "Failed to submit upgrade request");
  }
});

export default router;
