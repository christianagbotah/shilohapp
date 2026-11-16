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
  setView: (view: AppView) => void;
  setAdminToken: (token: string | null) => void;
  openProduct: (p: ProductDTO) => void;
  closeProduct: () => void;
  setCartOpen: (open: boolean) => void;
  setCheckoutOpen: (open: boolean) => void;
  setTrackOpen: (open: boolean) => void;
  setTrackPrefill: (prefill: string) => void;
  setPlacedOrder: (order: OrderDTO | null) => void;
};

const initialToken =
  typeof window !== "undefined" ? window.localStorage.getItem("shiloh-admin-token") : null;

export const useUi = create<UiState>()((set) => ({
  view: "store",
  adminToken: initialToken,
  activeProduct: null,
  cartOpen: false,
  checkoutOpen: false,
  trackOpen: false,
  trackPrefill: "",
  placedOrder: null,
  setView: (view) => set({ view }),
  setAdminToken: (token) => {
    if (typeof window !== "undefined") {
      if (token) window.localStorage.setItem("shiloh-admin-token", token);
      else window.localStorage.removeItem("shiloh-admin-token");
    }
    set({ adminToken: token });
  },
  openProduct: (p) => set({ activeProduct: p }),
  closeProduct: () => set({ activeProduct: null }),
  setCartOpen: (cartOpen) => set({ cartOpen }),
  setCheckoutOpen: (checkoutOpen) => set({ checkoutOpen }),
  setTrackOpen: (trackOpen) => set({ trackOpen }),
  setTrackPrefill: (trackPrefill) => set({ trackPrefill }),
  setPlacedOrder: (placedOrder) => set({ placedOrder }),
}));
