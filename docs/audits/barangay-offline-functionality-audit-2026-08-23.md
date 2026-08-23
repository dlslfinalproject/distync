# Barangay Offline Functionality Audit — 2026-08-23

## A. Repository setup

- Source baseline branch: `release/testing-rc1`
- Source baseline commit: `25f139c` (`merge: idempotency mismatch branch`)
- New branch: `audit/rc1-barangay-offline-functionality-20260823`
- New worktree: `C:\Users\jane allyson\OneDrive\Desktop\distync-barangay-offline-functionality-audit-20260823`
- Current HEAD: `7f41c6f25d364628b9ab68f3936505de52a20a67`
- The candidate baseline was verified to contain the latest committed prerequisite work, including Sync Center, anomaly tracking, sync idempotency mismatch handling, and Barangay status presentation.
- No commit, push, merge, deployment, reset, or stash was performed.

## B. Database safety

- Test project: `cldfgbqjvnianmpecybu`
- Production: `deufjjzwvagrljixxskn`
- Live DB operations: No.
- Production mutation: NO.
- Schema: No.
- Migration: No.
- No database client was pointed at either project. The server suite was run only as local unit/contract code; its DB-dependent cases were not authorized to use a live database.

## C. Offline architecture

The app is a Vite React PWA. `vite-plugin-pwa` generates a Workbox service worker. The app shell is precached and navigations use a mode-isolated NetworkFirst page cache. Authenticated `/api/` requests are NetworkOnly; they are not persisted by the service worker.

IndexedDB is Dexie-backed and named `distyncOfflineDb-${ACCESS_MODE}`. `syncQueue` stores mutation identity, scope, timestamps, payload, result state, and processing lease fields. `offlineStubCache` stores a sanitized, owner-stamped subset of stub data for verified offline claim presentation.

Connectivity is observed through `online`/`offline` listeners, `navigator.onLine`, an online reconnect flush, and a 30-second automatic flush interval. Manual processing uses the same queue processor and idempotent replay path. The backend accepts the original `client_sync_id`, revalidates authorization/domain rules, and reconciles terminal replay results.

## D. PWA / service worker audit

- Installability: manifest includes standalone display, scope/start URL, theme/background colors, and the existing square DISTYNC logo at `/assets/distync-logo-cropped.png`.
- Registration: the app registers the generated worker once through the existing PWA registration helper; update/waiting/error state is surfaced by the existing service-worker status model.
- App shell: JS, CSS, HTML, worker, static image, and font assets are precached or runtime cached according to destination.
- Cache strategy: authenticated API and signed profile-picture URLs are NetworkOnly; navigation is NetworkFirst with a three-second network timeout; shell code is StaleWhileRevalidate; static images/fonts are CacheFirst with bounded expiration.
- Offline navigation: generated `dist/sw.js` contains the app-shell navigation fallback and mode-specific cache prefix `distync-DEVELOPMENT`.
- Update lifecycle: `registerType: "autoUpdate"` and `cleanupOutdatedCaches: true` are enabled; the existing helper handles update/error state.
- Sensitive API caching: no authenticated API response caching is configured.
- Background Sync: not implemented. Reconnect processing is page/service-runtime driven (online listener plus interval), so a fully closed PWA is not guaranteed to synchronize until opened again.

## E. IndexedDB audit

- Stores/schema: Dexie version 2 defines `syncQueue`; version 3 adds `offlineStubCache`. No schema version was changed in this audit.
- Queue durability: queued rows are written with `db.syncQueue.put`, survive reload/restart subject to browser storage policy, and retain original IDs/payloads.
- User scope: entries carry authenticated `userId`; missing-user entries fail closed.
- Role scope: entries carry `roleCode`; mismatched or missing roles are hidden.
- Barangay scope: Barangay entries carry `barangayId` derived from explicit scope, payload, or authenticated assignment; Barangay readers fail closed on mismatch.
- Access-mode scope: entries and DB names are isolated by DEVELOPMENT/DEMO mode.
- Legacy entries: unsupported donation/disaster-event entries and invalid legacy inventory-reference entries remain visible but non-retryable; malformed queue rows are also non-retryable and receive safe notes.
- Quota/error behavior: queue write, update, claim, and cleanup errors become `OFFLINE_STORAGE_FAILURE`; the mutation does not claim a false local save. Browser quota/private-mode eviction remains an inherent platform limitation and is reported to the user as local-storage failure.

