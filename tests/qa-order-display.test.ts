import { describe, expect, test } from "bun:test";
import { isLivePaymentQaOrder, merchandiseManifestOrders, LIVE_PAYMENT_QA_MARKER, LIVE_PAYMENT_QA_PRODUCT_ID } from "../src/lib/live-payment-qa-order";

describe("payment QA and merchandise separation", () => {
  const merchandise = { adminNotes: "Ship to customer", items: [{ productId: "tee-001" }] };
  const qa = { adminNotes: LIVE_PAYMENT_QA_MARKER + " No merchandise.", items: [{ productId: LIVE_PAYMENT_QA_PRODUCT_ID }] };

  test("recognizes payment QA by audit marker or reserved test product", () => {
    expect(isLivePaymentQaOrder(qa)).toBe(true);
    expect(isLivePaymentQaOrder({ ...qa, adminNotes: null })).toBe(true);
    expect(isLivePaymentQaOrder({ ...qa, items: [] })).toBe(true);
  });
  test("does not affect genuine customer orders", () => {
    expect(isLivePaymentQaOrder(merchandise)).toBe(false);
    expect(isLivePaymentQaOrder({ ...merchandise, adminNotes: null })).toBe(false);
  });
  test("never prints QA transactions on goods dispatch manifests", () => {
    expect(merchandiseManifestOrders([qa, merchandise])).toEqual([merchandise]);
    expect(merchandiseManifestOrders([qa])).toEqual([]);
  });
  test("only a leading marker identifies an otherwise regular order", () => {
    expect(isLivePaymentQaOrder({ ...merchandise, adminNotes: "See " + LIVE_PAYMENT_QA_MARKER + " in logs" })).toBe(false);
  });
});