"use client";

import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ImageIcon,
  Loader2,
  Package,
  Pencil,
  Plus,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fetchJson } from "@/hooks/use-store-data";
import { MediaLibraryPicker } from "@/components/admin/MediaLibraryPicker";
import { useToast } from "@/hooks/use-toast";
import { formatGhs } from "@/lib/format";
import {
  PRODUCT_TYPE_LABELS,
  type AdminProductDTO,
  type AgeGroup,
  type ProductType,
} from "@/lib/types";
import { cn } from "@/lib/utils";

// ---- Form model -------------------------------------------------------------

type GalleryRow = { src: string; label: string };

type FormState = {
  name: string;
  type: ProductType;
  ageGroup: AgeGroup;
  tagline: string;
  price: string;
  badge: string;
  sortOrder: string;
  active: boolean;
  image: string;
  gallery: GalleryRow[];
  colors: { name: string; hex: string }[];
  sizes: string[];
  capStyles: string[];
};

const SIZE_PRESETS = ["S", "M", "L", "XL", "XXL"];
const COLOUR_PRESETS = [
  "#87CEEB", // sky blue
  "#FFFFFF", // white
  "#141414", // black
  "#D4A437", // gold
  "#6B2FA0", // purple
  "#C22B2B", // red
  "#2E7D4F", // green
  "#F26A1B", // orange
];

const EMPTY_FORM: FormState = {
  name: "",
  type: "tshirt",
  ageGroup: "adult",
  tagline: "",
  price: "",
  badge: "",
  sortOrder: "0",
  active: true,
  image: "",
  gallery: [{ src: "", label: "Front" }],
  colors: [{ name: "", hex: COLOUR_PRESETS[0] }],
  sizes: [],
  capStyles: [],
};

function formFromProduct(p: AdminProductDTO): FormState {
  return {
    name: p.name,
    type: p.type,
    ageGroup: p.ageGroup,
    tagline: p.tagline ?? "",
    price: String(p.price),
    badge: p.badge ?? "",
    sortOrder: String(p.sortOrder),
    active: p.active,
    image: p.image,
    // Keep at least one row so the editor never renders an empty list
    gallery: p.gallery.length ? p.gallery.map((g) => ({ ...g })) : [{ src: "", label: "Front" }],
    colors: p.colors.length ? p.colors.map((c) => ({ ...c })) : [{ name: "", hex: COLOUR_PRESETS[0] }],
    sizes: [...p.sizes],
    capStyles: p.capStyles ? p.capStyles.map((style) => style === "Soft" ? "Net" : style) : [],
  };
}

// ---- Small building blocks --------------------------------------------------

function SectionTitle({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="mt-5 first:mt-0">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
        {children}
      </p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground/70">{hint}</p> : null}
    </div>
  );
}

function Thumb({ src, alt, className }: { src: string; alt: string; className?: string }) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-secondary",
        className
      )}
    >
      {src ? (
        <img src={src} alt={alt} className="h-full w-full object-cover" />
      ) : (
        <Package className="h-4 w-4 text-muted-foreground" aria-hidden />
      )}
    </span>
  );
}

// ---- Main component ----------------------------------------------------------

