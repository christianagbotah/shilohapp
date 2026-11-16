"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CtaBand() {
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
          The convocation is <span className="text-gold-gradient glow-gold">almost here</span>
        </h2>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground sm:text-base">
          Order now so your family walks into Shiloh 2026 — Dec 8–13 — wearing the glory.
        </p>
        <Button
          asChild
          className="mt-7 h-12 rounded-full bg-gradient-to-r from-gold to-gold-deep px-8 text-base font-bold text-primary-foreground shadow-[0_14px_40px_-12px_var(--gold)] hover:opacity-95"
        >
          <a href="#shop">
            Shop the Collection
            <ArrowRight className="ml-2 h-4.5 w-4.5" aria-hidden />
          </a>
        </Button>
      </motion.div>
    </section>
  );
}
