"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, CreditCard, ExternalLink, Loader2, RefreshCcw, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetchJson } from "@/hooks/use-store-data";
import { formatGhs } from "@/lib/format";

type TestNotification = {
  channel: string;
  purpose: string;
  status: string;
  createdAt: string;
};

type LiveTestStatus = {
  code: string;
  amount: number;
  paymentStatus: string;
  attemptStatus: string | null;
  verificationIssue: string | null;
  paidAt: string | null;
  verifiedAmount: number | null;
  checkoutUrl: string | null;
  notificationAttempts: TestNotification[];
  note: string;
};

type TestCreated = {
  code: string;
  amount: number;
  url: string;
  message: string;
};

const STORAGE_KEY = "shiloh-live-qa-order-code";
const LABELS: Record<string, string> = {
  order_placed_customer: "Order created → customer SMS",
  order_placed_admin: "Order created → admin",
  payment_confirmed_customer: "Payment confirmed → customer SMS",
  payment_confirmed_admin: "Payment confirmed → admin",
  order_status_customer: "Order status → customer",
};

export function AdminLivePaymentTest({
  adminPhone,
  configured,
  enabled,
  token,
}: {
  adminPhone: string;
  configured: boolean;
  enabled: boolean;
  token: string;
}) {
  const [phone, setPhone] = useState("");
  const [amountText, setAmountText] = useState("1.00");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  const [code, setCode] = useState("");
  const [lookupCode, setLookupCode] = useState("");
  const [checkoutLink, setCheckoutLink] = useState<string | null>(null);
  const [status, setStatus] = useState<LiveTestStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [verificationIssue, setVerificationIssue] = useState<string | null>(null);
  const polling = useRef(false);

  useEffect(() => {
    setPhone((current) => current || adminPhone);
  }, [adminPhone]);

  useEffect(() => {
    try {
      const saved = window.sessionStorage.getItem(STORAGE_KEY);
      if (saved && /^SHL-[A-HJ-NP-Z2-9]{6}$/.test(saved)) {
        setCode(saved);
        setLookupCode(saved);
      }
    } catch {
      // Session storage is optional: the code can be entered manually.
    }
  }, []);

  const readStatus = useCallback(async (which: string) => {
    if (!which || polling.current) return;
    polling.current = true;
    setChecking(true);
    try {
      const response = await fetchJson<LiveTestStatus>(
        "/api/admin/payments/live-test?code=" + encodeURIComponent(which),
        { headers: { "x-admin-token": token } }
      );
      setStatus(response);
      if (response.paymentStatus === "paid") setVerificationIssue(null);
      else if (response.verificationIssue) setVerificationIssue(response.verificationIssue);
      setError(null);
      if (response.checkoutUrl) setCheckoutLink(response.checkoutUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Test status is temporarily unavailable");
    } finally {
      setChecking(false);
      polling.current = false;
    }
  }, [token]);

  useEffect(() => {
    if (!code) return;
    void readStatus(code);
    const tick = window.setInterval(() => { void readStatus(code); }, 15_000);
    return () => window.clearInterval(tick);
  }, [code, readStatus]);

  const amount = Number(amountText);
  const validAmount = Number.isFinite(amount) &&
    amount >= 1 && amount <= 20 &&
    Math.abs(Math.round(amount * 100) - amount * 100) < 0.000001;

  const createCheckout = async () => {
    if (!validAmount || !phone.trim() || !consent || !configured || !enabled) return;
    setBusy(true);
    setError(null);
    try {
      const result = await fetchJson<TestCreated>("/api/admin/payments/live-test", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-token": token },
        body: JSON.stringify({ phone: phone.trim(), amount }),
      });
      setCode(result.code);
      setLookupCode(result.code);
      setCheckoutLink(result.url);
      setStatus(null);
      setVerificationIssue(null);
      setConsent(false);
      try { window.sessionStorage.setItem(STORAGE_KEY, result.code); } catch { /* optional */ }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create the checkout");
    } finally {
      setBusy(false);
    }
  };

  const loadExisting = () => {
    const normalized = lookupCode.trim().toUpperCase();
    if (!/^SHL-[A-HJ-NP-Z2-9]{6}$/.test(normalized)) {
      setError("Enter the six-character test order code shown when the checkout was created.");
      return;
    }
    setCode(normalized);
    setStatus(null);
    setCheckoutLink(null);
    setVerificationIssue(null);
    setError(null);
    try { window.sessionStorage.setItem(STORAGE_KEY, normalized); } catch { /* optional */ }
    void readStatus(normalized);
  };

  const paid = status?.paymentStatus === "paid";
  const pending = code && !paid && status?.attemptStatus !== "failed" && status?.attemptStatus !== "cancelled";

  return (
    <div className="grid gap-4">
      <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-4 text-sm leading-relaxed text-foreground">
        <div className="flex items-center gap-2 font-bold">
          <ShieldAlert className="size-5 text-amber-400" aria-hidden />
          This uses REAL MONEY
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Only the signed-in administrator can create a test checkout. Public customer
          checkout remains disabled. A test transaction is recorded for audit, but
          no goods are supplied. Creating a link does not charge money; you
          must deliberately pay on Hubtel.
        </p>
      </div>

      {!enabled ? (
        <p role="status" className="rounded-xl border border-border bg-background/60 p-3 text-sm text-muted-foreground">
          Administrator live-payment testing is switched off on the VPS.
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="qa-phone">Your receiving phone number</Label>
          <Input
            id="qa-phone"
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="024 123 4567"
            autoComplete="tel"
            className="h-11 rounded-xl border-border bg-background/60"
          />
          <p className="text-xs text-muted-foreground">
            Use a phone you control, so you can check the order and payment SMS.
          </p>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="qa-amount">Real payment amount (₵)</Label>
          <Input
            id="qa-amount"
            type="number"
            min="1"
            max="20"
            step="0.01"
            value={amountText}
            onChange={(event) => setAmountText(event.target.value)}
            className="h-11 rounded-xl border-border bg-background/60"
          />
          <p className="text-xs text-muted-foreground">
            ₵1.00–₵20.00. Hubtel may reject ₵1.00 if its minimum or fee rules require a larger amount.
          </p>
        </div>
      </div>

      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-background/60 p-3">
        <input
          type="checkbox"
          checked={consent}
          onChange={(event) => setConsent(event.target.checked)}
          className="mt-1 size-4 accent-amber-500"
        />
        <span className="text-xs leading-relaxed">
          I understand that completing checkout will deduct real money and this is
          a payment-processing test, not a purchase of goods.
        </span>
      </label>

      <Button
        type="button"
        disabled={!enabled || !configured || !consent || !validAmount || !phone || !!pending || busy}
        onClick={createCheckout}
        className="h-11 rounded-xl bg-gold font-bold text-primary-foreground hover:bg-gold/90"
      >
        {busy ? <Loader2 className="mr-2 size-4 animate-spin" aria-hidden /> :
          <CreditCard className="mr-2 size-4" aria-hidden />}
        {busy ? "Creating secure checkout…" :
          "Prepare real-money checkout — " + (validAmount ? formatGhs(amount) : "invalid amount")}
      </Button>

      {error ? (
        <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
        <Input
          aria-label="Existing test order code"
          placeholder="Existing QA order code"
          value={lookupCode}
          onChange={(event) => setLookupCode(event.target.value)}
          className="h-10 min-w-0 flex-1 rounded-xl border-border bg-background/60 font-mono text-xs"
        />
        <Button type="button" onClick={loadExisting} size="sm" variant="outline" className="h-10 rounded-xl">
          Check existing test
        </Button>
      </div>

      {code ? (
        <div className="grid gap-3 rounded-xl border border-gold/30 bg-background/60 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs text-muted-foreground">Live test order</p>
              <p className="font-mono text-base font-bold tracking-wider text-gold">{code}</p>
            </div>
            <span className="rounded-full border border-border bg-card px-3 py-1 text-xs font-bold uppercase">
              {checking && !status ? "Checking…" :
                paid ? "Verified paid" : status?.paymentStatus === "unpaid" ? "Not paid" : "Awaiting payment"}
            </span>
          </div>

          {!paid && checkoutLink && (!status || status.attemptStatus === "open") ? (
            <a
              href={checkoutLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-gold px-4 text-sm font-bold text-primary-foreground hover:bg-gold/90"
            >
              <ExternalLink className="size-4" aria-hidden />
              Open secure Hubtel checkout
            </a>
          ) : null}

          {checkoutLink && !paid && (!status || status.attemptStatus === "open") ? (
            <p className="text-xs text-amber-300">
              Complete this payment only once. Do not open another payment attempt
              if your phone was charged; check the status below instead.
            </p>
          ) : null}

          {!paid && verificationIssue ? (
            <p role="alert" className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs leading-relaxed text-amber-300">
              Payment verification is blocked: {verificationIssue}.
              {verificationIssue.includes("403")
                ? " Hubtel requires the VPS outbound IP 163.245.212.15 to be allowlisted for Transaction Status. Do not pay again; the existing payment will be rechecked after Hubtel grants access."
                : " Do not pay again until the existing payment has been independently confirmed."}
            </p>
          ) : null}

          {paid ? (
            <p className="flex items-start gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-400">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
              Payment verified against Hubtel's status API, reference and exact amount.
              Check the SMS attempts below and confirm receipt on your handset.
            </p>
          ) : null}

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-lg border border-border p-3">
              <p className="text-muted-foreground">Payment status</p>
              <p className="mt-1 font-bold">{status?.paymentStatus ?? "Checking"}</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-muted-foreground">Hubtel attempt</p>
              <p className="mt-1 font-bold">{status?.attemptStatus ?? "Checking"}</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-muted-foreground">Expected amount</p>
              <p className="mt-1 font-bold">{status ? formatGhs(status.amount) : "—"}</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-muted-foreground">Verified amount</p>
              <p className="mt-1 font-bold">{status?.verifiedAmount != null ? formatGhs(status.verifiedAmount) : "—"}</p>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold">Notifications (SMS / email)</h3>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={checking}
              onClick={() => { void readStatus(code); }}
              className="rounded-xl"
            >
              <RefreshCcw className={"mr-1 size-4 " + (checking ? "animate-spin" : "")} aria-hidden />
              Refresh
            </Button>
          </div>
          <div className="grid gap-2">
            {(status?.notificationAttempts ?? []).length ? (
              status!.notificationAttempts.map((message, i) => (
                <div key={message.purpose + i} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-2.5 text-xs">
                  <span className="font-medium">
                    {LABELS[message.purpose] ?? message.purpose}
                    <span className="ml-1.5 text-muted-foreground">({message.channel})</span>
                  </span>
                  <span className={message.status === "sent" ? "font-bold text-emerald-400" : message.status === "failed" ? "font-bold text-destructive" : "text-muted-foreground"}>
                    {message.status === "sent" ? "Accepted" : message.status}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-xs text-muted-foreground">No messages logged yet; refresh after the checkout is created.</p>
            )}
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Accepted means Hubtel accepted an SMS for delivery, not that the message
            reached your phone. Confirm the actual messages yourself. Status checks
            refresh automatically every 15 seconds while this page is open.
          </p>
          <a className="text-xs font-semibold text-gold underline-offset-2 hover:underline" href="/backoffice?section=alerts">
            Open complete notifications log
          </a>
        </div>
      ) : null}
    </div>
  );
}
