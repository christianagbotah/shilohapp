"use client";

import { Lock, MapPin } from "lucide-react";
import { useUi } from "@/store/ui";
import { useStoreInfo } from "@/hooks/use-store-data";
import { BrandLogo } from "@/components/store/BrandLogo";
import { STORE_INFO_DEFAULTS } from "@/lib/types";

export function Footer() {
  const setView = useUi((s) => s.setView);
  const setTrackOpen = useUi((s) => s.setTrackOpen);
  const { data: info } = useStoreInfo();
  const year = info?.shilohYear ?? STORE_INFO_DEFAULTS.shilohYear;
  const tagline = info?.shilohTagline ?? STORE_INFO_DEFAULTS.shilohTagline;

  return (
    <footer className="mt-auto border-t border-border bg-secondary/30">
      <div className="mx-auto max-w-6xl px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-12 sm:px-6">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2.5">
              <BrandLogo size={40} />
              <span className="flex flex-col leading-none">
                <span className="font-display text-lg font-bold tracking-wide">
                  SHILOH <span className="text-gold">{year}</span>
                </span>
                <span className="text-[0.6rem] font-semibold tracking-[0.28em] text-gold">
                  {tagline}
                </span>
              </span>
            </div>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground">
              The official merch store for the Shiloh convocation of the Winners&apos; family
              worldwide — serving members across Ghana with premium t-shirts, lacostes, jerseys and
              caps for adults and kids.
            </p>
            <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 text-gold" aria-hidden /> Winners Chapel International —
              Ghana
            </p>
          </div>

          <nav aria-label="Shop links">
            <h3 className="text-xs font-bold uppercase tracking-[0.22em] text-foreground">Shop</h3>
            <ul className="mt-4 space-y-2.5 text-sm text-muted-foreground">
              <li><a className="transition-colors hover:text-gold" href="#shop">The Collection</a></li>
              <li><a className="transition-colors hover:text-gold" href="#how">How to Order</a></li>
              <li><a className="transition-colors hover:text-gold" href="#payment">Payments</a></li>
              <li><a className="transition-colors hover:text-gold" href="#faq">FAQ</a></li>
            </ul>
          </nav>

          <nav aria-label="Support links">
            <h3 className="text-xs font-bold uppercase tracking-[0.22em] text-foreground">Support</h3>
            <ul className="mt-4 space-y-2.5 text-sm text-muted-foreground">
              <li>
                <button
                  type="button"
                  onClick={() => setTrackOpen(true)}
                  className="transition-colors hover:text-gold"
                >
                  Track Your Order
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => setView("admin")}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-gold/40 hover:text-gold"
                >
                  <Lock className="h-3 w-3" aria-hidden />
                  Back Office
                </button>
              </li>
            </ul>
          </nav>
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-border pt-6 text-center text-xs text-muted-foreground sm:flex-row sm:text-left">
          <p>© {year} Shiloh Merch Store • Winners Chapel International, Ghana</p>
          <p className="font-display font-semibold uppercase tracking-[0.2em] text-gold/80">
            {tagline}
          </p>
        </div>
      </div>
    </footer>
  );
}
