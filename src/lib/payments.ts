/**
 * Authoritative payment transitions used by the webhook, browser return,
 * storefront polling and the server-side reconciliation job.
 *
 * Financial state MUST only move to paid after a status response from Hubtel
 * matches the attempt's exact collection account, reference and pesewa amount.
 * All transitions are conditional; callbacks cannot demote a settled payment.
 */
import { db } from "@/lib/db";
import { verifyHubtelTransaction, type WebhookInfo, type StatusResult } from "@/lib/hubtel";
import { notifyPaymentConfirmed } from "@/lib/notify";
import type { NotifyOrder } from "@/lib/hubtel";
import type { Order, OrderItem, PaymentAttempt } from "@prisma/client";

type OrderWithItems = Order & { items: OrderItem[] };

export function toNotifyOrder(order: OrderWithItems): NotifyOrder {
  return {
    id: order.id, code: order.code, fullName: order.fullName, phone: order.phone,
    isQaTest: order.adminNotes?.startsWith("[LIVE_PAYMENT_QA]") ?? false,
    total: order.total, itemCount: order.items.reduce((n, i) => n + i.quantity, 0),
    items: order.items.map((i) => ({
      productName: i.productName, color: i.color, size: i.size, quantity: i.quantity,
    })),
  };
}

export type FinalizeOutcome = {
  paymentStatus: "unpaid" | "verifying" | "paid";
  hubtelStatus: "success" | "cancelled" | "failed" | "pending" | "refunded" | "unknown" | "not-checked";
  alreadyPaid: boolean;
  verificationError?: string;
};

function currentStatus(order: OrderWithItems, hubtelStatus: FinalizeOutcome["hubtelStatus"]): FinalizeOutcome {
  return {
    paymentStatus: order.paymentStatus as FinalizeOutcome["paymentStatus"],
    hubtelStatus,
    alreadyPaid: order.paymentStatus === "paid",
  };
}

function verifyAmount(
  order: OrderWithItems,
  reference: string,
  result: Extract<StatusResult, { ok: true }>,
  attempt?: PaymentAttempt | null
): boolean {
  const expected = attempt ? attempt.expectedPesewas : Math.round(order.total * 100);
  if (
    result.clientReference.toUpperCase() !== reference.toUpperCase() ||
    result.amount === null || !Number.isFinite(result.amount)
  ) return false;

  const grossPesewas = Math.round(result.amount * 100);
  // In the normal fee model the gross collection matches the order.
  if (grossPesewas === expected) return true;

  // Some Hubtel collection accounts add their processing fee on top of
  // the requested checkout price. Then gross = requested price + charges.
  // Accept only when Hubtel independently reports BOTH the exact net
  // amount for this order and a fee that reconciles to the gross amount.
  if (
    result.amountAfterCharges === null || !Number.isFinite(result.amountAfterCharges) ||
    result.charges === null || !Number.isFinite(result.charges) || result.charges < 0
  ) return false;
  return (
    Math.round(result.amountAfterCharges * 100) === expected &&
    Math.round((result.amountAfterCharges + result.charges) * 100) === grossPesewas
  );
}

/** Record money-state changes and attempt receipts in one SQLite transaction. */
async function markOrderPaid(
  order: OrderWithItems,
  reference: string,
  result: Extract<StatusResult, { ok: true }>,
  attempt?: PaymentAttempt | null
): Promise<FinalizeOutcome> {
  const wasNew = await db.$transaction(async (tx) => {
    const changed = await tx.order.updateMany({
      where: { id: order.id, paymentStatus: { not: "paid" } },
      data: { paymentStatus: "paid", paidAt: new Date(), paymentMethod: "hubtel" },
    });
    if (attempt) {
      await tx.paymentAttempt.updateMany({
        where: { id: attempt.id, status: { not: "paid" } },
        data: {
          status: "paid", hubtelTransactionId: result.transactionId || null,
          verifiedAmount: result.amount, lastCheckedAt: new Date(),
        },
      });
    }
    if (changed.count) {
      // Compare-and-set status independently; never overwrite an admin's
      // concurrent cancellation or fulfillment change using a stale read.
      await tx.order.updateMany({
        where: { id: order.id, status: "pending" },
        data: { status: "reviewing" },
      });
      await tx.paymentAudit.create({
        data: {
          orderId: order.id, event: "hubtel_payment_verified", reference,
          detail: `Amount ${result.amount}; Hubtel transaction ${result.transactionId || "not reported"}`,
        },
      });
    } else if (attempt && attempt.status !== "paid") {
      const previouslyPaid = await tx.paymentAttempt.findFirst({
        where: { orderId: order.id, status: "paid", id: { not: attempt.id } },
      });
      if (previouslyPaid) {
        await tx.paymentAudit.create({
          data: {
            orderId: order.id, event: "potential_duplicate_payment", reference,
            detail: "Second confirmed Hubtel attempt; investigate and refund if appropriate",
          },
        });
      }
    }
    return changed.count === 1;
  });

  if (wasNew) {
    try {
      const fresh = await db.order.findUniqueOrThrow({
        where: { id: order.id }, include: { items: true },
      });
      await notifyPaymentConfirmed(toNotifyOrder(fresh));
    } catch (err) {
      // Money has already been durably confirmed. Alerts are independent.
      console.error("Payment confirmed but notification was not completed", err);
    }
  }
  return { paymentStatus: "paid", hubtelStatus: "success", alreadyPaid: !wasNew };
}

