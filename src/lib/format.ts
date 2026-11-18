/** Client-safe pure helpers (no server imports). */

/** Format an amount in Ghana cedis, e.g. 80 -> "₵80" */
export function formatGhs(amount: number): string {
  const rounded = Math.round(amount * 100) / 100;
  const str = Number.isInteger(rounded)
    ? rounded.toLocaleString("en-GH")
    : rounded.toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `GH₵${str}`;
}

/** Normalize a Ghana phone number to local format 0XXXXXXXXX. Returns null when invalid. */
export function normalizeGhPhone(input: string): string | null {
  const digits = input.replace(/[\s-]/g, "");
  let local = digits;
  if (local.startsWith("+233")) local = "0" + local.slice(4);
  else if (local.startsWith("233")) local = "0" + local.slice(3);
  if (!/^0\d{9}$/.test(local)) return null;
  return local;
}

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O/1/I — easy to read aloud

/** Generate a short, human-friendly order code, e.g. SHL-7K2P9Q */
export function generateOrderCode(): string {
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return `SHL-${code}`;
}
