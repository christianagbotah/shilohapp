"use client";

import { useEffect, useState } from "react";
import {
  Ban,
  CircleCheck,
  CircleDashed,
  ExternalLink,
  Loader2,
  PackageSearch,
  Search,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUi } from "@/store/ui";
import { fetchJson, useStoreInfo } from "@/hooks/use-store-data";
import { formatGhs } from "@/lib/format";
import { ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS, type OrderDTO } from "@/lib/types";
import { cn } from "@/lib/utils";

const TIMELINE = [
  { key: "placed", label: "Order placed" },
  { key: "contacted", label: "Team contacted you" },
  { key: "paid", label: "Payment confirmed" },
  { key: "fulfilled", label: "Fulfilled" },
] as const;

function stageIndex(order: OrderDTO): number {
  if (order.status === "fulfilled") return 3;
  if (order.paymentStatus === "paid") return 2;
  if (order.status === "contacted" || order.status === "reviewing") return 1;
  return 0;
}

function OrderCard({ order, hubtelActive }: { order: OrderDTO; hubtelActive: boolean }) {
  const stage = stageIndex(order);
  const cancelled = order.status === "cancelled";
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  // Unpaid orders can be settled right here via Hubtel's secure checkout
  const canPay = hubtelActive && !cancelled && order.paymentStatus !== "paid";

  const payNow = async () => {
    setPaying(true);
    setPayError(null);
    try {
      const res = await fetchJson<{ url: string }>("/api/payments/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: order.code, phone: order.phone }),
      });
      window.location.href = res.url;
    } catch (err) {
      setPaying(false);
      setPayError(
        err instanceof Error ? err.message : "Could not start payment. Please try again."
      );
    }
  };

  return (
    <article className="rounded-2xl border border-border bg-background/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-display text-lg font-bold tracking-wider text-gold">{order.code}</p>
        <p className="text-xs text-muted-foreground">
          {new Date(order.createdAt).toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </p>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <span
          className={cn(
            "rounded-full px-3 py-1 text-xs font-semibold",
            order.paymentStatus === "paid"
              ? "bg-gold/15 text-gold"
              : order.paymentStatus === "verifying"
                ? "bg-amber-500/15 text-amber-400"
                : "bg-secondary text-muted-foreground"
          )}
        >
          {PAYMENT_STATUS_LABELS[order.paymentStatus]}
        </span>
        <span
          className={cn(
            "rounded-full px-3 py-1 text-xs font-semibold",
            cancelled ? "bg-destructive/15 text-destructive" : "bg-secondary text-muted-foreground"
          )}
        >
          {ORDER_STATUS_LABELS[order.status]}
        </span>
      </div>

      {cancelled ? (
        <p className="mt-3 flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
          <Ban className="h-4 w-4 shrink-0" aria-hidden />
          This order was cancelled. Please contact the team if this is unexpected.
        </p>
      ) : (
        <ol className="mt-4 space-y-0" aria-label="Order progress">
          {TIMELINE.map((step, i) => {
            const done = i <= stage;
            return (
              <li key={step.key} className="flex items-start gap-3">
                <div className="flex flex-col items-center">
                  {done ? (
                    <CircleCheck className="h-5 w-5 shrink-0 text-gold" aria-hidden />
                  ) : (
                    <CircleDashed className="h-5 w-5 shrink-0 text-muted-foreground/50" aria-hidden />
                  )}
                  {i < TIMELINE.length - 1 ? (
                    <span
                      className={cn("w-px flex-1", i < stage ? "bg-gold/60" : "bg-border")}
                      style={{ minHeight: 14 }}
                      aria-hidden
                    />
                  ) : null}
                </div>
                <p
                  className={cn(
                    "pb-3 text-sm leading-none",
                    done ? "font-semibold text-foreground" : "text-muted-foreground"
                  )}
                >
                  {step.label}
                </p>
              </li>
            );
          })}
        </ol>
      )}

      {canPay ? (
        <div className="mt-3 flex flex-col gap-1.5">
          <Button
            onClick={payNow}
            disabled={paying}
            className="h-11 w-full rounded-full bg-gradient-to-r from-gold to-gold-deep font-bold text-primary-foreground shadow-[0_12px_32px_-10px_var(--gold)] hover:opacity-95"
          >
            {paying ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <ExternalLink className="mr-2 h-4 w-4" aria-hidden />
            )}
            {paying ? "Connecting to Hubtel…" : `Pay Now — ${formatGhs(order.total)}`}
          </Button>
          <p className="text-center text-[0.68rem] text-muted-foreground">
            MTN MoMo • Telecel Cash • AT Money • Cards — secured by Hubtel
          </p>
          {payError ? (
            <p
              role="alert"
              className="rounded-xl border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive"
            >
              {payError}
            </p>
          ) : null}
        </div>
      ) : !cancelled && order.paymentStatus !== "paid" ? (
        <p className="mt-3 rounded-xl border border-gold/30 bg-gold/10 p-3 text-xs leading-relaxed text-muted-foreground">
          Payment will be collected securely via Hubtel — our team will contact you on{" "}
          <span className="font-semibold text-foreground">{order.phone}</span> to complete it.
        </p>
      ) : null}

      <ul className="mt-2 space-y-1.5 border-t border-border pt-3">
        {order.items.map((item) => (
          <li key={item.id} className="flex items-center justify-between gap-2 text-sm">
            <span className="min-w-0 truncate text-muted-foreground">
              {item.quantity} × {item.productName}
              <span className="text-muted-foreground/70">
                {" "}
                ({item.color}, {item.size}
                {item.capStyle ? `, ${item.capStyle}` : ""})
              </span>
            </span>
            <span className="shrink-0 font-medium">{formatGhs(item.unitPrice * item.quantity)}</span>
          </li>
        ))}
        <li className="flex items-center justify-between border-t border-border pt-2 text-sm">
          <span className="text-muted-foreground">Total</span>
          <span className="font-display font-bold text-gold">{formatGhs(order.total)}</span>
        </li>
      </ul>
    </article>
  );
}

