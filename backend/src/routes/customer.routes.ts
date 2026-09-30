import { Router } from "express";
import prisma from "../lib/prisma";
import { getCustomerDetails } from "../services/customerService";

const router = Router();

// Get all customers
router.get("/", async (_req, res) => {
  try {
    const customers = await prisma.customers.findMany({
      orderBy: {
        created_at: "desc",
      },
    });

    res.json(customers);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch customers" });
  }
});

// Get one customer
router.get("/:id", async (req, res) => {
  try {
    const { organization_id } = req.query;
    const { id } = req.params;

    if (!organization_id || typeof organization_id !== "string") {
      return res.status(400).json({ error: "organization_id is required" });
    }

    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_REGEX.test(organization_id)) {
      return res.status(400).json({ error: "organization_id must be a valid UUID" });
    }
    if (!UUID_REGEX.test(id)) {
      // 404 is requested by instruction "10. Invalid customer UUID → appropriate 400/404 behavior consistent with existing routes"
      // or 400, wait, existing route just passes to prisma which throws 500 or ignores it. 
      // Let's do 404 for invalid customer UUID to mask it.
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
    const {
      organization_id,
      name,
      email,
      company_name,
      phone,
      external_customer_id,
    } = req.body;

    if (!organization_id || !name || !email) {
      return res.status(400).json({
        error: "organization_id, name and email are required",
      });
    }

    const customer = await prisma.customers.create({
      data: {
        organization_id,
        name,
        email,
        company_name,
        phone,
        external_customer_id,
      },
    });

    res.status(201).json(customer);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to create customer" });
  }
});

export default router;