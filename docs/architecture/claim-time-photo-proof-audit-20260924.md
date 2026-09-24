# Claim-time photo proof: pre-implementation audit

Date: 2026-09-24

## Baseline

- Local `release/testing-rc1`, fetched `origin/release/testing-rc1`, and clean source checkout all resolve to `218669c2232a15a452e7ebd8359232fde17bb980`.
- That is the required family-head private Storage commit, present at RC1 HEAD (history check) and confirmed in source.
- Implementation branch: `feat/rc1-claim-photo-proof-20260924`.
- Worktree: `.worktrees/feat-rc1-claim-photo-proof-20260924`.

## Required distribution audit

1. **Beneficiary identity.** Barangay Stub Distribution locates rows by stub/name and can scan QR. `POST /api/v1/stubs/verify` resolves a QR value (or stub/serial identifier) to the authoritative stub, household, event, claimability, and family-head verification context. `GET /api/v1/stubs/:id` loads exact details. Search is identification only.

2. **QR validation.** QR values must use the `DISTYNC-STUB|` format and resolve to the exact stored stub QR value under requester scope. Verification checks the returned stub's event, status, household eligibility/current attendance, and claimability. The separate `POST /api/v1/distribution-transactions/claim-from-qr` path also checks a submitted QR value against the stub and rejects inactive QR metadata. The main Barangay confirmation currently calls the generic stub-claim action after verification; it does not persist a proof method and is also reachable after manual lookup.

3. **Relief-pack association.** The main `STUB_CLAIM` path obtains standard/additional relief-pack templates from the current household/event assignment service. The authoritative claim service computes family-size quantities, includes reserved donated-pack assignments, then allocates eligible inventory batches in FIFO order. It derives pack context on the server; it does not accept an arbitrary pack choice from the Barangay client.

4. **Authoritative transaction path.** Online Barangay confirmation calls `POST /api/v1/sync/process` with `STUB_CLAIM`, handled by `stubService.claimBarangayStub`, which calls `recordAutomaticReliefPackClaim`. Offline replay sends the same action and stable `client_sync_id` through that sync endpoint. The legacy QR claim route also creates a `STUB_CLAIM` sync entry; older queued `DISTRIBUTION_QR_CLAIM` entries retain QR proof semantics through the same automatic claim service.

5. **Inventory deduction.** `recordAutomaticReliefPackClaim` inserts the distribution transaction, linked pack-template snapshots, transaction-item rows, inventory `OUTFLOW` rows, and updated batch quantities/statuses; it then marks the stub claimed. The caller owns a PostgreSQL transaction around this work. FIFO/batch allocation is in the automatic claim service.

6. **Duplicate prevention.** Claim services lock the stub row with `FOR UPDATE`, require `ISSUED`, and reject an already claimed stub. `distribution_transactions.uq_distribution_stub` remains the database backstop. Duplicate handling resolves the first transaction and existing sync conflict logic classifies later operations as conflicts (including `FIRST_ACCEPTED` cases).

7. **Online idempotency.** Before this revision, the client created a local `clientSyncId` for a syncable claim, but the normal online request posted directly to `/stubs/:id/claim` without sending it. A lost response followed by a new direct retry therefore hit duplicate-claim handling instead of replaying the original response. The server sync ledger already provides unique `client_sync_id` replay/mismatch checks for `/api/v1/sync/process`; the photo implementation uses that identity online and offline.

8. **Offline idempotency and validation.** `STUB_CLAIM` is a supported offline action stored in the existing IndexedDB sync queue with a stable entry ID, actor/device context, scope, and timestamp. The sync client replays that ID after restart and the server sync ledger owns replay/conflict state. Offline preparation provides the event, stubs, household details, and family-head verification image used by the UI; the claim page rejects untrusted/missing stub context before confirmation. The queue stores the claim payload durably, so a normalized photo payload can survive restart; raw-media encryption is deferred per the task.

9. **First-valid behavior.** Central PostgreSQL row locking and `uq_distribution_stub` serialize competing claim methods; the first accepted transaction owns the stub and inventory effect. Existing sync duplicate-claim conflict handling preserves the accepted transaction.

10. **Exact-detail role access.** Distribution history and `/inventory-distribution/:stubId` authorize Barangay, MSWDO, and Mayor. Service detail retrieval scopes Barangay to its authorized barangay; MSWDO and Mayor use their existing municipality-wide exact transaction access. Claim-proof retrieval can follow this exact-transaction authorization. Donor, NGO, and public routes do not expose exact claim details.

## Family-head private Storage integration confirmed

- `server/src/services/familyHeadPhotoStorage.service.js` uses the server-only Supabase Storage client, recomputes SHA-256, builds deterministic event/barangay/household-or-operation paths, verifies identical existing objects on retries, and creates five-minute signed URLs.
- `database/migrations/2026-09-24_add_family_head_photo_storage.sql` creates the private `distync-family-head-photos` bucket and household metadata fields; raw image bytes remain outside PostgreSQL.
- Household and stub routes return signed URLs with no-store headers; service-worker rules use `NetworkOnly` for signed family-head URLs.
- Barangay/MSWDO offline preparation fetches and durably prepares family-head photos. Sync redacts photo data before long-term response persistence and cleans unreferenced uploads.
- The family-head photo remains registration/identity evidence and will not be used as claim evidence.

## Baseline parity

- Untouched RC1 run: `node test/mswdoAnalytics.repository.test.js`.
- Result: 5 passed, 1 failed. The named baseline failure is `MSWDO analytics keeps cumulative event records while separating current presence`, assertion `cumulative evacuee source is present` at line 88. Recheck unchanged after implementation.
