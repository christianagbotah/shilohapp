import { z } from "zod";

/** A small real-money trial; no merchandise is included. */
export const livePaymentQaSchema = z.object({
  phone: z.string().min(9).max(20),
  // A small, real-money transaction — no product is shipped.
  amount: z.number().finite().min(1).max(20).refine(
    (amount) => Math.abs(Math.round(amount * 100) - amount * 100) < 0.000001,
    "Amount must have at most two decimal places"
  ),
});
