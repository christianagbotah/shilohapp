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
 * SMS flow (Hubtel Messaging API — smsc.hubtel.com):
 *   sendHubtelSms() -> POST /v1/messages/send with Basic auth.
 */
import { getSetting } from "@/lib/store-utils";
import { formatGhs } from "@/lib/format";

// ---------------------------------------------------------------------------
// Endpoints (adjust here if the provider payloads change)
// ---------------------------------------------------------------------------

const INITIATE_URL = "https://payproxyapi.hubtel.com/items/initiate";
const VERIFY_TXN_BASE = "https://api.hubtel.com/v1/merchant/transactions";
const SEND_SMS_URL = "https://smsc.hubtel.com/v1/messages/send";

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
    merchantName: merchantName || "Shiloh Merch GH",
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
  return { clientId, clientSecret, senderId: senderId || "Shiloh Merch" };
}

function basicAuth(clientId: string, clientSecret: string): string {
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
}

// ---------------------------------------------------------------------------
// Payment — Online Checkout (payproxyapi.hubtel.com)
// ---------------------------------------------------------------------------

export type InitiateResult =
  | { ok: true; url: string; token: string }
  | { ok: false; error: string };

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
  origin: string
): Promise<InitiateResult> {
  const config = await getHubtelPaymentConfig();
  if (!config) {
    return { ok: false, error: "Hubtel payment is not configured" };
  }
  if (!config.merchantNumber) {
    return {
      ok: false,
      error: "Hubtel Merchant Account Number is missing — add it in Admin Settings",
    };
  }

  const base = config.siteUrl || origin.replace(/\/+$/, "");
  const clientReference = order.code;

  // --- Hubtel Online Checkout initiate payload (camelCase) ---
  const payload: Record<string, unknown> = {
    totalAmount: Number(order.total.toFixed(2)),
    description: `Shiloh merch order ${order.code}`,
    callbackUrl: `${base}/api/payments/callback`,
    returnUrl: `${base}/?payment=return&code=${order.code}`,
    cancellationUrl: `${base}/?payment=cancelled&code=${order.code}`,
    merchantAccountNumber: config.merchantNumber,
    clientReference,
  };
  if (order.fullName) payload.clientName = order.fullName;
  if (order.phone) payload.customerPhoneNumber = order.phone;

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

    if (!res.ok) {
      const message =
        (data["message"] as string) ||
        (data["Message"] as string) ||
        (data["responseMessage"] as string) ||
        (data["responseCode"] ? `response code ${data["responseCode"]}` : "") ||
        `Hubtel rejected the checkout (HTTP ${res.status})`;
      return { ok: false, error: message };
    }

    // Response is camelCase: { checkoutUrl, responseCode, responseMessage, ... }
    const nested = data["data"] as Record<string, unknown> | undefined;
    const url =
      (data["checkoutUrl"] as string) ||
      (data["CheckoutUrl"] as string) ||
      (nested?.["checkoutUrl"] as string) ||
      (data["url"] as string) ||
      "";
    if (!url) {
      return { ok: false, error: "Hubtel did not return a checkout URL" };
    }
    return { ok: true, url, token: clientReference };
  } catch (err) {
    const error =
      err instanceof Error && err.name === "TimeoutError"
        ? "Hubtel did not respond in time"
        : "Could not reach Hubtel";
    return { ok: false, error };
  }
}

export type CheckoutStatus = "success" | "cancelled" | "failed" | "pending" | "unknown";