export function TrackOrderDialog() {
  const trackOpen = useUi((s) => s.trackOpen);
  const setTrackOpen = useUi((s) => s.setTrackOpen);
  const prefill = useUi((s) => s.trackPrefill);
  const { data: info } = useStoreInfo();

  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orders, setOrders] = useState<OrderDTO[]>([]);

  useEffect(() => {
    if (trackOpen) {
      setQuery(prefill);
      if (prefill) {
        // auto-search when opened with a prefill
        void search(prefill);
      }
    } else {
      setSearched(false);
      setError(null);
      setOrders([]);
    }
  }, [trackOpen, prefill]);

  const search = async (q: string) => {
    const trimmed = q.trim();
    if (trimmed.length < 4) {
      setError("Enter your order code (e.g. SHL-7K2P9Q) or phone number.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetchJson<{ orders: OrderDTO[] }>(
        `/api/orders/track?q=${encodeURIComponent(trimmed)}`
      );
      setOrders(res.orders);
      setSearched(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not look up your order.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={trackOpen} onOpenChange={setTrackOpen}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto pretty-scroll rounded-2xl border-border bg-card p-0 sm:max-w-md">
        <DialogHeader className="border-b border-border p-5">
          <DialogTitle className="flex items-center gap-2.5 font-display text-lg font-bold">
            <PackageSearch className="h-5 w-5 text-gold" aria-hidden />
            Track Your Order
          </DialogTitle>
          <DialogDescription>
            Enter your order code or the phone number you ordered with.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 p-5">
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void search(query);
            }}
          >
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="SHL-XXXXXX or 024 123 4567"
              aria-label="Order code or phone number"
              className="h-12 rounded-xl border-border bg-background/60 font-mono text-base tracking-wide"
            />
            <Button
              type="submit"
              disabled={loading}
              className="h-12 shrink-0 rounded-xl bg-gradient-to-r from-gold to-gold-deep font-bold text-primary-foreground hover:opacity-95"
            >
              {loading ? (
                <Loader2 className="h-4.5 w-4.5 animate-spin" aria-hidden />
              ) : (
                <Search className="h-4.5 w-4.5" aria-hidden />
              )}
              <span className="sr-only">Search</span>
            </Button>
          </form>

          {error ? (
            <p className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          {searched && !error && orders.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
              No orders found. Double-check your code or phone number.
            </p>
          ) : null}

          {orders.length > 0 ? (
            <div className="space-y-3">
              {orders.map((order) => (
                <OrderCard key={order.id} order={order} hubtelActive={info?.hubtelActive ?? false} />
              ))}
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
