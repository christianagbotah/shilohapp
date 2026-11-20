import { describe, expect, test } from "bun:test";
import {
  smsAsciiText,
  smsOrderPlacedCustomer,
  smsPaymentConfirmedCustomer,
  smsPaymentConfirmedAdmin,
  smsOrderPlacedAdmin,
  smsStatusUpdateCustomer,
  type NotifyOrder,
} from "../src/lib/hubtel";

const order: NotifyOrder = {
  id: "uat", code: "SHL-ABC123", fullName: "Shiloh Customer", phone: "0240000000",
  total: 1, itemCount: 1,
  items: [{ productName: "Shiloh Kids Jersey", color: "Purple", size: "6-7y", quantity: 1 }],
};

describe("Hubtel SMS legibility", () => {
  test("formats order amounts with ASCII GHS instead of cedi glyphs", () => {
    const messages = [
      smsOrderPlacedCustomer(order), smsOrderPlacedAdmin(order),
      smsPaymentConfirmedCustomer(order), smsPaymentConfirmedAdmin(order),
      smsStatusUpdateCustomer(order, "contacted"),
      smsStatusUpdateCustomer(order, "fulfilled"),
      smsStatusUpdateCustomer(order, "cancelled"),
    ];
    for (const message of messages) {
      expect(message).not.toContain("₵");
      expect(message).not.toContain("GH₵");
      expect(message).not.toMatch(/merch/i);
      expect(smsAsciiText(message)).toMatch(/^[\x20-\x7e\n\r]*$/);
    }
    expect(smsPaymentConfirmedCustomer(order)).toContain("GHS 1.00");
    expect(smsPaymentConfirmedAdmin(order)).toContain("GHS 1.00");
  });
  test("completed order says Your order is ready", () => {
    expect(smsStatusUpdateCustomer(order, "fulfilled")).toContain("Your order is ready");
  });
  test("provider payload normalization handles cedi signs, smart quotes and punctuation", () => {
    expect(smsAsciiText("Paid: GH₵1.00 • ₵2.50 — “confirmed”")).toBe('Paid: GHS 1.00 - GHS 2.50 - "confirmed"');
  });
  test("QA SMS also uses GHS without claiming a real order", () => {
    const qa = { ...order, isQaTest: true };
    expect(smsPaymentConfirmedCustomer(qa)).toContain("GHS 1.00");
    expect(smsPaymentConfirmedCustomer(qa)).toContain("PAYMENT TEST");
  });
});
