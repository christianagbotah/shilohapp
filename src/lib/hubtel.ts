/**
 * Hubtel integration — Online Checkout (payments) + SMS gateway.
 *
 * Payment flow (Hubtel Online Checkout — payproxyapi.hubtel.com):
 *   1. initiateCheckout() -> POST https://payproxyapi.hubtel.com/items/initiate
 *      Payload (camelCase):
 *        { totalAmount, description, callbackUrl, returnUrl, cancellationUrl,
 *          merchantAccountNumber, clientReference, clientName? }
 *      Returns { checkoutUrl }; the customer is redirected there to pay with
 *      MTN MoMo / Telecel Cash / AT Money / cards.
 *   2. Hubtel POSTs the payment result (server-to-server) to our callbackUrl:
 *        { Status, Data: { InvoiceId, ClientReference, ... }, TransactionId }
 *      Status "Completed"/"Success" = paid; "Failed"/"Cancelled"/"Timeout"/
 *      "Declined" = not paid.
 *   3. verifyHubtelTransaction() double-checks a clientReference against
 *      Hubtel's transaction API (belt & braces when the webhook is delayed).
 *
 * SMS flow (Hubtel Messaging API — sms.hubtel.com, batch simple send):
 *   sendHubtelSms() -> POST /v1/messages/batch/simple/send with Basic auth.
 *   Payload: { From, Recipients: ["+233…"], Content }. Success = status 0.
 *   getHubtelSmsBalance() -> GET /v1/merchantaccount/merchants/{clientId}/balance
 *   (used to diagnose insufficient / low balance on failures).
 */
import { getSetting } from "@/lib/store-utils";
import {
  explainHubtelCheckoutFailure,
  isTrustedHubtelCheckoutUrl,
  parseHubtelCheckoutResponse,
} from "@/lib/hubtel-checkout-response";

// ---------------------------------------------------------------------------
// Endpoints (adjust here if the provider payloads change)
// ---------------------------------------------------------------------------

const INITIATE_URL = "https://payproxyapi.hubtel.com/items/initiate";
const VERIFY_TXN_BASE = "https://api-txnstatus.hubtel.com/transactions";
const SEND_SMS_URL = "https://sms.hubtel.com/v1/messages/batch/simple/send";

/** Every outbound call aborts after this so order placement is never blocked. */
const PROVIDER_TIMEOUT_MS = 15_000;

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export type HubtelPaymentConfig = {
  /** Hubtel "API Username" (Online Checkout credential). */
  clientId: string;
  /** Hubtel "API Key" / secret that pairs with the API username. */
  clientSecret: string;
  /** Hubtel Merchant Account Number — required by the checkout payload. */
  merchantNumber: string;
  merchantName: string;
  /** Public site URL used to build Hubtel callback / return URLs. */
  siteUrl: string;
};

export type HubtelSmsConfig = {
  clientId: string;
  clientSecret: string;
  senderId: string;
};

export async function getHubtelPaymentConfig(): Promise<HubtelPaymentConfig | null> {
  const [clientId, clientSecret, merchantNumber, merchantName, siteUrl] = await Promise.all([
    getSetting("hubtel_client_id"),
    getSetting("hubtel_client_secret"),
    getSetting("hubtel_merchant_number"),
    getSetting("hubtel_merchant_name"),
    getSetting("site_url"),
  ]);
  if (!clientId || !clientSecret) return null;
  return {
    clientId,
    clientSecret,
    merchantNumber: merchantNumber ?? "",
    merchantName: merchantName || "Shiloh 2026",
    siteUrl: (siteUrl || process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/+$/, ""),
  };
}

export async function getHubtelSmsConfig(): Promise<HubtelSmsConfig | null> {
  const [clientId, clientSecret, senderId] = await Promise.all([
    getSetting("sms_client_id"),
    getSetting("sms_client_secret"),
    getSetting("sms_sender"),
  ]);
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret, senderId: senderId || "SHILOH" };
}

function basicAuth(clientId: string, clientSecret: string): string {
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
}

