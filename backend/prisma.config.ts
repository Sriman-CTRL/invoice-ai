import "dotenv/config";
import { defineConfig } from "prisma/config";

// `prisma generate` only needs a syntactically valid URL; real commands (db push, migrate) need a real one.
// Reading process.env directly (instead of env()) keeps generate working in CI / fresh clones without secrets.
const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL || "postgresql://placeholder:placeholder@localhost:5432/placeholder";

export default defineConfig({
  schema: "prisma/schema.prisma",

  migrations: {
    path: "prisma/migrations",
  },

  datasource: {
    url,
  },
});
