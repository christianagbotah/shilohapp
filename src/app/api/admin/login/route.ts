import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  ADMIN_COOKIE, ADMIN_SESSION_SECONDS, hashPassword, issueAdminSession, verifyAdminPassword,
} from "@/lib/admin-auth";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
const loginSchema = z.object({ password: z.string().min(1).max(200) });

export async function POST(req: NextRequest) {
  try {
    const limited = rateLimit(`login:${clientIp(req)}`, 8, 10 * 60_000);
    if (!limited.ok) return NextResponse.json(
      { error: "Too many login attempts. Try again later." },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
    const parsed = loginSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: "Password required" }, { status: 400 });
    const setting = await db.setting.findUnique({ where: { key: "admin_password" } });
    if (!setting) return NextResponse.json({ error: "Administrator setup required. Run the secure password setup command." }, { status: 503 });
    const check = verifyAdminPassword(parsed.data.password, setting.value);
    if (!check.valid) return NextResponse.json({ error: "Incorrect password or legacy password must be reset." }, { status: 401 });
    if (check.legacy) {
      await db.$transaction([
        db.setting.update({ where: { key: "admin_password" }, data: { value: hashPassword(parsed.data.password) } }),
        db.adminSession.deleteMany(),
      ]);
    }
    const token = await issueAdminSession();
    const response = NextResponse.json({ ok: true });
    response.cookies.set(ADMIN_COOKIE, token, {
      httpOnly: true, secure: process.env.NODE_ENV === "production",
      sameSite: "lax", path: "/", maxAge: ADMIN_SESSION_SECONDS,
    });
    return response;
  } catch (err) {
    console.error("POST /api/admin/login failed:", err);
    return NextResponse.json({ error: "Login could not be completed" }, { status: 500 });
  }
}