## F. Offline capability matrix

| Feature | Page loads offline? | Data available offline? | Mutation supported? | Local persistence? | Auto sync? | Manual retry? | Online requirement? | Verdict |
|---|---|---|---|---|---|---|---|---|
| Barangay Masterlist | Yes, app shell | Cached reference/stub data plus pending local rows; full authoritative list is not guaranteed | Registration, update, departure supported where locally validated | Yes, queue | Yes | Yes | Initial authoritative data and server validation | Supported with limitations |
| Household registration | Yes after shell/reference data | Local form/reference context and duplicate preflight cache | Yes | Yes | Yes | Yes | Server acceptance/authorization after reconnect | Fully supported with limitations |
| Household update | Yes after shell/reference data | Existing local context where available | Yes | Yes | Yes | Yes | Server acceptance/authorization after reconnect | Supported with limitations |
| Departure/time-out | Yes after shell/reference data | Row/event context | Yes | Yes | Yes | Yes | Server acceptance/authorization after reconnect | Supported with limitations |
| Relief Distribution / stub claim | Yes after shell/cache warm | Sanitized owner-scoped stub rows/details; QR hardware is separate | STUB_CLAIM and supported distribution create | Yes | Yes | Yes | Uncached verification and authoritative validation | Supported with limitations |
| Distribution History | App shell only | No authoritative history cache | No | No | No | No | Yes | Online-required/read-only unavailable offline |
| Offline Queue | Yes | Local queue | Queue retry/status actions | Yes | N/A | Yes | No for viewing; reconnect for sync | Fully supported locally |
| Sync History | App shell only | No server-history cache | No | No | No | No | Yes | Online-required/read-only unavailable offline |
| Conflict Review | App shell only | No authoritative conflict cache | No | No | No | No | Yes | Online-required/read-only unavailable offline |
| Anomaly Tracking | App shell only | No authoritative anomaly cache | No | No | No | No | Yes | Online-required/read-only unavailable offline |
| Donations/disaster-event mutations | App shell only | No | No | No | No | No | Yes | Explicitly online-required |

## G. Evacuee Masterlist

Registration, editable household updates, and departure/time-out use the existing sync wrapper and preserve distinct ordered queue entries. Local duplicate preflight uses only safe cached/pending identity fields and does not replace server authority. Arrival/attendance context remains tied to authoritative event and row context; it is not invented offline. Full masterlist search/reference data is not a complete offline mirror, so first-ever or uncached workflows remain limited. Photos/media are not stored in the queue/cache as raw sensitive payloads; photo editing/verification remains online-required or limited by available local form state.

## H. Relief Goods Distribution

Camera/QR availability is a device capability and is kept separate from verification. Offline claim presentation is available only for owner-scoped, sanitized, previously cached stub data; an uncached QR does not create a queue row. Manual and QR claims converge on `STUB_CLAIM`. Distribution create preserves event context and uses the same queue identity path. Pending duplicate protection, server-side claim validation, and `client_sync_id` idempotency protect critical claims. Online verification remains required when the target is not safely cached or when the server must establish trust.

## I. Distribution History

Distribution History is server-backed and is not locally cached as an authoritative ledger. Offline, the route shell may open but history data is unavailable and must not be represented as synchronized or complete. New locally queued distribution work is represented in the Offline Queue, not retroactively fabricated as server history.

## J. Sync Center

Offline Queue is local-first and remains usable without the server. Sync History and Conflict Review are authoritative server-backed views and remain unavailable offline. Sync Status distinguishes healthy, pending, failed, conflict, unavailable, and offline states; pending offline work cannot display “All changes synced.”

## K. Anomaly Tracking

Anomaly Tracking remains a separate server-backed operational review capability. Plain offline/sync failures do not become anomalies merely because synchronization is pending or failed. Domain anomalies are produced by server-authoritative sources and reviewed through the existing anomaly workflow.

## L. Authentication / session

