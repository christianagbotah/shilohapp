"use client";

import { ArrowRight, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { TintableProductImage } from "@/components/store/TintableProductImage";
import { useCart, cartTotal } from "@/store/cart";
import { useUi } from "@/store/ui";
import { useMounted } from "@/hooks/use-mounted";
import { formatGhs } from "@/lib/format";
import { PRODUCT_TYPE_LABELS } from "@/lib/types";

export function CartDrawer() {
  const items = useCart((s) => s.items);
  const setQuantity = useCart((s) => s.setQuantity);
  const removeItem = useCart((s) => s.removeItem);
  const clear = useCart((s) => s.clear);
  const cartOpen = useUi((s) => s.cartOpen);
  const setCartOpen = useUi((s) => s.setCartOpen);
  const setCheckoutOpen = useUi((s) => s.setCheckoutOpen);
  const mounted = useMounted();

  const total = mounted ? cartTotal(items) : 0;

  const goCheckout = () => {
    setCartOpen(false);
    setCheckoutOpen(true);
  };

  return (
    <Sheet open={cartOpen} onOpenChange={setCartOpen}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 border-l border-gold/15 bg-card p-0 sm:max-w-md"
      >
        <SheetHeader className="border-b border-border p-5">
          <SheetTitle className="flex items-center gap-2.5 font-display text-lg font-bold">
            <ShoppingBag className="h-5 w-5 text-gold" aria-hidden />
            Your Cart
            {mounted && items.length > 0 ? (
              <span className="rounded-full bg-gold/15 px-2.5 py-0.5 text-xs font-bold text-gold">
                {items.reduce((n, i) => n + i.quantity, 0)} item{items.reduce((n, i) => n + i.quantity, 0) > 1 ? "s" : ""}
              </span>
            ) : null}
          </SheetTitle>
          <SheetDescription className="sr-only">Review your merch before checkout</SheetDescription>
        </SheetHeader>

        {!mounted || items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary">
              <ShoppingBag className="h-7 w-7 text-muted-foreground" aria-hidden />
            </span>
            <div>
              <p className="font-display text-lg font-bold">Your cart is empty</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Add some Shiloh merch to get started.
              </p>
            </div>
            <Button asChild className="rounded-full bg-gradient-to-r from-gold to-gold-deep font-bold text-primary-foreground hover:opacity-95">
              <a href="#shop" onClick={() => setCartOpen(false)}>
                Browse the Collection
              </a>
            </Button>
          </div>
        ) : (
          <>
            <div className="pretty-scroll flex-1 overflow-y-auto p-4">
              <ul className="space-y-3">
                {items.map((item) => (
                  <li
                    key={item.key}
                    className="flex gap-3 rounded-2xl border border-border bg-background/60 p-3"
                  >
                    <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-secondary">
                      <TintableProductImage src={item.image} alt={item.name} tint={item.colorHex} />
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold leading-tight">{item.name}</p>
                          <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground">
                            <span
                              className="inline-block h-2.5 w-2.5 rounded-full border border-white/20"
                              style={{ backgroundColor: item.colorHex }}
                              aria-hidden
                            />
                            <span>{item.color}</span>
                            <span aria-hidden>•</span>
                            <span>{item.size}</span>
                            {item.capStyle ? (
                              <>
                                <span aria-hidden>•</span>
                                <span>{item.capStyle}</span>
                              </>
                            ) : null}
                            <span aria-hidden>•</span>
                            <span className="capitalize">{PRODUCT_TYPE_LABELS[item.type]}</span>
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeItem(item.key)}
                          aria-label={`Remove ${item.name} from cart`}
                          className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden />
                        </button>
                      </div>
                      <div className="mt-auto flex items-center justify-between pt-2">
                        <div className="flex items-center gap-1 rounded-full border border-border bg-secondary p-0.5">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 rounded-full"
                            onClick={() => setQuantity(item.key, item.quantity - 1)}
                            aria-label="Decrease quantity"
                          >
                            <Minus className="h-3.5 w-3.5" aria-hidden />
                          </Button>
                          <span className="w-6 text-center text-sm font-bold tabular-nums">
                            {item.quantity}
                          </span>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 rounded-full"
                            onClick={() => setQuantity(item.key, item.quantity + 1)}
                            aria-label="Increase quantity"
                          >
                            <Plus className="h-3.5 w-3.5" aria-hidden />
                          </Button>
                        </div>
                        <p className="font-display text-sm font-bold text-gold">
                          {formatGhs(item.unitPrice * item.quantity)}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={clear}
                className="mt-4 w-full text-center text-xs font-medium text-muted-foreground underline-offset-2 transition-colors hover:text-destructive hover:underline"
              >
                Clear cart
              </button>
            </div>

            <div className="space-y-3 border-t border-border bg-background/40 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Subtotal</span>
                <span className="font-display text-xl font-bold text-gold">{formatGhs(total)}</span>
              </div>
              <Separator className="bg-border" />
              <p className="text-xs leading-relaxed text-muted-foreground">
                Delivery is arranged when our team calls you after payment — pay with MoMo using
                your order code as reference.
              </p>
              <Button
                onClick={goCheckout}
                className="h-12 w-full rounded-full bg-gradient-to-r from-gold to-gold-deep text-base font-bold text-primary-foreground shadow-[0_12px_32px_-10px_var(--gold)] hover:opacity-95"
              >
                Checkout
                <ArrowRight className="ml-2 h-4.5 w-4.5" aria-hidden />
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

/** Floating cart button — appears on mobile when cart has items */
export function CartFab() {
  const items = useCart((s) => s.items);
  const setCartOpen = useUi((s) => s.setCartOpen);
  const cartOpen = useUi((s) => s.cartOpen);
  const checkoutOpen = useUi((s) => s.checkoutOpen);
  const mounted = useMounted();

  const count = mounted ? items.reduce((n, i) => n + i.quantity, 0) : 0;
  if (!mounted || count === 0 || cartOpen || checkoutOpen) return null;

  return (
    <button
      type="button"
      onClick={() => setCartOpen(true)}
      aria-label={`Open cart (${count} items)`}
      className="pulse-ring fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom))] right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-gold to-gold-deep text-primary-foreground shadow-2xl transition-transform hover:scale-105 active:scale-95 sm:bottom-6 sm:right-6"
    >
      <ShoppingBag className="h-6 w-6" aria-hidden />
      <span className="absolute -right-1 -top-1 flex h-6 min-w-6 items-center justify-center rounded-full border-2 border-background bg-foreground px-1 text-xs font-bold text-background">
        {count}
      </span>
    </button>
  );
}
