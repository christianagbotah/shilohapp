/**
 * Hubtel integration — Online Checkout (payments) + SMS gateway.
 *
 * All provider payloads and endpoints live in THIS file only, so when the
 * exact Hubtel API payloads are shared they can be adapted in one place.
 *
 * Payment flow (Hubtel Online Checkout):
 *   1. initiateCheckout()  -> POST /onlinecheckout/api/initiate
 *      Returns { url, token }; the customer is redirected to `url` to pay
 *      with MTN MoMo / Telecel Cash / AT Money / cards.
 *   2. Hubtel redirects the customer's browser to our callbackUrl and we
 *      double-check the payment with getCheckoutStatus(token).
 *   3. verifyCheckoutStatus() normalises the provider response into
 *      "success" | "cancelled" | "failed" | "pending" | "unknown".
 *
 * SMS flow (Hubtel Messaging API):
 *   sendHubtelSms() -> POST /v1/messages/send with Basic auth.
 */
import { db } from "@/lib/db";
import { getSetting } from "@/lib/store-utils";
import { formatGhs } from "@/lib/format";

// ---------------------------------------------------------------------------
// Endpoints (adjust here if the provider payloads change)
// ---------------------------------------------------------------------------

const CHECKOUT_BASE_URL = "https://pay.hubtel.com/onlinecheckout/api";
const SMS_BASE_URL = "https://api.hubtel.com/v1/messages";

const INITIATE_URL = `${CHECKOUT_BASE_URL}/initiate`;
const statusUrl = (token: string) => `${CHECKOUT_BASE_URL}/status/${encodeURIComponent(token)}`;
const SEND_SMS_URL = `${SMS_BASE_URL}/send`;

/** Every outbound call aborts after this so order placement is never blocked. */
const PROVIDER_TIMEOUT_MS = 12_000;

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export type HubtelPaymentConfig = {
  clientId: string;
  clientSecret: string;
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
  const [clientId, clientSecret, merchantName, siteUrl] = await Promise.all([
    getSetting("hubtel_client_id"),
    getSetting("hubtel_client_secret"),
    getSetting("hubtel_merchant_name"),
    getSetting("site_url"),
  ]);
  if (!clientId || !clientSecret) return null;
  return {
    clientId,
    clientSecret,
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
// Payment — Online Checkout
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
 */
export async function initiateCheckout(
  order: CheckoutOrder,
  origin: string
): Promise<InitiateResult> {
  const config = await getHubtelPaymentConfig();
  if (!config) {
    return { ok: false, error: "Hubtel payment is not configured" };
  }

  const base = config.siteUrl || origin.replace(/\/+$/, "");
  const token = crypto.randomUUID();

  // --- Hubtel Online Checkout initiate payload ---
  const payload = {
    token, // unique checkout token we generate
    amount: Number(order.total.toFixed(2)), // unit price (GHS)
    quantity: 1, // amount x quantity = total charged
    description: `Shiloh merch order ${order.code}`,
    name: config.merchantName, // merchant name shown on the checkout page
    callbackUrl: `${base}/api/payments/callback`,
    cancellationUrl: `${base}/?payment=cancelled&code=${order.code}`,
    returnUrl: `${base}/?payment=return&code=${order.code}`,
    customerName: order.fullName,
    customerPhoneNumber: order.phone,
  };

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
        `Hubtel rejected the checkout (HTTP ${res.status})`;
      return { ok: false, error: message };
    }

    const url = data["url"] as string;
    const returnedToken = (data["token"] as string) || token;
    if (!url) {
      return { ok: false, error: "Hubtel did not return a checkout URL" };
    }
    return { ok: true, url, token: returnedToken };
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
  if (["failed", "failure", "error", "declined", "rejected"].includes(s)) return "failed";
  if (["pending", "processing", "in_progress", "inprogress", "awaiting"].includes(s))
    return "pending";
  return "unknown";
}

/** Pull a status string out of whichever field shape Hubtel returns. */
function extractStatus(data: Record<string, unknown>): string | null {
  const candidates: Array<unknown> = [
    data["Status"],
    data["status"],
    (data["Data"] as Record<string, unknown> | undefined)?.["Status"],
    (data["Data"] as Record<string, unknown> | undefined)?.["status"],
    (data["data"] as Record<string, unknown> | undefined)?.["status"],
    (data["data"] as Record<string, unknown> | undefined)?.["Status"],
    (data["ResponseCode"] as string | undefined) === "0000" ? "success" : undefined,
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
 * Ask Hubtel for the authoritative payment status of a checkout token.
 * Used by the callback route AND by the polling endpoint (belt & braces).
 */
export async function getCheckoutStatus(token: string): Promise<StatusResult> {
  const config = await getHubtelPaymentConfig();
  if (!config) return { ok: false, error: "Hubtel payment is not configured" };

  try {
    const res = await fetch(statusUrl(token), {
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
    return { ok: true, status: raw ? normaliseStatus(raw) : "unknown", raw: raw ?? text.slice(0, 200) };
  } catch {
    return { ok: false, error: "Could not reach Hubtel" };
  }
}

// ---------------------------------------------------------------------------
// SMS — Hubtel Messaging API
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
    const ok = res.ok && (status === "0" || status.toLowerCase() === "queued" || status.toLowerCase() === "success");
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
