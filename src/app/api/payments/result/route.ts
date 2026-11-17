import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { finalizePaymentFromHubtel } from "@/lib/payments";

export const dynamic = "force-dynamic";

/**
 * Lightweight payment-status endpoint the storefront polls after redirecting
 * back from Hubtel. Returns NO personal data — just payment progress — and
 * re-verifies against Hubtel so an order finalises even if the callback
 * webhook was missed.
 */
export async function GET(req: NextRequest) {
  try {
    const code = (req.nextUrl.searchParams.get("code") ?? "").toUpperCase().trim();
    if (!code) {
      return NextResponse.json({ error: "Missing order code" }, { status: 400 });
    }

    const order = await db.order.findUnique({ where: { code }, include: { items: true } });
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // When an online checkout is in flight, double-check with Hubtel.
    if (order.paymentToken && order.paymentStatus !== "paid") {
      await finalizePaymentFromHubtel(order);
    }

    const fresh = order.paymentStatus === "paid"
      ? order
      : await db.order.findUniqueOrThrow({ where: { code } });

    return NextResponse.json({
      code: fresh.code,
      paymentStatus: fresh.paymentStatus,
      total: fresh.total,
      paidAt: fresh.paidAt ? fresh.paidAt.toISOString() : null,
    });
  } catch (err) {
    console.error("GET /api/payments/result failed:", err);
    return NextResponse.json({ error: "Could not load payment status" }, { status: 500 });
  }
}
