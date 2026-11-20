import { describe, expect, test } from "bun:test";
import {
  explainHubtelCheckoutFailure,
  isTrustedHubtelCheckoutUrl,
  parseHubtelCheckoutResponse,
} from "../src/lib/hubtel-checkout-response";

describe("Hubtel Online Checkout response handling", () => {
  const hubtelUrl = "https://pay.hubtel.com/7569a11e8b784f21baa9443b3fce31ed";

  test("recognizes documented successful HTTP 200 nested data response", () => {
    const parsed = parseHubtelCheckoutResponse({
      responseCode: "0000",
      status: "Success",
      data: { checkoutUrl: hubtelUrl, checkoutId: "checkout-123", message: "" },
    });
    expect(parsed).toEqual({
      responseCode: "0000",
      status: "Success",
      checkoutUrl: hubtelUrl,
      message: null,
    });
    expect(isTrustedHubtelCheckoutUrl(parsed.checkoutUrl!)).toBe(true);
  });

  test("supports legacy top-level checkout URL and case variants", () => {
    expect(parseHubtelCheckoutResponse({ ResponseCode: "0000", CheckoutUrl: hubtelUrl }).checkoutUrl).toBe(hubtelUrl);
    expect(parseHubtelCheckoutResponse({ ResponseCode: "0000", Data: { CheckoutUrl: hubtelUrl } }).checkoutUrl).toBe(hubtelUrl);
    expect(parseHubtelCheckoutResponse({ responseCode: "0000", data: { checkoutUrl: hubtelUrl } }).responseCode).toBe("0000");
  });

  test("HTTP 200 with a merchant fee error must not be reported as success", () => {
    const parsed = parseHubtelCheckoutResponse({
      responseCode: "4070", status: "Error", message: "Fees are not configured",
    });
    const failure = explainHubtelCheckoutFailure(parsed, 200);
    expect(failure.error).toContain("4070");
    expect(failure.hint).toContain("₵0.01");
    expect(failure.inconclusive).toBe(false);
  });

  test("HTTP 200 missing checkoutUrl is inconclusive rather than success", () => {
    const parsed = parseHubtelCheckoutResponse({ responseCode: "0000", data: {} });
    const failure = explainHubtelCheckoutFailure(parsed, 200);
    expect(failure.inconclusive).toBe(true);
    expect(failure.error).toContain("did not return a checkout URL");
  });

  test("unrecognized HTTP 200 includes meaningful diagnostics", () => {
    const failure = explainHubtelCheckoutFailure(parseHubtelCheckoutResponse({}), 200);
    expect(failure.inconclusive).toBe(true);
    expect(failure.error).toContain("HTTP 200");
  });

  test("rejects untrusted host, insecure URL, credentials, and malformed URLs", () => {
    for (const invalid of [
      "http://pay.hubtel.com/checkout",
      "https://pay.hubtel.com.evil.test/checkout",
      "https://evil.test/checkout",
      "https://user:password@pay.hubtel.com/checkout",
      "not a url",
    ]) {
      expect(isTrustedHubtelCheckoutUrl(invalid)).toBe(false);
    }
  });

  test("HTTP 401 receives credential-specific advice", () => {
    const failure = explainHubtelCheckoutFailure(parseHubtelCheckoutResponse({}), 401);
    expect(failure.error).toContain("authentication");
    expect(failure.hint).toContain("API ID");
  });
});
