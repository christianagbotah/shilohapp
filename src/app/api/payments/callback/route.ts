import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { normalizeWebhookPayload } from "@/lib/hubtel";
import { applyWebhookResult, finalizePaymentFromHubtel } from "@/lib/payments";

export const dynamic = "force-dynamic";

/**
 * Hubtel Online Checkout callback.
 *
 * POST = server-to-server webhook. After a customer pays (or the payment
 * fails), Hubtel POSTs the result here:
 *   { Status, Data: { InvoiceId, ClientReference, ... }, TransactionId }
 * We match the ClientReference back to the order, sanity-check the amount,
 * mark it paid and fire the confirmation SMS/email alerts.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const info = normalizeWebhookPayload(body);
    if (!info) {
      // Not a shape we recognise — acknowledge so Hubtel stops retrying.
      console.warn("Hubtel webhook: unrecognised payload", JSON.stringify(body).slice(0, 300));
      return NextResponse.json({ received: true });
    }

    console.log(
      `Hubtel webhook: status=${info.status} ref=${info.clientReference} tx=${info.transactionId} amount=${info.amount ?? "n/a"}`
    );

    // Match the order by clientReference (our order code), then by the
    // stored checkout reference, before giving up.
    let order = info.clientReference
      ? await db.order.findUnique({ where: { code: info.clientReference }, include: { items: true } })
      : null;
    if (!order && info.clientReference) {
      order = await db.order.findFirst({
        where: { paymentToken: info.clientReference },
        include: { items: true },
      });
    }

    if (!order) {
      console.warn(`Hubtel webhook: no order matches reference "${info.clientReference}"`);
      return NextResponse.json({ received: true });
    }

    await applyWebhookResult(order, info);
    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("POST /api/payments/callback failed:", err);
    // 200 keeps Hubtel from endlessly retrying a poisoned payload; the
    // polling endpoint still finalises the order later.
    return NextResponse.json({ received: true });
  }
}

/**
 * GET = browser-redirect fallback. If Hubtel ever sends the customer's
 * browser here (instead of returnUrl), we double-check the payment with
 * Hubtel and bounce them to the storefront with a friendly result.
 */
export async function GET(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams;
    const token = params.get("token") ?? params.get("checkoutToken");
    const code = (params.get("code") ?? params.get("orderCode") ?? "").toUpperCase();

    // Prefer resolving via the checkout reference; fall back to the order code.
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
