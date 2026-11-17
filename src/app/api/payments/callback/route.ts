import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { finalizePaymentFromHubtel } from "@/lib/payments";

export const dynamic = "force-dynamic";

/**
 * Hubtel Online Checkout callback. After a customer pays (or cancels),
 * Hubtel hits this URL with the checkout token. We verify the payment with
 * Hubtel's status API (never trust raw callback params), update the order,
 * fire the confirmation SMS/email alerts, then bounce the customer's browser
 * to the storefront with a friendly result.
 */
export async function GET(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams;
    const token = params.get("token") ?? params.get("checkoutToken");
    const code = (params.get("code") ?? params.get("orderCode") ?? "").toUpperCase();

    // Prefer resolving via the checkout token; fall back to the order code.
    let order = token
      ? await db.order.findFirst({ where: { paymentToken: token }, include: { items: true } })
      : null;
    if (!order && code) {
      order = await db.order.findUnique({ where: { code }, include: { items: true } });
    }

    if (!order) {
      return NextResponse.redirect(new URL("/?payment=unknown", req.nextUrl.origin));
    }

    const outcome = await finalizePaymentFromHubtel(order);

    let result: string;
    if (outcome.paymentStatus === "paid") {
      result = "success";
    } else if (outcome.hubtelStatus === "cancelled") {
      result = "cancelled";
    } else if (outcome.hubtelStatus === "failed") {
      result = "failed";
    } else {
      // Still processing at the provider — the storefront keeps polling.
      result = "processing";
    }

    return NextResponse.redirect(
      new URL(`/?payment=${result}&code=${order.code}`, req.nextUrl.origin)
    );
  } catch (err) {
    console.error("GET /api/payments/callback failed:", err);
    return NextResponse.redirect(new URL("/?payment=unknown", req.nextUrl.origin));
  }
}
