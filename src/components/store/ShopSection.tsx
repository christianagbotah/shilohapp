"use client";

import { useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { Plus, RefreshCcw, Shirt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useProducts, useStoreInfo } from "@/hooks/use-store-data";
import { useUi } from "@/store/ui";
import { formatGhs } from "@/lib/format";
import { PRODUCT_TYPE_LABELS, STORE_INFO_DEFAULTS, type ProductDTO } from "@/lib/types";
import { DEFAULT_SITE_CONTENT, hydrate } from "@/lib/site-content";
import { cn } from "@/lib/utils";

type Filter = "all" | "tshirt" | "lacoste" | "jersey" | "cap" | "adult" | "kid";

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: "all", label: "All" },
  { id: "tshirt", label: "T-Shirts" },
  { id: "lacoste", label: "Lacostes" },
  { id: "jersey", label: "Jerseys" },
  { id: "cap", label: "Caps" },
  { id: "adult", label: "Adults" },
  { id: "kid", label: "Kids" },
];

function matches(p: ProductDTO, filter: Filter): boolean {
  if (filter === "all") return true;
  if (filter === "adult" || filter === "kid") return p.ageGroup === filter;
  return p.type === filter;
}

function ProductCard({ product, index }: { product: ProductDTO; index: number }) {
  const openProduct = useUi((s) => s.openProduct);
  return (
    <motion.article
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.45, delay: Math.min(index * 0.05, 0.3), ease: "easeOut" }}
      className="card-hover group cursor-pointer overflow-hidden rounded-2xl border border-border bg-card focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
      onClick={() => openProduct(product)}
      role="button"
      tabIndex={0}
      aria-label={`View ${product.name}, ${formatGhs(product.price)}`}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openProduct(product);
        }
      }}
    >
      <div className="relative aspect-square overflow-hidden bg-secondary">
        <Image
          src={product.image}
          unoptimized={product.image.startsWith("/products/")}
          alt={`${product.name} — ${PRODUCT_TYPE_LABELS[product.type]} for ${product.ageGroup === "kid" ? "kids" : "adults"}`}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
        {product.badge ? (
          <span className="absolute left-2.5 top-2.5 rounded-full bg-gold px-2.5 py-1 text-[0.62rem] font-bold uppercase tracking-wider text-primary-foreground shadow-lg">
            {product.badge}
          </span>
        ) : null}
        <span className="absolute right-2.5 top-2.5 rounded-full bg-background/80 px-2.5 py-1 text-[0.62rem] font-semibold uppercase tracking-wider text-foreground backdrop-blur">
          {product.ageGroup === "kid" ? "Kids" : "Adult"}
        </span>
      </div>
      <div className="flex flex-col gap-2 p-3.5 sm:p-4">
        <div>
          <h3 className="font-display text-sm font-bold leading-tight sm:text-base">{product.name}</h3>
          {product.tagline ? (
            <p className="mt-1 line-clamp-2 text-xs leading-snug text-muted-foreground">{product.tagline}</p>
          ) : null}
        </div>
        <div
          className="flex items-center gap-1.5"
          aria-label={`Available colours: ${product.colors.map((c) => c.name).join(", ")}`}
        >
          {product.colors.slice(0, 5).map((c) => (
            <span
              key={c.name}
              title={c.name}
              className="h-3.5 w-3.5 rounded-full border border-white/25 shadow-sm"
              style={{ backgroundColor: c.hex }}
            />
          ))}
          {product.colors.length > 5 ? (
            <span className="text-[0.65rem] font-medium text-muted-foreground">
              +{product.colors.length - 5}
            </span>
          ) : null}
        </div>
        <div className="mt-auto flex items-center justify-between gap-2 pt-1">
          <p className="font-display text-base font-bold text-gold sm:text-lg">{formatGhs(product.price)}</p>
          <Button
            size="sm"
            aria-label={`Select options for ${product.name}`}
            className="h-9 rounded-full bg-gradient-to-r from-gold to-gold-deep px-3.5 font-bold text-primary-foreground shadow-[0_8px_20px_-8px_var(--gold)] hover:opacity-95"
          >
            <Plus className="h-4 w-4" aria-hidden />
            <span className="hidden sm:inline">Select</span>
          </Button>
        </div>
      </div>
    </motion.article>
  );
}

function CardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <Skeleton className="aspect-square rounded-none" />
      <div className="space-y-3 p-4">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
        <div className="flex items-center justify-between pt-1">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-9 w-20 rounded-full" />
        </div>
      </div>
    </div>
  );
}

export function ShopSection() {
  const [filter, setFilter] = useState<Filter>("all");
  const { data: products, isLoading, isError, refetch } = useProducts();
  const { data: info } = useStoreInfo();
  const year = info?.shilohYear ?? STORE_INFO_DEFAULTS.shilohYear;
  const c = info?.content?.shop ?? DEFAULT_SITE_CONTENT.shop;

  return (
    <section id="shop" className="mx-auto w-full max-w-6xl scroll-mt-24 px-4 py-14 sm:px-6 sm:py-20">
      <div className="mb-8 flex flex-col gap-4 sm:mb-10">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-gold">{c.eyebrow}</p>
          <h2 className="mt-2 font-display text-3xl font-bold uppercase tracking-tight sm:text-4xl">
            {c.title}
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            {hydrate(c.subtitle, { year, dates: info?.shilohDates ?? STORE_INFO_DEFAULTS.shilohDates, tagline: info?.shilohTagline ?? STORE_INFO_DEFAULTS.shilohTagline })}
          </p>
        </div>
        <div className="relative">
          <div
            className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0"
            role="group"
            aria-label="Filter products"
          >
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                aria-pressed={filter === f.id}
                className={cn(
                  "whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium transition-all",
                  filter === f.id
                    ? "border-gold/60 bg-gold font-bold text-primary-foreground shadow-[0_8px_20px_-10px_var(--gold)]"
                    : "border-border bg-secondary text-muted-foreground hover:border-gold/30 hover:text-foreground"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div
            className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-background to-transparent sm:hidden"
            aria-hidden
          />
        </div>
      </div>

      {isError ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border py-16 text-center">
          <Shirt className="h-10 w-10 text-muted-foreground" aria-hidden />
          <p className="text-sm text-muted-foreground">Could not load the collection. Please try again.</p>
          <Button onClick={() => refetch()} variant="outline" className="rounded-full">
            <RefreshCcw className="mr-2 h-4 w-4" aria-hidden /> Retry
          </Button>
        </div>
      ) : isLoading || !products ? (
        <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : (
        <>
          <p className="sr-only" aria-live="polite">
            {products.filter((p) => matches(p, filter)).length} products shown
          </p>
          <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
            {products
              .filter((p) => matches(p, filter))
              .map((p, i) => (
                <ProductCard key={p.id} product={p} index={i} />
              ))}
          </div>
        </>
      )}
    </section>
  );
}