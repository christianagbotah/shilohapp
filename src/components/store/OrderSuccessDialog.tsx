"use client";

import { useCallback, useEffect, useState } from "react";
import {
  BadgeCheck,
  Check,
  Copy,
  ExternalLink,
  Loader2,
  PartyPopper,
  Smartphone,
  Timer,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useUi } from "@/store/ui";
import { useStoreInfo, fetchJson } from "@/hooks/use-store-data";
import { useToast } from "@/hooks/use-toast";
import { formatGhs } from "@/lib/format";

type ClaimState = "idle" | "claiming" | "claimed";
type PayState = "idle" | "starting" | "waiting" | "paid" | "error";
type ManualState = "closed" | "open";

export function OrderSuccessDialog() {
  const placedOrder = useUi((s) => s.placedOrder);
  const setPlacedOrder = useUi((s) => s.setPlacedOrder);
  const setPlacedOrderNotice = useUi((s) => s.setPlacedOrderNotice);
  const placedOrderNotice = useUi((s) => s.placedOrderNotice);
  const setTrackOpen = useUi((s) => s.setTrackOpen);
  const setTrackPrefill = useUi((s) => s.setTrackPrefill);
  const { data: info } = useStoreInfo();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [claim, setClaim] = useState<ClaimState>("idle");
  const [pay, setPay] = useState<PayState>("idle");
  const [payError, setPayError] = useState<string | null>(null);
  const [manual, setManual] = useState<ManualState>("closed");

  const open = !!placedOrder;
  const code = placedOrder?.code ?? "";
  const momoNumber = info?.momoNumber ?? "";
  const hubtelActive = info?.hubtelActive ?? false;

  // ---- Live payment polling (Hubtel callback may land while this is open) ----
  const checkPayment = useCallback(async () => {
    if (!placedOrder || !hubtelActive) return;
    try {
      const res = await fetchJson<{ paymentStatus: string }>(
        `/api/payments/result?code=${encodeURIComponent(placedOrder.code)}`
      );
      if (res.paymentStatus === "paid") {
        setPay("paid");
      }
    } catch {
      /* polling is best-effort */
    }
  }, [placedOrder, hubtelActive]);

  useEffect(() => {
    if (!open || !hubtelActive || pay === "paid") return;
    // First check deferred a tick so we never setState synchronously in the effect.
    const first = setTimeout(checkPayment, 0);
    const id = setInterval(checkPayment, 5_000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [open, hubtelActive, pay, checkPayment]);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast({ title: "Order code copied" });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Could not copy", description: "Please note the code manually." });
    }
  };

  const payNow = async () => {
    if (!placedOrder) return;
    setPayError(null);
    setPay("starting");
    try {
      const res = await fetchJson<{ url: string }>("/api/payments/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: placedOrder.code, phone: placedOrder.phone }),
      });
      setPay("waiting");
      // Give the poller a beat to catch the redirect target, then go.
      window.location.href = res.url;
    } catch (err) {
      setPay("error");
      setPayError(err instanceof Error ? err.message : "Could not start payment.");
      toast({
        title: "Online payment unavailable",
        description: "You can still pay manually with MoMo below.",
        variant: "destructive",
      });
    }
  };

  const markPaid = async () => {
    if (!placedOrder) return;
    setClaim("claiming");
    try {
      await fetchJson("/api/orders/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: placedOrder.code, phone: placedOrder.phone }),
      });
      setClaim("claimed");
      toast({
        title: "Payment submitted",
        description: "Our team will confirm your MoMo payment shortly.",
      });
    } catch (err) {
      toast({
        title: "Could not submit",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
      setClaim("idle");
    }
  };

  const close = () => {
    setPlacedOrder(null);
    setPlacedOrderNotice(null);
    setClaim("idle");
    setCopied(false);
    setPay("idle");
    setPayError(null);
    setManual("closed");
  };

  const showManualMoMo = !hubtelActive || pay === "error" || manual === "open";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto pretty-scroll rounded-2xl border-gold/25 bg-card p-0 sm:max-w-md">
        <DialogHeader className="border-b border-border p-5 text-center">
          <span className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-gold/15 text-gold">
            {pay === "paid" ? (
              <Check className="h-7 w-7" aria-hidden />
            ) : (
              <PartyPopper className="h-7 w-7" aria-hidden />
            )}
          </span>
          <DialogTitle className="font-display text-xl font-bold">
            {pay === "paid" ? "Payment confirmed!" : "Order received!"}
          </DialogTitle>
          <DialogDescription>
            {pay === "paid"
              ? `We've received ${formatGhs(placedOrder?.total ?? 0)}. A confirmation SMS is on its way.`
              : `Thank you, ${placedOrder?.fullName.split(" ")[0]}. ${
                  hubtelActive ? "Complete your secure payment below." : "Complete your payment below."
                }`}
          </DialogDescription>
        </DialogHeader>

        {placedOrder ? (
          <div className="flex flex-col gap-5 p-5">
            {placedOrderNotice ? (
              <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs leading-relaxed text-amber-600 dark:text-amber-400">
                {placedOrderNotice} — you can pay manually below in the meantime.
              </p>
            ) : null}

            {/* Order code */}
            <div className="rounded-2xl border-2 border-dashed border-gold/40 bg-gold/5 p-4 text-center">
              <p className="text-[0.65rem] font-bold uppercase tracking-[0.25em] text-muted-foreground">
                Your order code
              </p>
              <div className="mt-2 flex items-center justify-center gap-3">
                <p className="font-display text-3xl font-bold tracking-wider text-gold sm:text-4xl">
                  {code}
                </p>
                <Button
                  size="icon"
                  onClick={copyCode}
                  aria-label="Copy order code"
                  variant="ghost"
                  className="h-10 w-10 shrink-0 rounded-full border border-gold/30 text-gold hover:bg-gold/15"
                >
                  {copied ? <Check className="h-4.5 w-4.5" aria-hidden /> : <Copy className="h-4.5 w-4.5" aria-hidden />}
                </Button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {hubtelActive
                  ? "Keep this code to track your order any time"
                  : "Use this exact code as your MoMo payment reference"}
              </p>
            </div>

            {/* Hubtel online payment */}
            {hubtelActive ? (
              pay === "paid" ? (
                <p className="flex items-center justify-center gap-2 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-center text-sm font-semibold text-emerald-500">
                  <BadgeCheck className="h-5 w-5 shrink-0" aria-hidden />
                  Paid {formatGhs(placedOrder.total)} — your order is confirmed and being processed.
                </p>
              ) : pay === "waiting" ? (
                <div className="rounded-2xl border border-gold/40 bg-gold/10 p-4 text-center">
                  <p className="flex items-center justify-center gap-2 text-sm font-semibold text-gold">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    Waiting for Hubtel…
                  </p>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    Redirecting to secure checkout — if nothing happens, tap the button again.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <Button
                    onClick={payNow}
                    disabled={pay === "starting"}
                    className="h-13 w-full rounded-full bg-gradient-to-r from-gold to-gold-deep text-base font-bold text-primary-foreground shadow-[0_12px_32px_-10px_var(--gold)] hover:opacity-95"
                  >
                    {pay === "starting" ? (
                      <Loader2 className="mr-2 h-4.5 w-4.5 animate-spin" aria-hidden />
                    ) : (
                      <ExternalLink className="mr-2 h-4.5 w-4.5" aria-hidden />
                    )}
                    {pay === "starting" ? "Connecting to Hubtel…" : `Pay Now — ${formatGhs(placedOrder.total)}`}
                  </Button>
                  <p className="text-center text-xs text-muted-foreground">
                    MTN MoMo • Telecel Cash • AirtelTigo Money • Cards — secured by Hubtel
                  </p>
                  {payError ? (
                    <p className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive" role="alert">
                      {payError}
                    </p>
                  ) : null}
                  {manual === "closed" ? (
                    <button
                      type="button"
                      onClick={() => setManual("open")}
                      className="mx-auto text-xs font-semibold text-muted-foreground underline-offset-2 hover:text-gold hover:underline"
                    >
                      Or pay manually with MoMo
                    </button>
                  ) : null}
                </div>
              )
            ) : null}

            {/* Manual MoMo instructions (default when Hubtel is off, fallback when on) */}
            {showManualMoMo ? (
              <div className="rounded-2xl border border-border bg-background/60 p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    <Smartphone className="h-4 w-4 text-gold" aria-hidden />
                    Send {formatGhs(placedOrder.total)} to
                  </p>
                  <span className="rounded-full bg-gold/15 px-2.5 py-1 text-[0.62rem] font-bold uppercase tracking-wider text-gold">
                    MTN MoMo
                  </span>
                </div>
                <p className="mt-2 font-display text-2xl font-bold tabular-nums text-foreground">
                  {momoNumber}
                </p>
                <p className="text-xs text-muted-foreground">{info?.momoName}</p>
                <ol className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                  <li>
                    1. Dial <span className="font-bold text-gold">*170#</span> → Transfer Money → MoMo
                    User
                  </li>
                  <li>
                    2. Enter the number and amount:{" "}
                    <span className="font-semibold text-foreground">{formatGhs(placedOrder.total)}</span>
                  </li>
                  <li>
                    3. Reference:{" "}
                    <span className="rounded bg-gold/15 px-1.5 py-0.5 font-mono text-xs font-bold text-gold">
                      {code}
                    </span>
                  </li>
                </ol>
              </div>
            ) : null}

            {/* I have paid (manual flow) */}
            {showManualMoMo && pay !== "paid" ? (
              claim === "claimed" ? (
                <p className="flex items-center justify-center gap-2 rounded-2xl border border-gold/40 bg-gold/10 p-4 text-center text-sm font-semibold text-gold">
                  <BadgeCheck className="h-5 w-5 shrink-0" aria-hidden />
                  Payment submitted — we&apos;ll confirm it shortly and call you.
                </p>
              ) : (
                <Button
                  onClick={markPaid}
                  disabled={claim === "claiming"}
                  variant="outline"
                  className="h-12 w-full rounded-full border-border font-semibold hover:border-gold/40 hover:text-gold"
                >
                  {claim === "claiming" ? (
                    <Timer className="mr-2 h-4.5 w-4.5 animate-pulse" aria-hidden />
                  ) : (
                    <BadgeCheck className="mr-2 h-4.5 w-4.5" aria-hidden />
                  )}
                  {claim === "claiming" ? "Submitting…" : "I Have Paid"}
                </Button>
              )
            ) : null}

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="h-11 flex-1 rounded-full border-border font-semibold hover:border-gold/40 hover:text-gold"
                onClick={() => {
                  setTrackPrefill(placedOrder.code);
                  close();
                  setTrackOpen(true);
                }}
              >
                Track Order
              </Button>
              <Button
                variant="ghost"
                className="h-11 flex-1 rounded-full font-semibold text-muted-foreground"
                onClick={close}
              >
                Continue Shopping
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
