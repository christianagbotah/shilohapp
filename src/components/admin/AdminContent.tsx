"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, RotateCcw, Save, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { fetchJson } from "@/hooks/use-store-data";
import { useToast } from "@/hooks/use-toast";
import type { SiteContent } from "@/lib/site-content";
import { prepareSectionForSave, splitCommasForEditing, splitLinesForEditing } from "@/lib/content-editor";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Small building blocks
// ---------------------------------------------------------------------------

function Section({
  title,
  description,
  children,
  onSave,
  saving,
  onReset,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  onSave: () => void;
  saving: boolean;
  onReset?: () => void;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-bold">{title}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        </div>
        <div className="flex items-center gap-2">
          {onReset ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onReset}
              className="rounded-full text-muted-foreground"
              title="Restore this section's saved values"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden />
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            onClick={onSave}
            disabled={saving}
            className="rounded-full bg-gradient-to-r from-gold to-gold-deep font-bold text-primary-foreground hover:opacity-95"
          >
            {saving ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <Save className="mr-1.5 h-3.5 w-3.5" aria-hidden />
            )}
            Save
          </Button>
        </div>
      </div>
      <div className="mt-5 grid gap-4">{children}</div>
    </section>
  );
}

function Field({
  id,
  label,
  hint,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id} className="text-sm font-semibold">
        {label}
      </Label>
      {children}
      {hint ? <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

const inputCls = "h-11 rounded-xl border-border bg-background/60";
const areaCls = "min-h-[88px] rounded-xl border-border bg-background/60";

/** Image picker: preview + upload button (reuses the products uploader). */
function ImageField({
  id,
  label,
  value,
  onChange,
  token,
  aspect = "aspect-[16/10]",
}: {
  id: string;
  label: string;
  value: string;
  onChange: (path: string) => void;
  token: string;
  aspect?: string;
}) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const pick = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetchJson<{ path: string }>("/api/admin/upload", {
        method: "POST",
        headers: { "x-admin-token": token },
        body: fd,
      });
      onChange(res.path);
    } catch (err) {
      toast({
        title: "Upload failed",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Field id={id} label={label} hint="JPG, PNG or WebP up to 4 MB.">
      <div className="flex items-center gap-3">
        <div className={cn("relative w-28 shrink-0 overflow-hidden rounded-lg border border-border bg-secondary", aspect)}>
          <Image src={value || "/images/shiloh-flyer.jpg"} alt="" fill sizes="112px" className="object-cover" />
        </div>
        <input
          ref={fileRef}
          id={id}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) pick(f);
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="rounded-full"
        >
          {uploading ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <Upload className="mr-1.5 h-3.5 w-3.5" aria-hidden />
          )}
          {uploading ? "Uploading…" : "Upload image"}
        </Button>
      </div>
    </Field>
  );
}

const TOKEN_HINT = "Tip: {year}, {dates} and {tagline} are replaced with the live branding values from Settings.";

// ---------------------------------------------------------------------------
// Main editor
// ---------------------------------------------------------------------------

