/**
 * Administrator live-money QA transactions are audit entries, not merchandise.
 */
export const LIVE_PAYMENT_QA_MARKER = "[LIVE_PAYMENT_QA]";
export const LIVE_PAYMENT_QA_PRODUCT_ID = "shiloh-payment-qa-internal";

export type QaClassifiableOrder = {
  adminNotes?: string | null;
  items: ReadonlyArray<{ productId: string }>;
};

export function isLivePaymentQaOrder(order: QaClassifiableOrder): boolean {
  return (
    (order.adminNotes?.startsWith(LIVE_PAYMENT_QA_MARKER) ?? false) ||
    order.items.some((item) => item.productId === LIVE_PAYMENT_QA_PRODUCT_ID)
  );
}

export function merchandiseManifestOrders<T extends QaClassifiableOrder>(
  orders: ReadonlyArray<T>
): T[] {
  return orders.filter((order) => !isLivePaymentQaOrder(order));
}