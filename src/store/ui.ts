"use client";

import { create } from "zustand";
import type { OrderDTO, ProductDTO } from "@/lib/types";

export type AppView = "store" | "admin";

type UiState = {
  view: AppView;
  adminToken: string | null;
  activeProduct: ProductDTO | null;
  cartOpen: boolean;
  checkoutOpen: boolean;
  trackOpen: boolean;
  trackPrefill: string;
  placedOrder: OrderDTO | null;
  /** Shown on the success dialog when online payment couldn't start. */
  placedOrderNotice: string | null;
  setView: (view: AppView) => void;
  setAdminToken: (token: string | null) => void;
  openProduct: (p: ProductDTO) => void;
  closeProduct: () => void;
  setCartOpen: (open: boolean) => void;
  setCheckoutOpen: (open: boolean) => void;
  setTrackOpen: (open: boolean) => void;
  setTrackPrefill: (prefill: string) => void;
  setPlacedOrder: (order: OrderDTO | null) => void;
  setPlacedOrderNotice: (notice: string | null) => void;
};

export const useUi = create<UiState>()((set) => ({
  view: "store",
  adminToken: null,
  activeProduct: null,
  cartOpen: false,
  checkoutOpen: false,
  trackOpen: false,
  trackPrefill: "",
  placedOrder: null,
  placedOrderNotice: null,
  setView: (view) => set({ view }),
  setAdminToken: (token) => set({ adminToken: token }),
  openProduct: (p) => set({ activeProduct: p }),
  closeProduct: () => set({ activeProduct: null }),
  setCartOpen: (cartOpen) => set({ cartOpen }),
  setCheckoutOpen: (checkoutOpen) => set({ checkoutOpen }),
  setTrackOpen: (trackOpen) => set({ trackOpen }),
  setTrackPrefill: (trackPrefill) => set({ trackPrefill }),
  setPlacedOrder: (placedOrder) => set({ placedOrder }),
  setPlacedOrderNotice: (placedOrderNotice) => set({ placedOrderNotice }),
}));
