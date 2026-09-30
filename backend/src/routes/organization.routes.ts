import { Router } from "express";
import prisma from "../lib/prisma";

const router = Router();

router.post("/", async (req, res) => {
  try {
    const { name, slug } = req.body;

    if (!name || !slug) {
      return res.status(400).json({
        error: "name and slug are required",
      });
    }

    const organization = await prisma.organizations.create({
      data: {
        name,
        slug,
      },
    });

    res.status(201).json(organization);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Failed to create organization",
    });
  }
});

router.get("/", async (_req, res) => {
  try {
    const organizations = await prisma.organizations.findMany({
      orderBy: {
        created_at: "desc",
      },
    });

    res.json(organizations);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Failed to fetch organizations",
    });
  }
});

export default router;