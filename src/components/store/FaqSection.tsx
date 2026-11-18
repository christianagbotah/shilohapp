"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useStoreInfo } from "@/hooks/use-store-data";
import { DEFAULT_SITE_CONTENT } from "@/lib/site-content";

export function FaqSection() {
  const { data: info } = useStoreInfo();
  const c = info?.content?.faq ?? DEFAULT_SITE_CONTENT.faq;

  return (
    <section id="faq" className="border-t border-border bg-secondary/40">
      <div className="mx-auto max-w-3xl scroll-mt-24 px-4 py-14 sm:px-6 sm:py-20">
        <div className="mb-8 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-gold">{c.eyebrow}</p>
          <h2 className="mt-2 font-display text-3xl font-bold uppercase tracking-tight sm:text-4xl">
            {c.title}
          </h2>
        </div>
        <Accordion type="single" collapsible className="w-full">
          {c.items.map((f, i) => (
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