export function AdminProducts({ token }: { token: string }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // ---- Catalogue data ----
  const { data: products, isLoading } = useQuery({
    queryKey: ["admin-products", token],
    queryFn: () =>
      fetchJson<{ products: AdminProductDTO[] }>("/api/admin/products", {
        headers: { "x-admin-token": token },
      }).then((r) => r.products),
    enabled: !!token,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-products"] });
    // The storefront catalogue — keeps the shop in sync without a reload
    queryClient.invalidateQueries({ queryKey: ["products"] });
  };

  // ---- Dialog state ----
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AdminProductDTO | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<AdminProductDTO | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setFormOpen(true);
  };

  const openEdit = (p: AdminProductDTO) => {
    setEditing(p);
    setForm(formFromProduct(p));
    setFormOpen(true);
  };

  // ---- Save (create or update) ----
  const save = async () => {
    const price = Number.parseFloat(form.price);
    const validColors = form.colors.filter((c) => c.name.trim() && c.hex);
    const gallery = form.gallery
      .map((g, i) => ({ src: g.src.trim(), label: g.label.trim() || `View ${i + 1}` }))
      .filter((g) => g.src);

    if (!form.name.trim()) {
      toast({ title: "Name required", description: "Give the product a name." });
      return;
    }
    if (!Number.isFinite(price) || price <= 0) {
      toast({ title: "Price required", description: "Enter a price in ₵, e.g. 80." });
      return;
    }
    if (!form.image.trim()) {
      toast({ title: "Main image required", description: "Upload an image or paste its path." });
      return;
    }
    if (!validColors.length) {
      toast({ title: "Colour required", description: "Add at least one colour with a name." });
      return;
    }
    if (!form.sizes.length) {
      toast({ title: "Size required", description: "Add at least one size option." });
      return;
    }

    const payload = {
      type: form.type,
      ageGroup: form.ageGroup,
      name: form.name.trim(),
      tagline: form.tagline.trim() || null,
      price,
      image: form.image.trim(),
      gallery,
      colors: validColors,
      sizes: form.sizes,
      capStyles: form.type === "cap" ? form.capStyles : null,
      badge: form.badge.trim() || null,
      active: form.active,
      ...(editing ? { sortOrder: Number.parseInt(form.sortOrder, 10) || 0 } : {}),
    };

    setSaving(true);
    try {
      await fetchJson(editing ? `/api/admin/products/${editing.id}` : "/api/admin/products", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json", "x-admin-token": token },
        body: JSON.stringify(payload),
      });
      toast({
        title: editing ? "Product updated" : "Product added",
        description: `${payload.name} is now ${payload.active ? "live" : "hidden"} in the store.`,
      });
      invalidate();
      setFormOpen(false);
    } catch (err) {
      toast({
        title: "Save failed",
        description: err instanceof Error ? err.message : "Please try again.",
      });
    } finally {
      setSaving(false);
    }
  };

  // ---- Inline active toggle ----
  const toggleActive = async (p: AdminProductDTO, active: boolean) => {
    setBusyId(p.id);
    try {
      await fetchJson(`/api/admin/products/${p.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-admin-token": token },
        body: JSON.stringify({ active }),
      });
      toast({ title: active ? `${p.name} is live` : `${p.name} hidden`, description: active ? "Shoppers can see it again." : "It no longer appears in the store." });
      invalidate();
    } catch (err) {
      toast({
        title: "Update failed",
        description: err instanceof Error ? err.message : "Please try again.",
      });
    } finally {
      setBusyId(null);
    }
  };

  // ---- Delete ----
  const confirmDelete = async () => {
    if (!deleting) return;
    setBusyId(deleting.id);
    try {
      await fetchJson(`/api/admin/products/${deleting.id}`, {
        method: "DELETE",
        headers: { "x-admin-token": token },
      });
      toast({ title: "Product deleted", description: `${deleting.name} has been removed.` });
      invalidate();
    } catch (err) {
      toast({
        title: "Delete failed",
        description: err instanceof Error ? err.message : "Please try again.",
      });
    } finally {
      setBusyId(null);
      setDeleting(null);
    }
  };

  // ---- Image upload (single hidden input, target tracked in state) ----
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadTarget, setUploadTarget] = useState<
    { kind: "main" } | { kind: "gallery"; index: number } | null
  >(null);
  const [uploading, setUploading] = useState(false);
  const [mediaTarget, setMediaTarget] = useState<
    { kind: "main" } | { kind: "gallery"; index: number } | null
  >(null);

  const chooseMedia = (path: string) => {
    if (mediaTarget?.kind === "main") {
      set("image", path);
    } else if (mediaTarget?.kind === "gallery") {
      setForm((current) => ({
        ...current,
        gallery: current.gallery.map((image, index) =>
          index === mediaTarget.index ? { ...image, src: path } : image
        ),
      }));
    }
    setMediaTarget(null);
  };

  const startUpload = (target: { kind: "main" } | { kind: "gallery"; index: number }) => {
    setUploadTarget(target);
    fileRef.current?.click();
  };

  const onFilePicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !uploadTarget) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetchJson<{ path: string }>("/api/admin/upload", {
        method: "POST",
        headers: { "x-admin-token": token },
        body: fd,
      });
      if (uploadTarget.kind === "main") {
        set("image", res.path);
      } else {
        setForm((f) => ({
          ...f,
          gallery: f.gallery.map((g, i) =>
            i === uploadTarget.index ? { ...g, src: res.path } : g
          ),
        }));
      }
      toast({ title: "Image uploaded", description: res.path });
    } catch (err) {
      toast({
        title: "Upload failed",
        description: err instanceof Error ? err.message : "Please try again.",
      });
    } finally {
      setUploading(false);
      setUploadTarget(null);
    }
  };

  return (
    <section aria-label="Product catalogue management">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold">Product catalogue</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Add products, set prices, colours, sizes and photos.
          </p>
        </div>
        <Button
          onClick={openCreate}
          className="rounded-full bg-gradient-to-r from-gold to-gold-deep font-bold text-primary-foreground"
        >
          <Plus className="mr-1.5 h-4 w-4" aria-hidden />
          Add product
        </Button>
      </div>

      {/* List */}
      <div className="mt-4 space-y-2.5">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-card py-12 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            Loading catalogue…
          </div>
        ) : !products?.length ? (
          <div className="rounded-xl border border-dashed border-border bg-card py-12 text-center text-muted-foreground">
            <Package className="mx-auto mb-2 h-6 w-6 opacity-60" aria-hidden />
            No products yet — add your first one.
          </div>
        ) : (
          products.map((p) => (
            <article
              key={p.id}
              className={cn(
                "flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3 sm:p-4",
                !p.active && "opacity-60"
              )}
            >
              <Thumb src={p.image} alt="" className="h-14 w-14" />
              <div className="min-w-[9rem] flex-1 basis-48">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <h3 className="font-semibold leading-tight">{p.name}</h3>
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-[0.62rem] font-bold uppercase tracking-wide text-muted-foreground">
                    {PRODUCT_TYPE_LABELS[p.type]}
                  </span>
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-[0.62rem] font-bold uppercase tracking-wide text-muted-foreground">
                    {p.ageGroup === "kid" ? "Kids" : "Adults"}
                  </span>
                  {!p.active ? (
                    <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-[0.62rem] font-bold uppercase tracking-wide text-destructive">
                      Hidden
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {p.colors.length} colour{p.colors.length === 1 ? "" : "s"} · sizes{" "}
                  {p.sizes.join(", ") || "—"}
                  {p.type === "cap" && p.capStyles ? ` · ${p.capStyles.join(" / ")}` : ""}
                </p>
              </div>
              <p className="font-display text-base font-bold text-gold">{formatGhs(p.price)}</p>
              <div className="flex items-center gap-2 sm:gap-3">
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="sr-only sm:not-sr-only">Live</span>
                  {busyId === p.id ? (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden />
                  ) : (
                    <Switch
                      checked={p.active}
                      onCheckedChange={(v) => toggleActive(p, v)}
                      aria-label={`${p.active ? "Hide" : "Show"} ${p.name}`}
                    />
                  )}
                </label>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                  onClick={() => openEdit(p)}
                >
                  <Pencil className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setDeleting(p)}
                >
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                  <span className="sr-only sm:not-sr-only">Delete</span>
                </Button>
              </div>
            </article>
          ))
        )}
      </div>

      {/* Hidden file input driving the upload buttons */}
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={onFilePicked}
        aria-hidden
        tabIndex={-1}
      />

      <MediaLibraryPicker
        open={mediaTarget !== null}
        onOpenChange={(open) => { if (!open) setMediaTarget(null); }}
        onSelect={chooseMedia}
        token={token}
        title={mediaTarget?.kind === "gallery" ? "Choose a gallery image" : "Choose a product image"}
      />

      {/* Add / Edit dialog */}
      <Dialog open={formOpen} onOpenChange={(open) => !open && setFormOpen(false)}>
        <DialogContent className="flex max-h-[92dvh] flex-col overflow-hidden p-0 sm:max-w-2xl">
          <DialogHeader className="border-b border-border px-5 py-4">
            <DialogTitle className="font-display">
              {editing ? `Edit ${editing.name}` : "New product"}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? "Update the price, variants or photos — the store updates instantly."
                : "Fill in the basics, add photos, colours and sizes, then save."}
            </DialogDescription>
          </DialogHeader>

          <div className="pretty-scroll flex-1 overflow-y-auto px-5 py-4">
            {/* Basics */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="col-span-2">
                <Label htmlFor="p-name">Name</Label>
                <Input
                  id="p-name"
                  className="mt-1.5"
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  placeholder="e.g. Shiloh Classic Tee"
                  maxLength={80}
                />
              </div>
              <div>
                <Label htmlFor="p-type">Type</Label>
                <Select value={form.type} onValueChange={(v) => set("type", v as ProductType)}>
                  <SelectTrigger id="p-type" className="mt-1.5 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PRODUCT_TYPE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="p-age">Age group</Label>
                <Select value={form.ageGroup} onValueChange={(v) => set("ageGroup", v as AgeGroup)}>
                  <SelectTrigger id="p-age" className="mt-1.5 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="adult">Adults</SelectItem>
                    <SelectItem value="kid">Kids</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="p-price">Price (₵)</Label>
                <Input
                  id="p-price"
                  className="mt-1.5"
                  inputMode="decimal"
                  value={form.price}
                  onChange={(e) => set("price", e.target.value)}
                  placeholder="80"
                />
              </div>
              <div>
                <Label htmlFor="p-badge">Badge (optional)</Label>
                <Input
                  id="p-badge"
                  className="mt-1.5"
                  value={form.badge}
                  onChange={(e) => set("badge", e.target.value)}
                  placeholder="Best Seller"
                  maxLength={24}
                />
              </div>
              <div>
                <Label htmlFor="p-order">Sort order</Label>
                <Input
                  id="p-order"
                  className="mt-1.5"
                  inputMode="numeric"
                  value={form.sortOrder}
                  onChange={(e) => set("sortOrder", e.target.value)}
                  placeholder="0"
                />
              </div>
              <div className="flex items-end gap-2 pb-1">
                <Switch
                  id="p-active"
                  checked={form.active}
                  onCheckedChange={(v) => set("active", v)}
                />
                <Label htmlFor="p-active" className="cursor-pointer text-sm">
                  Live in store
                </Label>
              </div>
            </div>
            <div className="mt-3">
              <Label htmlFor="p-tagline">Short description (optional)</Label>
              <Input
                id="p-tagline"
                className="mt-1.5"
                value={form.tagline}
                onChange={(e) => set("tagline", e.target.value)}
                placeholder="Heavyweight cotton tee with the Shiloh 2026 gold crest"
                maxLength={200}
              />
            </div>

            {/* Main image */}
            <SectionTitle hint="Choose a picture already on the website, upload a new one, or enter its path.">
              Main image
            </SectionTitle>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Thumb src={form.image} alt="Main image preview" className="h-16 w-16" />
              <Input
                className="min-w-[160px] flex-1"
                value={form.image}
                onChange={(e) => set("image", e.target.value)}
                placeholder="/products/adult-tshirt.jpg"
                aria-label="Main image path"
              />
              <Button
                type="button"
                variant="outline"
                className="shrink-0 rounded-full"
                onClick={() => setMediaTarget({ kind: "main" })}
              >
                <ImageIcon className="mr-1.5 h-4 w-4" aria-hidden />
                Browse library
              </Button>
              <Button
                type="button"
                variant="outline"
                className="shrink-0 rounded-full"
                disabled={uploading}
                onClick={() => startUpload({ kind: "main" })}
              >
                {uploading ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Upload className="mr-1.5 h-4 w-4" aria-hidden />
                )}
                Upload
              </Button>
            </div>

            {/* Gallery views */}
            <SectionTitle hint="Extra angles shown in the product modal — Front, Side, Back, Detail.">
              Gallery views (optional)
            </SectionTitle>
            <div className="mt-2 space-y-2">
              {form.gallery.map((g, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Thumb src={g.src} alt="" className="h-10 w-10" />
                  <Input
                    className="flex-1"
                    value={g.src}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        gallery: f.gallery.map((row, ri) =>
                          ri === i ? { ...row, src: e.target.value } : row
                        ),
                      }))
                    }
                    placeholder="/products/adult-tshirt-back.jpg"
                    aria-label={`Gallery image ${i + 1} path`}
                  />
                  <Input
                    className="w-24 shrink-0 sm:w-28"
                    value={g.label}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        gallery: f.gallery.map((row, ri) =>
                          ri === i ? { ...row, label: e.target.value } : row
                        ),
                      }))
                    }
                    placeholder="Front"
                    maxLength={40}
                    aria-label={`Gallery image ${i + 1} label`}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0 rounded-full"
                    onClick={() => setMediaTarget({ kind: "gallery", index: i })}
                    aria-label={"Choose gallery image " + (i + 1) + " from website library"}
                    title="Browse website images"
                  >
                    <ImageIcon className="h-3.5 w-3.5" aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0 rounded-full"
                    disabled={uploading}
                    onClick={() => startUpload({ kind: "gallery", index: i })}
                  >
                    <Upload className="h-3.5 w-3.5" aria-hidden />
                    <span className="sr-only">Upload gallery image {i + 1}</span>
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="shrink-0 rounded-full text-muted-foreground"
                    onClick={() =>
                      setForm((f) => ({ ...f, gallery: f.gallery.filter((_, ri) => ri !== i) }))
                    }
                    disabled={form.gallery.length <= 1}
                    aria-label={`Remove gallery image ${i + 1}`}
                  >
                    <X className="h-4 w-4" aria-hidden />
                  </Button>
                </div>
              ))}
              {form.gallery.length < 8 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="rounded-full text-muted-foreground"
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      gallery: [...f.gallery, { src: "", label: `View ${f.gallery.length + 1}` }],
                    }))
                  }
                >
                  <Plus className="mr-1.5 h-4 w-4" aria-hidden />
                  Add view
                </Button>
              ) : null}
            </div>

            {/* Colours */}
            <SectionTitle hint="Shoppers tap a swatch to pick a colour.">
              Colours ({form.colors.length})
            </SectionTitle>
            <div className="mt-2 space-y-2">
              {form.colors.map((c, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="color"
                    value={c.hex}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        colors: f.colors.map((row, ri) =>
                          ri === i ? { ...row, hex: e.target.value } : row
                        ),
                      }))
                    }
                    className="h-9 w-10 shrink-0 cursor-pointer rounded-lg border border-border bg-secondary p-0.5"
                    aria-label={`Colour ${i + 1} swatch picker`}
                  />
                  <Input
                    className="flex-1"
                    value={c.name}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        colors: f.colors.map((row, ri) =>
                          ri === i ? { ...row, name: e.target.value } : row
                        ),
                      }))
                    }
                    placeholder="e.g. Sky Blue"
                    maxLength={40}
                    aria-label={`Colour ${i + 1} name`}
                  />
                  <span
                    className="w-16 shrink-0 truncate text-right font-mono text-xs text-muted-foreground"
                    aria-hidden
                  >
                    {c.hex}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="shrink-0 rounded-full text-muted-foreground"
                    onClick={() =>
                      setForm((f) => ({ ...f, colors: f.colors.filter((_, ri) => ri !== i) }))
                    }
                    disabled={form.colors.length <= 1}
                    aria-label={`Remove colour ${i + 1}`}
                  >
                    <X className="h-4 w-4" aria-hidden />
                  </Button>
                </div>
              ))}
              {form.colors.length < 12 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="rounded-full text-muted-foreground"
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      colors: [
                        ...f.colors,
                        { name: "", hex: COLOUR_PRESETS[f.colors.length % COLOUR_PRESETS.length] },
                      ],
                    }))
                  }
                >
                  <Plus className="mr-1.5 h-4 w-4" aria-hidden />
                  Add colour
                </Button>
              ) : null}
            </div>

            {/* Sizes */}
            <SectionTitle hint="Add sizes one by one, or tap a preset.">
              Sizes ({form.sizes.length})
            </SectionTitle>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {form.sizes.map((s) => (
                <span
                  key={s}
                  className="flex items-center gap-1 rounded-lg border border-border bg-secondary px-2.5 py-1 text-sm font-semibold"
                >
                  {s}
                  <button
                    type="button"
                    onClick={() => set("sizes", form.sizes.filter((x) => x !== s))}
                    className="text-muted-foreground hover:text-destructive"
                    aria-label={`Remove size ${s}`}
                  >
                    <X className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </span>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Input
                className="w-24"
                placeholder="e.g. XL"
                maxLength={12}
                aria-label="Add a size — press Enter"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const v = e.currentTarget.value.trim();
                    if (v && !form.sizes.includes(v)) set("sizes", [...form.sizes, v]);
                    e.currentTarget.value = "";
                  }
                }}
              />
              {SIZE_PRESETS.filter((s) => !form.sizes.includes(s)).map((s) => (
                <Button
                  key={s}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                  onClick={() => set("sizes", [...form.sizes, s])}
                >
                  <Plus className="mr-1 h-3 w-3" aria-hidden />
                  {s}
                </Button>
              ))}
            </div>

            {/* Cap styles */}
            {form.type === "cap" ? (
              <>
                <SectionTitle hint="Offer Hard cap and/or Net cap options.">
                  Cap styles ({form.capStyles.length})
                </SectionTitle>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {form.capStyles.map((s) => (
                    <span
                      key={s}
                      className="flex items-center gap-1 rounded-lg border border-border bg-secondary px-2.5 py-1 text-sm font-semibold"
                    >
                      {s}
                      <button
                        type="button"
                        onClick={() => set("capStyles", form.capStyles.filter((x) => x !== s))}
                        className="text-muted-foreground hover:text-destructive"
                        aria-label={`Remove cap style ${s}`}
                      >
                        <X className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    </span>
                  ))}
                  {["Hard", "Net"]
                    .filter((s) => !form.capStyles.includes(s))
                    .map((s) => (
                      <Button
                        key={s}
                        type="button"
                        variant="outline"
                        size="sm"
                        className="rounded-full"
                        onClick={() => set("capStyles", [...form.capStyles, s])}
                      >
                        <Plus className="mr-1 h-3 w-3" aria-hidden />
                        {s}
                      </Button>
                    ))}
                </div>
              </>
            ) : null}
          </div>

          {/* Sticky dialog footer */}
          <div className="border-t border-border px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="ghost"
                className="rounded-full"
                onClick={() => setFormOpen(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                onClick={save}
                disabled={saving}
                className="min-w-32 rounded-full bg-gradient-to-r from-gold to-gold-deep font-bold text-primary-foreground"
              >
                {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden /> : null}
                {editing ? "Save changes" : "Add product"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{deleting?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the product from the catalogue. If it appears in past
              orders you&apos;ll be asked to hide it instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-full bg-destructive text-white hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                confirmDelete();
              }}
            >
              {busyId && deleting ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden />
              ) : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
