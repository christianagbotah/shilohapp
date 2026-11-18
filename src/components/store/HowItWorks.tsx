"use client";

import { motion } from "framer-motion";
import { BadgeCheck, ClipboardList, ShoppingBag } from "lucide-react";
import { useStoreInfo } from "@/hooks/use-store-data";
import { DEFAULT_SITE_CONTENT } from "@/lib/site-content";

const STEP_ICONS = [ShoppingBag, ClipboardList, BadgeCheck];

export function HowItWorks() {
  const { data: info } = useStoreInfo();
  const c = info?.content?.how ?? DEFAULT_SITE_CONTENT.how;

  return (
    <section id="how" className="border-y border-border bg-secondary/40">
      <div className="mx-auto max-w-6xl scroll-mt-24 px-4 py-14 sm:px-6 sm:py-20">
        <div className="mb-10 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-gold">{c.eyebrow}</p>
          <h2 className="mt-2 font-display text-3xl font-bold uppercase tracking-tight sm:text-4xl">
            {c.title}
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground sm:text-base">
            {c.subtitle}
          </p>
        </div>
        <div className="grid gap-5 sm:grid-cols-3 sm:gap-6">
          {c.steps.map((s, i) => {
            const Icon = STEP_ICONS[i % STEP_ICONS.length];
            return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 22 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: i * 0.12, ease: "easeOut" }}
              className="card-hover relative overflow-hidden rounded-2xl border border-border bg-card p-6"
            >
              <span
                className="pointer-events-none absolute -right-2 -top-5 font-display text-7xl font-bold text-foreground/5"
                aria-hidden
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gold/15 text-gold">
                <Icon className="h-6 w-6" aria-hidden />
              </span>
              <h3 className="mt-4 font-display text-lg font-bold">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
            </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
