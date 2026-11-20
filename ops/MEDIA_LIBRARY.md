# Shiloh Store media library

Back Office > Products and Back Office > Site content now support **Browse library** alongside device upload. The picker searches the existing product photos, content images and site social artwork, displays previews, and inserts the chosen existing public image path without copying or uploading it again. Product gallery image rows use an icon button with accessible text.

## Authenticated endpoints

- `GET /api/admin/upload` requires the current administrator session and returns `items` with same-origin image path, filename, category, file size and last modification date. The legacy `images` property is preserved for older clients.
- `POST /api/admin/upload` remains administrator-only. It accepts JPEG, PNG and WebP up to 4 MB, validates dimensions and decodes/re-encodes via Sharp, strips metadata and saves a unique WebP filename. No destructive or bulk media delete operation is exposed.
- Only allowlisted `public/products`, `public/images`, a site OG image and optionally the configured persistent product-image folder are enumerated. The request cannot choose a filesystem path.

## Production persistence

The deployed VPS should set `SHILOH_MEDIA_DIR=/home/lightworld/data/shiloh-store/media/products` in `/etc/shiloh-store.env`. Do not put live secrets in Git or commit uploads with sensitive customer data.

Before switching releases, make sure the folder is owned by the application user and contains existing product images. Configure the storefront `public/products` path to resolve to the persistent directory, and have Nginx serve `/products/` from this same directory. This prevents uploads from disappearing when a new standalone Next.js release is deployed. The website `public/images` and root OG assets continue to live in the normal versioned release.

**Operational limitation:** the existing SQLite-only backup job does not make uploaded media disaster-proof. Independent backups of the persistent media directory are still required.

## Validation

- `bun test tests/media-library.test.ts` tests product + site discovery, persistent-file deduplication, extension allowlist and missing folders.
- `bun run typecheck` validates the media picker and both editor integrations.
- Verify the live authenticated list, a test upload, file retrieval and image previews using an isolated order database before enabling production.
