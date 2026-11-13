# DISTYNC MSWDO Offline Stage 3 Parity Audit

Date: 2026-09-10
Baseline: `0108143cd87547b1e8944984fb614dec4648cf30`
Branch: `audit/rc1-mswdo-offline-parity-stage3-20260910`

The live `origin/release/testing-rc1` ref could not be reverified because GitHub
was unreachable. The local tracking ref points at the baseline above.

## Barangay offline capability inventory

| Capability | Implementation | Queue/cache/helper | Offline semantics |
|---|---|---|---|
| Preparation/readiness | `useBarangayOfflinePreparation`, `offlinePreparation` | `offlinePreparation`, generation guard, read-back | READY, PREPARING, NOT_READY, NEEDS_REFRESH with last-good cache |
| Context/cold start | `useBarangayDashboard`, operational event selection | mode/user/role/event-scoped storage | Restores event, actor context, cached rows and readiness for an authenticated owner |
| Masterlist | `useMasterlist`, `useBarangayMasterlistSync` | `offlineMasterlistCache`, `resolveEffectiveMasterlistRows` | Local search/filter/sort/pagination; valid empty is distinct from unavailable |
| Registration | shared `registerHousehold` | `HOUSEHOLD_REGISTER`, durable `syncQueue` | Immediate pending active occurrence; server validates and reconciles IDs |
| Re-admission | shared registration form in re-admission mode | `HOUSEHOLD_RE_ADMISSION` | New active occurrence; archived source remains immutable |
| Departure | `departHousehold` | `HOUSEHOLD_DEPART` | Immediate archived projection; original client timestamp retained |
| Lifecycle authority | shared client/server logic | `resolveEffectiveMasterlistRows`; server earliest valid departure | Sync state is separate from ACTIVE/ARCHIVED lifecycle state |
| Summary cards | `barangayDashboardOfflineMetrics` | complete cached rows + lifecycle projection | Deterministic counts; no fake zero on unavailable data |
| Relief distribution | stub service/cache | `STUB_CLAIM` and distribution queue operations | Cached, owner-scoped QR/manual claims only; unknown records are blocked |
| Photos | preparation hydration and shared resolver | durable data URL in prepared snapshots | Offline photo is available only when prepared and local; fail closed otherwise |
| Sync Center | `SyncManagementPage` | visible queue, history/conflict APIs | Queue is local-first; authoritative history/conflict views remain online-backed |
| Unsupported routes | offline access guards | `barangayOfflineAccess` | Disaster-event mutations, reports/history/anomalies stay online-only |

## MSWDO online authorization inventory

| Workflow | Online authorized | Evidence |
|---|---:|---|
| View masterlist/search/filter/sort | YES | `masterlist.routes.js`, `requireRoles(BARANGAY, MSWDO, MAYOR)` and MSWDO source-role protection |
| Register family | YES | `householdRegistration.routes.js`, `/register`, `requireRoles(BARANGAY, MSWDO)` |
| Edit family | YES | `PATCH /households/:householdId`, `requireRoles(BARANGAY, MSWDO)` |
| Re-admit family | YES | `PATCH /households/:householdId/restore` and new-occurrence registration contract, both MSWDO-authorized |
| Mark departure | YES | `POST /households/:householdId/depart`, `requireRoles(BARANGAY, MSWDO)` |
| View archived families | YES | MSWDO consolidated masterlist supports ended/archived status |
| Relief distribution / QR / manual stub / claim | YES | MSWDO stub distribution page and shared stub routes/services |
| Analytics | YES, read-only | MSWDO analytics page/service and dashboard endpoint |
| Distribution history | YES online, not offline | Server-backed history page/service; no authoritative local mirror |
| Disaster event management | YES online, not offline | Dedicated server-backed route; no mature offline conflict model |
| Anomaly tracking/reports | YES online, not offline | Server-authoritative review/report surfaces |

## Applicability matrix before implementation

| Capability | Barangay offline | MSWDO online | Applicable offline | Before | After | Status |
|---|---|---|---|---|---|---|
| Event restoration | READY | YES | YES | Already present | Confirmed | ALREADY PARITY |
| Preparation/readiness | READY/NEEDS_REFRESH | YES | YES | Already present | Confirmed | ALREADY PARITY |
| Masterlist cache | Complete event dataset | YES | YES | Present | Confirmed | ALREADY PARITY |
| Local filters/sort/pagination | Yes | YES | YES | Present | Confirmed | ALREADY PARITY |
| Family-head photos | Durable prepared resolver | YES | YES | Present | Confirmed | ALREADY PARITY |
| Registration | Queued local mutation | YES | YES | Shared queue exists | Confirmed | ALREADY PARITY |
| Editing | Shared queued update | YES | YES, where details cached | Shared queue; uncached detail online-only | Confirmed | ALREADY PARITY |
| Re-admission (new occurrence) | New occurrence, immutable archive | YES | YES | Shared form queues new occurrence | Confirmed | ALREADY PARITY |
| Return-to-center restore | Role workflow is online-only | YES | NO safe queued equivalent | Online-only `PATCH /restore` remains gated | Unchanged | ONLINE-ONLY BY DESIGN |
| Departure | Queued archived projection | YES | YES | Queue exists; MSWDO display omitted projection | Shared projection applied | FIXED |
| Archived lifecycle | Immutable history | YES | YES | Shared helper exists | Confirmed | ALREADY PARITY |
| Dashboard summary projection | Derived from effective rows | YES | YES | Stale cached metrics | Derived locally | FIXED |
| QR/manual distribution | Cached verified stubs | YES | YES | Present | Confirmed | ALREADY PARITY |
| STUB_CLAIM | Durable/idempotent | YES | YES | Present | Confirmed | ALREADY PARITY |
| Conflict handling | Shared server authority | YES | YES | Shared queue/Sync Center | Confirmed | ALREADY PARITY |
| Queue durability/reconnect | Durable scoped queue | YES | YES | Present | Confirmed | ALREADY PARITY |
| Cross-device departure convergence | Earliest original timestamp | YES | YES | Shared server path | Confirmed | ALREADY PARITY |
| Sync Center | Shared role-aware center | YES | YES for local queue | Present | Confirmed | ALREADY PARITY |
| Cold refresh | Restored context/cache/queue | YES | YES | Present | Confirmed | ALREADY PARITY |
| Valid-empty behavior | Legitimate empty snapshot | YES | YES | Present | Confirmed | ALREADY PARITY |
| Unsupported route handling | Explicit online-only | YES online | NO | Present | Confirmed | ONLINE-ONLY BY DESIGN |

## Proven gaps and safe disposition

1. MSWDO offline cached masterlist data did not consume the shared lifecycle
   projection helper, so pending registration/departure/re-admission rows and
   sync badges were not consistently reflected after refresh.
2. MSWDO offline dashboard data reused the last server snapshot, so summary
   cards could be stale after a local lifecycle mutation.

Both gaps are client-only and can reuse existing `syncQueue` and
`resolveEffectiveMasterlistRows`; no database, API, IndexedDB schema, or new
queue is required. Registration, re-admission, editing, and departure are
applicable because the online routes explicitly authorize MSWDO.

Features intentionally kept online-only: login/re-authentication, disaster
event mutations, event reports, distribution history, Sync History,
Conflict Review, anomaly tracking, and authoritative report generation. These
depend on server-only authority or lack a safe existing offline conflict model.