/** Normalise the many possible Hubtel status spellings. */
function normaliseStatus(raw: string): CheckoutStatus {
  const s = raw.trim().toLowerCase();
  if (["success", "succeeded", "paid", "completed", "complete"].includes(s)) return "success";
  if (["cancelled", "canceled", "abort", "abandoned"].includes(s)) return "cancelled";
  if (["failed", "failure", "error", "declined", "rejected", "timeout"].includes(s))
    return "failed";
  if (["pending", "processing", "in_progress", "inprogress", "awaiting"].includes(s))
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
  | { ok: true; status: CheckoutStatus; raw: string }
  | { ok: false; error: string };

/**
 * Ask Hubtel for the authoritative status of a transaction by its
 * clientReference (our order code). Used by the polling endpoint as a
 * belt-and-braces check when the webhook has not landed yet.
 */
export async function verifyHubtelTransaction(reference: string): Promise<StatusResult> {
  const config = await getHubtelPaymentConfig();
  if (!config) return { ok: false, error: "Hubtel payment is not configured" };

  try {
    const res = await fetch(`${VERIFY_TXN_BASE}/${encodeURIComponent(reference)}`, {
      method: "GET",
      headers: {
        Authorization: basicAuth(config.clientId, config.clientSecret),
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
    });

    const text = await res.text();
    let data: Record<string, unknown> = {};
    try {
      data = JSON.parse(text);
    } catch {
      data = {};
    }

    if (!res.ok) {
      const message =
        (data["message"] as string) || (data["Message"] as string) || `HTTP ${res.status}`;
      return { ok: false, error: message };
    }

    const raw = extractStatus(data);
    return {
      ok: true,
      status: raw ? normaliseStatus(raw) : "unknown",
      raw: raw ?? text.slice(0, 200),
    };
  } catch {
    return { ok: false, error: "Could not reach Hubtel" };
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
// SMS — Hubtel Messaging API (smsc.hubtel.com)
// ---------------------------------------------------------------------------

/** 0244123456 -> +233244123456 (the format Hubtel SMS expects). */
export function toInternationalGhPhone(local: string): string {
  const digits = local.replace(/[^\d]/g, "");
  if (digits.startsWith("233")) return `+${digits}`;
  if (digits.startsWith("0")) return `+233${digits.slice(1)}`;
  return `+${digits}`;
}

export type SmsResult = { ok: true; detail: string } | { ok: false; error: string };

/** Send one SMS through Hubtel. Throws nothing — always returns a result. */
export async function sendHubtelSms(to: string, content: string): Promise<SmsResult> {
  const config = await getHubtelSmsConfig();
  if (!config) {
    return { ok: false, error: "SMS is not configured (Hubtel SMS API key missing)" };
  }

  // --- Hubtel messaging payload ---
  const payload = {
    From: config.senderId,
    To: toInternationalGhPhone(to),
    Content: content,
    RegisteredDelivery: true,
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

    // Hubtel classic API: Status "0" (string) = accepted for delivery.
    const status =
      (data["Status"] as string) ?? (data["status"] as string) ?? String(res.status);
    const ok =
      res.ok &&
      (status === "0" || status.toLowerCase() === "queued" || status.toLowerCase() === "success");
    if (ok) {
      const id = (data["MessageId"] as string) || (data["id"] as string) || "";
      return { ok: true, detail: id ? `MessageId ${id}` : "Accepted" };
    }
    const message =
      (data["Message"] as string) ||
      (data["message"] as string) ||
      (data["MessageResponse"] as string) ||
      `HTTP ${res.status}: ${text.slice(0, 160)}`;
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
  return (
    `Shiloh 2026: Order ${order.code} received. Total ${formatGhs(order.total)}. ` +
    "Complete your payment to confirm the order. Thank you!"
  );
}

export function smsOrderPlacedAdmin(order: NotifyOrder): string {
  return (
    `NEW ORDER ${order.code}: ${order.fullName} (${order.phone}) — ` +
    `${order.itemCount} items, ${formatGhs(order.total)}. Check the back office.`
  );
}

export function smsPaymentConfirmedCustomer(order: NotifyOrder): string {
  return (
    `Payment confirmed! Shiloh 2026 order ${order.code} (${formatGhs(order.total)}) is confirmed. ` +
    "We will contact you shortly for delivery. Thank you!"
  );
}

export function smsPaymentConfirmedAdmin(order: NotifyOrder): string {
  return (
    `PAYMENT CONFIRMED: ${order.code} — ${formatGhs(order.total)} by ${order.fullName} ` +
    `(${order.phone}). Items: ${itemsSummary(order)}. Proceed with fulfilment.`
  );
}

// ---------------------------------------------------------------------------
// Admin "test connection" helper
// ---------------------------------------------------------------------------

export type TestResult =
  | { ok: true; message: string }
  | { ok: false; error: string; hint?: string };

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

  const base = config.siteUrl || origin.replace(/\/+$/, "");
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

    if (res.ok && (data["checkoutUrl"] || data["url"])) {
      return {
        ok: true,
        message: "Credentials verified — Hubtel Online Checkout is working.",
      };
    }

    let hint = "";
    if (res.status === 401 || res.status === 403) {
      hint = "Check the API Username and API Key — these are the Online Checkout credentials from your Hubtel account.";
    } else if (res.status === 400) {
      hint = "The request was rejected — most likely the Merchant Account Number is wrong.";
    }
    const message =
      (data["message"] as string) ||
      (data["Message"] as string) ||
      (data["responseMessage"] as string) ||
      `Hubtel returned HTTP ${res.status}`;
    return { ok: false, error: message, hint };
  } catch {
    return { ok: false, error: "Could not reach Hubtel — check your internet connection." };
  }
}