// ---------------------------------------------------------------------------
// Payment — Online Checkout (payproxyapi.hubtel.com)
// ---------------------------------------------------------------------------

export type InitiateResult =
  | { ok: true; url: string; token: string }
  | { ok: false; error: string; ambiguous: boolean };

export type CheckoutOrder = {
  code: string;
  fullName: string;
  phone: string;
  total: number;
};

/**
 * Create a Hubtel checkout session for an order.
 * `origin` is the request origin (used when no explicit site_url is configured).
 * The order code is used as the clientReference, so webhook callbacks can be
 * matched straight back to the order.
 */
export async function initiateCheckout(
  order: CheckoutOrder,
  origin: string,
  reference: string
): Promise<InitiateResult> {
  const config = await getHubtelPaymentConfig();
  if (!config) {
    return { ok: false, error: "Hubtel payment is not configured", ambiguous: false };
  }
  if (!config.merchantNumber) {
    return {
      ok: false,
      error: "Hubtel Merchant Account Number is missing — add it in Admin Settings",
      ambiguous: false,
    };
  }

  const base = config.siteUrl ||
    (process.env.NODE_ENV !== "production" ? origin.replace(/\/+$/, "") : "");
  if (!base) {
    return { ok: false, error: "Set the canonical HTTPS site URL before accepting payments", ambiguous: false };
  }
  try {
    const target = new URL(base);
    if (target.protocol !== "https:" ||
      target.username || target.password || target.search || target.hash ||
      target.pathname !== "/") {
      return { ok: false, error: "Invalid canonical HTTPS site URL", ambiguous: false };
    }
  } catch {
    return { ok: false, error: "Invalid canonical HTTPS site URL", ambiguous: false };
  }
  const clientReference = reference;

  // --- Hubtel Online Checkout initiate payload (camelCase) ---
  const payload: Record<string, unknown> = {
    totalAmount: Number(order.total.toFixed(2)),
    description: `Shiloh order ${order.code}`,
    callbackUrl: `${base}/api/payments/callback`,
    returnUrl: `${base}/?payment=return&code=${order.code}`,
    cancellationUrl: `${base}/?payment=cancelled&code=${order.code}`,
    merchantAccountNumber: config.merchantNumber,
    clientReference,
  };
  if (order.fullName) payload.payeeName = order.fullName;
  if (order.phone) payload.payeeMobileNumber = order.phone;

  try {
    const res = await fetch(INITIATE_URL, {
      method: "POST",
      headers: {
        Authorization: basicAuth(config.clientId, config.clientSecret),
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
    });

    const text = await res.text();
    let data: Record<string, unknown> = {};
    try {
      data = JSON.parse(text);
    } catch {
      data = {};
    }

    // HTTP status 200 is only transport success. Hubtel's v1 checkout
    // response has { responseCode: "0000", data: { checkoutUrl } }.
    const parsed = parseHubtelCheckoutResponse(data);
    if (!res.ok || parsed.responseCode !== "0000" || !parsed.checkoutUrl ||
        !isTrustedHubtelCheckoutUrl(parsed.checkoutUrl)) {
      const failure = explainHubtelCheckoutFailure(parsed, res.status);
      return { ok: false, error: failure.error, ambiguous: failure.inconclusive };
    }
    const url = parsed.checkoutUrl;
    return { ok: true, url, token: clientReference };
  } catch (err) {
    const error =
      err instanceof Error && err.name === "TimeoutError"
        ? "Hubtel did not respond in time"
        : "Could not reach Hubtel";
    return { ok: false, error, ambiguous: true };
  }
}

export type CheckoutStatus = "success" | "cancelled" | "failed" | "pending" | "refunded" | "unknown";

/** Normalise the many possible Hubtel status spellings. */
function normaliseStatus(raw: string): CheckoutStatus {
  const s = raw.trim().toLowerCase();
  if (["success", "succeeded", "paid", "completed", "complete"].includes(s)) return "success";
  if (["cancelled", "canceled", "abort", "abandoned"].includes(s)) return "cancelled";
  if (["failed", "failure", "error", "declined", "rejected", "timeout"].includes(s))
    return "failed";
  if (s === "refunded") return "refunded";
  if (["unpaid", "pending", "processing", "in_progress", "inprogress", "awaiting"].includes(s))
    return "pending";
  return "unknown";
}

/** Pull a status string out of whichever field shape Hubtel returns. */
function extractStatus(data: Record<string, unknown>): string | null {
  const nested = (data["Data"] ?? data["data"]) as Record<string, unknown> | undefined;
  const candidates: Array<unknown> = [
    data["Status"],
    data["status"],
    nested?.["Status"],
    nested?.["status"],
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.length > 0) return c;
  }
  return null;
}

