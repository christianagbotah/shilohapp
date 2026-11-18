"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import {
  ArrowDown,
  BadgeCheck,
  Expand,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Truck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BrandLogo } from "@/components/store/BrandLogo";
import { useStoreInfo } from "@/hooks/use-store-data";
import { STORE_INFO_DEFAULTS } from "@/lib/types";
import { DEFAULT_SITE_CONTENT, hydrate } from "@/lib/site-content";

function useCountdown(target: number) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const update = () => setNow(Date.now());
    const raf = requestAnimationFrame(update);
    const id = setInterval(update, 1000);
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(id);
    };
  }, [target]);
  if (now === null) return null;
  const diff = Math.max(0, target - now);
  return {
    days: Math.floor(diff / 86_400_000),
    hours: Math.floor((diff % 86_400_000) / 3_600_000),
    minutes: Math.floor((diff % 3_600_000) / 60_000),
    seconds: Math.floor((diff % 60_000) / 1000),
    live: diff <= 0,
  };
}

function Countdown({ startIso, year, dates }: { startIso: string; year: string; dates: string }) {
  const target = useMemo(() => new Date(`${startIso}T00:00:00Z`).getTime(), [startIso]);
  const t = useCountdown(target);
  const startLabel = useMemo(
    () =>
      new Date(`${startIso}T00:00:00Z`).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      }),
    [startIso]
  );
  const units: Array<{ value: number | null; label: string }> = [
    { value: t?.days ?? null, label: "Days" },
    { value: t?.hours ?? null, label: "Hours" },
    { value: t?.minutes ?? null, label: "Mins" },
    { value: t?.seconds ?? null, label: "Secs" },
  ];
  if (t?.live) {
    return (
      <p className="gold-panel inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-gold">
        <Sparkles className="h-4 w-4" aria-hidden /> Shiloh {year} is live — {dates}
      </p>
    );
  }
  return (
    <div className="flex flex-wrap items-end gap-2 sm:gap-3" role="timer" aria-label={`Countdown to Shiloh ${year}`}>
      <span className="pb-2 pr-1 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground sm:text-sm">
        {startLabel} in
      </span>
      {units.map((u) => (
        <div
          key={u.label}
          className="flex min-w-[3.6rem] flex-col items-center rounded-xl border border-border bg-card/80 px-2 py-2 backdrop-blur sm:min-w-[4.2rem] sm:px-3"
        >
          <span className="font-display text-2xl font-bold tabular-nums text-foreground sm:text-3xl">
            {u.value === null ? "–" : String(u.value).padStart(2, "0")}
          </span>
          <span className="text-[0.6rem] font-medium uppercase tracking-widest text-muted-foreground">
            {u.label}
          </span>
        </div>
      ))}
    </div>
  );
}

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
};

