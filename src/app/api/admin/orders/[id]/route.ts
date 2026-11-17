import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { isAdminRequest } from "@/lib/admin-auth";
import { notifyOrderStatusChanged, notifyPaymentConfirmed } from "@/lib/notify";
import { toNotifyOrder } from "@/lib/payments";
import type { OrderStatus, PaymentStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  status: z.enum(["pending", "reviewing", "contacted", "fulfilled", "cancelled"]).optional(),
  paymentStatus: z.enum(["unpaid", "verifying", "paid"]).optional(),
  adminNotes: z.string().max(500).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminRequest(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { id } = await params;
    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success || Object.keys(parsed.data).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    const existing = await db.order.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const data: Record<string, unknown> = { ...parsed.data };

    // Manual "Confirm payment received": stamp the same metadata the Hubtel
    // flow writes so receipts and stats stay consistent.
    const transitionToPaid =
      parsed.data.paymentStatus === "paid" && existing.paymentStatus !== "paid";
    if (transitionToPaid) {
      data.paidAt = new Date();
      if (!existing.paymentMethod) data.paymentMethod = "momo-manual";
      // Paid orders leave the "pending review" queue, mirroring markOrderPaid.
      if (existing.status === "pending" && data.status === undefined) {
        data.status = "reviewing";
      }
    }

    const updated = await db.order.update({ where: { id }, data });

    // Customer notifications run after the response so the back office stays snappy.
    const statusChanged =
      parsed.data.status !== undefined && parsed.data.status !== existing.status;
    const notifiableStatus =
      parsed.data.status === "contacted" ||
      parsed.data.status === "fulfilled" ||
      parsed.data.status === "cancelled";

    if (statusChanged && notifiableStatus) {
      after(async () => {
        try {
          const fresh = await db.order.findUnique({ where: { id }, include: { items: true } });
          if (fresh) {
            await notifyOrderStatusChanged(toNotifyOrder(fresh), parsed.data.status as "contacted" | "fulfilled" | "cancelled");
          }
        } catch (err) {
          console.error("Status-change notification failed:", err);
        }
      });
    }

    if (transitionToPaid) {
      after(async () => {
        try {
          const fresh = await db.order.findUnique({ where: { id }, include: { items: true } });
          if (fresh && fresh.paymentStatus === "paid") {
            await notifyPaymentConfirmed(toNotifyOrder(fresh));
          }
        } catch (err) {
          console.error("Payment-confirmed notification failed:", err);
        }
      });
    }

    return NextResponse.json({
      order: {
        id: updated.id,
        status: updated.status as OrderStatus,
        paymentStatus: updated.paymentStatus as PaymentStatus,
        adminNotes: updated.adminNotes,
      },
    });
  } catch (err) {
    console.error("PATCH /api/admin/orders/[id] failed:", err);
    return NextResponse.json({ error: "Failed to update order" }, { status: 500 });
  }
}
