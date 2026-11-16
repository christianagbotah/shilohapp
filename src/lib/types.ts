export type ProductType = "tshirt" | "lacoste" | "jersey" | "cap";
export type AgeGroup = "adult" | "kid";

export const PRODUCT_TYPE_LABELS: Record<ProductType, string> = {
  tshirt: "T-Shirt",
  lacoste: "Lacoste",
  jersey: "Jersey",
  cap: "Cap",
};

export type ColorOption = { name: string; hex: string };

export type ProductDTO = {
  id: string;
  type: ProductType;
  ageGroup: AgeGroup;
  name: string;
  tagline: string | null;
  price: number;
  image: string;
  colors: ColorOption[];
  sizes: string[];
  capStyles: string[] | null;
  badge: string | null;
};

export type StoreInfo = {
  momoNumber: string;
  momoName: string;
  momoNetwork: string;
  announcement: string;
};

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
