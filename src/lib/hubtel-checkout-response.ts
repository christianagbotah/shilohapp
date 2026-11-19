/**
 * Hubtel Online Checkout's v1 success response has nested data.checkoutUrl.
 * Keep the production checkout and Back Office test on the same parser.
 */
type JsonObject = Record<string, unknown>;

const record = (value: unknown): JsonObject =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : {};

const nonEmpty = (...values: unknown[]): string | null => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
};

export type ParsedHubtelCheckout = {
  responseCode: string | null;
  status: string | null;
  checkoutUrl: string | null;
  message: string | null;
};

export function parseHubtelCheckoutResponse(payload: unknown): ParsedHubtelCheckout {
  const top = record(payload);
  const details = record(top.data ?? top.Data);
  const code = top.responseCode ?? top.ResponseCode ?? details.responseCode ?? details.ResponseCode;
  return {
    responseCode: typeof code === "string" ? code.trim() : typeof code === "number" ? String(code) : null,
    status: nonEmpty(top.status, top.Status, details.status, details.Status),
    checkoutUrl: nonEmpty(
      details.checkoutUrl, details.CheckoutUrl,
      top.checkoutUrl, top.CheckoutUrl,
      details.url, top.url
    ),
    message: nonEmpty(
      top.message, top.Message, top.responseMessage, top.ResponseMessage,
      details.message, details.Message, details.responseMessage, details.ResponseMessage
    ),
  };
}

/** Do not allow a provider response to redirect a customer to a third party. */
export function isTrustedHubtelCheckoutUrl(value: string): boolean {
  try {
    const target = new URL(value);
    return target.protocol === "https:" &&
      target.hostname === "pay.hubtel.com" &&
      !target.port && !target.username && !target.password;
  } catch {
    return false;
  }
}

export function explainHubtelCheckoutFailure(
  parsed: ParsedHubtelCheckout, httpStatus: number
): { error: string; hint?: string; inconclusive: boolean } {
  const code = parsed.responseCode;
  const msg = parsed.message;
  if (code === "4070") {
    return {
      error: "Hubtel rejected the checkout (response code 4070)" + (msg ? ": " + msg : ""),
      hint: "Fees might not be configured for this amount. A ₵0.01 test could be below the merchant minimum; ask Hubtel about fee configuration. No payment was taken.",
      inconclusive: false,
    };
  }
  if (code && code !== "0000") {
    return {
      error: "Hubtel rejected the checkout (response code " + code + ")" + (msg ? ": " + msg : ""),
      hint: code === "4000"
        ? "Check the Merchant Account Number, callback and amount."
        : code === "0005"
          ? "Hubtel reported an upstream problem; the outcome is uncertain. Contact Hubtel support before retrying."
          : undefined,
      inconclusive: code === "0005",
    };
  }
  if (httpStatus === 401 || httpStatus === 403) {
    return {
      error: "Hubtel authentication was rejected (HTTP " + httpStatus + ")",
      hint: "Check the Online Checkout API ID and API Key.",
      inconclusive: false,
    };
  }
  if (httpStatus >= 400) {
    return {
      error: msg
        ? "Hubtel returned HTTP " + httpStatus + ": " + msg
        : "Hubtel rejected the API request (HTTP " + httpStatus + ")",
      inconclusive: false,
    };
  }
  if (code === "0000" && !parsed.checkoutUrl) {
    return {
      error: "Hubtel accepted the checkout (response code 0000) but did not return a checkout URL.",
      hint: "Please contact Hubtel about the missing checkout link.",
      inconclusive: true,
    };
  }
  if (code === "0000" && parsed.checkoutUrl && !isTrustedHubtelCheckoutUrl(parsed.checkoutUrl)) {
    return {
      error: "Hubtel returned an unexpected checkout link, which was blocked for safety.",
      hint: "Please confirm the checkout domain with Hubtel support.",
      inconclusive: true,
    };
  }
  return {
    error: msg
      ? "Hubtel returned HTTP " + httpStatus + ": " + msg
      : "Hubtel responded with HTTP " + httpStatus + ", but a checkout acceptance code and trusted checkout link could not be confirmed.",
    hint: "Check the Online Checkout credentials and merchant account. If this persists, ask Hubtel for the response code.",
    inconclusive: true,
  };
}