Already-authenticated users can open the shell and perform supported locally validated operations while offline. OAuth/login and fresh authentication are online-required; no insecure offline login or bypass was added. If a session expires before replay, the queue is retained and the server rejection is surfaced for re-authentication rather than silently discarded. Logout/account changes hide queue rows through scope checks; they do not grant the next user access to prior work.

## M. User / role / Barangay isolation

Queue rows are stamped with mode, user, role, and Barangay where applicable. A different user, role, mode, or Barangay cannot read or process another owner’s Barangay queue rows. Non-Barangay roles retain their broader user/role-scoped behavior. Mode-specific DB/cache names prevent DEVELOPMENT and DEMO cross-contamination. Local stub cache entries are sanitized and owner-stamped.

## N. Queue order / dependencies

Entries retain their own `client_sync_id`; grouped rows are not coalesced into one identity. Replay batches are ordered by `clientTimestamp`. Parent/child dependency handling remains server-authoritative and is not fabricated locally. Multiple offline updates remain distinct, ordered mutations; the server applies its existing stale/ordering/business rules and returns the authoritative result. Local IDs are carried until terminal reconciliation, with server IDs returned through the existing result path.

## O. Automatic reconnect

The `online` listener immediately requests a flush, and a 30-second interval provides recovery when browser connectivity state is imperfect. Only visible, retryable PENDING/FAILED rows are eligible. Transient HTTP statuses 408, 425, 429, 500, 502, 503, and 504 remain retryable. 401/403, validation/business conflicts, malformed/legacy/unsupported rows, and idempotency mismatches remain non-retryable or attention states.

## P. Manual retry

Manual retry uses the same processing path as automatic reconnect. It first claims rows, so it cannot replay a row already leased by another processor. A successful or terminal result clears the processing lease; a transient failure returns the row to FAILED with a safe reason. Manual and automatic retry do not create a new logical ID.

## Q. Multi-tab

Queue processing now uses an atomic Dexie transaction to claim rows with a 60-second processing lease. A second tab skips rows with a live lease, preventing duplicate concurrent submission. An expired lease is recoverable after a browser crash/restart. This is a best-effort browser-level lock; it is not a replacement for server idempotency and can still be limited by browser storage failure or abrupt process termination.

## R. Lost response / idempotency

Each queued replay sends the stored original queue ID as `client_sync_id`. If the server committed but the response was lost, replay reaches the server idempotency check and returns the terminal result rather than creating a duplicate. If the server reports an idempotency mismatch, the row is retained as a non-retryable attention state. Unsafe queue coalescing remains removed.

## S. Error classification

| Error class | Local treatment | Retryability |
|---|---|---|
| Offline/network/timeout | Keep as pending/failed with safe copy | Retryable |
| Transient HTTP 408/425/429/5xx | Failed with retained identity | Retryable |
| 401/403/auth expiry | Retain work; require authentication | Not automatic until re-authenticated |
| Validation error | Retain terminal/attention state with safe explanation | Not automatic |
| Business conflict | Route to existing conflict/review semantics | Not blind retry |
| Idempotency mismatch | Retain and exclude from retry | Not retryable |
| Unsupported/legacy/malformed row | Retain and explain next step | Not retryable |
| Local storage/quota failure | Throw `OFFLINE_STORAGE_FAILURE`; no false local-save response | Retry only after storage recovers and user retries |

## T. Offline UX

Barangay operational pages expose compact offline-aware sync status while preserving the quiet healthy-online state. Supported actions use local-save/pending-sync semantics; they do not claim server success. Online-required actions remain distinct and must explain that internet is required rather than pretending to queue. Server-backed unavailable states remain unavailable rather than showing empty authoritative data. Technical identifiers and raw backend errors are mapped to safe operational copy.

## U. Responsiveness / accessibility

The audit preserved the existing responsive table/toolbar patterns for desktop, tablet, and mobile rather than converting standardized tables to cards. Shared status components retain semantic status text and compact/full variants. Existing keyboard/focus/modal and touch-target coverage remains in the client suite. Browser/assistive-technology rendering was not manually exercised in this environment.

## V. Privacy / local data

Local operational data is limited to queue payloads required for supported mutations, mode/user/role/Barangay scope, safe reference context, and an allowlisted sanitized stub cache. Contact/photo/audit-sensitive fields are excluded from the stub cache. No offline authentication secret or new profile-photo storage was added. Mode/account/logout cleanup and fail-closed owner checks reduce cross-user exposure; browser clear-site-data, eviction, and private-mode behavior remain platform limitations.

