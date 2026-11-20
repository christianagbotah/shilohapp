import { PrismaClient } from "@prisma/client";
import { statSync } from "node:fs";

// Never let an ambiguous relative SQLite URL silently create a fresh,
// empty database in Next's standalone working directory.
if (process.env.NODE_ENV === "production") {
  const configured = process.env.DATABASE_URL || "";
  const match = /^file:(\/[^?#]+)(?:[?#].*)?$/.exec(configured);
  if (!match) throw new Error("Production DATABASE_URL must be a persistent absolute SQLite path (file:/absolute/path/to/database.db)");
  const file = decodeURIComponent(match[1]);
  try {
    if (statSync(file).size < 512) throw new Error("SQLite file is empty");
  } catch {
    throw new Error("Production SQLite database is missing or empty. Restore or migrate the real database before starting the store.");
  }
}

const globalDb = globalThis as unknown as { prisma?: PrismaClient };

export const db = globalDb.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === "development" && process.env.PRISMA_DEBUG_QUERIES === "true"
    ? ["query", "warn", "error"] : ["warn", "error"],
});

if (process.env.NODE_ENV !== "production") globalDb.prisma = db;
