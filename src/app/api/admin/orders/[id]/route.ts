import { NextRequest, NextResponse, after } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { isAdminRequest } from "@/lib/admin-auth";
import { notifyOrderStatusChanged, notifyPaymentConfirmed } from "@/lib/notify";
import { toNotifyOrder } from "@/lib/payments";
import type { OrderStatus, PaymentStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  status: z.enum(["pending", "reviewing", "contacted", "fulfilled", "cancelled"]).optional(),
  adminNotes: z.string().max(500).optional(),
  // Manual payments require a reference from an independently confirmed
  // transfer/cash receipt; Hubtel transactions must be verified by Hubtel.
  manualPaymentReference: z.string().trim().min(6).max(100).optional(),
}).strict();

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { id } = await params;
    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success || Object.keys(parsed.data).length === 0) {
      return NextResponse.json({ error: "Invalid update. Direct payment-status overrides are not allowed." }, { status: 400 });
    }
    const existing = await db.order.findUnique({ where: { id }, include: { paymentAttempts: { take: 1 } } });
    if (!existing) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    const d = parsed.data;
    if (d.status === "fulfilled" && existing.paymentStatus !== "paid") {
      return NextResponse.json({ error: "Verify payment before marking an order fulfilled." }, { status: 409 });
    }
    if (d.status === "cancelled" && existing.paymentStatus === "paid") {
      return NextResponse.json({ error: "Paid orders require a documented refund before cancellation." }, { status: 409 });
    }
    if (d.manualPaymentReference) {
      if (existing.paymentStatus === "paid") {
        return NextResponse.json({ error: "Payment was already confirmed." }, { status: 409 });
      }
      if (existing.paymentMethod === "hubtel" || existing.paymentToken || existing.paymentAttempts.length) {
        return NextResponse.json({ error: "A Hubtel payment attempt exists. Reconcile it with Hubtel; do not override it manually." }, { status: 409 });
      }
    }

    const changed = await db.$transaction(async (tx) => {
      let manuallyPaid = false;
      if (d.manualPaymentReference) {
        const result = await tx.order.updateMany({
          where: { id, paymentStatus: { not: "paid" }, paymentToken: null },
          data: { paymentStatus: "paid", paymentMethod: "momo-manual", paidAt: new Date() },
        });
        if (!result.count) throw new Error("Payment already changed; reload order");
        manuallyPaid = true;
        await tx.paymentAudit.create({
          data: {
            orderId: id, event: "manual_payment_confirmed",
            reference: d.manualPaymentReference,
            detail: d.adminNotes || "Confirmed by an authenticated back-office administrator",
          },
        });
      }
      const conditionalWhere = d.status === "cancelled"
        ? { id, paymentStatus: { not: "paid" as const } }
        : d.status === "fulfilled"
          ? { id, paymentStatus: "paid" }
          : { id };
      const statusWrite = await tx.order.updateMany({
        where: conditionalWhere,
        data: {
          ...(d.adminNotes !== undefined ? { adminNotes: d.adminNotes } : {}),
          ...(d.status !== undefined ? { status: d.status } : {}),
          ...(d.status === undefined && manuallyPaid && existing.status === "pending" ? { status: "reviewing" } : {}),
        },
      });
      if (statusWrite.count !== 1) throw new Error("Payment changed while editing the order; reload and verify again");
      const update = await tx.order.findUniqueOrThrow({ where: { id } });
      return { update, manuallyPaid };
    });

    const statusChanged = d.status !== undefined && d.status !== existing.status;
    if (statusChanged && (d.status === "contacted" || d.status === "fulfilled" || d.status === "cancelled")) {
      after(async () => {
        try {
          const fresh = await db.order.findUnique({ where: { id }, include: { items: true } });
          if (fresh) await notifyOrderStatusChanged(toNotifyOrder(fresh), d.status as "contacted" | "fulfilled" | "cancelled");
        } catch (err) { console.error("Order status notification failed:", err); }
      });
    }
    if (changed.manuallyPaid) {
      after(async () => {
        try {
          const fresh = await db.order.findUnique({ where: { id }, include: { items: true } });
          if (fresh) await notifyPaymentConfirmed(toNotifyOrder(fresh));
        } catch (err) { console.error("Manual payment notification failed:", err); }
      });
    }

    return NextResponse.json({
      order: {
        id: changed.update.id, status: changed.update.status as OrderStatus,
        paymentStatus: changed.update.paymentStatus as PaymentStatus,
        adminNotes: changed.update.adminNotes,
      },
    });
  } catch (err) {
    console.error("PATCH /api/admin/orders/[id] failed:", err);
    return NextResponse.json({ error: "Order update failed. Reload before retrying." }, { status: 500 });
  }
}
