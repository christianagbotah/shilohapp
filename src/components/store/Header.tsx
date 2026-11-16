"use client";

import { Crown, ShoppingBag, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCart, cartCount } from "@/store/cart";
import { useUi } from "@/store/ui";
import { useStoreInfo } from "@/hooks/use-store-data";
import { useMounted } from "@/hooks/use-mounted";

const NAV_LINKS = [
  { href: "#shop", label: "Shop" },
  { href: "#how", label: "How to Order" },
  { href: "#payment", label: "Payment" },
  { href: "#faq", label: "FAQ" },
];

export function Header() {
  const items = useCart((s) => s.items);
  const setCartOpen = useUi((s) => s.setCartOpen);
  const setTrackOpen = useUi((s) => s.setTrackOpen);
  const { data: info } = useStoreInfo();
  const mounted = useMounted();

  const count = mounted ? cartCount(items) : 0;

  return (
    <header className="sticky top-0 z-50 w-full">
      {info?.announcement ? (
        <div className="bg-gradient-to-r from-gold-deep via-gold to-gold-deep text-primary-foreground">
          <p className="mx-auto flex max-w-6xl items-center justify-center gap-2 px-4 py-1.5 text-center text-xs font-medium sm:text-sm">
            <Truck className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="line-clamp-2 sm:line-clamp-1">{info.announcement}</span>
          </p>
        </div>
      ) : null}
      <div className="border-b border-border bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <a href="#top" className="flex items-center gap-2.5" aria-label="Shiloh 2026 Merch — home">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-gold to-gold-deep text-primary-foreground shadow-[0_6px_20px_-6px_var(--gold)]">
              <Crown className="h-5 w-5" aria-hidden />
            </span>
            <span className="flex flex-col leading-none">
              <span className="font-display text-lg font-bold tracking-wide">SHILOH</span>
              <span className="text-[0.6rem] font-semibold uppercase tracking-[0.28em] text-muted-foreground">
                2026 Merch
              </span>
            </span>
          </a>

          <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="rounded-full px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="hidden rounded-full text-muted-foreground hover:text-foreground sm:inline-flex"
              onClick={() => setTrackOpen(true)}
            >
              Track Order
            </Button>
            <Button
              onClick={() => setCartOpen(true)}
              className="h-10 rounded-full bg-gradient-to-r from-gold to-gold-deep px-4 font-semibold text-primary-foreground shadow-[0_8px_24px_-8px_var(--gold)] hover:opacity-95"
              aria-label={`Open cart${count > 0 ? ` (${count} items)` : ""}`}
            >
              <ShoppingBag className="h-4.5 w-4.5" aria-hidden />
              <span className="hidden sm:inline">Cart</span>
              {count > 0 ? (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary-foreground px-1 text-xs font-bold text-primary">
                  {count}
                </span>
              ) : null}
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
