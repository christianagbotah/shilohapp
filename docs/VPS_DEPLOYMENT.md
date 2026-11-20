# Shiloh 2026 VPS deployment

Public URL: https://shiloh.lightworldtech.com

## Installed layout

- Source repository: christianagbotah/shilohapp
- Deployed branch: fix/shiloh-production-hardening-ux (pending merge into main)
- Release base: /home/lightworld/webapps/shiloh-store/releases/<commit>
- Active release symlink: /home/lightworld/webapps/shiloh-store/current
- Single-instance Bun Next.js server: 127.0.0.1:3065
- Service: systemctl status shiloh-store.service; journalctl -fu shiloh-store.service
- Persistent SQLite: /home/lightworld/data/shiloh-store/shiloh.db (WAL)
- Persistent product media: /home/lightworld/data/shiloh-store/media/products
- Root-only environment: /etc/shiloh-store.env
- First admin password (root only): /root/.secrets/shiloh-store/initial-admin-password. Change on first login and then securely remove this temporary file.
- Reconciliation: shiloh-store-reconcile.timer (every 5 minutes)
- Daily SQLite snapshots: shiloh-store-backup.timer (03:00 Africa/Accra, UTC)
- On-server backups: /home/lightworld/data/shiloh-store/backups; replicate to off-server storage.
- Nginx/Webuzo include: /var/webuzo-data/nginx/custom/domains/shiloh.lightworldtech.com.conf
- Certificate: /var/webuzo/users/lightworld/ssl/shiloh.lightworldtech.com-combined.pem

Webuzo's shared common config has an exact-match root location. The
Shiloh domain include uses a server-level rewrite to an internal reverse
proxy location to render the Next.js homepage without altering other sites.

## Subsequent releases

1. Review docs/LAUNCH_READINESS.md, current transactions and backups.
2. Pull reviewed source from GitHub into a separate working directory.
3. Build with the protected environment (root-only /etc/shiloh-store.env).
   Run tests against a disposable SQLite file, then typecheck and production build.
4. Create a new versioned releases/<commit> from .next/standalone, copy
   .next/static, public assets, scripts, src/lib, tsconfig and Prisma schema.
   Include nodemailer for the standalone reconciliation script.
5. Never copy source .env files or temporary/test databases. Make the release's
   public/products a symlink to persistent media and set owner lightworld.
6. Back up live persistent SQLite before reviewing/applying additive migrations.
   Never run Prisma migrations with data-loss acceptance.
7. Atomically point the current symlink to the new release and restart
   shiloh-store.service. Test the public HTTPS site, product media, APIs and
   payment gate after each release.
8. Roll back source by restoring the prior release symlink. Data rollback is a
   separate reviewed operation; never replace the live database casually.

## Payment launch gate

SHILOH_PAYMENTS_ENABLED=false at deployment. Hubtel credentials are
not installed. Configure credentials through the back office, verify a real
provider-reported payment and reference/amount match, then explicitly change
SHILOH_PAYMENTS_ENABLED=true in the protected environment and restart.
Browser callbacks alone are never authoritative.

Monitor disk usage and WAL file growth. Backups and customer data require
restricted access and replication to independent storage.