export function AdminContent({ token }: { token: string }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [savingSection, setSavingSection] = useState<string | null>(null);
  const [content, setContent] = useState<SiteContent | null>(null);
  const [saved, setSaved] = useState<SiteContent | null>(null);
  // Store comma-separated input as literal text while typing. Formatting it
  // back to a joined array on every keystroke would reset the cursor.
  const [paymentMethodsDraft, setPaymentMethodsDraft] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchJson<{ content: SiteContent }>("/api/admin/content", {
          headers: { "x-admin-token": token },
        });
        if (!cancelled) {
          setContent(res.content);
          setSaved(res.content);
        }
      } catch {
        if (!cancelled) {
          toast({
            title: "Could not load site content",
            description: "Please refresh the page and try again.",
            variant: "destructive",
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, toast]);

  const patch = <K extends keyof SiteContent>(section: K, value: Partial<SiteContent[K]>) => {
    setContent((c) => (c ? { ...c, [section]: { ...c[section], ...value } } : c));
  };

  const save = async (section: keyof SiteContent) => {
    if (!content) return;
    const original = content[section];
    const data = prepareSectionForSave(section, content);
    const submittedMethodsDraft = paymentMethodsDraft;
    setSavingSection(section);
    try {
      await fetchJson("/api/admin/content", {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-admin-token": token },
        body: JSON.stringify({ section, data }),
      });
      setSaved((s) => ({ ...(s ?? content), [section]: data }));
      // Only replace the editor draft if nothing changed since Save was
      // clicked. Otherwise preserve any typing during the network request.
      setContent((c) => (c && c[section] === original ? { ...c, [section]: data } : c));
      if (section === "payment") {
        setPaymentMethodsDraft((draft) => draft === submittedMethodsDraft ? null : draft);
      }
      await queryClient.invalidateQueries({ queryKey: ["store-info"] });
      toast({ title: "Saved", description: "The storefront updates immediately." });
    } catch (err) {
      toast({
        title: "Could not save",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSavingSection(null);
    }
  };

  const reset = (section: keyof SiteContent) => {
    if (!saved) return;
    setContent((c) => (c ? { ...c, [section]: saved[section] } : c));
    if (section === "payment") setPaymentMethodsDraft(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> Loading site content…
      </div>
    );
  }
  if (!content) return null;

  const h = content.hero;
  const p = content.payment;

  return (
    <div className="grid gap-6">
      <div className="rounded-2xl border border-gold/30 bg-gold/10 p-4 text-xs leading-relaxed text-muted-foreground">
        <span className="font-semibold text-foreground">Every word on the storefront lives here.</span>{" "}
        Edit a section and tap Save — the live site refreshes instantly (hard-refresh if you have it
        open in another tab). {TOKEN_HINT}
      </div>

      {/* Hero */}
      <Section
        title="Hero — top of the page"
        description="Headline intro, buttons, flyer image, badge and trust points."
        saving={savingSection === "hero"}
        onSave={() => save("hero")}
        onReset={() => reset("hero")}
      >
        <Field id="hero-intro" label="Intro paragraph" hint={TOKEN_HINT}>
          <Textarea
            id="hero-intro"
            className={areaCls}
            value={h.intro}
            onChange={(e) => patch("hero", { intro: e.target.value })}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="hero-cta1" label="Primary button">
            <Input id="hero-cta1" className={inputCls} value={h.ctaPrimary} onChange={(e) => patch("hero", { ctaPrimary: e.target.value })} />
          </Field>
          <Field id="hero-cta2" label="Secondary button">
            <Input id="hero-cta2" className={inputCls} value={h.ctaSecondary} onChange={(e) => patch("hero", { ctaSecondary: e.target.value })} />
          </Field>
        </div>
        <ImageField
          id="hero-flyer"
          label="Flyer image"
          value={h.flyerImage}
          onChange={(flyerImage) => patch("hero", { flyerImage })}
          token={token}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="hero-badge-t" label="Floating badge — title">
            <Input id="hero-badge-t" className={inputCls} value={h.badgeTitle} onChange={(e) => patch("hero", { badgeTitle: e.target.value })} />
          </Field>
          <Field id="hero-badge-s" label="Floating badge — subtitle">
            <Input id="hero-badge-s" className={inputCls} value={h.badgeSubtitle} onChange={(e) => patch("hero", { badgeSubtitle: e.target.value })} />
          </Field>
        </div>
        <Field id="hero-trust" label="Trust points" hint="One per line (3 recommended — icons are assigned automatically).">
          <Textarea
            id="hero-trust"
            className={areaCls}
            value={h.trust.join("\n")}
            onChange={(e) => patch("hero", { trust: splitLinesForEditing(e.target.value) })}
          />
        </Field>
      </Section>

      {/* Marquee */}
      <Section
        title="Gold marquee strip"
        description="The scrolling phrases under the hero (year, dates and tagline are always included first)."
        saving={savingSection === "marquee"}
        onSave={() => save("marquee")}
        onReset={() => reset("marquee")}
      >
        <Field id="marquee-items" label="Extra phrases" hint="One per line.">
          <Textarea
            id="marquee-items"
            className={areaCls}
            value={content.marquee.extras.join("\n")}
            onChange={(e) => patch("marquee", { extras: splitLinesForEditing(e.target.value) })}
          />
        </Field>
      </Section>

      {/* Shop heading */}
      <Section
        title="Shop section heading"
        description="The title block above the product grid and filters."
        saving={savingSection === "shop"}
        onSave={() => save("shop")}
        onReset={() => reset("shop")}
      >
        <Field id="shop-eyebrow" label="Eyebrow (small gold label)">
          <Input id="shop-eyebrow" className={inputCls} value={content.shop.eyebrow} onChange={(e) => patch("shop", { eyebrow: e.target.value })} />
        </Field>
        <Field id="shop-title" label="Title">
          <Input id="shop-title" className={inputCls} value={content.shop.title} onChange={(e) => patch("shop", { title: e.target.value })} />
        </Field>
        <Field id="shop-sub" label="Subtitle" hint={TOKEN_HINT}>
          <Textarea id="shop-sub" className={areaCls} value={content.shop.subtitle} onChange={(e) => patch("shop", { subtitle: e.target.value })} />
        </Field>
      </Section>

      {/* How to Order */}
      <Section
        title="How to Order"
        description="Section heading and the three step cards."
        saving={savingSection === "how"}
        onSave={() => save("how")}
        onReset={() => reset("how")}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="how-eyebrow" label="Eyebrow">
            <Input id="how-eyebrow" className={inputCls} value={content.how.eyebrow} onChange={(e) => patch("how", { eyebrow: e.target.value })} />
          </Field>
          <Field id="how-title" label="Title">
            <Input id="how-title" className={inputCls} value={content.how.title} onChange={(e) => patch("how", { title: e.target.value })} />
          </Field>
        </div>
        <Field id="how-sub" label="Subtitle">
          <Textarea id="how-sub" className={areaCls} value={content.how.subtitle} onChange={(e) => patch("how", { subtitle: e.target.value })} />
        </Field>
        {content.how.steps.map((s, i) => (
          <div key={i} className="rounded-xl border border-border bg-background/40 p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-bold uppercase tracking-wider text-gold">Step {i + 1}</p>
              {content.how.steps.length > 1 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 rounded-full px-2 text-muted-foreground hover:text-destructive"
                  onClick={() =>
                    patch("how", { steps: content.how.steps.filter((_, j) => j !== i) })
                  }
                  aria-label={`Remove step ${i + 1}`}
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                </Button>
              ) : null}
            </div>
            <div className="mt-3 grid gap-3">
              <Input
                aria-label={`Step ${i + 1} title`}
                className={inputCls}
                placeholder="Step title"
                value={s.title}
                onChange={(e) =>
                  patch("how", { steps: content.how.steps.map((st, j) => (j === i ? { ...st, title: e.target.value } : st)) })
                }
              />
              <Textarea
                aria-label={`Step ${i + 1} body`}
                className={areaCls}
                placeholder="Step description"
                value={s.body}
                onChange={(e) =>
                  patch("how", { steps: content.how.steps.map((st, j) => (j === i ? { ...st, body: e.target.value } : st)) })
                }
              />
            </div>
          </div>
        ))}
        {content.how.steps.length < 6 ? (
          <Button
            type="button"
            variant="outline"
            className="rounded-full"
            onClick={() => patch("how", { steps: [...content.how.steps, { title: "", body: "" }] })}
          >
            <Plus className="mr-1.5 h-4 w-4" aria-hidden /> Add step
          </Button>
        ) : null}
      </Section>

      {/* Payment */}
      <Section
        title="Payment section"
        description="Heading, feature cards, the numbered checkout steps and accepted methods."
        saving={savingSection === "payment"}
        onSave={() => save("payment")}
        onReset={() => reset("payment")}
      >
        <Field id="pay-eyebrow" label="Eyebrow">
          <Input id="pay-eyebrow" className={inputCls} value={p.eyebrow} onChange={(e) => patch("payment", { eyebrow: e.target.value })} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="pay-title" label="Title (first part)">
            <Input id="pay-title" className={inputCls} value={p.title} onChange={(e) => patch("payment", { title: e.target.value })} />
          </Field>
          <Field id="pay-accent" label="Title (gold accent part)">
            <Input id="pay-accent" className={inputCls} value={p.titleAccent} onChange={(e) => patch("payment", { titleAccent: e.target.value })} />
          </Field>
        </div>
        <Field id="pay-sub" label="Subtitle">
          <Textarea id="pay-sub" className={areaCls} value={p.subtitle} onChange={(e) => patch("payment", { subtitle: e.target.value })} />
        </Field>
        {p.features.map((f, i) => (
          <div key={i} className="rounded-xl border border-border bg-background/40 p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-bold uppercase tracking-wider text-gold">Feature {i + 1}</p>
              {p.features.length > 1 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 rounded-full px-2 text-muted-foreground hover:text-destructive"
                  onClick={() => patch("payment", { features: p.features.filter((_, j) => j !== i) })}
                  aria-label={`Remove feature ${i + 1}`}
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                </Button>
              ) : null}
            </div>
            <div className="mt-3 grid gap-3">
              <Input
                aria-label={`Feature ${i + 1} title`}
                className={inputCls}
                placeholder="Feature title"
                value={f.title}
                onChange={(e) => patch("payment", { features: p.features.map((ft, j) => (j === i ? { ...ft, title: e.target.value } : ft)) })}
              />
              <Textarea
                aria-label={`Feature ${i + 1} body`}
                className={areaCls}
                placeholder="Feature description"
                value={f.body}
                onChange={(e) => patch("payment", { features: p.features.map((ft, j) => (j === i ? { ...ft, body: e.target.value } : ft)) })}
              />
            </div>
          </div>
        ))}
        {p.features.length < 6 ? (
          <Button type="button" variant="outline" className="rounded-full" onClick={() => patch("payment", { features: [...p.features, { title: "", body: "" }] })}>
            <Plus className="mr-1.5 h-4 w-4" aria-hidden /> Add feature
          </Button>
        ) : null}
        <Field id="pay-steps" label="Numbered checkout steps" hint="One per line. Wrap words in **double asterisks** to make them bold.">
          <Textarea
            id="pay-steps"
            className={areaCls}
            value={p.steps.join("\n")}
            onChange={(e) => patch("payment", { steps: splitLinesForEditing(e.target.value) })}
          />
        </Field>
        <Field id="pay-methods" label="Accepted methods (chips)" hint="Comma separated, e.g. MTN MoMo, Telecel Cash, Visa.">
          <Input
            id="pay-methods"
            className={inputCls}
            value={paymentMethodsDraft ?? p.methods.join(", ")}
            onChange={(e) => {
              setPaymentMethodsDraft(e.target.value);
              patch("payment", { methods: splitCommasForEditing(e.target.value) });
            }}
          />
        </Field>
        <Field id="pay-btn" label="Button label">
          <Input id="pay-btn" className={inputCls} value={p.buttonLabel} onChange={(e) => patch("payment", { buttonLabel: e.target.value })} />
        </Field>
      </Section>

      {/* FAQ */}
      <Section
        title="FAQ"
        description="The question list customers expand. Add or remove freely."
        saving={savingSection === "faq"}
        onSave={() => save("faq")}
        onReset={() => reset("faq")}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="faq-eyebrow" label="Eyebrow">
            <Input id="faq-eyebrow" className={inputCls} value={content.faq.eyebrow} onChange={(e) => patch("faq", { eyebrow: e.target.value })} />
          </Field>
          <Field id="faq-title" label="Title">
            <Input id="faq-title" className={inputCls} value={content.faq.title} onChange={(e) => patch("faq", { title: e.target.value })} />
          </Field>
        </div>
        {content.faq.items.map((f, i) => (
          <div key={i} className="rounded-xl border border-border bg-background/40 p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-bold uppercase tracking-wider text-gold">Q{i + 1}</p>
              {content.faq.items.length > 1 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 rounded-full px-2 text-muted-foreground hover:text-destructive"
                  onClick={() => patch("faq", { items: content.faq.items.filter((_, j) => j !== i) })}
                  aria-label={`Remove question ${i + 1}`}
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                </Button>
              ) : null}
            </div>
            <div className="mt-3 grid gap-3">
              <Input
                aria-label={`Question ${i + 1}`}
                className={inputCls}
                placeholder="The question"
                value={f.q}
                onChange={(e) => patch("faq", { items: content.faq.items.map((it, j) => (j === i ? { ...it, q: e.target.value } : it)) })}
              />
              <Textarea
                aria-label={`Answer ${i + 1}`}
                className={areaCls}
                placeholder="The answer"
                value={f.a}
                onChange={(e) => patch("faq", { items: content.faq.items.map((it, j) => (j === i ? { ...it, a: e.target.value } : it)) })}
              />
            </div>
          </div>
        ))}
        {content.faq.items.length < 20 ? (
          <Button type="button" variant="outline" className="rounded-full" onClick={() => patch("faq", { items: [...content.faq.items, { q: "", a: "" }] })}>
            <Plus className="mr-1.5 h-4 w-4" aria-hidden /> Add question
          </Button>
        ) : null}
      </Section>

      {/* CTA band */}
      <Section
        title="Call-to-action band"
        description="The gold panel above the footer."
        saving={savingSection === "cta"}
        onSave={() => save("cta")}
        onReset={() => reset("cta")}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="cta-title" label="Title (first part)">
            <Input id="cta-title" className={inputCls} value={content.cta.title} onChange={(e) => patch("cta", { title: e.target.value })} />
          </Field>
          <Field id="cta-accent" label="Title (gold accent part)">
            <Input id="cta-accent" className={inputCls} value={content.cta.titleAccent} onChange={(e) => patch("cta", { titleAccent: e.target.value })} />
          </Field>
        </div>
        <Field id="cta-sub" label="Subtitle" hint={TOKEN_HINT}>
          <Textarea id="cta-sub" className={areaCls} value={content.cta.subtitle} onChange={(e) => patch("cta", { subtitle: e.target.value })} />
        </Field>
        <Field id="cta-btn" label="Button label">
          <Input id="cta-btn" className={inputCls} value={content.cta.buttonLabel} onChange={(e) => patch("cta", { buttonLabel: e.target.value })} />
        </Field>
      </Section>

      {/* Footer */}
      <Section
        title="Footer"
        description="About text, location line and copyright."
        saving={savingSection === "footer"}
        onSave={() => save("footer")}
        onReset={() => reset("footer")}
      >
        <Field id="foot-about" label="About the store">
          <Textarea id="foot-about" className={areaCls} value={content.footer.about} onChange={(e) => patch("footer", { about: e.target.value })} />
        </Field>
        <Field id="foot-loc" label="Location line">
          <Input id="foot-loc" className={inputCls} value={content.footer.location} onChange={(e) => patch("footer", { location: e.target.value })} />
        </Field>
        <Field id="foot-copy" label="Copyright" hint={TOKEN_HINT}>
          <Input id="foot-copy" className={inputCls} value={content.footer.copyright} onChange={(e) => patch("footer", { copyright: e.target.value })} />
        </Field>
      </Section>

      {/* Lookbook */}
      <Section
        title="Lookbook carousel"
        description="The styled outfit shots. Images, titles and descriptions are editable —
        the gold + pins stay linked to the product types shown in each photo."
        saving={savingSection === "lookbook"}
        onSave={() => save("lookbook")}
        onReset={() => reset("lookbook")}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="look-eyebrow" label="Eyebrow">
            <Input id="look-eyebrow" className={inputCls} value={content.lookbook.eyebrow} onChange={(e) => patch("lookbook", { eyebrow: e.target.value })} />
          </Field>
          <Field id="look-title" label="Title">
            <Input id="look-title" className={inputCls} value={content.lookbook.title} onChange={(e) => patch("lookbook", { title: e.target.value })} />
          </Field>
        </div>
        {content.lookbook.slides.map((s, i) => (
          <div key={i} className="rounded-xl border border-border bg-background/40 p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-bold uppercase tracking-wider text-gold">Look {i + 1}</p>
              {content.lookbook.slides.length > 1 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 rounded-full px-2 text-muted-foreground hover:text-destructive"
                  onClick={() => patch("lookbook", { slides: content.lookbook.slides.filter((_, j) => j !== i) })}
                  aria-label={`Remove look ${i + 1}`}
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                </Button>
              ) : null}
            </div>
            <div className="mt-3 grid gap-3">
              <ImageField
                id={`look-img-${i}`}
                label={`Look ${i + 1} image`}
                value={s.image}
                onChange={(image) => patch("lookbook", { slides: content.lookbook.slides.map((sl, j) => (j === i ? { ...sl, image } : sl)) })}
                token={token}
                aspect="aspect-[4/3]"
              />
              <Input
                aria-label={`Look ${i + 1} title`}
                className={inputCls}
                placeholder="Look title (shown over the photo)"
                value={s.title}
                onChange={(e) => patch("lookbook", { slides: content.lookbook.slides.map((sl, j) => (j === i ? { ...sl, title: e.target.value } : sl)) })}
              />
              <Textarea
                aria-label={`Look ${i + 1} description`}
                className={areaCls}
                placeholder="Look description"
                value={s.description}
                onChange={(e) => patch("lookbook", { slides: content.lookbook.slides.map((sl, j) => (j === i ? { ...sl, description: e.target.value } : sl)) })}
              />
            </div>
          </div>
        ))}
        {content.lookbook.slides.length < 8 ? (
          <Button
            type="button"
            variant="outline"
            className="rounded-full"
            onClick={() => patch("lookbook", { slides: [...content.lookbook.slides, { image: "/products/look-1.jpg", title: "", description: "" }] })}
          >
            <Plus className="mr-1.5 h-4 w-4" aria-hidden /> Add look
          </Button>
        ) : null}
      </Section>
    </div>
  );
}
