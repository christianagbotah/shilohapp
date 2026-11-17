"use client";

import { motion } from "framer-motion";
import { ClipboardList, ShoppingBag, Smartphone } from "lucide-react";

const STEPS = [
  {
    icon: ShoppingBag,
    step: "01",
    title: "Pick your merch",
    body: "Browse t-shirts, lacostes, jerseys and caps for adults and kids. Choose colour, size and quantity — caps come soft or hard.",
  },
  {
    icon: ClipboardList,
    step: "02",
    title: "Place your order",
    body: "Enter your name and phone number — no account needed. You instantly receive a unique order code, e.g. SHL-7K2P9Q.",
  },
  {
    icon: Smartphone,
    step: "03",
    title: "Pay with MoMo",
    body: "Send the total to our MTN MoMo line from any network, using your order code as the reference. Our team confirms every payment.",
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="border-y border-border bg-secondary/40">
      <div className="mx-auto max-w-6xl scroll-mt-24 px-4 py-14 sm:px-6 sm:py-20">
        <div className="mb-10 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-gold">Simple by design</p>
          <h2 className="mt-2 font-display text-3xl font-bold uppercase tracking-tight sm:text-4xl">
            How to Order
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground sm:text-base">
            From picking your piece to confirming payment — the whole flow takes less than two
            minutes on your phone.
          </p>
        </div>
        <div className="grid gap-5 sm:grid-cols-3 sm:gap-6">
          {STEPS.map((s, i) => (
            <motion.div
              key={s.step}
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
                {s.step}
              </span>
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gold/15 text-gold">
                <s.icon className="h-6 w-6" aria-hidden />
              </span>
              <h3 className="mt-4 font-display text-lg font-bold">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
