"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CartItem } from "@/lib/types";

type CartState = {
  items: CartItem[];
  addItem: (item: Omit<CartItem, "key" | "quantity">, quantity: number) => void;
  setQuantity: (key: string, quantity: number) => void;
  removeItem: (key: string) => void;
  clear: () => void;
};

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      addItem: (item, quantity) =>
        set((state) => {
          const key = [item.productId, item.color, item.size, item.capStyle ?? ""]
            .join("|")
            .toLowerCase();
          const existing = state.items.find((i) => i.key === key);
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.key === key ? { ...i, quantity: Math.min(99, i.quantity + quantity) } : i
              ),
            };
          }
          return { items: [...state.items, { ...item, key, quantity }] };
        }),
      setQuantity: (key, quantity) =>
        set((state) => ({
          items:
            quantity <= 0
              ? state.items.filter((i) => i.key !== key)
              : state.items.map((i) =>
                  i.key === key ? { ...i, quantity: Math.min(99, quantity) } : i
                ),
        })),
      removeItem: (key) =>
        set((state) => ({ items: state.items.filter((i) => i.key !== key) })),
      clear: () => set({ items: [] }),
    }),
    { name: "shiloh-cart-v1" }
  )
);

export const cartCount = (items: CartItem[]) => items.reduce((n, i) => n + i.quantity, 0);
export const cartTotal = (items: CartItem[]) =>
  items.reduce((n, i) => n + i.quantity * i.unitPrice, 0);
