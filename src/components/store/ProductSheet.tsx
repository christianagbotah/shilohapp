"use client";

import { useMemo, useState } from "react";
import { Check, Minus, Plus, ShoppingBag } from "lucide-react";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useCart } from "@/store/cart";
import { useUi } from "@/store/ui";
import { formatGhs } from "@/lib/format";
import { PRODUCT_TYPE_LABELS, type ProductDTO } from "@/lib/types";
import { ProductGallery } from "@/components/store/ProductGallery";
import { cn } from "@/lib/utils";

function Options({ product }: { product: ProductDTO }) {
  const closeProduct = useUi((s) => s.closeProduct);
  const setCartOpen = useUi((s) => s.setCartOpen);
  const addItem = useCart((s) => s.addItem);
  const { toast } = useToast();

  const [color, setColor] = useState(product.colors[0]?.name ?? "");
  const [size, setSize] = useState<string | null>(null);
  const [capStyle, setCapStyle] = useState<string | null>(product.capStyles?.[0] ?? null);
  const [quantity, setQuantity] = useState(1);

  const selectedHex = useMemo(
    () => product.colors.find((c) => c.name === color)?.hex ?? "#000",
    [product.colors, color]
  );
  const lineTotal = product.price * quantity;

  const handleAdd = () => {
    if (!color) {
      toast({ title: "Choose a colour", description: "Tap a colour swatch to continue." });
      return;
    }
    if (!size) {
      toast({ title: "Choose a size", description: "Select your size to continue." });
      return;
    }
    if (product.type === "cap" && product.capStyles && !capStyle) {
      toast({ title: "Choose a cap style", description: "Soft or hard?" });
      return;
    }
    addItem(
      {
        productId: product.id,
        name: product.name,
        type: product.type,
        ageGroup: product.ageGroup,
        image: product.image,
        unitPrice: product.price,
        color,
        colorHex: selectedHex,
        size,
        capStyle: product.type === "cap" ? capStyle : null,
      },
      quantity
    );
    toast({
      title: "Added to cart",
      description: `${quantity} × ${product.name} (${color}, ${size}${capStyle ? `, ${capStyle}` : ""})`,
    });
    closeProduct();
    setCartOpen(true);
  };

  return (
    <>
      <div className="pretty-scroll flex-1 overflow-y-auto p-4 sm:p-6">
        {/* Two columns at every breakpoint: gallery (image + thumbs) left,
            description / colour / size right. */}
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] gap-4 sm:gap-5">
      <ProductGallery product={product} tintHex={selectedHex} />

      <div className="flex min-w-0 flex-col">
        <DrawerTitle asChild>
          <h2 className="font-display text-lg font-bold leading-tight sm:text-2xl">{product.name}</h2>
        </DrawerTitle>
        <p className="mt-1 text-sm text-muted-foreground">{product.tagline}</p>
        <p className="mt-2 font-display text-2xl font-bold text-gold">{formatGhs(product.price)}</p>

        {/* Colour */}
        <div className="mt-4 sm:mt-5">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
            Colour <span className="ml-1 normal-case tracking-normal text-foreground">— {color}</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {product.colors.map((c) => (
              <button
                key={c.name}
                type="button"
                onClick={() => setColor(c.name)}
                aria-label={`Colour ${c.name}`}
                aria-pressed={color === c.name}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all",
                  color === c.name
                    ? "border-gold shadow-[0_0_0_3px_var(--gold-25,rgba(212,164,55,0.25))]"
                    : "border-white/15 hover:border-white/40"
                )}
                style={{ backgroundColor: c.hex }}
              >
                {color === c.name ? (
                  <Check className="h-3.5 w-3.5 drop-shadow" style={{ color: "#fff", mixBlendMode: "difference" }} aria-hidden />
                ) : null}
              </button>
            ))}
          </div>
        </div>

        {/* Cap style */}
        {product.type === "cap" && product.capStyles ? (
          <div className="mt-4 sm:mt-5">
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
              Cap style
            </p>
            <div className="grid grid-cols-2 gap-2">
              {product.capStyles.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setCapStyle(s)}
                  aria-pressed={capStyle === s}
                  className={cn(
                    "rounded-xl border px-2.5 py-2 text-left text-sm font-semibold transition-all sm:px-3 sm:py-2.5",
                    capStyle === s
                      ? "border-gold/60 bg-gold/15 text-gold"
                      : "border-border bg-secondary text-muted-foreground hover:text-foreground"
                  )}
                >
                  {s}
                  <span className="mt-0.5 hidden text-[0.68rem] font-normal text-muted-foreground sm:block">
                    {s === "Soft" ? "Relaxed, unstructured crown" : "Structured, crisp crown"}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {/* Size */}
        <div className="mt-4 sm:mt-5">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
            Size {product.type === "cap" ? "" : "— true to fit"}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {product.sizes.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSize(s)}
                aria-pressed={size === s}
                className={cn(
                  "min-w-9 rounded-lg border px-2.5 py-1.5 text-sm font-semibold transition-all",
                  size === s
                    ? "border-gold/60 bg-gold font-bold text-primary-foreground"
                    : "border-border bg-secondary text-muted-foreground hover:text-foreground"
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>
        </div>
      </div>

      {/* Fixed CTA footer — always visible, never overlaps content.
          Counter + button share one row at every breakpoint (same as desktop). */}
      <div className="border-t border-border bg-card px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 sm:px-6">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex shrink-0 items-center rounded-full border border-border bg-secondary p-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              aria-label="Decrease quantity"
            >
              <Minus className="h-4 w-4" aria-hidden />
            </Button>
            <span className="w-8 text-center font-display text-lg font-bold tabular-nums" aria-live="polite">
              {quantity}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full"
              onClick={() => setQuantity((q) => Math.min(99, q + 1))}
              aria-label="Increase quantity"
            >
              <Plus className="h-4 w-4" aria-hidden />
            </Button>
          </div>
          <Button
            onClick={handleAdd}
            className="h-12 min-w-0 flex-1 whitespace-nowrap rounded-full bg-gradient-to-r from-gold to-gold-deep text-sm font-bold text-primary-foreground shadow-[0_12px_32px_-10px_var(--gold)] hover:opacity-95 max-[359px]:text-xs sm:text-base"
          >
            <ShoppingBag className="mr-1.5 h-4 w-4 sm:mr-2 sm:h-4.5 sm:w-4.5" aria-hidden />
            Add to Cart — {formatGhs(lineTotal)}
          </Button>
        </div>
        <p className="mt-2.5 text-center text-xs leading-relaxed text-muted-foreground">
          After placing your order you&apos;ll pay on Hubtel&apos;s secure checkout — MTN MoMo,
          Telecel Cash, AT Money and cards accepted.
        </p>
      </div>
    </>
  );
}

export function ProductSheet() {
  const activeProduct = useUi((s) => s.activeProduct);
  const closeProduct = useUi((s) => s.closeProduct);

  return (
    <Drawer open={!!activeProduct} onOpenChange={(open) => !open && closeProduct()}>
      <DrawerContent className="drawer-wide flex max-h-[96dvh] flex-col border-t border-gold/20 bg-card">
        <div className="mx-auto mb-3 mt-3 h-1 w-10 shrink-0 rounded-full bg-muted-foreground/30" aria-hidden />
        {/* Inner column fills the full width of the wider (44rem) drawer so the
            original two-column layout breathes: gallery left, details right. */}
        {activeProduct ? (
          <div className="mx-auto flex min-h-0 w-full flex-1 flex-col">
            <DrawerDescription className="sr-only">
              {`Select colour, ${activeProduct.type === "cap" ? "style, " : ""}size and quantity for ${activeProduct.name} (${PRODUCT_TYPE_LABELS[activeProduct.type]} for ${activeProduct.ageGroup === "kid" ? "kids" : "adults"})`}
            </DrawerDescription>
            <Options key={activeProduct.id} product={activeProduct} />
          </div>
        ) : null}
      </DrawerContent>
    </Drawer>
  );
}
