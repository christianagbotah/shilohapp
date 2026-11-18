"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  BadgeCheck,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Loader2,
  XCircle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { fetchJson } from "@/hooks/use-store-data";
import { useUi } from "@/store/ui";
import { formatGhs } from "@/lib/format";

type Phase = "checking" | "paid" | "cancelled" | "failed" | "processing" | "unknown";

type LastOrder = { code: string; phone: string };

const MAX_POLLS = 45; // ~3 minutes at 4s intervals

/**
 * Shown automatically when the customer returns from Hubtel's checkout
 * (via /?payment=...&code=...). Polls the payment status server-side —
 * which itself re-verifies with Hubtel — so the order finalises even if
 * the provider callback was missed.
 */
export function PaymentResultDialog() {
  const setTrackOpen = useUi((s) => s.setTrackOpen);
  const setTrackPrefill = useUi((s) => s.setTrackPrefill);
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("checking");
  const [code, setCode] = useState("");
  const [total, setTotal] = useState<number | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);
  const pollCount = useRef(0);

  const readLastOrder = useCallback((): LastOrder | null => {
    try {
      const raw = window.localStorage.getItem("shiloh-last-order");
      return raw ? (JSON.parse(raw) as LastOrder) : null;
    } catch {
      return null;
    }
  }, []);

  // Read the return params exactly once, then clean the URL.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const payment = params.get("payment");
    const codeParam = params.get("code");
    if (!payment) return;

    window.history.replaceState({}, "", window.location.pathname);

    // Open the dialog on the next tick (setState must not run synchronously
    // inside the effect body).
    const t = setTimeout(() => {
      if (codeParam) setCode(codeParam.toUpperCase());
      // The browser return URL does not prove money moved.
      setPhase("checking");
      pollCount.current = 0;
      setOpen(true);
    }, 0);
    return () => clearTimeout(t);
  }, []);

  // Poll payment status while checking.
  useEffect(() => {
    if (!open || phase !== "checking" || !code) return;
    let cancelled = false;

    const poll = async () => {
      if (pollCount.current >= MAX_POLLS) {
        setPhase("processing");
        return;
      }
      pollCount.current += 1;
      try {
        const res = await fetchJson<{ paymentStatus: string; total: number; attemptStatus: string | null }>(
          `/api/payments/result?code=${encodeURIComponent(code)}`
        );
        if (cancelled) return;
        setTotal(res.total);
        if (res.paymentStatus === "paid") {
          setPhase("paid");
        } else if (res.attemptStatus === "cancelled" || res.attemptStatus === "failed") {
          setPhase(res.attemptStatus);
        }
      } catch {
        /* keep polling — network blips happen */
      }
    };

    const first = setTimeout(poll, 0);
    const id = setInterval(poll, 4_000);
    return () => {
      cancelled = true;
      clearTimeout(first);
      clearInterval(id);
    };
  }, [open, phase, code]);

  const retryPayment = async () => {
    const last = readLastOrder();
    if (!last) {
      setRetryError("We couldn't find your order details on this device — please track your order or contact us.");
      return;
    }
    setRetrying(true);
    setRetryError(null);
    try {
      const res = await fetchJson<{ url: string }>("/api/payments/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: last.code, phone: last.phone }),
      });
      window.location.href = res.url;
    } catch (err) {
      setRetrying(false);
      setRetryError(err instanceof Error ? err.message : "Could not start payment.");
    }
  };

  const headline =
    phase === "paid"
      ? "Payment successful!"
      : phase === "checking"
        ? "Confirming your payment…"
        : phase === "processing"
          ? "Payment is processing"
          : phase === "cancelled"
            ? "Payment cancelled"
            : phase === "failed"
              ? "Payment didn't go through"
              : "Payment status unknown";

  const Icon =
    phase === "paid"
      ? CheckCircle2
      : phase === "cancelled" || phase === "failed"
        ? XCircle
        : phase === "unknown"
          ? AlertCircle
          : phase === "processing"
            ? Clock3
            : Loader2;

  const iconClass =
    phase === "paid"
      ? "bg-emerald-500/15 text-emerald-500"
      : phase === "cancelled" || phase === "failed"
        ? "bg-destructive/15 text-destructive"
        : phase === "unknown"
          ? "bg-amber-500/15 text-amber-500"
          : "bg-gold/15 text-gold";

  const description =
    phase === "paid"
      ? "Your order is confirmed and being processed. A confirmation SMS with your order details is on its way."
      : phase === "checking"
        ? "We are checking your transaction with Hubtel. You can leave and track your order later."
        : phase === "processing"
          ? "Hubtel is still processing your payment. Your order updates automatically the moment it clears — you can track it any time."
          : phase === "cancelled"
            ? "You cancelled the payment at checkout. Your order is saved — you can try again whenever you're ready."
            : phase === "failed"
              ? "Hubtel reported an unsuccessful payment. If your wallet was debited, contact our team before trying again."
              : "We couldn't determine the payment outcome. Your order is safe — track it with your order code.";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && setOpen(false)}>
      <DialogContent className="rounded-2xl border-border bg-card p-0 sm:max-w-md">
        <DialogHeader className="border-b border-border p-5 text-center">
          <span
            className={`mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full ${iconClass}`}
          >
            <Icon
              className={phase === "checking" ? "h-7 w-7 animate-spin" : "h-7 w-7"}
              aria-hidden
            />
          </span>
          <DialogTitle className="font-display text-xl font-bold">{headline}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 p-5">
          {code ? (
            <div className="flex items-center justify-between rounded-2xl border border-border bg-background/60 px-4 py-3.5">
              <div>
                <p className="text-[0.65rem] font-semibold uppercase tracking-widest text-muted-foreground">
                  Order code
                </p>
                <p className="font-display text-xl font-bold tracking-wider text-gold">{code}</p>
              </div>
              {total !== null ? (
                <p className="font-display text-lg font-bold text-foreground">{formatGhs(total)}</p>
              ) : null}
            </div>
          ) : null}

          {phase === "paid" ? (
            <p className="flex items-center justify-center gap-2 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm font-semibold text-emerald-500">
              <BadgeCheck className="h-5 w-5 shrink-0" aria-hidden />
              We&apos;ll call you shortly to arrange delivery.
            </p>
          ) : null}

          {phase === "cancelled" || phase === "failed" ? (
            <div className="flex flex-col gap-2">
              <Button
                onClick={retryPayment}
                disabled={retrying}
                className="h-12 w-full rounded-full bg-gradient-to-r from-gold to-gold-deep font-bold text-primary-foreground shadow-[0_12px_32px_-10px_var(--gold)] hover:opacity-95"
              >
                {retrying ? (
                  <Loader2 className="mr-2 h-4.5 w-4.5 animate-spin" aria-hidden />
                ) : (
                  <ExternalLink className="mr-2 h-4.5 w-4.5" aria-hidden />
                )}
                {retrying ? "Connecting to Hubtel…" : "Try paying again"}
              </Button>
              {retryError ? (
                <p className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive" role="alert">
                  {retryError}
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="flex gap-2">
            {code ? (
              <Button
                variant="outline"
                className="h-11 flex-1 rounded-full border-border font-semibold hover:border-gold/40 hover:text-gold"
                onClick={() => {
                  setTrackPrefill(code);
                  setOpen(false);
                  setTrackOpen(true);
                }}
              >
                Track order
              </Button>
            ) : null}
            <Button
              variant="ghost"
              className="h-11 flex-1 rounded-full font-semibold text-muted-foreground"
              onClick={() => setOpen(false)}
            >
              Continue shopping
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
