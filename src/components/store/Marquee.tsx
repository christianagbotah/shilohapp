import { Sparkle } from "lucide-react";

const ITEMS = [
  "Shiloh 2026",
  "Dec 8 – 13",
  "Wear the Glory",
  "Official Convocation Merch",
  "Pay with MoMo",
  "Adults & Kids",
];

function Row({ hidden }: { hidden?: boolean }) {
  return (
    <div className="flex shrink-0 items-center" aria-hidden={hidden}>
      {ITEMS.map((item, i) => (
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
  return (
    <div className="relative overflow-hidden border-y border-gold/20 bg-gradient-to-r from-gold-deep via-gold to-gold-deep py-3 text-primary-foreground">
      <div className="animate-marquee flex w-max">
        <Row />
        <Row hidden />
      </div>
    </div>
  );
}
