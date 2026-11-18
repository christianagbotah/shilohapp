import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getHubtelPaymentConfig, initiateCheckout } from "@/lib/hubtel";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { normalizeGhPhone } from "@/lib/format";

export const dynamic = "force-dynamic";
const initiateSchema = z.object({
  code: z.string().trim().min(4).max(20),
  phone: z.string().trim().min(9).max(20),
});

export async function POST(req: NextRequest) {
  try {
    const limit = rateLimit(`pay:${clientIp(req)}`, 12, 10 * 60_000);
    if (!limit.ok) {
      return NextResponse.json({ error: "Too many payment attempts. Please try later." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } });
    }
    const parsed = initiateSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    const order = await db.order.findUnique({ where: { code: parsed.data.code.toUpperCase() } });
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    if (normalizeGhPhone(parsed.data.phone) !== order.phone) {
      return NextResponse.json({ error: "Phone number does not match this order" }, { status: 403 });
    }
    if (order.paymentStatus === "paid") {
      return NextResponse.json({ error: "This order has already been paid", alreadyPaid: true }, { status: 409 });
    }
    if (order.status === "cancelled" || order.status === "fulfilled") {
      return NextResponse.json({ error: "This order is no longer open for payment" }, { status: 409 });
    }
    const config = await getHubtelPaymentConfig();
    if (!config?.merchantNumber) {
      return NextResponse.json({ error: "Online payment is not configured yet" }, { status: 503 });
    }

    const active = order.paymentToken
      ? await db.paymentAttempt.findUnique({ where: { reference: order.paymentToken } })
      : null;
    if (order.paymentStatus === "verifying" || active?.status === "open" || active?.status === "unknown") {
      if (active?.status === "open" && active.checkoutUrl) {
        return NextResponse.json({ url: active.checkoutUrl, resumed: true });
      }
      return NextResponse.json({
        error: "An earlier payment is still being checked. Please track its status before retrying to avoid paying twice.",
        pending: true,
      }, { status: 409 });
    }

    const reference = `${order.code}-${crypto.randomBytes(5).toString("hex").toUpperCase()}`;
    // Reserve one attempt atomically. Concurrent requests cannot open two
    // hosted checkout sessions for the same unpaid order.
    const reserved = await db.$transaction(async (tx) => {
      const claim = await tx.order.updateMany({
        where: { id: order.id, paymentStatus: "unpaid", status: { notIn: ["cancelled", "fulfilled"] } },
        data: { paymentStatus: "verifying", paymentMethod: "hubtel", paymentToken: reference },
      });
      if (claim.count !== 1) return false;
      await tx.paymentAttempt.create({
        data: {
          orderId: order.id, reference, merchantNumber: config.merchantNumber,
          expectedPesewas: Math.round(order.total * 100), status: "initiating",
        },
      });
      return true;
    });
    if (!reserved) {
      return NextResponse.json({ error: "Another payment is being processed. Please refresh the order status.", pending: true },
        { status: 409 });
    }

    const result = await initiateCheckout(
      { code: order.code, fullName: order.fullName, phone: order.phone, total: order.total },
      req.nextUrl.origin, reference
    );
    if (!result.ok) {
      await db.paymentAttempt.updateMany({
        where: { reference, status: { not: "paid" } },
        data: { status: result.ambiguous ? "unknown" : "failed" },
      });
      if (!result.ambiguous) {
        await db.order.updateMany({
          where: { id: order.id, paymentToken: reference, paymentStatus: { not: "paid" } },
          data: { paymentStatus: "unpaid" },
        });
      }
      return NextResponse.json({
        error: result.ambiguous
          ? "Hubtel did not confirm whether checkout was created. Please track this order before trying again."
          : result.error,
        pending: result.ambiguous,
      }, { status: 502 });
    }

    await db.paymentAttempt.updateMany({
      where: { reference, status: { not: "paid" } },
      data: { status: "open", checkoutUrl: result.url },
    });
    const fresh = await db.order.findUnique({ where: { id: order.id }, select: { paymentStatus: true } });
    return NextResponse.json({ url: result.url, token: reference, alreadyPaid: fresh?.paymentStatus === "paid" });
  } catch (err) {
    console.error("POST /api/payments/initiate failed:", err);
    return NextResponse.json({ error: "Payment could not be started; check your order before retrying." }, { status: 500 });
  }
}
