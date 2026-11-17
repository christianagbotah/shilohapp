"use client";

import { Sparkle } from "lucide-react";
import { useStoreInfo } from "@/hooks/use-store-data";
import { STORE_INFO_DEFAULTS } from "@/lib/types";

function useMarqueeItems() {
  const { data: info } = useStoreInfo();
  const year = info?.shilohYear ?? STORE_INFO_DEFAULTS.shilohYear;
  const tagline = info?.shilohTagline ?? STORE_INFO_DEFAULTS.shilohTagline;
  const dates = info?.shilohDates ?? STORE_INFO_DEFAULTS.shilohDates;
  const hubtelActive = info?.hubtelActive ?? false;
  return [
    `Shiloh ${year}`,
    dates,
    tagline,
    "Official Convocation Merch",
    hubtelActive ? "Pay with Hubtel" : "Pay with MoMo",
    "Adults & Kids",
  ];
}

function Row({ items, hidden }: { items: string[]; hidden?: boolean }) {
  return (
    <div className="flex shrink-0 items-center" aria-hidden={hidden}>
      {items.map((item, i) => (
        <span key={i} className="flex items-center">
          <span className="whitespace-nowrap px-6 font-display text-sm font-bold uppercase tracking-[0.2em]">
            {item}
          </span>
          <Sparkle className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
        </span>
      ))}
    </div>
  );
}

export function Marquee() {
  const items = useMarqueeItems();
  return (
    <div className="relative overflow-hidden border-y border-gold/20 bg-gradient-to-r from-gold-deep via-gold to-gold-deep py-3 text-primary-foreground">
      <div className="animate-marquee flex w-max">
        <Row items={items} />
        <Row items={items} hidden />
      </div>
    </div>
  );
}
