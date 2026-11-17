"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  BadgeCheck,
  BellRing,
  Copy,
  CreditCard,
  Lock,
  PhoneCall,
  ShieldCheck,
  Smartphone,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useStoreInfo } from "@/hooks/use-store-data";
import { useUi } from "@/store/ui";

export function PaymentSection() {
  const { data: info } = useStoreInfo();
  const { toast } = useToast();
  const setTrackOpen = useUi((s) => s.setTrackOpen);
  const setCartOpen = useUi((s) => s.setCartOpen);
  const [copied, setCopied] = useState(false);

  const momoNumber = info?.momoNumber ?? "—";
  const hubtelActive = info?.hubtelActive ?? false;

  const copyNumber = async () => {
    try {
      await navigator.clipboard.writeText(momoNumber.replace(/\s/g, ""));
      setCopied(true);
      toast({ title: "MoMo number copied" });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Could not copy", description: "Please copy the number manually." });
    }
  };

  const features = hubtelActive
    ? [
        {
          icon: Smartphone,
          title: "Every wallet & card",
          body: "MTN MoMo, Telecel Cash, AirtelTigo Money, Visa and Mastercard — all in one secure checkout.",
        },
        {
          icon: BellRing,
          title: "Instant SMS updates",
          body: "You get an SMS with your order details immediately, and another the moment payment is confirmed.",
        },
        {
          icon: ShieldCheck,
          title: "Bank-grade security",
          body: "Payments are processed by Hubtel, a licensed Ghanaian payment provider. We never see your PIN.",
        },
      ]
    : [
        {
          icon: Smartphone,
          title: "Every network welcome",
          body: "MTN, Telecel and AirtelTigo users can all send to our MTN MoMo line.",
        },
        {
          icon: BadgeCheck,
          title: "Reference matching",
          body: "Your order code in the payment reference lets us confirm you instantly.",
        },
        {
          icon: PhoneCall,
          title: "Personal follow-up",
          body: "Our team calls you to arrange delivery or pickup after payment is confirmed.",
        },
      ];

  return (
    <section id="payment" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-14 sm:px-6 sm:py-20">
      <div className="grid items-start gap-8 lg:grid-cols-2 lg:gap-14">
        <motion.div
          initial={{ opacity: 0, x: -18 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.55, ease: "easeOut" }}
        >
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-gold">
            {hubtelActive ? "Secure Online Payment" : "Mobile Money"}
          </p>
          <h2 className="mt-2 font-display text-3xl font-bold uppercase tracking-tight sm:text-4xl">
            Payment, <span className="text-gold-gradient">made easy</span>
          </h2>
          <p className="mt-4 max-w-lg text-sm leading-relaxed text-muted-foreground sm:text-base">
            {hubtelActive
              ? "Pick your merch, tap Pay Now and Hubtel's secure checkout takes it from there — approve the prompt on your phone and your order is confirmed instantly. No long codes to type, no waiting."
              : "After placing your order you receive a unique order code. Send the exact total to our MTN Mobile Money line and type that code as the reference — that's how we match your payment to your order."}
          </p>
          <ul className="mt-6 space-y-4">
            {features.map((f) => (
              <li key={f.title} className="flex gap-3.5">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gold/15 text-gold">
                  <f.icon className="h-4.5 w-4.5" aria-hidden />
                </span>
                <div>
                  <p className="text-sm font-semibold">{f.title}</p>
                  <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 22 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.55, delay: 0.1, ease: "easeOut" }}
          className="gold-panel rounded-3xl p-6 sm:p-8"
        >
          {hubtelActive ? (
            <>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gold text-primary-foreground shadow-[0_10px_26px_-8px_var(--gold)]">
                    <Lock className="h-5.5 w-5.5" aria-hidden />
                  </span>
                  <div>
                    <p className="font-display text-lg font-bold leading-tight">Hubtel Secure Checkout</p>
                    <p className="text-xs text-muted-foreground">Licensed payment provider — Ghana</p>
                  </div>
                </div>
                <span className="rounded-full bg-gold/15 px-3 py-1 text-[0.65rem] font-bold uppercase tracking-wider text-gold">
                  One-tap pay
                </span>
              </div>

              <ol className="mt-6 space-y-3">
                {[
                  <>
                    Add your favourites to the cart and tap{" "}
                    <span className="font-semibold text-foreground">Pay Now</span>
                  </>,
                  <>
                    Enter your name &amp; phone — you&apos;ll be taken to{" "}
                    <span className="font-semibold text-foreground">Hubtel&apos;s secure page</span>
                  </>,
                  <>
                    Choose <span className="font-semibold text-foreground">MoMo, wallet or card</span> and approve
                    the prompt on your phone
                  </>,
                  <>
                    Payment confirmed — <span className="font-semibold text-foreground">SMS alerts</span> sent to you
                    and our team instantly
                  </>,
                ].map((line, i) => (
                  <li key={i} className="flex gap-3 text-sm leading-relaxed text-muted-foreground">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gold/15 font-display text-xs font-bold text-gold">
                      {i + 1}
                    </span>
                    <span className="pt-0.5">{line}</span>
                  </li>
                ))}
              </ol>

              <div className="mt-6 flex flex-wrap items-center gap-2">
                {["MTN MoMo", "Telecel Cash", "AT Money", "Visa", "Mastercard"].map((m) => (
                  <span
                    key={m}
                    className="rounded-full border border-border bg-background/70 px-3 py-1.5 text-xs font-semibold text-muted-foreground"
                  >
                    {m}
                  </span>
                ))}
              </div>

              <Button
                onClick={() => setCartOpen(true)}
                className="mt-6 h-12 w-full rounded-full bg-gradient-to-r from-gold to-gold-deep font-bold text-primary-foreground shadow-[0_12px_32px_-10px_var(--gold)] hover:opacity-95"
              >
                <CreditCard className="mr-2 h-4.5 w-4.5" aria-hidden />
                Start an order
              </Button>

              <p className="mt-6 rounded-xl border border-border bg-secondary/60 p-3.5 text-xs leading-relaxed text-muted-foreground">
                <span className="font-semibold text-foreground">Prefer to pay manually?</span>{" "}
                Send MoMo to{" "}
                <span className="font-semibold text-gold">{momoNumber}</span> ({info?.momoName}) with
                your order code as the reference. Placed an order?{" "}
                <button
                  type="button"
                  onClick={() => setTrackOpen(true)}
                  className="font-semibold text-gold underline-offset-2 hover:underline"
                >
                  Track it here
                </button>
                .
              </p>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gold text-primary-foreground shadow-[0_10px_26px_-8px_var(--gold)]">
                    <Wallet className="h-5.5 w-5.5" aria-hidden />
                  </span>
                  <div>
                    <p className="font-display text-lg font-bold leading-tight">MTN Mobile Money</p>
                    <p className="text-xs text-muted-foreground">{info?.momoName || "Shiloh Merch GH"}</p>
                  </div>
                </div>
                <span className="rounded-full bg-gold/15 px-3 py-1 text-[0.65rem] font-bold uppercase tracking-wider text-gold">
                  Official line
                </span>
              </div>

              <div className="mt-6 flex items-center justify-between gap-3 rounded-2xl border border-gold/25 bg-background/60 px-4 py-3.5">
                <div>
                  <p className="text-[0.65rem] font-semibold uppercase tracking-widest text-muted-foreground">
                    Pay to this number
                  </p>
                  <p className="font-display text-2xl font-bold tabular-nums text-gold sm:text-3xl">
                    {momoNumber}
                  </p>
                </div>
                <Button
                  size="icon"
                  onClick={copyNumber}
                  aria-label="Copy MoMo number"
                  className="h-10 w-10 shrink-0 rounded-full border border-gold/30 bg-gold/10 text-gold hover:bg-gold/20"
                  variant="ghost"
                >
                  {copied ? <BadgeCheck className="h-4.5 w-4.5" aria-hidden /> : <Copy className="h-4.5 w-4.5" aria-hidden />}
                </Button>
              </div>

              <ol className="mt-6 space-y-3">
                {[
                  <>
                    Dial <span className="font-bold text-gold">*170#</span> and choose{" "}
                    <span className="font-semibold">Transfer Money → MoMo User</span>
                  </>,
                  <>
                    Enter the number above and the <span className="font-semibold">exact total</span> of your
                    order
                  </>,
                  <>
                    Type your order code as the reference — e.g.{" "}
                    <span className="rounded bg-gold/15 px-1.5 py-0.5 font-mono text-xs font-bold text-gold">
                      SHL-7K2P9Q
                    </span>
                  </>,
                  <>
                    Send, then tap <span className="font-semibold">&ldquo;I have paid&rdquo;</span> in the app —
                    we confirm within the day
                  </>,
                ].map((line, i) => (
                  <li key={i} className="flex gap-3 text-sm leading-relaxed text-muted-foreground">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gold/15 font-display text-xs font-bold text-gold">
                      {i + 1}
                    </span>
                    <span className="pt-0.5">{line}</span>
                  </li>
                ))}
              </ol>

              <p className="mt-6 rounded-xl border border-border bg-secondary/60 p-3.5 text-xs leading-relaxed text-muted-foreground">
                <span className="font-semibold text-foreground">Telecel Cash & AirtelTigo Money users:</span>{" "}
                send to the same MTN number from your wallet app and enter your order code as the
                narration. Placed an order?{" "}
                <button
                  type="button"
                  onClick={() => setTrackOpen(true)}
                  className="font-semibold text-gold underline-offset-2 hover:underline"
                >
                  Track it here
                </button>
                .
              </p>
            </>
          )}
        </motion.div>
      </div>
    </section>
  );
}
