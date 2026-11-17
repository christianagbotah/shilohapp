/**
 * Payment finalisation shared by the Hubtel webhook (callback POST), the
 * browser-redirect fallback and the storefront polling endpoint.
 * Belt & braces: whichever confirms the payment first wins, and a second
 * confirmation is a no-op.
 */
import { db } from "@/lib/db";
import { verifyHubtelTransaction, type WebhookInfo } from "@/lib/hubtel";
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
 * Flip an order to paid + fire SMS/email confirmations.
 * Idempotent: once paid, nothing happens. Returns the updated order.
 */
async function markOrderPaid(order: OrderWithItems): Promise<Order & { items: OrderItem[] }> {
  // Guard against a race between webhook and polling: only the first
  // unpaid -> paid write wins.
  const updated = await db.order.updateMany({
    where: { id: order.id, paymentStatus: { not: "paid" } },
    data: {
      paymentStatus: "paid",
      paidAt: new Date(),
      paymentMethod: "hubtel",
      // Paid orders move out of "pending" automatically so the admin's
      // queue only shows work that still needs attention.
      status: order.status === "pending" ? "reviewing" : order.status,
    },
  });
  if (updated.count === 0) {
    // Already paid by a parallel call — return the fresh row.
    return db.order.findUniqueOrThrow({ where: { id: order.id }, include: { items: true } });
  }

  const fresh = await db.order.findUniqueOrThrow({ where: { id: order.id }, include: { items: true } });

  // Notifications run after the status flip; never let them break the flow.
  try {
    await notifyPaymentConfirmed(toNotifyOrder(fresh));
  } catch (err) {
    console.error("notifyPaymentConfirmed failed:", err);
  }
  return fresh;
}

/**
 * Apply a Hubtel webhook result to an order (server-to-server callback).
 * Includes an amount sanity check: when Hubtel reports an amount that is
 * wildly different from the order total, the webhook is treated as
 * untrusted and logged for manual review instead of marking the order paid.
 */
export async function applyWebhookResult(
  order: OrderWithItems,
  info: WebhookInfo
): Promise<FinalizeOutcome> {
  if (order.paymentStatus === "paid") {
    return { paymentStatus: "paid", hubtelStatus: "success", alreadyPaid: true };
  }

  if (info.status === "success") {
    if (info.amount !== null && Math.abs(info.amount - order.total) > 1) {
      // Amount mismatch — do NOT trust this callback blindly.
      console.error(
        `Hubtel webhook amount mismatch for ${order.code}: expected ${order.total}, got ${info.amount} (tx ${info.transactionId})`
      );
      await db.order.updateMany({
        where: { id: order.id, paymentStatus: { not: "paid" } },
        data: { paymentStatus: "verifying" },
      });
      return { paymentStatus: "verifying", hubtelStatus: "unknown", alreadyPaid: false };
    }

    const txNote = info.transactionId ? `Hubtel tx ${info.transactionId}` : "Hubtel webhook";
    await db.order.updateMany({
      where: { id: order.id },
      data: { paymentToken: info.clientReference || order.paymentToken },
    });
    console.log(`Hubtel webhook: marking ${order.code} paid (${txNote})`);
    await markOrderPaid(order);
    return { paymentStatus: "paid", hubtelStatus: "success", alreadyPaid: false };
  }

  if (info.status === "cancelled" || info.status === "failed") {
    // Payment did not go through — back to unpaid so the customer can retry.
    await db.order.updateMany({
      where: { id: order.id, paymentStatus: { not: "paid" } },
      data: { paymentStatus: "unpaid" },
    });
    return { paymentStatus: "unpaid", hubtelStatus: info.status, alreadyPaid: false };
  }

  // pending / unknown — leave as-is; polling or a later webhook resolves it.
  return {
    paymentStatus: order.paymentStatus as FinalizeOutcome["paymentStatus"],
    hubtelStatus: info.status,
    alreadyPaid: false,
  };
}

/**
 * Check an order's payment status by asking Hubtel directly (used by the
 * browser-return fallback and the storefront polling endpoint).
 * Safe to call repeatedly — a second call is a no-op once paid.
 */
export async function finalizePaymentFromHubtel(
  order: OrderWithItems
): Promise<FinalizeOutcome> {
  if (order.paymentStatus === "paid") {
    return { paymentStatus: "paid", hubtelStatus: "not-checked", alreadyPaid: true };
  }
  // Only re-check orders that actually went through Hubtel (a checkout
  // reference was stored when the session started).
  if (!order.paymentToken && order.paymentMethod !== "hubtel") {
    return {
      paymentStatus: order.paymentStatus as FinalizeOutcome["paymentStatus"],
      hubtelStatus: "not-checked",
      alreadyPaid: false,
    };
  }

  // The clientReference we sent Hubtel is the order code.
  const result = await verifyHubtelTransaction(order.code);
  if (!result.ok) {
    // Provider unreachable — keep waiting, the next poll/webhook will retry.
    return {
      paymentStatus: order.paymentStatus as FinalizeOutcome["paymentStatus"],
      hubtelStatus: "unknown",
      alreadyPaid: false,
    };
  }

  if (result.status === "success") {
    await markOrderPaid(order);
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