export type StatusResult =
  | {
      ok: true;
      status: CheckoutStatus;
      raw: string;
      amount: number | null;
      /** Hubtel processing charge in cedis, when reported. */
      charges: number | null;
      /** Net merchant amount in cedis, when reported. */
      amountAfterCharges: number | null;
      clientReference: string;
      transactionId: string;
    }
  | { ok: false; error: string };

/**
 * Hubtel's authoritative Transaction Status API (Nov 2026).
 * An online checkout "success" callback is never financial proof on its own.
 * The collection account must be allowlisted with Hubtel for this endpoint.
 */
export async function verifyHubtelTransaction(
  reference: string,
  merchantNumber?: string
): Promise<StatusResult> {
  const config = await getHubtelPaymentConfig();
  if (!config) return { ok: false, error: "Hubtel payment is not configured" };
  const account = merchantNumber || config.merchantNumber;
  if (!account) return { ok: false, error: "Hubtel collection account is not configured" };

  try {
    const uri = `${VERIFY_TXN_BASE}/${encodeURIComponent(account)}/status?clientReference=${encodeURIComponent(reference)}`;
    const res = await fetch(uri, {
      method: "GET",
      headers: {
        Authorization: basicAuth(config.clientId, config.clientSecret),
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
      cache: "no-store",
    });
    if (!res.ok) return { ok: false, error: `Hubtel status HTTP ${res.status}` };
    const body = (await res.json()) as Record<string, unknown>;
    if (body.responseCode !== "0000") {
      return { ok: false, error: `Hubtel status rejected: ${String(body.responseCode || "unknown")}` };
    }
    const detail = body.data as Record<string, unknown> | undefined;
    if (!detail || typeof detail.status !== "string") {
      return { ok: false, error: "Hubtel status response missing data.status" };
    }
    const finiteAmount = (value: unknown): number | null => {
      if (typeof value !== "number" && (typeof value !== "string" || !value.trim())) return null;
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    };
    return {
      ok: true,
      raw: detail.status,
      status: normaliseStatus(detail.status),
      amount: finiteAmount(detail.amount),
      charges: finiteAmount(detail.charges),
      amountAfterCharges: finiteAmount(detail.amountAfterCharges),
      clientReference: typeof detail.clientReference === "string" ? detail.clientReference : "",
      transactionId: typeof detail.transactionId === "string" ? detail.transactionId : "",
    };
  } catch {
    return { ok: false, error: "Could not reach Hubtel transaction status service" };
  }
}

// ---------------------------------------------------------------------------
// Webhook payload normalisation
// ---------------------------------------------------------------------------

export type WebhookInfo = {
  status: CheckoutStatus;
  clientReference: string;
  transactionId: string;
  /** Payment amount as reported by Hubtel (null when not present). */
  amount: number | null;
};

/**
 * Normalise the several shapes Hubtel uses for its callback POST:
 * fields may sit at the top level or nested inside { Data: {...} }.
 */
export function normalizeWebhookPayload(body: Record<string, unknown>): WebhookInfo | null {
  const data = (body["Data"] ?? body["data"]) as Record<string, unknown> | undefined;
  const pick = (...vals: Array<unknown>): string => {
    for (const v of vals) if (typeof v === "string" && v.length > 0) return v;
    return "";
  };

  const rawStatus = pick(
    body["Status"],
    body["status"],
    data?.["Status"],
    data?.["status"]
  );
  if (!rawStatus) return null;

  const ref = pick(
    body["ClientReference"],
    body["clientReference"],
    data?.["ClientReference"],
    data?.["clientReference"]
  );
  const txId = pick(
    body["TransactionId"],
    body["transactionId"],
    data?.["TransactionId"],
    data?.["transactionId"]
  );
  const amountRaw =
    body["Amount"] ?? body["amount"] ?? data?.["Amount"] ?? data?.["TotalAmount"];
  let amount: number | null = null;
  if (typeof amountRaw === "number" && Number.isFinite(amountRaw)) amount = amountRaw;
  else if (typeof amountRaw === "string") {
    const n = Number(amountRaw);
    if (Number.isFinite(n)) amount = n;
  }

  return {
    status: normaliseStatus(rawStatus),
    clientReference: ref.toUpperCase(),
    transactionId: txId,
    amount,
  };
}

// ---------------------------------------------------------------------------
// SMS — Hubtel Messaging API (sms.hubtel.com, batch simple send)
// ---------------------------------------------------------------------------

/** 0244123456 -> +233244123456 (the format Hubtel SMS expects). */
export function toInternationalGhPhone(local: string): string {
  const digits = local.replace(/[^\d]/g, "");
  if (digits.startsWith("233")) return `+${digits}`;
  if (digits.startsWith("0")) return `+233${digits.slice(1)}`;
  return `+${digits}`;
}

export type SmsResult = { ok: true; detail: string } | { ok: false; error: string };

export type SmsBalance = {
  /** Account balance in GHS (null when the API did not report one). */
  balance: number | null;
  /** Cost per SMS page in GHS (Hubtel calls this "Credit"). */
  ratePerPage: number | null;
};

/**
 * Query the Hubtel SMS account balance — same endpoint the PHP version uses,
 * so failure messages can explain INSUFFICIENT / LOW BALANCE situations.
 */
export async function getHubtelSmsBalance(): Promise<SmsBalance | null> {
  const config = await getHubtelSmsConfig();
  if (!config) return null;

  try {
    const res = await fetch(
      `https://api.hubtel.com/v1/merchantaccount/merchants/${encodeURIComponent(config.clientId)}/balance`,
      {
        method: "GET",
        headers: {
          Authorization: basicAuth(config.clientId, config.clientSecret),
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
      }
    );
    if (!res.ok) return null;
    const data = (await res.json().catch(() => null)) as {
      Balance?: number | string;
      Credit?: number | string;
    } | null;
    if (!data) return null;
    const num = (v: number | string | undefined): number | null => {
      if (v === undefined) return null;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };
    return { balance: num(data.Balance), ratePerPage: num(data.Credit) };
  } catch {
    return null;
  }
}

/** Send one SMS through Hubtel. Throws nothing — always returns a result. */
/** SMS networks sometimes replace the cedi symbol with ??. Send ASCII.
 * This only changes SMS, not currency formatting on the website. */
export function smsAsciiText(input: string): string {
  return input
    .replace(/GH₵|₵/g, "GHS ")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—−]/g, "-")
    .replace(/[…]/g, "...")
    .replace(/[•·]/g, "-")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7e\n\r]/g, "");
}

