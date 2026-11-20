import crypto from "node:crypto";
import { db } from "@/lib/db";

export const ADMIN_COOKIE = "shiloh-admin-session";
const SESSION_HOURS = 12;
const LEGACY_SALT = "|shiloh-merch-salt";
const DEFAULT_PASSWORD = "shiloh2026";

function safeEquals(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

/** An independently salted, memory-hard password hash. */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${derived}`;
}

export function verifyAdminPassword(password: string, stored: string): { valid: boolean; legacy: boolean } {
  if (password === DEFAULT_PASSWORD) return { valid: false, legacy: false };
  if (stored.startsWith("scrypt:")) {
    const [, salt, expected] = stored.split(":");
    if (!salt || !expected || !/^[a-f0-9]{32}$/.test(salt) || !/^[a-f0-9]{128}$/.test(expected)) {
      return { valid: false, legacy: false };
    }
    const actual = crypto.scryptSync(password, salt, 64).toString("hex");
    return { valid: safeEquals(actual, expected), legacy: false };
  }
  // Legacy migration for existing installations only. The well-known seed
  // password is refused; other strong old passwords are upgraded on login.
  if (/^[a-f0-9]{64}$/.test(stored) && password.length >= 12) {
    const oldHash = crypto.createHash("sha256").update(password + LEGACY_SALT).digest("hex");
    return { valid: safeEquals(oldHash, stored), legacy: true };
  }
  return { valid: false, legacy: false };
}

export async function issueAdminSession(): Promise<string> {
  const raw = crypto.randomBytes(32).toString("base64url");
  await db.adminSession.create({
    data: {
      tokenHash: crypto.createHash("sha256").update(raw).digest("hex"),
      expiresAt: new Date(Date.now() + SESSION_HOURS * 60 * 60 * 1000),
    },
  });
  return raw;
}

export const ADMIN_SESSION_SECONDS = SESSION_HOURS * 60 * 60;

function readCookie(req: Request): string | null {
  const cookie = req.headers.get("cookie") || "";
  const entry = cookie.split(";").map((x) => x.trim()).find((x) => x.startsWith(`${ADMIN_COOKIE}=`));
  const value = entry?.slice(ADMIN_COOKIE.length + 1);
  return value && /^[A-Za-z0-9_-]{43}$/.test(value) ? value : null;
}

export async function revokeAdminSession(req: Request): Promise<void> {
  const token = readCookie(req);
  if (token) {
    await db.adminSession.deleteMany({
      where: { tokenHash: crypto.createHash("sha256").update(token).digest("hex") },
    });
  }
}

export async function isAdminRequest(req: Request): Promise<boolean> {
  const token = readCookie(req);
  if (!token) return false;
  // Reject cross-origin state-changing admin requests, including requests
  // originating from other applications on sibling subdomains.
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    const origin = req.headers.get("origin");
    const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
    if (!origin || !host) return false;
    try {
      if (new URL(origin).host !== host) return false;
    } catch {
      return false;
    }
  }
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const record = await db.adminSession.findUnique({ where: { tokenHash } });
  return !!record && record.expiresAt.getTime() > Date.now();
}