async function changeAttemptStatus(
  order: OrderWithItems,
  attempt: PaymentAttempt | null,
  status: "failed" | "cancelled",
): Promise<void> {
  await db.$transaction(async (tx) => {
    if (attempt) {
      await tx.paymentAttempt.updateMany({
        where: { id: attempt.id, status: { not: "paid" } },
        data: { status, lastCheckedAt: new Date() },
      });
      // Only the *current* attempt may reset the order for retry.
      await tx.order.updateMany({
        where: { id: order.id, paymentToken: attempt.reference, paymentStatus: { not: "paid" } },
        data: { paymentStatus: "unpaid" },
      });
    } else {
      await tx.order.updateMany({
        where: { id: order.id, paymentStatus: { not: "paid" } },
        data: { paymentStatus: "unpaid" },
      });
    }
  });
}

/**
 * A callback is a hint, not a source of financial truth.
 * Even callback failures are verified to avoid stale failure messages
 * cancelling a successful or concurrently settled payment.
 */
export async function applyWebhookResult(
  order: OrderWithItems,
  info: WebhookInfo,
  attempt: PaymentAttempt | null = null,
): Promise<FinalizeOutcome> {
  const reference = attempt?.reference || order.paymentToken || order.code;
  if (!reference || info.clientReference.toUpperCase() !== reference.toUpperCase()) {
    return currentStatus(order, "unknown");
  }
  if (order.paymentStatus === "paid" && (!attempt || attempt.status === "paid")) {
    return currentStatus(order, "success");
  }
  // An order that has never initiated checkout must never be settled by
  // someone POSTing an invented callback with a guessed order code.
  if (!attempt && (!order.paymentToken || order.paymentMethod !== "hubtel")) {
    return currentStatus(order, "unknown");
  }
  if (info.amount !== null &&
      Math.round(info.amount * 100) < (attempt?.expectedPesewas ?? Math.round(order.total * 100))) {
    console.error("Hubtel callback amount mismatch", {
      reference, order: order.code,
      callbackAmount: info.amount,
      expectedAmount: (attempt?.expectedPesewas ?? Math.round(order.total * 100)) / 100,
    });
    return currentStatus(order, "unknown");
  }
  // Never translate a failure hint + a provider Unpaid/pending status
  // into a terminal failure; it may settle after the callback arrives.
  return verifyAndApply(order, attempt, reference);
}

async function verifyAndApply(
  order: OrderWithItems,
  attempt: PaymentAttempt | null,
  reference: string,
): Promise<FinalizeOutcome> {
  const result = await verifyHubtelTransaction(reference, attempt?.merchantNumber);
  if (!result.ok) {
    console.warn("Hubtel payment remains unresolved", { reference, reason: result.error });
    if (attempt) {
      await db.paymentAttempt.updateMany({
        where: { id: attempt.id, status: { in: ["initiating", "open", "unknown"] } },
        data: { status: "unknown", lastCheckedAt: new Date() },
      });
    }
    return { paymentStatus: order.paymentStatus === "paid" ? "paid" : "verifying",
      hubtelStatus: "unknown", alreadyPaid: order.paymentStatus === "paid",
      verificationError: result.error };
  }
  if (result.status === "success") {
    if (!verifyAmount(order, reference, result, attempt)) {
      console.error("Hubtel status evidence does not match the order", { reference, order: order.code });
      await db.paymentAudit.create({
        data: { orderId: order.id, event: "payment_evidence_mismatch", reference,
          detail: `Provider reported ${result.amount} for reference ${result.clientReference}` },
      });
      return { paymentStatus: "verifying", hubtelStatus: "unknown", alreadyPaid: false };
    }
    return markOrderPaid(order, reference, result, attempt);
  }
  if (result.status === "cancelled" || result.status === "failed") {
    await changeAttemptStatus(order, attempt, result.status);
    return { paymentStatus: "unpaid", hubtelStatus: result.status, alreadyPaid: false };
  }
  if (attempt) {
    await db.paymentAttempt.updateMany({
      where: { id: attempt.id, status: { in: ["initiating", "open", "unknown"] } },
      data: { lastCheckedAt: new Date() },
    });
  }
  // Hubtel's "Unpaid" is NOT a terminal failure: a late payment may settle.
  return {
    paymentStatus: order.paymentStatus as FinalizeOutcome["paymentStatus"],
    hubtelStatus: result.status,
    alreadyPaid: order.paymentStatus === "paid",
  };
}

export async function finalizePaymentFromHubtel(order: OrderWithItems): Promise<FinalizeOutcome> {
  if (order.paymentStatus === "paid") return currentStatus(order, "not-checked");
  if (!order.paymentToken || order.paymentMethod !== "hubtel") {
    return currentStatus(order, "not-checked");
  }
  const attempt = await db.paymentAttempt.findUnique({ where: { reference: order.paymentToken } });
  return verifyAndApply(order, attempt, order.paymentToken);
}