export function Hero() {
  const { data: info } = useStoreInfo();
  const [flyerOpen, setFlyerOpen] = useState(false);

  const year = info?.shilohYear ?? STORE_INFO_DEFAULTS.shilohYear;
  const tagline = info?.shilohTagline ?? STORE_INFO_DEFAULTS.shilohTagline;
  const dates = info?.shilohDates ?? STORE_INFO_DEFAULTS.shilohDates;
  const startIso = info?.shilohStart ?? STORE_INFO_DEFAULTS.shilohStart;
  const c = info?.content?.hero ?? DEFAULT_SITE_CONTENT.hero;
  const vars = { year, dates, tagline };

  return (
    <section id="top" className="hero-radial relative overflow-hidden">
      <div className="dot-grid pointer-events-none absolute inset-0" aria-hidden />
      <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 pb-14 pt-10 sm:px-6 sm:pt-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12 lg:pb-20 lg:pt-20">
        <div className="flex flex-col items-start gap-6">
          <motion.div {...fadeUp} transition={{ duration: 0.55, ease: "easeOut" }}>
            <span className="inline-flex flex-wrap items-center gap-x-2.5 gap-y-1 rounded-full border border-gold/30 bg-gold/10 px-4 py-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-gold">
              <BrandLogo size={26} priority />
              <span>Winners Chapel International</span>
              <span className="hidden sm:inline" aria-hidden>
                •
              </span>
              <span className="text-gold/90">{dates}</span>
            </span>
          </motion.div>

          <motion.h1
            {...fadeUp}
            transition={{ duration: 0.55, delay: 0.08, ease: "easeOut" }}
            className="font-display text-5xl font-bold uppercase leading-[0.95] tracking-tight sm:text-6xl lg:text-7xl"
          >
            Shiloh {year}
            <span className="mt-2 block normal-case text-gold-gradient glow-gold">{tagline}</span>
          </motion.h1>

          <motion.p
            {...fadeUp}
            transition={{ duration: 0.55, delay: 0.16, ease: "easeOut" }}
            className="max-w-md text-base leading-relaxed text-muted-foreground sm:text-lg"
          >
            {hydrate(c.intro, vars)}
          </motion.p>

          <motion.div
            {...fadeUp}
            transition={{ duration: 0.55, delay: 0.24, ease: "easeOut" }}
            className="flex flex-wrap items-center gap-3"
          >
            <Button
              asChild
              className="h-12 rounded-full bg-gradient-to-r from-gold to-gold-deep px-7 text-base font-bold text-primary-foreground shadow-[0_14px_40px_-12px_var(--gold)] hover:opacity-95"
            >
              <a href="#shop">
                {c.ctaPrimary}
                <ArrowDown className="ml-1 h-4 w-4" aria-hidden />
              </a>
            </Button>
            <Button
              asChild
              variant="outline"
              className="h-12 rounded-full border-border px-6 text-base font-semibold hover:border-gold/40 hover:bg-secondary hover:text-gold"
            >
              <a href="#payment">{c.ctaSecondary}</a>
            </Button>
          </motion.div>

          <motion.div
            {...fadeUp}
            transition={{ duration: 0.55, delay: 0.32, ease: "easeOut" }}
            className="w-full"
          >
            <Countdown startIso={startIso} year={year} dates={dates} />
          </motion.div>

          <motion.ul
            {...fadeUp}
            transition={{ duration: 0.55, delay: 0.4, ease: "easeOut" }}
            className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground"
          >
            {c.trust.map((t, i) => (
              <li key={i} className="flex items-center gap-2">
                {i === 0 ? (
                  <ShieldCheck className="h-4 w-4 text-gold" aria-hidden />
                ) : i === 1 ? (
                  <Smartphone className="h-4 w-4 text-gold" aria-hidden />
                ) : (
                  <Truck className="h-4 w-4 text-gold" aria-hidden />
                )}
                {t}
              </li>
            ))}
          </motion.ul>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.15, ease: "easeOut" }}
          className="relative mx-auto w-full max-w-lg lg:max-w-none"
        >
          <button
            type="button"
            onClick={() => setFlyerOpen(true)}
            aria-label={`View the official Shiloh ${year} flyer`}
            className="glow-gold group relative block aspect-[16/10] w-full overflow-hidden rounded-3xl border border-gold/25 bg-secondary/40"
          >
            <Image
              src={c.flyerImage}
              alt={`Official Shiloh ${year} — ${tagline} flyer, Winners Chapel International`}
              fill
              sizes="(max-width: 1024px) 100vw, 560px"
              className="object-contain p-2 transition-transform duration-500 group-hover:scale-[1.02] sm:p-3"
              priority
            />
            <span className="absolute inset-x-0 bottom-0 flex justify-center pb-3 pt-10">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/30 bg-background/85 px-3.5 py-1.5 text-xs font-semibold text-gold shadow-lg backdrop-blur transition-colors group-hover:bg-background">
                <Expand className="h-3.5 w-3.5" aria-hidden /> View flyer
              </span>
            </span>
          </button>

          <motion.div
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
            className="gold-panel absolute -bottom-4 left-4 flex items-center gap-3 rounded-2xl px-4 py-3 shadow-2xl sm:left-8"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gold/20 text-gold">
              <BadgeCheck className="h-5 w-5" aria-hidden />
            </span>
            <div className="leading-tight">
              <p className="text-sm font-semibold">{c.badgeTitle}</p>
              <p className="text-xs text-muted-foreground">{c.badgeSubtitle}</p>
            </div>
          </motion.div>
        </motion.div>
      </div>

      <Dialog open={flyerOpen} onOpenChange={setFlyerOpen}>
        <DialogContent className="max-h-[92dvh] max-w-3xl overflow-y-auto border-gold/25 bg-card p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="font-display uppercase">
              Shiloh {year} — <span className="text-gold-gradient">{tagline}</span>
            </DialogTitle>
            <DialogDescription>
              Official convocation flyer • Winners Chapel International • {dates}
            </DialogDescription>
          </DialogHeader>
          <div className="relative mx-auto aspect-video w-full max-w-2xl overflow-hidden rounded-2xl bg-secondary/40">
            <Image
              src={c.flyerImage}
              alt={`Official Shiloh ${year} — ${tagline} flyer, Winners Chapel International`}
              fill
              sizes="(max-width: 768px) 90vw, 640px"
              className="object-contain"
            />
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
