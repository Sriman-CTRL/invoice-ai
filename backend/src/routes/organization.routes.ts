import { Router } from "express";
import prisma from "../lib/prisma";

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
    res.status(500).json({ error: "Failed to fetch organization" });
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
    res.status(500).json({ error: "Failed to update organization" });
  }
});

export default router;
