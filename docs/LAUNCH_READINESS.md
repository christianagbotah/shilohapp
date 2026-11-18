# Shiloh 2026 Merch — production release checklist

## Status — staging/PR only

The code adds payment-attempt tracking, independent Hubtel status verification,
atomic financial state transitions, admin-session security, guest-order privacy,
credential encryption, image sanitation and mobile checkout clarity. None of this
proves a real payment has worked. Do not enable real-money checkout until the
following release gates are completed on the real hosted domain.

## Mandatory before taking money

1. BACK UP before a migration. Identify the exact live persistent SQLite
   volume, separate from deploy/release directories. Verify it contains
   existing orders. Do not overwrite it with the staging database.
2. Configure a random, host-managed 32-byte base64
   SHILOH_SETTINGS_ENCRYPTION_KEY. Never commit it or store it in SQLite.
   Configure the exact HTTPS site_url/NEXT_PUBLIC_SITE_URL.
3. On the verified live database, review then apply the additive Prisma schema
   changes for PaymentAttempt, PaymentAudit and AdminSession. Never use
   --accept-data-loss. Backups are required before schema modification.
4. Revoke the seeded admin password. Run scripts/set-admin-password.ts with a
   strong unique SHILOH_ADMIN_INITIAL_PASSWORD provided temporarily from a
   protected terminal, then clear that variable. All old sessions are revoked.
5. Encrypt any pre-existing plaintext API keys by running
   scripts/encrypt-legacy-secrets.ts after the encryption key is configured.
6. Configure Hubtel collection-account credentials in Back Office. Get the
   server's public outbound IP allowlisted for Hubtel's transaction status API.
   Confirm status checking works before accepting payments. An initiation-only
   credential test is not enough.
7. Complete a real low-value checkout on the public HTTPS domain. Compare the
   exact reference, merchant, amount and status with the Hubtel dashboard.
   Test success, failure, duplicate webhooks, delayed confirmation, downtime
   and safe order reconciliation. If the transaction status cannot be verified,
   leave the order unresolved and do not fulfill it.
8. Schedule scripts/reconcile-payments.ts against the production environment
   every five minutes. Alert on unresolved attempts and errors; it does not
   initiate charges. Schedule scripts/backup-db.sh daily with SHILOH_DB_PATH
   and SHILOH_BACKUP_DIR pointing to persistent storage. Replicate backups
   to a second server/location, encrypt/restrict access and test restoration.
9. Enable SQLite WAL through scripts/configure-sqlite.ts after backing up and
   verifying the database path. Monitor SQL busy/lock/time-out errors.
10. Confirm the reverse proxy strips untrusted forwarded IP headers. Verify
    pages on phone and desktop, and verify the production deployment is exactly
    the tested source commit. Use release rollback without overwriting the DB.

## QA commands (disposable database only)

- DATABASE_URL=file:./local-test.db bunx prisma db push
- DATABASE_URL=file:./local-test.db bun test tests/payment-state.test.ts
- DATABASE_URL=file:./local-test.db bun run typecheck
- DATABASE_URL=file:./local-test.db bun run build

## Constraints and operational limitations

- SQLite single instance and bun are retained as hosting requirements.
- Hubtel webhook status is a hint; the status API is the money authority.
  When the status API is unreachable, payment stays unresolved.
- A new unique reference is created per payment attempt. Avoid asking a
  customer to pay twice while any previous attempt remains unresolved.
- Manual payment confirmations require an independently verified receipt
  and must not override Hubtel attempts. Paid orders cannot be cancelled
  without a refund process. No automatic refund is implemented.
- Storefront order tracking requires both order code and phone number.
- SMS and email are best-effort; failed delivery does not undo a payment.
- Backups, SQLite and images contain sensitive customer data. Historical
  copies of DB files in Git history require access control and assessment.
- Encrypted credentials become unrecoverable if the encryption key is lost.
- This release provides no formal inventory-reservation or refund automation.
