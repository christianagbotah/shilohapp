import { describe, expect, test } from "bun:test";
import { NextRequest } from "next/server";
import {
  GET as getLiveTest,
  POST as createLiveTest,
} from "../src/app/api/admin/payments/live-test/route";
import { livePaymentQaSchema } from "../src/lib/live-payment-qa";
import {
  smsOrderPlacedCustomer,
  smsOrderPlacedAdmin,
  smsPaymentConfirmedCustomer,
  smsPaymentConfirmedAdmin,
  type NotifyOrder,
} from "../src/lib/hubtel";

const sample: NotifyOrder = {
  id: "test-order",
  code: "SHL-BCDE23",
  fullName: "Live Payment Test",
  phone: "0240000000",
  total: 1,
  itemCount: 1,
  items: [{ productName: "QA", color: "Test", size: "N/A", quantity: 1 }],
  isQaTest: true,
};

describe("Admin-only real-money test safeguards", () => {
  test("one-cedi real-money checkout is permitted, sub-cedi and high charges are blocked", () => {
    expect(livePaymentQaSchema.safeParse({ phone: "0240000000", amount: 1 }).success).toBe(true);
    expect(livePaymentQaSchema.safeParse({ phone: "0240000000", amount: 0.99 }).success).toBe(false);
    expect(livePaymentQaSchema.safeParse({ phone: "0240000000", amount: 20.01 }).success).toBe(false);
    expect(livePaymentQaSchema.safeParse({ phone: "0240000000", amount: 1.001 }).success).toBe(false);
  });

  test("unauthenticated callers cannot create a real test charge", async () => {
    const req = new NextRequest("https://shiloh.lightworldtech.com/api/admin/payments/live-test", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://shiloh.lightworldtech.com" },
      body: JSON.stringify({ phone: "0240000000", amount: 5 }),
    });
    const res = await createLiveTest(req);
    expect(res.status).toBe(401);
  });

  test("unauthenticated callers cannot inspect real test payment state", async () => {
    const req = new NextRequest(
      "https://shiloh.lightworldtech.com/api/admin/payments/live-test?code=SHL-BCDE23"
    );
    const res = await getLiveTest(req);
    expect(res.status).toBe(401);
  });

  test("QA messages plainly say no merchandise is supplied", () => {
    expect(smsOrderPlacedCustomer(sample)).toContain("PAYMENT TEST");
    expect(smsOrderPlacedCustomer(sample)).toContain("No merchandise");
    expect(smsOrderPlacedAdmin(sample)).toContain("Do not fulfil");
    expect(smsPaymentConfirmedCustomer(sample)).toContain("REAL-money test");
    expect(smsPaymentConfirmedAdmin(sample)).toContain("No goods");
    expect(smsPaymentConfirmedCustomer(sample)).toContain("₵1");
  });

  test("ordinary customer payment confirmation still describes delivery", () => {
    const standard = { ...sample, isQaTest: false };
    expect(smsPaymentConfirmedCustomer(standard)).toContain("delivery");
    expect(smsOrderPlacedCustomer(standard)).toContain("Pay securely");
  });
});
