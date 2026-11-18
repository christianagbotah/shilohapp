"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronLeft, ChevronRight, Plus, Sparkles } from "lucide-react";
import { useProducts, useStoreInfo } from "@/hooks/use-store-data";
import { useUi } from "@/store/ui";
import { formatGhs } from "@/lib/format";
import { PRODUCT_TYPE_LABELS, type AgeGroup, type ProductDTO, type ProductType } from "@/lib/types";
import { DEFAULT_SITE_CONTENT } from "@/lib/site-content";
import { cn } from "@/lib/utils";

type Hotspot = {
  /** Which catalog product this pin opens */
  type: ProductType;
  ageGroup: AgeGroup;
  /** Pin position, % of the frame */
  x: number;
  y: number;
  /** Short caption shown in the tooltip */
  caption: string;
};

type Slide = {
  image: string;
  title: string;
  description: string;
  hotspots: Hotspot[];
};

/** Hotspot pins stay tied to catalog product types (set at build time) —
 *  admin editing covers each slide's image, title and description. */
const SLIDE_HOTSPOTS: Hotspot[][] = [
  [{ type: "tshirt", ageGroup: "adult", x: 30, y: 38, caption: "The Classic Tee" }],
  [
    { type: "tshirt", ageGroup: "adult", x: 26, y: 32, caption: "Classic Tee" },
    { type: "tshirt", ageGroup: "kid", x: 40, y: 78, caption: "Kids Tee" },
  ],
  [
    { type: "cap", ageGroup: "adult", x: 48, y: 62, caption: "Shiloh Cap" },
    { type: "cap", ageGroup: "kid", x: 83, y: 22, caption: "Kids Cap" },
  ],
  [
    { type: "lacoste", ageGroup: "adult", x: 50, y: 66, caption: "Shiloh Lacoste" },
    { type: "cap", ageGroup: "adult", x: 57, y: 28, caption: "Shiloh Cap" },
  ],
];

const AUTOPLAY_MS = 6000;

