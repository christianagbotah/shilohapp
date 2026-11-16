"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { ArrowDown, BadgeCheck, ShieldCheck, Smartphone, Sparkles, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";

const SHILOH_START = new Date("2026-12-08T00:00:00Z").getTime(); // Ghana is UTC+0

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

function Countdown() {
  const t = useCountdown(SHILOH_START);
  const units: Array<{ value: number | null; label: string }> = [
    { value: t?.days ?? null, label: "Days" },
    { value: t?.hours ?? null, label: "Hours" },
    { value: t?.minutes ?? null, label: "Mins" },
    { value: t?.seconds ?? null, label: "Secs" },
  ];
  if (t?.live) {
    return (
      <p className="gold-panel inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-gold">
        <Sparkles className="h-4 w-4" aria-hidden /> Shiloh 2026 is live — Dec 8–13
      </p>
    );
  }
  return (
    <div className="flex items-end gap-2 sm:gap-3" role="timer" aria-label="Countdown to Shiloh 2026">
      <span className="pb-2 pr-1 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground sm:text-sm">
        Dec 8 in
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
  return (
    <section id="top" className="hero-radial relative overflow-hidden">
      <div className="dot-grid pointer-events-none absolute inset-0" aria-hidden />
      <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 pb-14 pt-10 sm:px-6 sm:pt-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12 lg:pb-20 lg:pt-20">
        <div className="flex flex-col items-start gap-6">
          <motion.div {...fadeUp} transition={{ duration: 0.55, ease: "easeOut" }}>
            <span className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-4 py-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-gold">
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              Winners Chapel International • Dec 8–13
            </span>
          </motion.div>

          <motion.h1
            {...fadeUp}
            transition={{ duration: 0.55, delay: 0.08, ease: "easeOut" }}
            className="font-display text-5xl font-bold uppercase leading-[0.95] tracking-tight sm:text-6xl lg:text-7xl"
          >
            Wear the
            <br />
            <span className="text-gold-gradient glow-gold">Glory</span>
          </motion.h1>

          <motion.p
            {...fadeUp}
            transition={{ duration: 0.55, delay: 0.16, ease: "easeOut" }}
            className="max-w-md text-base leading-relaxed text-muted-foreground sm:text-lg"
          >
            The official <span className="font-semibold text-foreground">Shiloh 2026</span> convocation
            merch — premium t-shirts, lacostes, jerseys and caps for adults and kids. Order in under a
            minute, pay with Mobile Money, anywhere in Ghana.
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
                Shop the Collection
                <ArrowDown className="ml-1 h-4 w-4" aria-hidden />
              </a>
            </Button>
            <Button
              asChild
              variant="outline"
              className="h-12 rounded-full border-border px-6 text-base font-semibold hover:border-gold/40 hover:bg-secondary hover:text-gold"
            >
              <a href="#payment">Pay with MoMo</a>
            </Button>
          </motion.div>

          <motion.div
            {...fadeUp}
            transition={{ duration: 0.55, delay: 0.32, ease: "easeOut" }}
            className="w-full"
          >
            <Countdown />
          </motion.div>

          <motion.ul
            {...fadeUp}
            transition={{ duration: 0.55, delay: 0.4, ease: "easeOut" }}
            className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground"
          >
            <li className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-gold" aria-hidden /> 100% official merch
            </li>
            <li className="flex items-center gap-2">
              <Smartphone className="h-4 w-4 text-gold" aria-hidden /> MoMo payment
            </li>
            <li className="flex items-center gap-2">
              <Truck className="h-4 w-4 text-gold" aria-hidden /> Delivery across Ghana
            </li>
          </motion.ul>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.15, ease: "easeOut" }}
          className="relative mx-auto w-full max-w-lg lg:max-w-none"
        >
          <div className="glow-gold relative aspect-[5/4] overflow-hidden rounded-3xl border border-gold/25">
            <Image
              src="/products/hero.png"
              alt="Shiloh 2026 merch collection — t-shirts, lacoste and cap"
              fill
              sizes="(max-width: 1024px) 100vw, 560px"
              className="object-cover"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background/50 via-transparent to-transparent" aria-hidden />
          </div>

          <motion.div
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
            className="gold-panel absolute -bottom-4 left-4 flex items-center gap-3 rounded-2xl px-4 py-3 shadow-2xl sm:left-8"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gold/20 text-gold">
              <BadgeCheck className="h-5 w-5" aria-hidden />
            </span>
            <div className="leading-tight">
              <p className="text-sm font-semibold">Official Convocation Merch</p>
              <p className="text-xs text-muted-foreground">Quality you can trust</p>
            </div>
          </motion.div>

          <motion.div
            animate={{ y: [0, 10, 0] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 0.6 }}
            className="absolute -right-2 top-6 rounded-2xl border border-border bg-card/90 px-4 py-3 shadow-2xl backdrop-blur sm:right-4"
          >
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">From</p>
            <p className="font-display text-xl font-bold text-gold">GH₵50</p>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
