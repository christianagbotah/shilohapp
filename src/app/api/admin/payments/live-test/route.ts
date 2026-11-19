import crypto, { randomInt } from "node:crypto";
import { after, NextRequest, NextResponse } from "next/server";
import { livePaymentQaSchema } from "@/lib/live-payment-qa";
import { db } from "@/lib/db";
import { isAdminRequest } from "@/lib/admin-auth";
import { getHubtelPaymentConfig, initiateCheckout } from "@/lib/hubtel";
import { normalizeGhPhone } from "@/lib/format";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { finalizePaymentFromHubtel, toNotifyOrder } from "@/lib/payments";
import { notifyOrderPlaced } from "@/lib/notify";

export const dynamic = "force-dynamic";

const QA_PRODUCT_ID = "shiloh-payment-qa-internal";
const QA_MARKER = "[LIVE_PAYMENT_QA]";
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";


function newOrderCode(): string {
  return "SHL-" + Array.from({ length: 6 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
}

const unavailable = () => NextResponse.json({
  error: "Live payment testing is currently disabled by the administrator.",
}, { status: 503 });

/**
 * Admin-only test route. Does NOT activate the public payment gate.
 * Creating a checkout link does not charge anyone. The administrator must
 * complete a real payment on Hubtel to exercise the callback/status/SMS flow.
 */
export async function POST(req: NextRequest) {
  if (!(await isAdminRequest(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (process.env.SHILOH_LIVE_PAYMENT_TEST_ENABLED !== "true") return unavailable();
  const limited = rateLimit("live-payment-qa:" + clientIp(req), 2, 60 * 60_000);
  if (!limited.ok) {
    return NextResponse.json({
      error: "Two test checkouts have already been created this hour. Reconcile existing attempts before retrying.",
    }, { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } });
  }
  try {
    const parsed = livePaymentQaSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid test details" }, { status: 400 });
    }
    const phone = normalizeGhPhone(parsed.data.phone);
    if (!phone) {
      return NextResponse.json({ error: "Enter a valid Ghana Mobile Money number" }, { status: 400 });
    }
    const config = await getHubtelPaymentConfig();
    if (!config?.merchantNumber || !config.siteUrl) {
      return NextResponse.json({ error: "Save the Hubtel credentials and Public Site URL before testing" }, { status: 400 });
    }

    const amount = Math.round(parsed.data.amount * 100) / 100;
    await db.product.upsert({
      where: { id: QA_PRODUCT_ID },
      create: {
        id: QA_PRODUCT_ID,
        type: "tshirt",
        ageGroup: "adult",
        name: "Payment processing test — no merchandise",
        tagline: "Administrator-only transaction verification",
        price: 0,
        image: "/images/shiloh-flyer.jpg",
        colors: JSON.stringify([{ name: "Test", hex: "#b99856" }]),
        sizes: JSON.stringify(["N/A"]),
        active: false,
      },
      update: { active: false },
    });

    // The order and its unique payment attempt are reserved atomically.
    // A failure to create either means neither is saved.
    let code = newOrderCode();
    for (let n = 0; n < 6; n++) {
      if (!(await db.order.findUnique({ where: { code }, select: { id: true } }))) break;
      code = newOrderCode();
    }
    const reference = code + "-" + crypto.randomBytes(5).toString("hex").toUpperCase();
    const order = await db.order.create({
      data: {
        code,
        fullName: "Live Payment Test",
        phone,
        address: "Administrator payment verification — no merchandise to deliver",
        status: "pending",
        paymentStatus: "verifying",
        paymentMethod: "hubtel",
        paymentToken: reference,
        subtotal: amount,
        total: amount,
        adminNotes: QA_MARKER + " Administrator payment and notification test. This is not a merchandise order. Do not fulfil.",
        items: {
          create: [{
            productId: QA_PRODUCT_ID,
            productName: "Live Payment & SMS QA (no goods)",
            productType: "tshirt",
            ageGroup: "adult",
            color: "Test",
            size: "N/A",
            unitPrice: amount,
            quantity: 1,
          }],
        },
        paymentAttempts: {
          create: [{
            reference,
            merchantNumber: config.merchantNumber,
            expectedPesewas: Math.round(amount * 100),
            status: "initiating",
          }],
        },
      },
      include: { items: true },
    });

    const result = await initiateCheckout(
      { code, fullName: order.fullName, phone, total: amount },
      req.nextUrl.origin,
      reference
    );
    if (!result.ok) {
      await db.paymentAttempt.updateMany({
        where: { reference, status: { not: "paid" } },
        data: { status: result.ambiguous ? "unknown" : "failed" },
      });
      if (!result.ambiguous) {
        await db.order.updateMany({
          where: { id: order.id, paymentToken: reference, paymentStatus: { not: "paid" } },
          data: { paymentStatus: "unpaid" },
        });
      }
      return NextResponse.json({
        error: result.ambiguous
          ? "Hubtel checkout creation is uncertain for test " + code + ". Check the order before retrying."
          : result.error + " (QA order " + code + " — no payment was confirmed)",
        code,
        pending: result.ambiguous,
      }, { status: 502 });
    }

    await db.paymentAttempt.updateMany({
      where: { reference, status: { not: "paid" } },
      data: { status: "open", checkoutUrl: result.url },
    });

    // The normal order notification pathway is reused: customer + admin SMS
    // and admin email (where those channels are enabled). Never fabricate
    // an SMS success result: the provider response is recorded separately.
    after(async () => {
      try {
        await notifyOrderPlaced(toNotifyOrder(order));
      } catch (err) {
        console.error("Live payment QA order notification failed", err);
      }
    });

    return NextResponse.json({
      code,
      amount,
      paymentStatus: "verifying",
      url: result.url,
      message: "Checkout created. You will only be charged if you approve this real-money payment at Hubtel.",
    }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("Admin live payment test initiation failed", err);
    return NextResponse.json({
      error: "Could not complete live test setup. Check the QA payment history before creating another checkout.",
    }, { status: 500 });
  }
}

/** Admin-only report: authoritative payment state and notification attempts. */
export async function GET(req: NextRequest) {
  if (!(await isAdminRequest(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const code = (req.nextUrl.searchParams.get("code") ?? "").trim().toUpperCase();
  if (!/^SHL-[A-HJ-NP-Z2-9]{6}$/.test(code)) {
    return NextResponse.json({ error: "Enter a valid test order code" }, { status: 400 });
  }
  try {
    let order = await db.order.findUnique({ where: { code }, include: { items: true } });
    if (!order?.adminNotes?.startsWith(QA_MARKER)) {
      return NextResponse.json({ error: "QA test order not found" }, { status: 404 });
    }
    let attempt = order.paymentToken
      ? await db.paymentAttempt.findUnique({ where: { reference: order.paymentToken } })
      : null;

    if (order.paymentStatus === "verifying" &&
        (!attempt?.lastCheckedAt || Date.now() - attempt.lastCheckedAt.getTime() >= 20_000)) {
      await finalizePaymentFromHubtel(order);
      order = await db.order.findUniqueOrThrow({ where: { code }, include: { items: true } });
      attempt = order.paymentToken
        ? await db.paymentAttempt.findUnique({ where: { reference: order.paymentToken } })
        : null;
    }
    const notifications = await db.notificationLog.findMany({
      where: { orderId: order.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { channel: true, purpose: true, status: true, createdAt: true },
    });

    return NextResponse.json({
      code: order.code,
      amount: order.total,
      paymentStatus: order.paymentStatus,
      attemptStatus: attempt?.status ?? null,
      paidAt: order.paidAt?.toISOString() ?? null,
      verifiedAmount: attempt?.verifiedAmount ?? null,
      checkoutUrl: order.paymentStatus === "verifying" && attempt?.status === "open"
        ? attempt.checkoutUrl : null,
      notificationAttempts: notifications.map((n) => ({
        channel: n.channel,
        purpose: n.purpose,
        status: n.status,
        createdAt: n.createdAt.toISOString(),
      })),
      note: "SMS sent means accepted by Hubtel for delivery, not verified on the recipient's handset.",
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("Admin live payment QA status failed", err);
    return NextResponse.json({ error: "Could not refresh test status. Retry later." }, { status: 503 });
  }
}
