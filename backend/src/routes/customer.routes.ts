import { Router } from "express";
import prisma from "../lib/prisma";
import { getCustomerDetails } from "../services/customerService";

const router = Router();

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Get all customers (scoped to the authenticated organization)
router.get("/", async (req, res) => {
  try {
    const organization_id = String(req.query.organization_id || "");
    if (!organization_id) {
      return res.status(400).json({ error: "organization_id is required" });
    }

    const q = String(req.query.q || "").trim();
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 100));
    const offset = Math.max(0, Number(req.query.offset) || 0);

    const where: Record<string, unknown> = { organization_id };
    if (q) {
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { company_name: { contains: q, mode: "insensitive" } },
      ];
    }

    const customers = await prisma.customers.findMany({
      where,
      orderBy: { created_at: "desc" },
      skip: offset,
      take: limit,
    });

    res.setHeader("X-Total-Count", String(await prisma.customers.count({ where })));
    res.json(customers);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch customers" });
  }
});

// Get one customer (tenant-scoped)
router.get("/:id", async (req, res) => {
  try {
    const { organization_id } = req.query;
    const { id } = req.params;

    if (!organization_id || typeof organization_id !== "string") {
      return res.status(400).json({ error: "organization_id is required" });
    }
    if (!UUID_REGEX.test(organization_id)) {
      return res.status(400).json({ error: "organization_id must be a valid UUID" });
    }
    if (!UUID_REGEX.test(id)) {
      return res.status(404).json({ error: "Customer not found" });
    }

    const details = await getCustomerDetails(organization_id, id);

    if (!details) {
      return res.status(404).json({ error: "Customer not found" });
    }

    res.json(details);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch customer" });
  }
});

// Create customer
router.post("/", async (req, res) => {
  try {
    const { organization_id, name, email, company_name, phone, external_customer_id } = req.body;

    if (!organization_id || !name || !email) {
      return res.status(400).json({
        error: "organization_id, name and email are required",
      });
    }

    const cleanName = String(name).trim();
    if (cleanName.length === 0 || cleanName.length > 255) {
      return res.status(400).json({ error: "Customer name must be between 1 and 255 characters" });
    }

    const cleanCompany = company_name ? String(company_name).trim().slice(0, 255) : null;
    const cleanPhone = phone ? String(phone).trim().slice(0, 50) : null;
    const cleanExternalId = external_customer_id ? String(external_customer_id).trim().slice(0, 255) : null;

    const emailTrimmed = String(email).trim().toLowerCase();
    if (emailTrimmed.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed)) {
      return res.status(400).json({ error: "A valid email (max 320 chars) is required" });
    }

    // Guard against duplicates for the same org (schema enforces this too)
    const existing = await prisma.customers.findFirst({
      where: { organization_id, email: emailTrimmed },
    });
    if (existing) {
      return res.status(409).json({ error: "A customer with this email already exists" });
    }

    const customer = await prisma.customers.create({
      data: {
        organization_id,
        name: cleanName,
        email: emailTrimmed,
        company_name: cleanCompany,
        phone: cleanPhone,
        external_customer_id: cleanExternalId,
      },
    });

    res.status(201).json(customer);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to create customer" });
  }
});

/**
 * POST /api/customers/:id/erasure
 * GDPR (Art. 17) & India DPDP Act 2023: Right to Erasure / "Right to be Forgotten".
 * Anonymizes customer PII while retaining statutory tax invoice snapshots for 7-year audit hold.
 */
router.post("/:id/erasure", async (req, res) => {
  try {
    const organization_id = req.user?.organization_id;
    const { id } = req.params;

    if (!organization_id || !UUID_REGEX.test(id)) {
      return res.status(400).json({ error: "Valid customer id is required" });
    }

    const customer = await prisma.customers.findFirst({
      where: { id, organization_id },
    });

    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    const originalEmail = customer.email;
    const anonymizedEmail = `anonymized_${customer.id.slice(0, 8)}@erased.local`;

    // 1. Anonymize PII and set processing_restricted
    const updated = await prisma.customers.update({
      where: { id },
      data: {
        name: "Anonymized Debtor",
        email: anonymizedEmail,
        company_name: null,
        phone: null,
        external_customer_id: null,
        processing_restricted: true,
      },
    });

    // 2. Add original email to suppressions to prevent future dunning or re-ingestion
    await prisma.suppressions.upsert({
      where: {
        organization_id_address: {
          organization_id,
          address: originalEmail,
        },
      },
      update: { reason: "GDPR_DPDP_RIGHT_TO_ERASURE" },
      create: {
        organization_id,
        address: originalEmail,
        reason: "GDPR_DPDP_RIGHT_TO_ERASURE",
      },
    });

    // 3. Cancel any pending collection actions for this customer
    await prisma.collection_actions.updateMany({
      where: {
        organization_id,
        customer_id: id,
        status: "PENDING",
      },
      data: { status: "CANCELLED" },
    });

    res.json({
      status: "ERASURE_COMPLETED",
      customer_id: id,
      processing_restricted: true,
      legal_notice:
        "PII anonymized and future communications suppressed. Historical tax and invoice records are preserved under statutory 7-year legal hold as required by accounting regulations.",
    });
  } catch (error) {
    console.error("Customer erasure error:", error);
    res.status(500).json({ error: "Failed to process customer erasure request" });
  }
});

/**
 * GET /api/customers/:id/export
 * GDPR (Art. 20): Right to Data Portability.
 * Provides machine-readable structured JSON export of all customer records, invoices, and communications.
 */
router.get("/:id/export", async (req, res) => {
  try {
    const organization_id = req.user?.organization_id;
    const { id } = req.params;

    if (!organization_id || !UUID_REGEX.test(id)) {
      return res.status(400).json({ error: "Valid customer id is required" });
    }

    const customer = await prisma.customers.findFirst({
      where: { id, organization_id },
      include: {
        invoices: {
          include: { payments: true },
        },
        conversations: {
          include: { messages: true },
        },
        collection_actions: true,
      },
    });

    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    res.setHeader("Content-Disposition", `attachment; filename="data-export-${customer.id}.json"`);
    res.json({
      export_version: "1.0",
      generated_at: new Date().toISOString(),
      customer,
    });
  } catch (error) {
    console.error("Customer export error:", error);
    res.status(500).json({ error: "Failed to export customer data" });
  }
});

export default router;
