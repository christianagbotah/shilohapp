import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { normalizeGhPhone } from "@/lib/format";

export const dynamic = "force-dynamic";

/**
 * Customer flags "I have paid" — moves paymentStatus from `unpaid`
 * to `verifying` so the back office knows to expect the MoMo payment.
 */
const claimSchema = z.object({
  code: z.string().trim().min(4).max(20),
  phone: z.string().trim().min(9).max(20),
});

export async function POST(req: NextRequest) {
  try {
    const parsed = claimSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid order details" }, { status: 400 });
    }
    const code = parsed.data.code.toUpperCase();
    const phone = normalizeGhPhone(parsed.data.phone);
    if (!phone) {
      return NextResponse.json({ error: "Invalid phone number" }, { status: 400 });
    }

    const order = await db.order.findUnique({ where: { code } });
    if (!order || order.phone !== phone) {
      return NextResponse.json(
        { error: "No order found with that code and phone number" },
        { status: 404 }
      );
    }
    if (order.paymentStatus === "paid") {
      return NextResponse.json({ order: { code: order.code, paymentStatus: "paid" } });
    }
    if (order.paymentStatus === "verifying") {
      return NextResponse.json({ order: { code: order.code, paymentStatus: "verifying" } });
    }
    if (order.status === "cancelled") {
      return NextResponse.json({ error: "This order was cancelled" }, { status: 400 });
    }

    const updated = await db.order.update({
      where: { code },
      data: { paymentStatus: "verifying" },
    });
    return NextResponse.json({ order: { code: updated.code, paymentStatus: updated.paymentStatus } });
  } catch (err) {
    console.error("POST /api/orders/claim failed:", err);
    return NextResponse.json({ error: "Could not submit your payment claim" }, { status: 500 });
  }
}