function HotspotPin({
  hotspot,
  product,
  onOpen,
}: {
  hotspot: Hotspot;
  product: ProductDTO | undefined;
  onOpen: (p: ProductDTO) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="group absolute z-20"
      style={{ left: `${hotspot.x}%`, top: `${hotspot.y}%` }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-label={`${hotspot.caption} — view product`}
        onClick={() => product && onOpen(product)}
        className="relative flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-gold/70 bg-background/85 text-gold shadow-[0_6px_20px_-6px_rgba(0,0,0,0.8)] backdrop-blur transition-transform duration-300 hover:scale-110 hover:bg-gold hover:text-primary-foreground"
      >
        <span
          className="absolute inset-0 animate-ping rounded-full border border-gold/60"
          style={{ animationDuration: "2.4s" }}
          aria-hidden
        />
        <Plus className="h-4 w-4" aria-hidden />
      </button>

      <AnimatePresence>
        {open && product ? (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.94 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="pointer-events-none absolute left-1/2 top-full z-30 w-44 -translate-x-1/2 rounded-xl border border-gold/30 bg-card/95 p-3 text-left shadow-2xl backdrop-blur"
          >
            <p className="text-[0.6rem] font-bold uppercase tracking-[0.18em] text-gold">
              {PRODUCT_TYPE_LABELS[product.type]} • {product.ageGroup === "kid" ? "Kids" : "Adult"}
            </p>
            <p className="mt-0.5 text-sm font-bold leading-tight text-foreground">{product.name}</p>
            <p className="mt-1 font-display text-base font-bold text-gold">
              {formatGhs(product.price)}
            </p>
            <p className="mt-1 text-[0.62rem] font-medium uppercase tracking-wider text-muted-foreground">
              Tap to shop
            </p>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

/**
 * motionsites-inspired "Outfit Carousel": a cinematic lookbook that
 * cross-fades between styled merch shots, with shoppable hotspot pins,
 * arrow controls and an auto-advancing segmented scrubber.
 */
export function OutfitCarousel() {
  const [[index, direction], setState] = useState<[number, number]>([0, 0]);
  const [paused, setPaused] = useState(false);
  const prefersReduced = useReducedMotion();
  const { data: products } = useProducts();
  const { data: info } = useStoreInfo();
  const c = info?.content?.lookbook ?? DEFAULT_SITE_CONTENT.lookbook;
  const openProduct = useUi((s) => s.openProduct);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Slides come from Back Office content; hotspots attach by index.
  const slides = c.slides.map((s, i) => ({
    ...s,
    hotspots: SLIDE_HOTSPOTS[i % SLIDE_HOTSPOTS.length],
  }));

  const go = useCallback((dir: number) => {
    setState(([i]) => [(i + dir + slides.length) % slides.length, dir]);
  }, [slides.length]);

  const jumpTo = useCallback((target: number) => {
    setState(([i]) => [target, target > i ? 1 : -1]);
  }, []);

  // Autoplay with segmented scrubber; pauses on hover/focus.
  useEffect(() => {
    if (paused || prefersReduced) return;
    timer.current = setTimeout(() => go(1), AUTOPLAY_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [index, paused, prefersReduced, go]);

  const slide = slides[index];

  const resolveProduct = useMemo(
    () => (h: Hotspot) => products?.find((p) => p.type === h.type && p.ageGroup === h.ageGroup),
    [products]
  );

  return (
    <section
      id="lookbook"
      aria-roledescription="carousel"
      aria-label="Shiloh lookbook"
      className="relative mx-auto w-full max-w-6xl scroll-mt-24 px-4 py-14 sm:px-6 sm:py-20"
    >
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4 sm:mb-10">
        <div>
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.28em] text-gold">
            <Sparkles className="h-3.5 w-3.5" aria-hidden /> {c.eyebrow}
          </p>
          <h2 className="mt-2 font-display text-3xl font-bold uppercase tracking-tight sm:text-4xl">
            {c.title}
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            {c.subtitle || (
              <>
                Styled straight from the collection — tap a{" "}
                <Plus className="inline h-3 w-3 text-gold" aria-hidden /> pin on any piece to shop it
                instantly.
              </>
            )}
          </p>
        </div>
        <p className="font-display text-sm font-bold tabular-nums tracking-[0.3em] text-muted-foreground">
          {String(index + 1).padStart(2, "0")}
          <span className="mx-1 text-gold">/</span>
          {String(slides.length).padStart(2, "0")}
        </p>
      </div>

      <div
        className="group relative overflow-hidden rounded-3xl border border-gold/25 bg-secondary/40 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.9)]"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocusCapture={() => setPaused(true)}
        onBlurCapture={() => setPaused(false)}
      >
        <div className="relative aspect-[4/3] w-full sm:aspect-[16/10]">
          <AnimatePresence initial={false} custom={direction} mode="popLayout">
            <motion.div
              key={slide.image}
              custom={direction}
              initial={{ opacity: 0, scale: 1.06, x: direction >= 0 ? 60 : -60 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 1.02, x: direction >= 0 ? -50 : 50 }}
              transition={{ duration: 0.6, ease: [0.32, 0.72, 0, 1] }}
              className="absolute inset-0"
            >
              <Image
                src={slide.image}
                alt={`${slide.title} — Shiloh lookbook`}
                fill
                priority={index === 0}
                sizes="(max-width: 640px) 100vw, 1100px"
                className="object-cover"
                draggable={false}
              />
              {/* Subtle cinematic vignette for text legibility */}
              <div
                className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent"
                aria-hidden
              />
            </motion.div>
          </AnimatePresence>

          {/* Shoppable hotspot pins */}
          {slide.hotspots.map((h) => (
            <HotspotPin
              key={`${slide.image}-${h.type}-${h.ageGroup}-${h.caption}`}
              hotspot={h}
              product={resolveProduct(h)}
              onOpen={openProduct}
            />
          ))}

          {/* Arrows */}
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label="Previous look"
            className="absolute left-3 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/45 text-foreground shadow-xl backdrop-blur transition-all duration-300 hover:bg-black/70 sm:left-5"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            aria-label="Next look"
            className="absolute right-3 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/45 text-foreground shadow-xl backdrop-blur transition-all duration-300 hover:bg-black/70 sm:right-5"
          >
            <ChevronRight className="h-5 w-5" aria-hidden />
          </button>

          {/* Caption + scrubber */}
          <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col gap-3 p-4 sm:p-6">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={slide.title}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.32, ease: "easeOut" }}
              >
                <h3 className="font-display text-xl font-bold text-white drop-shadow sm:text-2xl">
                  {slide.title}
                </h3>
                <p className="mt-1 max-w-md text-xs leading-relaxed text-white/80 sm:text-sm">
                  {slide.description}
                </p>
              </motion.div>
            </AnimatePresence>

            {/* Segmented progress scrubber (motionsites style) */}
            <div className="flex items-center gap-2" role="tablist" aria-label="Lookbook slides">
              {slides.map((s, i) => (
                <button
                  key={s.title}
                  type="button"
                  role="tab"
                  aria-selected={i === index}
                  aria-label={`Show ${s.title}`}
                  onClick={() => jumpTo(i)}
                  className="group/seg relative h-1.5 flex-1 overflow-hidden rounded-full bg-white/25"
                >
                  {i < index ? (
                    <span className="absolute inset-0 bg-gold" />
                  ) : i === index ? (
                    <motion.span
                      key={`seg-${index}-${paused}`}
                      initial={{ width: "0%" }}
                      animate={{ width: paused || prefersReduced ? "0%" : "100%" }}
                      transition={{
                        duration: paused || prefersReduced ? 0 : AUTOPLAY_MS / 1000,
                        ease: "linear",
                      }}
                      className="absolute inset-y-0 left-0 bg-gold"
                    />
                  ) : null}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