const smsAmount = (n: number) =>
  "GHS " + n.toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export async function sendHubtelSms(to: string, content: string): Promise<SmsResult> {
  const config = await getHubtelSmsConfig();
  if (!config) {
    return { ok: false, error: "SMS is not configured (Hubtel SMS API key missing)" };
  }

  // --- Hubtel messaging payload (batch simple send) ---
  const payload = {
    From: config.senderId,
    Recipients: [toInternationalGhPhone(to)],
    Content: smsAsciiText(content),
  };

  try {
    const res = await fetch(SEND_SMS_URL, {
      method: "POST",
      headers: {
        Authorization: basicAuth(config.clientId, config.clientSecret),
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
    });

    const text = await res.text();
    let data: Record<string, unknown> = {};
    try {
      data = JSON.parse(text);
    } catch {
      data = {};
    }

    // Hubtel batch API: numeric status 0 = accepted for delivery (the PHP
    // version checks $response['status'] == 0 with loose comparison).
    const rawStatus = data["status"] ?? data["Status"];
    const statusNum = Number(rawStatus);
    const accepted =
      res.ok &&
      (rawStatus !== undefined ? statusNum === 0 : false);
    if (accepted) {
      const id = (data["messageId"] as string) || (data["MessageId"] as string) || "";
      return { ok: true, detail: id ? `MessageId ${id}` : "Accepted" };
    }

    let message =
      (data["message"] as string) ||
      (data["Message"] as string) ||
      (data["MessageResponse"] as string) ||
      (rawStatus !== undefined ? `status ${rawStatus}` : `HTTP ${res.status}`);

    // Mirror the PHP behaviour: on failure, check the balance so the admin
    // knows immediately whether it is an INSUFFICIENT / LOW BALANCE case.
    const bal = await getHubtelSmsBalance();
    if (bal && bal.balance !== null) {
      if (bal.balance <= 0) {
        message += ` — INSUFFICIENT BALANCE: Hubtel SMS balance is GHS 0.00. Please top up.`;
      } else if (bal.balance < 5) {
        message += ` — LOW BALANCE: Hubtel SMS balance is GHS ${bal.balance.toFixed(2)}. Please top up soon.`;
      }
    }
    return { ok: false, error: message };
  } catch (err) {
    const error =
      err instanceof Error && err.name === "TimeoutError"
        ? "Hubtel SMS did not respond in time"
        : "Could not reach Hubtel SMS";
    return { ok: false, error };
  }
}

// ---------------------------------------------------------------------------
// Message templates (single source of truth for customer/admin alerts)
// ---------------------------------------------------------------------------

export type NotifyOrder = {
  isQaTest?: boolean;
  id: string;
  code: string;
  fullName: string;
  phone: string;
  total: number;
  itemCount: number;
  items: Array<{ productName: string; color: string; size: string; quantity: number }>;
};

function itemsSummary(order: NotifyOrder): string {
  return order.items
    .slice(0, 3)
    .map((i) => `${i.quantity}x ${i.productName} (${i.color}, ${i.size})`)
    .join(", ")
    .slice(0, 120);
}

export function smsOrderPlacedCustomer(order: NotifyOrder): string {
  if (order.isQaTest) {
    return "SHILOH PAYMENT TEST " + order.code + ": Live checkout for " + smsAmount(order.total) +
      " prepared. Only pay if you approve it on Hubtel. No goods will be supplied.";
  }
  return (
    `Shiloh 2026: Order ${order.code} received. Total ${smsAmount(order.total)}. ` +
    "Pay securely via the Hubtel checkout to confirm your order. Thank you!"
  );
}

export function smsOrderPlacedAdmin(order: NotifyOrder): string {
  if (order.isQaTest) {
    return "SHILOH ADMIN QA " + order.code + ": Live payment test of " + smsAmount(order.total) +
      " initiated. Do not fulfil or dispatch any goods.";
  }
  return (
    `NEW ORDER ${order.code}: ${order.fullName} (${order.phone}) — ` +
    `${order.itemCount} items, ${smsAmount(order.total)}. Check the back office.`
  );
}

export function smsPaymentConfirmedCustomer(order: NotifyOrder): string {
  if (order.isQaTest) {
    return "SHILOH PAYMENT TEST " + order.code + ": Hubtel verified receipt of " + smsAmount(order.total) +
      ". This was a REAL-money test, not a customer order.";
  }
  return (
    `Payment confirmed! Shiloh 2026 order ${order.code} (${smsAmount(order.total)}) is confirmed. ` +
    "We will contact you shortly for delivery. Thank you!"
  );
}

export function smsPaymentConfirmedAdmin(order: NotifyOrder): string {
  if (order.isQaTest) {
    return "SHILOH ADMIN QA " + order.code + ": Hubtel confirmed REAL-money test payment of " +
      smsAmount(order.total) + ". No goods to dispatch; reconcile separately.";
  }
  return (
    `PAYMENT CONFIRMED: ${order.code} — ${smsAmount(order.total)} by ${order.fullName} ` +
    `(${order.phone}). Items: ${itemsSummary(order)}. Proceed with fulfilment.`
  );
}

/** Statuses that trigger an automatic customer SMS when set from the back office. */
export type NotifiableOrderStatus = "contacted" | "fulfilled" | "cancelled";

export function smsStatusUpdateCustomer(
  order: NotifyOrder,
  status: NotifiableOrderStatus
): string {
  switch (status) {
    case "contacted":
      return (
        `Shiloh 2026: About order ${order.code} — our team tried reaching you. ` +
        "Please call us back to arrange delivery or pickup. Thank you!"
      );
    case "fulfilled":
      return (
        `Shiloh 2026: Good news — order ${order.code} is fulfilled! ` +
        "Your order is ready. Thank you!"
      );
    case "cancelled":
      return (
        `Shiloh 2026: Order ${order.code} has been cancelled. ` +
        "If this is unexpected, please contact the Shiloh team. Thank you!"
      );
  }
}

// ---------------------------------------------------------------------------
// Admin "test connection" helper
// ---------------------------------------------------------------------------

export type TestResult =
  | { ok: true; message: string }
  | { ok: false; error: string; hint?: string; inconclusive?: boolean };

/**
 * Verify saved Hubtel credentials by initiating a GHS 0.01 test checkout
 * session (the same endpoint real payments use — nothing is charged unless
 * someone completes the 1-pesewa checkout).
 */
export async function testHubtelConnection(origin: string): Promise<TestResult> {
  const config = await getHubtelPaymentConfig();
  if (!config) {
    return { ok: false, error: "API Username and API Key are not configured yet." };
  }
  if (!config.merchantNumber) {
    return {
      ok: false,
      error: "Merchant Account Number is missing.",
      hint: "Copy it from your Hubtel account and paste it above.",
    };
  }

  const base = config.siteUrl ||
    (process.env.NODE_ENV !== "production" ? origin.replace(/\/+$/, "") : "");
  try {
    const publicSite = new URL(base);
    if (publicSite.protocol !== "https:" ||
        publicSite.username || publicSite.password ||
        publicSite.search || publicSite.hash || publicSite.pathname !== "/") {
      return {
        ok: false,
        error: "Set the Public Site URL to https://shiloh.lightworldtech.com (without /backoffice).",
        inconclusive: false,
      };
    }
  } catch {
    return {
      ok: false,
      error: "Enter a valid HTTPS Public Site URL before testing Hubtel.",
      inconclusive: false,
    };
  }
  try {
    const res = await fetch(INITIATE_URL, {
      method: "POST",
      headers: {
        Authorization: basicAuth(config.clientId, config.clientSecret),
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        totalAmount: 0.01,
        description: "Shiloh Back Office connection test",
        callbackUrl: `${base}/api/payments/callback`,
        returnUrl: `${base}/?payment=test`,
        cancellationUrl: `${base}/?payment=test`,
        merchantAccountNumber: config.merchantNumber,
        clientReference: `test-${Date.now()}`,
      }),
      signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
    });

    const text = await res.text();
    let data: Record<string, unknown> = {};
    try {
      data = JSON.parse(text);
    } catch {
      data = {};
    }

    const parsed = parseHubtelCheckoutResponse(data);
    if (res.ok && parsed.responseCode === "0000" &&
        parsed.checkoutUrl && isTrustedHubtelCheckoutUrl(parsed.checkoutUrl)) {
      return {
        ok: true,
        message: "Hubtel Online Checkout accepted the request (code 0000) and returned a valid hosted checkout link. No payment was charged. Full payment verification has not yet been tested.",
      };
    }
    const failure = explainHubtelCheckoutFailure(parsed, res.status);
    return { ok: false, ...failure };
  } catch {
    return { ok: false, error: "Could not reach Hubtel — check your internet connection." };
  }
}
