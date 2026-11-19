# Shiloh real-money payment and SMS acceptance test

Only the authenticated Back Office administrator can create a live QA checkout
from Settings > Live payment & SMS verification. The server must explicitly set
SHILOH_LIVE_PAYMENT_TEST_ENABLED=true (the production default is disabled).
The normal public SHILOH_PAYMENTS_ENABLED flag stays false during this trial.

The administrator must enter a Ghanaian number under their control, choose
an amount from ₵1.00 to ₵20.00 (default ₵1.00), acknowledge the real-money
charge and click Prepare checkout. Preparing a session does not charge the
payer; only completing the Hubtel-hosted payment will charge them.

If Hubtel rejects ₵1.00 as below the merchant minimum, do not retry repeatedly; review the provider's response and confirm fee configuration with Hubtel before changing the amount.

The resulting QA transaction uses the normal payment attempt, callback,
status-reconciliation, and notification code paths. Each attempt has a fresh
reference and exact amount verification; a Hubtel callback alone never proves
payment. The administration panel polls status and displays SMS/email logs.

Validation checklist:
1. A created QA order has a unique code and an open checkout attempt.
2. The customer and admin order-placed SMS entries are recorded with outcomes.
3. Open the supplied trusted pay.hubtel.com link. Pay **once** with a wallet
   the administrator controls. Do not repeat if charged.
4. The status verifier independently confirms reference, amount and paid
   status before marking the order paid. Confirm paidAt, verifiedAmount and
   Hubtel transaction ID in the internal payment-attempt record.
5. Payment-confirmed customer and admin SMS alerts are attempted once and
   logged; check the actual handset for receipt. "sent" means the provider
   accepted the message for delivery, not handset-confirmed delivery.
6. Confirm order status, auditing, and no duplicate payment transitions.
7. Review the merchant's Hubtel settlement statement before go-live.

QA orders and the inactive QA product are excluded from normal merchandise
sales statistics/catalogue, but are retained for financial audit. Their labels
and email/SMS copy explicitly say "test" and "no goods", and back-office
fulfilment/contact status changes are blocked.

After testing, set SHILOH_LIVE_PAYMENT_TEST_ENABLED=false again. Enable
public payments only after the administrator independently confirms the
end-to-end flow and approves launch; never infer go-live authorization from a
successful connection test.

Safety: no credentials, OTP, wallet PIN or payment card information should be
entered into ChatGPT or repository files.
