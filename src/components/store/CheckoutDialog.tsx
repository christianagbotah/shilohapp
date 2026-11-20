"use client";

import { useState } from "react";
import Image from "next/image";
import { AlertCircle, Loader2, Phone, ShieldCheck, ShoppingBag, Smartphone, User } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCart, cartTotal } from "@/store/cart";
import { useUi } from "@/store/ui";
import { useMounted } from "@/hooks/use-mounted";
import { fetchJson, useStoreInfo } from "@/hooks/use-store-data";
import { rememberOrder } from "@/lib/order-history";
import { formatGhs } from "@/lib/format";
import type { OrderDTO } from "@/lib/types";

export function CheckoutDialog() {
  const items = useCart((s) => s.items);
  const clear = useCart((s) => s.clear);
  const checkoutOpen = useUi((s) => s.checkoutOpen);
  const setCheckoutOpen = useUi((s) => s.setCheckoutOpen);
  const setPlacedOrder = useUi((s) => s.setPlacedOrder);
  const setPlacedOrderNotice = useUi((s) => s.setPlacedOrderNotice);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const mounted = useMounted();
  const { data: info } = useStoreInfo();
  const onlinePaymentReady = !!info?.hubtelActive;

  const total = mounted ? cartTotal(items) : 0;
  const itemCount = mounted ? items.reduce((n, i) => n + i.quantity, 0) : 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (fullName.trim().length < 3) {
      setError("Please enter your full name.");
      return;
    }
    const digits = phone.replace(/[\s-]/g, "");
    const normalized =
      digits.startsWith("+233") || digits.startsWith("233")
        ? "0" + digits.replace(/^\+?233/, "")
        : digits;
    if (!/^0\d{9}$/.test(normalized)) {
      setError("Enter a valid Ghana phone number, e.g. 024 123 4567.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetchJson<{ order: OrderDTO }>("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: fullName.trim(),
          phone: normalized,
          address: address.trim(),
          items: items.map((i) => ({
            productId: i.productId,
            color: i.color,
            size: i.size,
            capStyle: i.capStyle,
            quantity: i.quantity,
          })),
        }),
      });

      // Remember the last order so the payment-result dialog (shown after
      // returning from Hubtel) can offer "try again" without re-entering data.
      try {
        window.localStorage.setItem(
          "shiloh-last-order",
          JSON.stringify({ code: res.order.code, phone: normalized })
        );
      } catch {
        /* private mode — ignore */
      }
      // Also keep a device history so "Track your order" can offer one-tap
      // lookup of recent orders without memorising codes.
      rememberOrder({
        code: res.order.code,
        phone: normalized,
        total,
        itemCount,
        placedAt: new Date().toISOString(),
      });

      if (Math.abs(res.order.total - total) >= 0.01) {
        clear();
        setCheckoutOpen(false);
        setPlacedOrderNotice("Your order is saved, but a catalogue price changed. Review the final amount before paying from Track Order.");
        setPlacedOrder(res.order);
        return;
      }
      if (!onlinePaymentReady) {
        clear();
        setCheckoutOpen(false);
        setPlacedOrderNotice("Your order is saved. Online checkout is not active yet; our team will contact you with verified payment instructions.");
        setPlacedOrder(res.order);
        return;
      }

      // One tap: order is created, hand the customer straight to Hubtel's
      // secure checkout. If Hubtel can't start a session we keep the order
      // and let our team arrange payment — the customer never loses out.
      try {
        const pay = await fetchJson<{ url: string; alreadyPaid?: boolean }>("/api/payments/initiate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: res.order.code, phone: normalized }),
        });
        clear();
        setCheckoutOpen(false);
        window.location.href = pay.alreadyPaid ? `/?payment=return&code=${encodeURIComponent(res.order.code)}` : pay.url;
        return;
      } catch (err) {
        console.error("Payment initiation failed:", err);
        clear();
        setCheckoutOpen(false);
        setPlacedOrderNotice(
          "Online payment couldn't be started just now — our team will contact you to complete your payment securely via Hubtel."
        );
        setPlacedOrder(res.order);
        return;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not place your order. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={checkoutOpen} onOpenChange={(open) => !submitting && setCheckoutOpen(open)}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto pretty-scroll rounded-2xl border-border bg-card p-0 sm:max-w-lg">
        <DialogHeader className="border-b border-border p-5">
          <DialogTitle className="flex items-center gap-2.5 font-display text-lg font-bold">
            <ShoppingBag className="h-5 w-5 text-gold" aria-hidden />
            Checkout
          </DialogTitle>
          <DialogDescription>
            {itemCount > 0
              ? `${itemCount} item${itemCount > 1 ? "s" : ""} • ${formatGhs(total)} — pay securely after you place the order.`
              : "Your cart is empty."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="flex flex-col gap-5 p-5">
          {/* Order summary */}
          {mounted && items.length > 0 ? (
            <ul className="space-y-2 rounded-2xl border border-border bg-background/60 p-4">
              {items.map((i) => (
                <li key={i.key} className="flex items-center gap-3 text-sm">
                  <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-secondary">
                    <Image src={i.image} alt="" fill sizes="44px" unoptimized={i.image.startsWith("/products/")} className="object-cover" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium leading-tight">
                      {i.quantity} × {i.name}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {i.color} • {i.size}
                      {i.capStyle ? ` • ${i.capStyle}` : ""}
                    </p>
                  </div>
                  <p className="shrink-0 font-semibold text-gold">
                    {formatGhs(i.unitPrice * i.quantity)}
                  </p>
                </li>
              ))}
              <li className="flex items-center justify-between border-t border-border pt-2.5 text-sm">
                <span className="text-muted-foreground">Total</span>
                <span className="font-display text-lg font-bold text-gold">{formatGhs(total)}</span>
              </li>
            </ul>
          ) : null}

          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="checkout-name" className="text-sm font-semibold">
                Full name <span className="text-gold">*</span>
              </Label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Input
                  id="checkout-name"
                  autoComplete="name"
                  placeholder="e.g. Grace Mensah"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="h-12 rounded-xl border-border bg-background/60 pl-10"
                  required
                  maxLength={80}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="checkout-phone" className="text-sm font-semibold">
                Phone number <span className="text-gold">*</span>
              </Label>
              <div className="relative">
                <Phone className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Input
                  id="checkout-phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="024 123 4567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="h-12 rounded-xl border-border bg-background/60 pl-10"
                  required
                  maxLength={20}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                MTN, Telecel or AirtelTigo — we call you on this number.
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="checkout-address" className="text-sm font-semibold">
                Delivery address <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Textarea
                id="checkout-address"
                placeholder="Area, street, landmark — e.g. Ashaley Botwe, Trinity road"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="min-h-[76px] rounded-xl border-border bg-background/60"
                maxLength={300}
              />
            </div>
          </div>

          {error ? (
            <p className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive" role="alert">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              {error}
            </p>
          ) : null}

          <div className="flex items-start gap-2.5 rounded-xl border border-gold/30 bg-gold/10 p-3.5 text-xs leading-relaxed text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-gold" aria-hidden />
            <span>
              {onlinePaymentReady
                ? "You'll be redirected to Hubtel's secure checkout to choose MoMo or card. Follow Hubtel's instructions. Your order only becomes paid after verification."
                : "Online payment is currently unavailable. You can place your order and our team will contact you with official payment instructions."}
            </span>
          </div>

          <Button
            type="submit"
            disabled={submitting || itemCount === 0}
            className="h-13 w-full rounded-full bg-gradient-to-r from-gold to-gold-deep py-3.5 text-base font-bold text-primary-foreground shadow-[0_12px_32px_-10px_var(--gold)] hover:opacity-95 disabled:opacity-60"
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4.5 w-4.5 animate-spin" aria-hidden />
                Saving your order…
              </>
            ) : (
              <>
                <Smartphone className="mr-2 h-4 w-4" aria-hidden />
                {onlinePaymentReady ? `Pay securely — ${formatGhs(total)}` : `Place order — ${formatGhs(total)}`}
              </>
            )}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            {onlinePaymentReady ? "Payment handled securely by Hubtel • MoMo • Cards" : "No money is charged when you place this order"}
          </p>
        </form>
      </DialogContent>
    </Dialog>
  );
}