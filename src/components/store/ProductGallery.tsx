"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ProductDTO } from "@/lib/types";
import { TintableProductImage } from "@/components/store/TintableProductImage";
import { cn } from "@/lib/utils";

/**
 * Multi-view product gallery (Front / Side / Back / Detail) with
 * motionsites-style cross-fade + slide transitions, swipe gestures,
 * labelled thumbnails and a segmented scrubber. The garment fabric is
 * re-tinted live as the shopper picks a colour.
 */
export function ProductGallery({
  product,
  tintHex,
}: {
  product: ProductDTO;
  tintHex?: string | null;
}) {
  const views = product.gallery.length
    ? product.gallery
    : [{ src: product.image, label: "Front" }];

  const [[index, direction], setState] = useState<[number, number]>([0, 0]);
  const [interacted, setInteracted] = useState(false);
  const frameRef = useRef<HTMLDivElement>(null);

  const go = useCallback(
    (dir: number) => {
      setInteracted(true);
      setState(([i]) => [(i + dir + views.length) % views.length, dir]);
    },
    [views.length]
  );

  const jumpTo = useCallback(
    (target: number) => {
      setInteracted(true);
      setState(([i]) => [target, target > i ? 1 : -1]);
    },
    []
  );

  // Gentle auto-rotate to showcase the views — stops the moment the
  // visitor interacts (tap, swipe, arrow key or hover intent).
  useEffect(() => {
    if (interacted || views.length < 2) return;
    const t = setTimeout(() => setState(([i]) => [(i + 1) % views.length, 1]), 3500);
    return () => clearTimeout(t);
  }, [index, interacted, views.length]);

  // Keyboard arrows while the gallery holds focus
  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    el.addEventListener("keydown", onKey);
    return () => el.removeEventListener("keydown", onKey);
  }, [go]);

  const current = views[index];

  return (
    <div className="flex flex-col gap-3">
      <div
        ref={frameRef}
        role="group"
        aria-roledescription="carousel"
        aria-label={`${product.name} photo gallery`}
        tabIndex={0}
        className="group relative aspect-square touch-pan-y select-none overflow-hidden rounded-2xl border border-border bg-secondary outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
        onMouseEnter={() => setInteracted(true)}
      >
        <AnimatePresence initial={false} custom={direction} mode="popLayout">
          <motion.div
            key={current.src}
            custom={direction}
            initial={{ opacity: 0, x: direction >= 0 ? 90 : -90, scale: 1.06 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: direction >= 0 ? -70 : 70, scale: 0.97 }}
            transition={{ duration: 0.42, ease: [0.32, 0.72, 0, 1] }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.16}
            onDragEnd={(_, info) => {
              setInteracted(true);
              if (info.offset.x < -60) go(1);
              else if (info.offset.x > 60) go(-1);
            }}
            className="absolute inset-0 cursor-grab active:cursor-grabbing"
          >
            <TintableProductImage
              src={current.src}
              alt={`${product.name} — ${current.label} view`}
              tint={tintHex}
              className="pointer-events-none"
            />
          </motion.div>
        </AnimatePresence>

        {product.badge ? (
          <span className="absolute left-3 top-3 z-10 rounded-full bg-gold px-3 py-1 text-[0.65rem] font-bold uppercase tracking-wider text-primary-foreground shadow-lg">
            {product.badge}
          </span>
        ) : null}

        {/* Current view label */}
        <div className="absolute right-3 top-3 z-10 overflow-hidden rounded-full">
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={current.label}
              initial={{ y: 14, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -14, opacity: 0 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="block bg-background/85 px-3 py-1 text-[0.62rem] font-bold uppercase tracking-[0.18em] text-gold shadow-lg backdrop-blur"
            >
              {current.label}
            </motion.span>
          </AnimatePresence>
        </div>

        {/* Arrows */}
        {views.length > 1 ? (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Previous view"
              className="absolute left-2.5 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-background/70 text-foreground opacity-0 shadow-lg backdrop-blur transition-all duration-300 hover:bg-background focus-visible:opacity-100 group-hover:opacity-100 max-sm:opacity-100"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Next view"
              className="absolute right-2.5 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-background/70 text-foreground opacity-0 shadow-lg backdrop-blur transition-all duration-300 hover:bg-background focus-visible:opacity-100 group-hover:opacity-100 max-sm:opacity-100"
            >
              <ChevronRight className="h-5 w-5" aria-hidden />
            </button>
          </>
        ) : null}
      </div>

      {/* Labelled thumbnails */}
      {views.length > 1 ? (
        <div className="flex items-center gap-2" role="tablist" aria-label="Product views">
          {views.map((v, i) => (
            <button
              key={v.src}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`Show ${v.label} view`}
              onClick={() => jumpTo(i)}
              className={cn(
                "group/th relative flex-1 overflow-hidden rounded-xl border-2 transition-all duration-300",
                i === index
                  ? "border-gold shadow-[0_8px_20px_-10px_var(--gold)]"
                  : "border-border opacity-60 hover:opacity-100"
              )}
            >
              <span className="relative block aspect-[4/3] w-full bg-secondary">
                <TintableProductImage src={v.src} alt="" tint={tintHex} />
              </span>
              <span
                className={cn(
                  "block px-1 py-1 text-center text-[0.58rem] font-bold uppercase tracking-[0.14em]",
                  i === index ? "bg-gold/15 text-gold" : "text-muted-foreground"
                )}
              >
                {v.label}
              </span>
              {i === index ? (
                <motion.span
                  layoutId="thumb-underline"
                  className="absolute inset-x-0 bottom-0 h-0.5 bg-gold"
                />
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
