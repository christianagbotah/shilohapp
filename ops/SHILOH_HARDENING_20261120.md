# Shiloh Store — Payment, Inventory and Backup Hardening

This directory documents the production release of 20 November 2026 and the related source changes.

## Production verification

- Public storefront: https://shiloh.lightworldtech.com/ (HTTPS 200)
- Back office: https://shiloh.lightworldtech.com/backoffice
- Inventory management: https://shiloh.lightworldtech.com/backoffice/inventory (requires an existing Shiloh administrator session)
- Hubtel: the existing **₵1.00** QA checkout returned **Paid**, gross **₵1.01**, charges **₵0.01**, net **₵1.00**; order, attempt, transaction ID and customer/admin SMS logs were saved.
- Inventory: separate same-origin Bun administration process bound exclusively to `127.0.0.1:3066`, behind Webuzo Nginx and the existing hashed admin-session cookie. Mutations enforce origin and CSRF.
- Inventory database triggers run inside the customer's SQLite order transaction. In-stock orders are held, out-of-stock orders fail with HTTP 409, cancellation releases holds, fulfillment consumes held stock once.
- Default: no `InventoryVariant` records, so the initial storefront is not disrupted. Enter actual stock for a variant to enable quantity control. Pausing a managed variant blocks purchases; deleting a product should not bypass historical inventory.
- PostgreSQL is **not** used in this app; its persistent payment and order DB is SQLite.

## Operational deployment

The live Next standalone build is under
`/home/lightworld/webapps/shiloh-store/current`, currently pointing at
`releases/inventory-20261120`.
The separate stock service is at `/home/lightworld/services/shiloh-inventory`.

After deploying an updated full-source Next build, verify both the production fee-reconciliation logic and the stock-error HTTP 409 mapping survived compilation. Do not restore an old release that lacks the secure Hubtel evidence checks.

The installation has:

- `shiloh-store.service` — storefront and payment APIs
- `shiloh-inventory.service` — inventory editor
- `shiloh-store-reconcile.timer` — payment reconciliation
- `shiloh-store-backup.timer` — daily SQLite snapshot
- `shiloh-store-restore-drill.timer` — weekly snapshot restoration, integrity, foreign-key and essential-table checks

Unit and inventory code are versioned under `ops/inventory`; restoration code and unit files are under `ops/backup`.
The Nginx domain custom configuration is deployed under
`/var/webuzo-data/nginx/custom/domains/shiloh.lightworldtech.com.conf`.

### Database changes

`ops/inventory/migrate.py <absolute-path-to-shiloh.db>` creates the stock tables and triggers idempotently. Always take an **online SQLite backup** before applying schema changes.

**Never use `prisma db push --accept-data-loss` against production.** A controlled clone test revealed a Prisma SQLite `Int` -> `BigInt` warning for the millisecond timestamp columns in the inventory tables. Existing production migration is safe; uncontrolled Prisma schema pushes could rewrite tables and destroy SQLite triggers. Apply changes using reviewed migrations on a snapshot first, confirm trigger preservation, and run the restore drill.

### Safe test commands

- `python3 ops/inventory/test_inventory.py` (requires the configured Shiloh VPS; clones live data to a disposable DB)
- `python3 ops/inventory/test_server.py` (localhost Bun admin-session test using disposable DB)
- `python3 ops/inventory/test_storefront.py` (isolated Next server at port 3068; no real Hubtel payment, no live orders)
- `DATABASE_URL=file:./local-test.db bun test tests/payment-state.test.ts tests/hubtel-checkout-response.test.ts tests/live-payment-qa.test.ts` (fresh test DB required)

These scripts are VPS-specific smoke tests, not customer-facing payment workflows. Never run destructive payment tests against the production SQLite DB.

## Known gaps for production operations

- **Off-server backup destination is not yet configured.** Local daily snapshots and weekly restoration are proven, but a catastrophic failure of the VPS can still affect both original DB and snapshots. Configure an independently credentialed backup target (S3-compatible storage or a separate server) and periodically test recovery from that target.
- SMTP mail delivery is not configured. Hubtel SMS has returned accepted/sent statuses, but receipt on every handset is not guaranteed.
- Terms, privacy, refund/return and shipping-policy pages need the merchant's approved commercial and legal terms. Do not invent promises, deadlines or refund entitlements.
- The real ₵1.00 QA payment is verified. A full paid **merchandise** checkout requiring a customer's phone authorization, delivery/pickup and refund should receive a final supervised acceptance test.
- Stock counts must be entered by authorized staff. Unconfigured variants remain unlimited until stock is entered.

## Rollback

For code errors, the previous release `hubtel-fee-20261120` is retained. **Do not roll back the database or delete stock tables** without a reviewed plan; order and inventory state must remain consistent. The initial database backup from before stock migration is in the Shiloh data backup directory, but restoring it would discard subsequent real customer activity.
