/**
 * Run with a strong password supplied via a local environment variable:
 * SHILOH_ADMIN_INITIAL_PASSWORD='...' bun scripts/set-admin-password.ts
 * Do not pass secrets on the command line or commit them.
 */
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/admin-auth";
const db = new PrismaClient();
async function main() {
  const pw = process.env.SHILOH_ADMIN_INITIAL_PASSWORD;
  if (!pw || pw.length < 12 || pw === "shiloh2026") {
    throw new Error("Set SHILOH_ADMIN_INITIAL_PASSWORD to a unique password of at least 12 characters");
  }
  const hashed = hashPassword(pw);
  await db.$transaction([
    db.setting.upsert({
      where: { key: "admin_password" },
      update: { value: hashed },
      create: { key: "admin_password", value: hashed },
    }),
    db.adminSession.deleteMany(),
  ]);
  console.log("Administrator password replaced; prior sessions revoked.");
}
main().finally(() => db.$disconnect());
