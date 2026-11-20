/**
 * Run every 5 minutes through the host scheduler:
 * cd /path/to/shilohapp && bun scripts/reconcile-payments.ts
 * This does not charge customers; it only checks unresolved checkout attempts.
 */
import { db } from "../src/lib/db";
import { finalizePaymentFromHubtel } from "../src/lib/payments";
async function main() {
  const due = await db.order.findMany({
    where: {
      paymentStatus: "verifying", paymentMethod: "hubtel",
      createdAt: { lt: new Date(Date.now() - 5 * 60_000) },
    },
    include: { items: true }, take: 100,
    orderBy: { createdAt: "asc" },
  });
  let paid = 0;
  for (const order of due) {
    try {
      const attempt = order.paymentToken
        ? await db.paymentAttempt.findUnique({ where: { reference: order.paymentToken } })
        : null;
      if (attempt?.lastCheckedAt && Date.now() - attempt.lastCheckedAt.getTime() < 60_000) continue;
      const outcome = await finalizePaymentFromHubtel(order);
      if (outcome.paymentStatus === "paid") paid++;
    } catch (err) { console.error("Reconciliation failed for", order.code, err); }
  }
  console.log(`Reconciliation checked ${due.length} unresolved orders; ${paid} verified paid`);
}
main().finally(async () => db.$disconnect());
