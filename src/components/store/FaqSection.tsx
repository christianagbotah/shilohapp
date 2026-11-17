"use client";

import { useMemo } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useStoreInfo } from "@/hooks/use-store-data";

type Faq = { q: string; a: string };

const BASE_FAQS: Faq[] = [
  {
    q: "When will I receive my order?",
    a: "Orders are reviewed daily by our team. Once your payment is confirmed, we call you on the number you provided to arrange delivery or pickup. Order early — everything is delivered before Dec 8, Shiloh week.",
  },
  {
    q: "What sizes are available?",
    a: "T-shirts, lacostes and jerseys come in adult sizes S–XXL and kids sizes 2–3y up to 12–13y. Caps come in S/M, L/XL and One Size, in both soft and hard styles.",
  },
  {
    q: "Can I order for my whole family in one go?",
    a: "Absolutely — that's the idea. Mix adults' and kids' items, different colours and sizes in a single cart, then check out once with one order code.",
  },
  {
    q: "Is delivery free?",
    a: "Delivery is arranged when our team calls you after payment — fees depend on your location in Ghana, and church pickup points are available at a lower cost.",
  },
  {
    q: "I placed my order but nobody has called me. What do I do?",
    a: "Use the Track Order link in the menu with your order code or phone number to see its status. Orders are typically reviewed within 24 hours.",
  },
];

export function FaqSection() {
  const { data: info } = useStoreInfo();
  const hubtelActive = info?.hubtelActive ?? false;

  const faqs = useMemo<Faq[]>(() => {
    const paymentFaq: Faq = hubtelActive
      ? {
          q: "How exactly do I pay?",
          a: "Tap Pay Now at checkout and you'll be taken to Hubtel's secure payment page — approve the prompt with MTN MoMo, Telecel Cash, AirtelTigo Money or a card. Your order confirms automatically and you get an SMS with the details. You can also pay manually to our MTN MoMo line with your order code as reference.",
        }
      : {
          q: "How exactly do I pay?",
          a: "After placing your order you receive a unique code like SHL-7K2P9Q. Send the exact total to our MTN MoMo line using that code as the payment reference. MTN, Telecel and AirtelTigo users can all send to the line.",
        };
    // Payment FAQ always sits second, right after delivery timing.
    return [BASE_FAQS[0], paymentFaq, ...BASE_FAQS.slice(1)];
  }, [hubtelActive]);

  return (
    <section id="faq" className="border-t border-border bg-secondary/40">
      <div className="mx-auto max-w-3xl scroll-mt-24 px-4 py-14 sm:px-6 sm:py-20">
        <div className="mb-8 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-gold">Good to know</p>
          <h2 className="mt-2 font-display text-3xl font-bold uppercase tracking-tight sm:text-4xl">
            Frequently Asked
          </h2>
        </div>
        <Accordion type="single" collapsible className="w-full">
          {faqs.map((f, i) => (
            <AccordionItem key={i} value={`item-${i}`} className="border-border">
              <AccordionTrigger className="text-left font-display text-base font-semibold hover:text-gold hover:no-underline sm:text-lg">
                {f.q}
              </AccordionTrigger>
              <AccordionContent className="text-sm leading-relaxed text-muted-foreground sm:text-base">
                {f.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