## W. Defects found

| ID | Severity | Area | Root cause | Impact | Fix | Tests | Remaining risk |
|---|---|---|---|---|---|---|---|
| OFF-001 | P1 | Queue concurrency | No durable cross-tab processing claim | Two tabs could submit the same pending row concurrently | Added atomic Dexie claim transaction with a 60-second lease and cleanup | Focused audit, full client 435/435 | Server idempotency remains the final safety boundary |
| OFF-002 | P1 | Queue ownership | Visibility was permissive for missing/mismatched owner context | Logout/account/role changes could expose or process another owner’s local work | Fail-closed mode/user/role checks plus Barangay scope | Full client scope/idempotency coverage and focused audit | Browser storage itself remains device-local and user-controlled |
| OFF-003 | P1 | Storage failure | Queue writes/updates could surface raw IDB failure or imply local success | An operation could appear saved when it was not durable | Typed safe `OFFLINE_STORAGE_FAILURE` handling across write/update/claim/cleanup | Focused audit and client suite | Storage quota/private-mode behavior still depends on browser |
| OFF-004 | P1 | Bulk claim | Bulk claim callback referenced undefined `row` | Bulk offline claims failed before queueing | Resolve the selected row from `stubRows` before building each claim | Focused audit and full client suite | Uncached/unauthorized claims remain intentionally blocked |
| OFF-005 | P1 | Reconnect recovery | Transient HTTP statuses were not consistently classified as network-retryable | 5xx/429 responses could become terminal failures instead of safe retries | Broadened transient classification and attached distribution HTTP status/code | Focused audit and full client suite | Non-distribution service handlers should retain their existing status mapping |
| OFF-006 | P2 | Status presentation | Barangay compact status could be quiet while the browser was offline with no queue rows | Users lacked explicit connectivity truth at the point of action | Added online/offline state to the Barangay sync-health presentation | Focused UX audit and full client suite | Manual visual validation remains unavailable |
| OFF-007 | P2 | PWA installability | Manifest had no stable icon entry | Install prompts could lack a branded icon | Reused existing logo with stable output path and manifest icon | Focused PWA audit and successful PWA build inspection | One 363px icon is adequate but not a full multi-resolution icon set |

## X. Files modified

- `client/src/components/shared/SyncHealthStatus.jsx` — display explicit offline state without changing healthy-online quietness.
- `client/src/features/distribution/distributionService.js` — preserve HTTP status/code for transient classification and pass queue scope/context.
- `client/src/features/masterlist/masterlistService.js` — pass explicit Barangay/event context for offline departure queue rows.
- `client/src/features/sync/syncManagementHelpers.js` — map malformed entries to safe non-retryable notes.
- `client/src/features/sync/useBarangaySyncHealth.js` — track browser connectivity and expose it to compact status presentation.
- `client/src/offline/syncQueue.js` — durable storage errors, fail-closed scope, malformed handling, Barangay scope, and atomic processing leases.
- `client/src/offline/syncService.js` — transient HTTP classification, durable queue-error feedback, lease-based replay, and lease cleanup.
- `client/src/offline/syncStatus.js` — safe local-storage/malformed-entry error codes and copy.
- `client/src/pages/barangay/BarangayMasterlistPage.jsx` — provide departure queue context.
- `client/src/pages/barangay/DistributionTransactionPage.jsx` — show compact sync health and provide distribution queue context.
- `client/src/pages/barangay/StubDistributionPage.jsx` — resolve the selected row during bulk claims.
- `client/vite.config.js` — add the existing DISTYNC PWA icon and stable emitted asset path.
- `client/tests/barangayOfflineFunctionalityAudit.test.mjs` — focused regression contracts for PWA, queue, recovery, UX, and bulk claim behavior.
- `docs/audits/barangay-offline-functionality-audit-2026-08-23.md` — this audit record.

## Y. API / database impact

| Surface | Changed? |
|---|---|
| Frontend | Yes |
| Service Worker | Yes, through generated build configuration/output; no hand-edited worker |
| IndexedDB schema | No |
| Queue logic | Yes |
| Backend | No |
| API | No endpoint/contract change |
| Database schema | No |
| Migration | No |
| Production | Untouched |

