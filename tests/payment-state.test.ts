/**
 * Run against a disposable SQLite database ONLY:
 * DATABASE_URL='file:./local-test.db' bunx prisma db push
 * DATABASE_URL='file:./local-test.db' bun test tests/payment-state.test.ts
 */
import { beforeAll, beforeEach, afterAll, describe, test, expect } from "bun:test";
import { db } from "../src/lib/db";
import { NextRequest } from "next/server";
import { POST as initiatePayment } from "../src/app/api/payments/initiate/route";
import { POST as createLivePaymentTest } from "../src/app/api/admin/payments/live-test/route";
import { applyWebhookResult, finalizePaymentFromHubtel } from "../src/lib/payments";
import { hashPassword, verifyAdminPassword, issueAdminSession, ADMIN_COOKIE } from "../src/lib/admin-auth";

const originalFetch = globalThis.fetch;
const CODE = "SHL-ABC234";
const REF = "SHL-ABC234-A1B2C3D4E5";
let productId: string;

function mockStatus(
  reference = REF,
  amount = 80,
  status = "Paid",
  charges: number | null = null,
  amountAfterCharges: number | null = null,
) {
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (!url.startsWith("https://api-txnstatus.hubtel.com/transactions/998877/status")) {
      throw new Error("Unexpected outbound URL: " + url);
    }
    return new Response(JSON.stringify({
      responseCode: "0000",
      data: {
        clientReference: reference,
        amount,
        status,
        ...(charges !== null ? { charges } : {}),
        ...(amountAfterCharges !== null ? { amountAfterCharges } : {}),
        transactionId: "mock-hubtel-tx-123",
      },
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;
}

async function newOrder() {
  const order = await db.order.create({
    data: {
      code: CODE,
      fullName: "Test Customer",
      phone: "0241234567",
      paymentStatus: "verifying",
      paymentMethod: "hubtel",
      paymentToken: REF,
      subtotal: 80,
      total: 80,
      items: {
        create: [{
          productId, productName: "Test Tee", productType: "tshirt",
          ageGroup: "adult", color: "Gold", size: "M",
          quantity: 1, unitPrice: 80,
        }],
      },
      paymentAttempts: {
        create: [{
          reference: REF, expectedPesewas: 8000, merchantNumber: "998877",
          status: "open",
        }],
      },
    },
    include: { items: true, paymentAttempts: true },
  });
  return order;
}

beforeAll(async () => {
  if (!process.env.DATABASE_URL?.includes("local-test.db")) {
    throw new Error("Refusing to run payment tests against anything other than local-test.db");
  }
  await db.setting.upsert({ where: { key: "hubtel_client_id" }, update: { value: "test" }, create: { key: "hubtel_client_id", value: "test" } });
  await db.setting.upsert({ where: { key: "hubtel_client_secret" }, update: { value: "test" }, create: { key: "hubtel_client_secret", value: "test" } });
  await db.setting.upsert({ where: { key: "hubtel_merchant_number" }, update: { value: "998877" }, create: { key: "hubtel_merchant_number", value: "998877" } });
  const product = await db.product.create({
    data: {
      type: "tshirt", ageGroup: "adult", name: "Test Tee",
      price: 80, image: "/test.png", colors: '[{"name":"Gold","hex":"#ffffff"}]',
      sizes: '["M"]',
    },
  });
  productId = product.id;
});

beforeEach(async () => {
  await db.notificationLog.deleteMany();
  await db.paymentAudit.deleteMany();
  await db.paymentAttempt.deleteMany();
  await db.order.deleteMany();
  mockStatus();
});

afterAll(async () => {
  globalThis.fetch = originalFetch;
  await db.notificationLog.deleteMany();
  await db.paymentAudit.deleteMany();
  await db.paymentAttempt.deleteMany();
  await db.order.deleteMany();
  await db.product.deleteMany({ where: { id: productId } });
  await db.$disconnect();
});

describe("Hubtel money-state integrity", () => {
  test("verified payment moves to paid exactly once, even with repeated callbacks", async () => {
    const order = await newOrder();
    const info = { status: "success" as const, clientReference: REF, transactionId: "mock", amount: 80 };
    await applyWebhookResult(order, info, order.paymentAttempts[0]);
    await applyWebhookResult(order, info, order.paymentAttempts[0]);
    const fresh = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(fresh.paymentStatus).toBe("paid");
    expect(fresh.status).toBe("reviewing");
    expect(await db.paymentAudit.count({ where: { orderId: order.id, event: "hubtel_payment_verified" } })).toBe(1);
  });

  test("polling and callback racing cannot double-book revenue", async () => {
    const order = await newOrder();
    await Promise.all([
      applyWebhookResult(order, { status: "success", clientReference: REF, transactionId: "mock", amount: 80 }, order.paymentAttempts[0]),
      finalizePaymentFromHubtel(order),
    ]);
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).paymentStatus).toBe("paid");
    expect(await db.paymentAudit.count({ where: { orderId: order.id, event: "hubtel_payment_verified" } })).toBe(1);
  });

  test("a fast callback cannot be overwritten when initiation returns", async () => {
    const initial = await newOrder();
    await db.paymentAttempt.deleteMany({ where: { orderId: initial.id } });
    await db.order.update({
      where: { id: initial.id },
      data: { paymentStatus: "unpaid", paymentMethod: null, paymentToken: null },
    });
    await db.setting.upsert({
      where: { key: "site_url" },
      update: { value: "https://store.example" },
      create: { key: "site_url", value: "https://store.example" },
    });

    globalThis.fetch = (async (input: RequestInfo | URL, options?: RequestInit) => {
      if (String(input) !== "https://payproxyapi.hubtel.com/items/initiate") {
        throw new Error("Unexpected outbound API: " + String(input));
      }
      const payload = JSON.parse(String(options?.body)) as { clientReference: string };
      const order = await db.order.findUniqueOrThrow({
        where: { code: CODE }, include: { items: true },
      });
      const attempt = await db.paymentAttempt.findUniqueOrThrow({
        where: { reference: payload.clientReference },
      });
      mockStatus(payload.clientReference, 80, "Paid");
      await applyWebhookResult(order, {
        status: "success", clientReference: payload.clientReference,
        transactionId: "mock-fast-callback", amount: 80,
      }, attempt);
      return new Response(JSON.stringify({
        responseCode: "0000", checkoutUrl: "https://pay.hubtel.com/checkout/test",
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }) as unknown as typeof fetch;

    const request = new NextRequest("https://store.example/api/payments/initiate", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: CODE, phone: "0241234567" }),
    });
    const response = await initiatePayment(request);
    const body = await response.json() as { alreadyPaid: boolean };
    expect(response.status).toBe(200);
    expect(body.alreadyPaid).toBe(true);
    expect((await db.order.findUniqueOrThrow({ where: { code: CODE } })).paymentStatus).toBe("paid");
    expect(await db.paymentAttempt.count({ where: { orderId: initial.id, status: "paid" } })).toBe(1);
  });

  test("Hubtel fee on top of the order confirms exactly reconciled merchant net", async () => {
    const order = await newOrder();
    mockStatus(REF, 80.80, "Paid", 0.80, 80);
    const result = await finalizePaymentFromHubtel(order);
    expect(result.paymentStatus).toBe("paid");
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).paymentStatus).toBe("paid");
    const attempt = await db.paymentAttempt.findUniqueOrThrow({ where: { reference: REF } });
    expect(attempt.verifiedAmount).toBeCloseTo(80.80);
  });

  test("mismatched fee arithmetic is never sufficient to settle a paid claim", async () => {
    const order = await newOrder();
    mockStatus(REF, 80.80, "Paid", 0.70, 80);
    const result = await finalizePaymentFromHubtel(order);
    expect(result.paymentStatus).toBe("verifying");
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).paymentStatus).not.toBe("paid");
    expect(await db.paymentAudit.count({ where: { orderId: order.id, event: "payment_evidence_mismatch" } })).toBe(1);
  });

  test("underpayment reported by Hubtel never marks order paid", async () => {
    const order = await newOrder();
    mockStatus(REF, 79);
    await applyWebhookResult(order, { status: "success", clientReference: REF, transactionId: "mock", amount: 80 }, order.paymentAttempts[0]);
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).paymentStatus).toBe("verifying");
    expect(await db.paymentAudit.count({ where: { event: "payment_evidence_mismatch" } })).toBe(1);
  });

  test("wrong provider reference is rejected", async () => {
    const order = await newOrder();
    mockStatus("UNRELATED-REF", 80);
    await finalizePaymentFromHubtel(order);
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).paymentStatus).toBe("verifying");
  });

  test("an old failed callback cannot downgrade a paid order", async () => {
    const order = await newOrder();
    await finalizePaymentFromHubtel(order);
    await applyWebhookResult(order, { status: "failed", clientReference: REF, transactionId: "mock", amount: 80 }, order.paymentAttempts[0]);
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).paymentStatus).toBe("paid");
  });

  test("Hubtel 403 remains unverified and exposes the actual verification issue", async () => {
    const order = await newOrder();
    globalThis.fetch = (async () => new Response("Forbidden", { status: 403 })) as unknown as typeof fetch;
    const outcome = await finalizePaymentFromHubtel(order);
    expect(outcome.hubtelStatus).toBe("unknown");
    expect(outcome.verificationError).toContain("HTTP 403");
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).paymentStatus).toBe("verifying");
    expect((await db.paymentAttempt.findUniqueOrThrow({ where: { reference: REF } })).status).toBe("unknown");
    expect(await db.notificationLog.count({ where: { orderId: order.id, purpose: "payment_confirmed_customer" } })).toBe(0);
  });

  test("authenticated administrator cannot charge a second QA transaction while one is unresolved", async () => {
    const order = await newOrder();
    await db.order.update({
      where: { id: order.id },
      data: { adminNotes: "[LIVE_PAYMENT_QA] Pending real-money trial" },
    });
    const originalFlag = process.env.SHILOH_LIVE_PAYMENT_TEST_ENABLED;
    process.env.SHILOH_LIVE_PAYMENT_TEST_ENABLED = "true";
    try {
      const session = await issueAdminSession();
      const request = new NextRequest("https://shiloh.lightworldtech.com/api/admin/payments/live-test", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://shiloh.lightworldtech.com",
          host: "shiloh.lightworldtech.com",
          cookie: ADMIN_COOKIE + "=" + session,
        },
        body: JSON.stringify({ phone: "0241234567", amount: 1 }),
      });
      const response = await createLivePaymentTest(request);
      const body = await response.json() as { code?: string; pending?: boolean };
      expect(response.status).toBe(409);
      expect(body.pending).toBe(true);
      expect(body.code).toBe(CODE);
      expect(await db.order.count()).toBe(1);
      await db.adminSession.deleteMany();
    } finally {
      if (originalFlag === undefined) delete process.env.SHILOH_LIVE_PAYMENT_TEST_ENABLED;
      else process.env.SHILOH_LIVE_PAYMENT_TEST_ENABLED = originalFlag;
    }
  });

  test("Hubtel network errors leave order unresolved, not unpaid", async () => {
    const order = await newOrder();
    globalThis.fetch = (async () => { throw new Error("provider offline"); }) as unknown as typeof fetch;
    const outcome = await finalizePaymentFromHubtel(order);
    expect(outcome.hubtelStatus).toBe("unknown");
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).paymentStatus).toBe("verifying");
  });
});

describe("administrator password model", () => {
  test("uses independently salted scrypt hashes", () => {
    const a = hashPassword("Correct-Horse-Battery!2026");
    const b = hashPassword("Correct-Horse-Battery!2026");
    expect(a).not.toBe(b);
    expect(verifyAdminPassword("Correct-Horse-Battery!2026", a).valid).toBe(true);
    expect(verifyAdminPassword("incorrect", a).valid).toBe(false);
    expect(verifyAdminPassword("shiloh2026", a).valid).toBe(false);
  });
});
