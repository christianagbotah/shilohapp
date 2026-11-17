"use client";

import { useQuery } from "@tanstack/react-query";
import type { ProductDTO, StoreInfo } from "@/lib/types";

export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error ?? "Something went wrong");
  }
  return data as T;
}

export function useProducts() {
  return useQuery({
    queryKey: ["products"],
    queryFn: () => fetchJson<{ products: ProductDTO[] }>("/api/products").then((r) => r.products),
    staleTime: 60_000,
  });
}

export function useStoreInfo() {
  return useQuery({
    queryKey: ["store-info"],
    queryFn: () => fetchJson<StoreInfo>("/api/store-info"),
    staleTime: 60_000,
  });
}
