import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getAdminToken, hashPassword } from "@/lib/admin-auth";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const loginSchema = z.object({ password: z.string().min(1).max(100) });

export async function POST(req: NextRequest) {
  try {
    // Slow down brute-force attempts on the back-office password.
    const limited = rateLimit(`login:${clientIp(req)}`, 10, 10 * 60_000);
    if (!limited.ok) {
      return NextResponse.json(
        { error: "Too many login attempts — try again in a few minutes." },
        { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } }
      );
    }

    const parsed = loginSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Password required" }, { status: 400 });
    }
    const row = await db.setting.findUnique({ where: { key: "admin_password" } });
    if (!row) {
      return NextResponse.json({ error: "Back office is not configured" }, { status: 500 });
    }
    const attempted = hashPassword(parsed.data.password);
    if (attempted !== row.value) {
      return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
    }
    const token = await getAdminToken();
    return NextResponse.json({ token });
  } catch (err) {
    console.error("POST /api/admin/login failed:", err);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
