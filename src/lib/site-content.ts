/**
 * Site content model — every marketing string/image on the storefront that
 * the Back Office "Content" tab can override.
 *
 * Storage: one JSON blob per section in the Setting table
 * (keys content_hero, content_marquee, ...). Saved values are always the
 * FULL section merged over these defaults (validated at save time), so a
 * schema change or a missing field falls back gracefully.
 *
 * Text supports two mini-template tokens — {year}, {dates}, {tagline} —
 * hydrated from the branding settings at render time, plus **bold** spans
 * in the payment steps.
 */

export type HeroContent = {
  intro: string;
  ctaPrimary: string;
  ctaSecondary: string;
  flyerImage: string;
  badgeTitle: string;
  badgeSubtitle: string;
  trust: string[];
};

export type MarqueeContent = {
  /** Extra phrases after the auto year/dates/tagline items */
  extras: string[];
};

export type SectionHeading = {
  eyebrow: string;
  title: string;
  subtitle: string;
};

export type HowStep = { title: string; body: string };
export type HowContent = SectionHeading & { steps: HowStep[] };

export type PaymentFeature = { title: string; body: string };

export type PaymentContent = {
  eyebrow: string;
  title: string;
  titleAccent: string;
  subtitle: string;
  features: PaymentFeature[];
  steps: string[];
  methods: string[];
  buttonLabel: string;
};

export type FaqItem = { q: string; a: string };
export type FaqContent = SectionHeading & { items: FaqItem[] };

export type CtaContent = {
  title: string;
  titleAccent: string;
  subtitle: string;
  buttonLabel: string;
};

export type FooterContent = {
  about: string;
  location: string;
  copyright: string;
};

export type LookbookSlideContent = {
  image: string;
  title: string;
  description: string;
};

export type LookbookContent = SectionHeading & {
  slides: LookbookSlideContent[];
};

export type SiteContent = {
  hero: HeroContent;
  marquee: MarqueeContent;
  shop: SectionHeading;
  how: HowContent;
  payment: PaymentContent;
  faq: FaqContent;
  cta: CtaContent;
  footer: FooterContent;
  lookbook: LookbookContent;
};

