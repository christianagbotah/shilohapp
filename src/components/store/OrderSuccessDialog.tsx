"use client";

import { useState } from "react";
import {
  BadgeCheck,
  Check,
  Copy,
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

export function OrderSuccessDialog() {
  const placedOrder = useUi((s) => s.placedOrder);
  const setPlacedOrder = useUi((s) => s.setPlacedOrder);
  const setTrackOpen = useUi((s) => s.setTrackOpen);
  const setTrackPrefill = useUi((s) => s.setTrackPrefill);
  const { data: info } = useStoreInfo();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [claim, setClaim] = useState<ClaimState>("idle");

  const open = !!placedOrder;
  const code = placedOrder?.code ?? "";
  const momoNumber = info?.momoNumber ?? "";

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
    setClaim("idle");
    setCopied(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto pretty-scroll rounded-2xl border-gold/25 bg-card p-0 sm:max-w-md">
        <DialogHeader className="border-b border-border p-5 text-center">
          <span className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-gold/15 text-gold">
            <PartyPopper className="h-7 w-7" aria-hidden />
          </span>
          <DialogTitle className="font-display text-xl font-bold">Order received!</DialogTitle>
          <DialogDescription>
            Thank you, {placedOrder?.fullName.split(" ")[0]}. Complete your payment below.
          </DialogDescription>
        </DialogHeader>

        {placedOrder ? (
          <div className="flex flex-col gap-5 p-5">
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
                Use this exact code as your MoMo payment reference
              </p>
            </div>

            {/* Payment instructions */}
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

            {/* I have paid */}
            {claim === "claimed" ? (
              <p className="flex items-center justify-center gap-2 rounded-2xl border border-gold/40 bg-gold/10 p-4 text-center text-sm font-semibold text-gold">
                <BadgeCheck className="h-5 w-5 shrink-0" aria-hidden />
                Payment submitted — we&apos;ll confirm it shortly and call you.
              </p>
            ) : (
              <Button
                onClick={markPaid}
                disabled={claim === "claiming"}
                className="h-12 w-full rounded-full bg-gradient-to-r from-gold to-gold-deep text-base font-bold text-primary-foreground shadow-[0_12px_32px_-10px_var(--gold)] hover:opacity-95"
              >
                {claim === "claiming" ? (
                  <Timer className="mr-2 h-4.5 w-4.5 animate-pulse" aria-hidden />
                ) : (
                  <BadgeCheck className="mr-2 h-4.5 w-4.5" aria-hidden />
                )}
                {claim === "claiming" ? "Submitting…" : "I Have Paid"}
              </Button>
            )}

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
