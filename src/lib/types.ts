export type ProductType = "tshirt" | "lacoste" | "jersey" | "cap";
export type AgeGroup = "adult" | "kid";

export const PRODUCT_TYPE_LABELS: Record<ProductType, string> = {
  tshirt: "T-Shirt",
  lacoste: "Lacoste",
  jersey: "Jersey",
  cap: "Cap",
};

export type ColorOption = { name: string; hex: string };

/** One view of a product — e.g. Front / Side / Back / Detail */
export type GalleryImage = { src: string; label: string };

export type ProductDTO = {
  id: string;
  type: ProductType;
  ageGroup: AgeGroup;
  name: string;
  tagline: string | null;
  price: number;
  image: string;
  gallery: GalleryImage[];
  colors: ColorOption[];
  sizes: string[];
  capStyles: string[] | null;
  badge: string | null;
};

/** Product as seen from the Back Office — adds catalogue management fields */
export type AdminProductDTO = ProductDTO & {
  sortOrder: number;
  active: boolean;
};

export type StoreInfo = {
  announcement: string;
  /** Event branding — editable every year from the Back Office */
  shilohYear: string; // e.g. "2026"
  shilohTagline: string; // e.g. "Far Above"
  shilohDates: string; // e.g. "December 8–13"
  shilohStart: string; // ISO date the countdown targets, e.g. "2026-12-08"
  /** True when the admin activated Hubtel online checkout in the Back Office */
  hubtelActive: boolean;
  /** Team WhatsApp number in international format without \"+\" (\"\" = hidden) */
  supportPhone: string;
  /** Back-office editable marketing copy (undefined until store-info loads) */
  content?: import("./site-content").SiteContent;
};

/** Fallbacks used while settings load or if they are missing */
export const STORE_INFO_DEFAULTS = {
  shilohYear: "2026",
  shilohTagline: "Far Above",
  shilohDates: "December 8–13",
  shilohStart: "2026-12-08",
} as const;

export type OrderStatus = "pending" | "reviewing" | "contacted" | "fulfilled" | "cancelled";
export type PaymentStatus = "unpaid" | "verifying" | "paid";

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Pending review",
  reviewing: "Under review",
  contacted: "Customer contacted",
  fulfilled: "Fulfilled",
  cancelled: "Cancelled",
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  unpaid: "Awaiting payment",
  verifying: "Verifying payment",
  paid: "Payment confirmed",
};

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  hubtel: "Hubtel checkout",
  "momo-manual": "Manual MoMo",
};

export type OrderItemDTO = {
  id: string;
  productId: string;
  productName: string;
  productType: ProductType;
  ageGroup: AgeGroup;
  color: string;
  size: string;
  capStyle: string | null;
  unitPrice: number;
  quantity: number;
};

export type OrderDTO = {
  id: string;
  code: string;
  fullName: string;
  phone: string;
  address: string | null;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: string | null; // hubtel | momo-manual | null
  paidAt: string | null;
  subtotal: number;
  total: number;
  adminNotes: string | null;
  createdAt: string;
  items: OrderItemDTO[];
};

export type AdminStats = {
  totalOrders: number;
  pendingReview: number;
  verifyingPayment: number;
  paidRevenue: number;
  totalUnits: number;
};

// ---- Cart (client-side) ----

export type CartItem = {
  key: string; // productId|color|size|capStyle
  productId: string;
  name: string;
  type: ProductType;
  ageGroup: AgeGroup;
  image: string;
  unitPrice: number;
  color: string;
  colorHex: string;
  size: string;
  capStyle: string | null;
  quantity: number;
};