export const DEFAULT_SITE_CONTENT: SiteContent = {
  hero: {
    intro:
      "The official Shiloh {year} collection — premium t-shirts, lacostes, jerseys and caps for adults and kids. Order in under a minute, pay instantly with MoMo or card, anywhere in Ghana.",
    ctaPrimary: "Shop the Collection",
    ctaSecondary: "Pay in One Tap",
    flyerImage: "/images/shiloh-flyer.jpg",
    badgeTitle: "Shiloh Collection",
    badgeSubtitle: "Quality you can trust",
    trust: ["Official Shiloh collection", "Secure MoMo & card payment", "Delivery across Ghana"],
  },
  marquee: {
    extras: ["Shiloh Collection", "Pay with Hubtel", "Adults & Kids"],
  },
  shop: {
    eyebrow: "The Collection",
    title: "Shop the Collection",
    subtitle:
      "Every piece carries the Shiloh {year} gold crest. Choose your type, colour, size and quantity — for every member of the family.",
  },
  how: {
    eyebrow: "Simple by design",
    title: "How to Order",
    subtitle:
      "From picking your piece to instant confirmation — the whole flow takes less than two minutes on your phone.",
    steps: [
      {
        title: "Choose your items",
        body: "Browse t-shirts, lacostes, jerseys and caps for adults and kids. Choose colour, size and quantity — caps come in Hard and Net styles.",
      },
      {
        title: "Place your order",
        body: "Enter your name and phone number — no account needed. Tap Pay Now and you instantly receive a unique order code, e.g. SHL-7K2P9Q.",
      },
      {
        title: "Pay & get instant confirmation",
        body: "Pay on Hubtel's secure page — MTN MoMo, Telecel Cash, AirtelTigo Money or card. Follow Hubtel's instructions and approve the payment. We verify the transaction before marking your order paid.",
      },
    ],
  },
  payment: {
    eyebrow: "Secure Online Payment",
    title: "Payment,",
    titleAccent: "made easy",
    subtitle:
      "Choose your items, tap Pay Now and Hubtel's secure checkout takes it from there — complete the steps for your chosen wallet or card, then check the verified status using your order reference.",
    features: [
      {
        title: "Every wallet & card",
        body: "MTN MoMo, Telecel Cash, AirtelTigo Money, Visa and Mastercard — all in one secure checkout.",
      },
      {
        title: "Order status updates",
        body: "Track payment and fulfillment status with your order code and phone. SMS alerts are sent when enabled.",
      },
      {
        title: "Bank-grade security",
        body: "Payments are processed by Hubtel, a licensed Ghanaian payment provider. We never see your PIN.",
      },
    ],
    steps: [
      "Add your favourites to the cart and tap **Pay Now**",
      "Enter your name & phone — you'll be taken to **Hubtel's secure page**",
      "Choose **MoMo, wallet or card** — Hubtel texts a **one-time code (OTP)** to the number you're paying from",
      "Input the **OTP digits** into the fields on Hubtel's page — the approval prompt then appears on your phone",
      "Payment confirmed — your **order status** is updated after provider verification",
    ],
    methods: ["MTN MoMo", "Telecel Cash", "AT Money", "Visa", "Mastercard"],
    buttonLabel: "Start an order",
  },
  faq: {
    eyebrow: "Good to know",
    title: "Frequently Asked",
    subtitle: "",
    items: [
      {
        q: "When will I receive my order?",
        a: "Orders are reviewed daily by our team. Once your payment is confirmed, we call you on the number you provided to arrange delivery or pickup. Order early — everything is delivered before Dec 8, Shiloh week.",
      },
      {
        q: "How exactly do I pay?",
        a: "Tap Pay Now at checkout and you'll be taken to Hubtel's secure payment page. Choose MTN MoMo, Telecel Cash, AirtelTigo Money or a card — Hubtel texts a one-time code (OTP) to the number you're paying from, you input the digits into the fields on their page, and only then does the approval prompt appear on your phone. Approve it and your order confirms automatically — you get an SMS with the details.",
      },
      {
        q: "Why is Hubtel asking me for an OTP code?",
        a: "Before the approval prompt can show on your phone, Hubtel sends a one-time password (OTP) to the mobile money number you're paying from. Simply input the numerical digits into the fields Hubtel provides — once it's verified, the approval prompt appears and you can confirm the payment. The code expires quickly, so keep the phone you're paying with close by.",
      },
      {
        q: "What sizes are available?",
        a: "T-shirts, lacostes and jerseys come in adult sizes S–XXL and kids sizes 2–3y up to 12–13y. Caps come in S/M, L/XL and One Size, in Hard and Net styles.",
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
    ],
  },
  cta: {
    title: "The convocation is",
    titleAccent: "almost here",
    subtitle: "Order now so your family walks into Shiloh {year} — {dates} — wearing the glory.",
    buttonLabel: "Shop the Collection",
  },
  footer: {
    about:
      "The official Shiloh shopping site for the annual Shiloh convocation of the Winners' family worldwide — serving members across Ghana with premium t-shirts, lacostes, jerseys and caps for adults and kids.",
    location: "Winners Chapel International — Ghana",
    copyright: "© {year} Shiloh Orders • Winners Chapel International, Ghana",
  },
  lookbook: {
    eyebrow: "The Lookbook",
    title: "Shop the Look",
    subtitle: "",
    slides: [
      {
        image: "/products/look-1.jpg",
        title: "Far Above in Every Thread",
        description: "The signature Shiloh tee — shown front and back, just as it arrives.",
      },
      {
        image: "/products/look-2.jpg",
        title: "The Full Collection",
        description: "Tees in every colour of the convocation — for every member of the Winners' family.",
      },
      {
        image: "/products/look-3.jpg",
        title: "Crowns of the Convocation",
        description: "Hard or net cap, every colour of praise — embroidered with the Far Above crest.",
      },
      {
        image: "/products/look-4.jpg",
        title: "Polished. Pique. Praise.",
        description: "The lacoste and cap pairing — layered for the season of encounters.",
      },
    ],
  },
};

/** Setting key for each section. */
export const CONTENT_KEYS: Record<keyof SiteContent, string> = {
  hero: "content_hero",
  marquee: "content_marquee",
  shop: "content_shop",
  how: "content_how",
  payment: "content_payment",
  faq: "content_faq",
  cta: "content_cta",
  footer: "content_footer",
  lookbook: "content_lookbook",
};

type Vars = { year: string; dates: string; tagline: string };

/** Replace {year} / {dates} / {tagline} tokens with live branding values. */
export function hydrate(text: string, vars: Vars): string {
  return text
    .replaceAll("{year}", vars.year)
    .replaceAll("{dates}", vars.dates)
    .replaceAll("{tagline}", vars.tagline);
}

/**
 * Overlay a stored section JSON on top of the defaults. Unknown fields are
 * dropped; fields whose stored type doesn't match the default fall back to
 * the default, so a corrupt row can never break rendering.
 */
export function mergeSection<T>(fallback: T, stored: unknown): T {
  if (typeof stored !== "object" || stored === null || Array.isArray(stored)) {
    return fallback;
  }
  const out: Record<string, unknown> = { ...(fallback as Record<string, unknown>) };
  for (const [key, defVal] of Object.entries(fallback as Record<string, unknown>)) {
    const raw = (stored as Record<string, unknown>)[key];
    if (raw === undefined || raw === null) continue;
    if (Array.isArray(defVal)) {
      if (!Array.isArray(raw)) continue;
      const elDef = defVal[0];
      if (typeof elDef === "object" && elDef !== null) {
        // array of objects — keep only plain objects
        out[key] = raw.filter(
          (r) => typeof r === "object" && r !== null && !Array.isArray(r)
        );
      } else {
        // array of primitives — keep only matching primitive types
        out[key] = raw.filter((r) => typeof r === typeof elDef);
      }
      continue;
    }
    if (typeof defVal === typeof raw) {
      out[key] = raw;
    }
  }
  return out as T;
}

/** Parse a stored JSON section ("" / corrupt values return null). */
export function parseSection(raw: string | null | undefined): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
