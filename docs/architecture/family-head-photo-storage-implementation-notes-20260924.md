# Family-head photo Storage implementation notes

This note records the RC1 implementation boundary for family-head identity photos. The photo remains part of the household registration occurrence and supports manual beneficiary verification. Distribution claim or receipt photos remain out of scope.

## Storage and API behavior

- New registration and re-admission requests continue to submit the hardened normalized image as a transient `family_head_photo_url` data URL for compatibility with the existing form and offline queue.
- The server validates the decoded image and uploads it through the existing server-side Supabase client to the private `distync-family-head-photos` bucket. New household rows store `family_head_photo_path` and server-computed SHA-256/MIME/size metadata; the legacy URL field is null for new rows.
- Storage paths use `<event>/<barangay>/operations/<sha256(operation-id)[0:32]>/<photo-sha256>.<extension>`. Legacy backfill uses `<event>/<barangay>/households/<household-id>/<photo-sha256>.<extension>`. Existing objects are downloaded and hash-checked before a retry is accepted.
- `/api/v1/households/:householdId`, `/api/v1/stubs/:id`, `/api/v1/stubs/verify`, and `/api/v1/distribution-transactions/inventory-distribution/:stubId` resolve a private path to a five-minute signed URL after the route's existing role/scope authorization. Photo retrieval API responses are `private, no-store`; the PWA service worker uses `NetworkOnly` for signed family-photo URLs.
- Household list and stub-dashboard rows carry only `has_family_head_photo`. A Barangay, MSWDO, or Mayor client obtains a signed URL only through an authorized detail or photo endpoint. Donor, NGO, and public roles have no route access.

## Offline copy discrepancy to the PII design specification

The specification at `docs/architecture/rc1-pii-encryption-design-specification-20260911.md` says approved offline photo copies should be encrypted with a per-device Web Crypto key. This implementation preserves the existing IndexedDB registration queue and offline preparation model, which stores the normalized photo as a readable data URL until the server confirms sync. It does not introduce offline encryption or key custody, so this item remains an explicit security follow-up and a production sign-off blocker. The object is encrypted in transit and protected at rest by the private Supabase Storage boundary after sync; that does not encrypt the pending browser copy.

## Backfill and orphan reconciliation

`node server/scripts/backfill-family-head-photos.js` is dry-run by default and requires `TEST_DATABASE_URL` for the default test target. It reads rows by keyset batches, validates legacy data URLs, and reports aggregate counts without logging image bytes or URLs. A successful apply uploads or hash-verifies the deterministic household path and atomically updates the row only while the original URL remains unchanged, then clears that row's legacy data URL. Corrupt data URLs and non-data-URL legacy references are skipped for separate review.

For an isolated test environment, set `TEST_DATABASE_URL`, `FAMILY_HEAD_PHOTO_BACKFILL_STORAGE_ENV=test`, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY`, then run:

```powershell
node server/scripts/backfill-family-head-photos.js --target test --apply --batch-size 100
```

Orphan review is also dry-run by default. It only considers objects older than seven days whose path contains a SHA-256 filename, whose downloaded bytes match that hash, and which have no household reference. Deletion requires a second reference check and `--confirm-orphan-cleanup`.

The script never reads `DATABASE_URL`. A later controlled production run must use a separately reviewed change window, an explicit `FAMILY_HEAD_PHOTO_BACKFILL_DATABASE_URL`, `FAMILY_HEAD_PHOTO_BACKFILL_STORAGE_ENV=production`, the production service-role secret, and `--target production --apply --confirm-production-backfill`; run and review a production dry run before that approved write. No production migration, backfill, or Storage write was performed for this implementation.

## Documentation updates for the capstone

Update the ERD and Data Dictionary with `family_head_photo_path`, `family_head_photo_sha256`, `family_head_photo_mime_type`, and `family_head_photo_size_bytes`; retain `family_head_photo_url` during staged rollout and describe it as a legacy compatibility field. Update Technical Scope and Data Scope to define the family-head photo as identity-verification evidence attached to a household occurrence. Update Security Architecture to describe server-managed private Storage and short-lived scoped signed URLs, and record offline IndexedDB encryption as pending. Update Online Data Flow and Offline Data Flow to show server upload, stable sync identity, and local queue cleanup only after a terminal server result. Update PWA synchronization and Testing documentation with response-loss retries, backfill, photo authorization, and offline restart cases.

The upload, SHA-256 verification, private object path, and authorization-gated signed-URL pattern may inform future media features. A claim photo must have separate transaction ownership, lifecycle, retention, authorization, and UI; none of those behaviors are implemented here.
