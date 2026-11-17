import crypto from "crypto";
import { db } from "@/lib/db";

const TOKEN_SECRET = "shiloh-2026-merch-backoffice";

/** Hash a plaintext password the same way the seeder does. */
export function hashPassword(password: string): string {
  return crypto
    .createHash("sha256")
    .update(password + "|shiloh-merch-salt")
    .digest("hex");
}

/**
 * The admin token is derived from the stored password hash, so changing
 * the password immediately invalidates every previously issued token.
 */
export async function getAdminToken(): Promise<string | null> {
  const row = await db.setting.findUnique({ where: { key: "admin_password" } });
  if (!row) return null;
  return crypto.createHash("sha256").update(row.value + TOKEN_SECRET).digest("hex");
}

/** Validate the x-admin-token header of an incoming request. */
export async function isAdminRequest(req: Request): Promise<boolean> {
  const token = req.headers.get("x-admin-token");
  if (!token) return false;
  const expected = await getAdminToken();
  if (!expected) return false;
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
