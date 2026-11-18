import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { finalizePaymentFromHubtel } from "@/lib/payments";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const code = (req.nextUrl.searchParams.get("code") || "").trim().toUpperCase();
    if (!/^SHL-[A-HJ-NP-Z2-9]{6}$/.test(code)) {
      return NextResponse.json({ error: "Invalid order code" }, { status: 400 });
    }
    const limit = rateLimit(`result:${clientIp(req)}:${code}`, 70, 10 * 60_000);
    if (!limit.ok) return NextResponse.json({ error: "Please try again shortly" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } });
    const order = await db.order.findUnique({ where: { code }, include: { items: true } });
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    if (order.paymentToken && order.paymentStatus !== "paid") {
      const attempt = await db.paymentAttempt.findUnique({ where: { reference: order.paymentToken } });
      if (!attempt?.lastCheckedAt || Date.now() - attempt.lastCheckedAt.getTime() > 12_000) {
        await finalizePaymentFromHubtel(order);
      }
    }
    const fresh = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    const currentAttempt = fresh.paymentToken ? await db.paymentAttempt.findUnique({ where: { reference: fresh.paymentToken } }) : null;
    return NextResponse.json({
      attemptStatus: currentAttempt?.status ?? null,
      code: fresh.code, paymentStatus: fresh.paymentStatus, total: fresh.total,
      paidAt: fresh.paidAt ? fresh.paidAt.toISOString() : null,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("GET /api/payments/result failed:", err);
    return NextResponse.json({ error: "Payment status is temporarily unavailable" }, { status: 503 });
  }
}
