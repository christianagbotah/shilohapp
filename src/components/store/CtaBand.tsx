"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStoreInfo } from "@/hooks/use-store-data";
import { STORE_INFO_DEFAULTS } from "@/lib/types";
import { DEFAULT_SITE_CONTENT, hydrate } from "@/lib/site-content";

export function CtaBand() {
  const { data: info } = useStoreInfo();
  const year = info?.shilohYear ?? STORE_INFO_DEFAULTS.shilohYear;
  const dates = info?.shilohDates ?? STORE_INFO_DEFAULTS.shilohDates;
  const tagline = info?.shilohTagline ?? STORE_INFO_DEFAULTS.shilohTagline;
  const c = info?.content?.cta ?? DEFAULT_SITE_CONTENT.cta;
  return (
    <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.55, ease: "easeOut" }}
        className="gold-panel dot-grid relative overflow-hidden rounded-3xl px-6 py-12 text-center sm:px-12 sm:py-16"
      >
        <h2 className="font-display text-3xl font-bold uppercase tracking-tight sm:text-4xl">
          {c.title} <span className="text-gold-gradient glow-gold">{c.titleAccent}</span>
        </h2>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground sm:text-base">
          {hydrate(c.subtitle, { year, dates, tagline })}
        </p>
        <Button
          asChild
          className="mt-7 h-12 rounded-full bg-gradient-to-r from-gold to-gold-deep px-8 text-base font-bold text-primary-foreground shadow-[0_14px_40px_-12px_var(--gold)] hover:opacity-95"
        >
          <a href="#shop">
            {c.buttonLabel}
            <ArrowRight className="ml-2 h-4.5 w-4.5" aria-hidden />
          </a>
        </Button>
      </motion.div>
    </section>
  );
}
