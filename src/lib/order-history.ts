/**
 * Orders placed on this device are remembered in localStorage so customers
 * can track them later without memorising their SHL- codes or re-typing
 * their phone number. Purely a convenience cache — nothing leaves the
 * browser and it is safe to clear at any time.
 */

export type HistoryEntry = {
  code: string;
  phone: string;
  total: number;
  itemCount: number;
  placedAt: string; // ISO date
};

const KEY = "shiloh-order-history";
const MAX_ENTRIES = 8;

export function getOrderHistory(): HistoryEntry[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (e): e is HistoryEntry =>
          e &&
          typeof e.code === "string" &&
          typeof e.phone === "string" &&
          typeof e.total === "number"
      )
      .slice(0, MAX_ENTRIES);
  } catch {
    return [];
  }
}

export function rememberOrder(entry: HistoryEntry): void {
  try {
    const existing = getOrderHistory().filter((e) => e.code !== entry.code);
    window.localStorage.setItem(
      KEY,
      JSON.stringify([entry, ...existing].slice(0, MAX_ENTRIES))
    );
  } catch {
    /* private mode — ignore */
  }
}

export function clearOrderHistory(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* private mode — ignore */
  }
}
