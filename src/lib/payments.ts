/**
 * Payment finalisation shared by the Hubtel callback route and the
 * storefront polling endpoint (belt & braces: whichever hits Hubtel first
 * confirms the payment).
 */
import { db } from "@/lib/db";
import { getCheckoutStatus } from "@/lib/hubtel";
import { notifyPaymentConfirmed } from "@/lib/notify";
import type { NotifyOrder } from "@/lib/hubtel";
import type { Order, OrderItem } from "@prisma/client";

type OrderWithItems = Order & { items: OrderItem[] };

export function toNotifyOrder(order: OrderWithItems): NotifyOrder {
  return {
    id: order.id,
    code: order.code,
    fullName: order.fullName,
    phone: order.phone,
    total: order.total,
    itemCount: order.items.reduce((n, i) => n + i.quantity, 0),
    items: order.items.map((i) => ({
      productName: i.productName,
      color: i.color,
      size: i.size,
      quantity: i.quantity,
    })),
  };
}

export type FinalizeOutcome = {
  paymentStatus: "unpaid" | "verifying" | "paid";
  hubtelStatus: "success" | "cancelled" | "failed" | "pending" | "unknown" | "not-checked";
  alreadyPaid: boolean;
};

/**
 * Check an order's Hubtel checkout status and, when the provider says the
 * payment succeeded, mark the order paid + fire SMS/email confirmations.
 * Safe to call repeatedly — a second call is a no-op once paid.
 */
export async function finalizePaymentFromHubtel(
  order: OrderWithItems
): Promise<FinalizeOutcome> {
  if (order.paymentStatus === "paid") {
    return { paymentStatus: "paid", hubtelStatus: "not-checked", alreadyPaid: true };
  }
  if (!order.paymentToken) {
    return { paymentStatus: order.paymentStatus as FinalizeOutcome["paymentStatus"], hubtelStatus: "not-checked", alreadyPaid: false };
  }

  const result = await getCheckoutStatus(order.paymentToken);
  if (!result.ok) {
    // Provider unreachable — keep waiting, the next poll/callback will retry.
    return { paymentStatus: order.paymentStatus as FinalizeOutcome["paymentStatus"], hubtelStatus: "unknown", alreadyPaid: false };
  }

  if (result.status === "success") {
    const updated = await db.order.update({
      where: { id: order.id },
      data: {
        paymentStatus: "paid",
        paidAt: new Date(),
        paymentMethod: "hubtel",
        // Paid orders move out of "pending" automatically so the admin's
        // queue only shows work that still needs attention.
        status: order.status === "pending" ? "reviewing" : order.status,
      },
      include: { items: true },
    });

    // Notifications run after the status flip; never let them break the flow.
    try {
      await notifyPaymentConfirmed(toNotifyOrder(updated));
    } catch (err) {
      console.error("notifyPaymentConfirmed failed:", err);
    }

    return { paymentStatus: "paid", hubtelStatus: "success", alreadyPaid: false };
  }

  // cancelled | failed | pending | unknown — reflect what Hubtel told us.
  if (result.status === "cancelled" || result.status === "failed") {
    await db.order.updateMany({
      where: { id: order.id, paymentStatus: { not: "paid" } },
      data: { paymentStatus: "unpaid" },
    });
  }
  return { paymentStatus: "unpaid", hubtelStatus: result.status, alreadyPaid: false };
}
