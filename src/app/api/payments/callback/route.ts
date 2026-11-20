import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { normalizeWebhookPayload } from "@/lib/hubtel";
import { applyWebhookResult, finalizePaymentFromHubtel } from "@/lib/payments";

export const dynamic = "force-dynamic";

/**
 * Public Hubtel server-to-server callback. The supplied status has no financial
 * authority; applyWebhookResult rechecks the unique attempt against Hubtel.
 * Transient processing exceptions return 503 so Hubtel can retry.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as Record<string, unknown>;
    const info = normalizeWebhookPayload(body);
    if (!info?.clientReference) {
      return NextResponse.json({ error: "Unrecognized Hubtel callback" }, { status: 400 });
    }
    const attempt = await db.paymentAttempt.findUnique({
      where: { reference: info.clientReference }, include: { order: { include: { items: true } } },
    });
    const legacyOrder = attempt ? null : await db.order.findFirst({
      where: { OR: [{ code: info.clientReference }, { paymentToken: info.clientReference }] },
      include: { items: true },
    });
    const order = attempt?.order || legacyOrder;
    if (!order) {
      console.warn("Hubtel callback without matching order", info.clientReference);
      return NextResponse.json({ received: true, matched: false });
    }
    await applyWebhookResult(order, info, attempt);
    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("Hubtel callback processing error", err);
    return NextResponse.json({ error: "Temporary processing error" }, { status: 503 });
  }
}

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const token = params.get("token") || params.get("checkoutToken");
  const code = (params.get("code") || params.get("orderCode") || "").toUpperCase();
  try {
    const attempt = token ? await db.paymentAttempt.findUnique({ where: { reference: token } }) : null;
    const order = await db.order.findFirst({
      where: attempt ? { id: attempt.orderId } : { code },
      include: { items: true },
    });
    if (!order) return NextResponse.redirect(new URL("/?payment=unknown", req.nextUrl.origin));
    const outcome = await finalizePaymentFromHubtel(order);
    const result = outcome.paymentStatus === "paid" ? "success"
      : outcome.hubtelStatus === "cancelled" ? "cancelled"
      : outcome.hubtelStatus === "failed" ? "failed" : "processing";
    return NextResponse.redirect(new URL(
      `/?payment=${result}&code=${encodeURIComponent(order.code)}`, req.nextUrl.origin,
    ));
  } catch (err) {
    console.error("Hubtel return status check failed", err);
    return NextResponse.redirect(new URL("/?payment=processing&code=" + encodeURIComponent(code), req.nextUrl.origin));
  }
}
