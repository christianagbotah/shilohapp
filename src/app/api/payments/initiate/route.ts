import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { initiateCheckout } from "@/lib/hubtel";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const initiateSchema = z.object({
  code: z.string().trim().min(4).max(20),
  phone: z.string().trim().min(9).max(20),
});

/**
 * Start a Hubtel online-checkout session for an existing order.
 * The storefront redirects the customer to the returned URL, where Hubtel
 * collects MoMo / card payment and then notifies our callback route.
 */
export async function POST(req: NextRequest) {
  try {
    // Each call opens a Hubtel checkout session — throttle abuse.
    const limited = rateLimit(`pay:${clientIp(req)}`, 12, 10 * 60_000);
    if (!limited.ok) {
      return NextResponse.json(
        { error: "Too many payment attempts just now — please wait a few minutes and try again." },
        { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } }
      );
    }

    const parsed = initiateSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    const { code, phone } = parsed.data;

    const order = await db.order.findUnique({ where: { code: code.toUpperCase() } });
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    if (order.phone !== phone) {
      return NextResponse.json({ error: "Phone number does not match this order" }, { status: 403 });
    }
    if (order.paymentStatus === "paid") {
      return NextResponse.json(
        { error: "This order is already paid", alreadyPaid: true },
        { status: 400 }
      );
    }
    if (order.status === "cancelled") {
      return NextResponse.json({ error: "This order was cancelled" }, { status: 400 });
    }

    const result = await initiateCheckout(
      { code: order.code, fullName: order.fullName, phone: order.phone, total: order.total },
      req.nextUrl.origin
    );
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, fallback: true },
        { status: 502 }
      );
    }

    await db.order.update({
      where: { id: order.id },
      data: {
        // paymentToken now holds the clientReference sent to Hubtel
        // (the order code) so webhook callbacks match back to the order.
        paymentToken: result.token,
        paymentMethod: "hubtel",
        paymentStatus: "verifying",
      },
    });

    return NextResponse.json({ url: result.url, token: result.token });
  } catch (err) {
    console.error("POST /api/payments/initiate failed:", err);
    return NextResponse.json(
      { error: "Could not start payment. Please try again.", fallback: true },
      { status: 500 }
    );
  }
}