## Z. Test results

- Focused PWA/offline: 5/5 passed in `client/tests/barangayOfflineFunctionalityAudit.test.mjs`.
- Focused queue: covered by the same 5/5 audit contracts plus existing client queue/mode tests.
- Focused idempotency: covered by the same audit contracts plus existing `SYNC-IDEMP-CLIENT-*` tests; all passed in the full client run.
- Focused operational flows: bulk claim, Barangay status, masterlist departure, distribution queue context, and existing stub/registration tests passed in the full client run.
- Focused server: `server/test/sync.validator.test.js` passed 4/4. The four-file sync route/repository/service subset reached 88 tests with 21 pass and 67 environment-blocked failures because DB configuration was intentionally unavailable.
- Full client: 435 passed, 0 failed.
- Full server: 443 total, 368 passed, 75 failed/blocked. The default `npm --prefix server test` runner also hit Windows `spawn EPERM`; serial execution was used to obtain the meaningful count. DB-dependent failures report missing `server/.env`/`DATABASE_URL`; no live DB was used.
- Development build: passed with Vite 7.3.1 using `VITE_ACCESS_MODE=DEVELOPMENT` and `DISTYNC_BUILD_TARGET=development`. Existing warnings: React Router module-level `use client` directives ignored and a large application chunk.
- PWA/service-worker build: passed. Generated `client/dist/manifest.webmanifest`, `client/dist/sw.js`, and `client/dist/workbox-65be5e4f.js`; inspected NetworkOnly `/api/`, NetworkFirst navigation, shell/static routes, mode-specific cache prefix, and manifest icon.
- Default/demo build: not run against a deployment configuration. The explicit build gate requires `VITE_ACCESS_MODE` and DEMO additionally requires a non-loopback `VITE_API_BASE_URL` and `VITE_GOOGLE_CLIENT_ID`; no such demo environment was supplied.
- Lint: not configured in `client/package.json` or `server/package.json`.
- Typecheck: not configured in `client/package.json` or `server/package.json`.

## AA. Manual validation

- Desktop browser: unavailable; no authenticated TEST rendering session was provided.
- Offline DevTools: unavailable.
- Browser restart: unavailable for live functional validation; source/IndexedDB durability was audited and covered by contracts.
- Account-switch: unavailable for live functional validation; fail-closed scope is covered by automated client tests.
- Android PWA: unavailable.
- No manual result is being inferred from automated tests.

## AB. Capability summary

Barangay officials can safely perform supported household registration, household update, departure/time-out, cached-owner-scoped stub claim, and supported distribution operations while already authenticated and holding the required local/reference context. Those operations are durably queued locally, retain their original logical identity, can be retried automatically/manual, and remain subject to server authorization, validation, conflict, and idempotency rules after reconnect.

Still online-required: login/OAuth and re-authentication; authoritative first-time reference loading; uncached stub verification; Distribution History, Sync History, Conflict Review, and Anomaly Tracking data; donations and disaster-event mutations; and any operation requiring server-only evidence or unavailable media.

## AC. Additional findings

- The generated PWA artifact initially lacked a manifest icon even though the existing logo was already bundled; this was fixed without changing branding.
- The repository has no lint/typecheck scripts, so static verification relies on the existing Node test suites and Vite build.
- The default test runners spawn child processes that are denied by this Windows sandbox (`EPERM`); serial test execution is a valid diagnostic fallback but does not change the configured scripts.

## AD. Remaining limitations

- No Background Sync API integration exists; a fully closed PWA waits until reopened/reconnected for page-driven processing.
- Full authoritative masterlist, distribution history, Sync History, Conflict Review, and anomaly datasets are not offline mirrors.
- The server suite cannot be green-verified without the configured TEST database environment; no live database access was used.
- Manual desktop/offline/restart/account-switch/Android validation was unavailable.
- The PWA manifest has one 363px branded icon rather than a full 192px/512px multi-resolution set.
- Browser storage eviction, quota exhaustion, private/incognito persistence, and device clock correctness remain platform/user-environment limitations.

## AE. Final verdict

READY FOR REVIEW

