# DISTYNC

DISTYNC is a disaster-relief management system for coordinated operations by
selected local government offices in Malvar, Batangas. It connects barangay
household and evacuee records with municipal disaster-event, distribution,
inventory, donation, forecasting, synchronization, and audit workflows.

This README is the concise technical guide for the current RC1 application. It
describes behavior and configuration implemented in the repository. Dated
audits, migration notes, and design specifications remain historical records;
see [Documentation](#documentation) for their scope.

## Overview

DISTYNC has a React/Vite browser client, an Express/Node.js API, a PostgreSQL
database connection, and an independent Python/FastAPI forecasting service.
The browser client is a Progressive Web App (PWA) with mode-scoped IndexedDB
offline preparation and queueing for selected workflows. The server remains
the authority for authentication, authorization, validation, conflict
resolution, and committed operational data.

The application has two explicit access modes:

| Environment purpose | Frontend | Backend | Development bypass |
| --- | --- | --- | --- |
| Local development | `DEVELOPMENT` | `DEVELOPMENT` | Exact `true`, only when intentionally enabled |
| Official demo | `DEMO` | `DEMO` | Disabled |
| Production deployment | `DEMO` | `DEMO` | Disabled |

`DEVELOPMENT` and `DEMO` are application access modes, not substitutes for
`NODE_ENV` or Vite's build mode. Both layers must be configured explicitly;
there is no missing-value fallback. `PRODUCTION` is not a DISTYNC access mode.

## Users and roles

The current internal authorized role codes are `BARANGAY`, `MSWDO`, and
`MAYOR`. `DONOR` represents the public donor-facing experience and does not
grant internal municipal permissions.

### Barangay Officials

Barangay users work within their assigned barangay scope. The current UI
provides:

- **Evacuee Masterlist Management** — `/barangay/masterlist`
- **Relief Goods Distribution** — `/barangay/stub-distribution`
- **Distribution History** — `/barangay/distribution-history`
- **Sync Center** — `/barangay/sync`
- **Anomaly Tracking** — `/barangay/anomalies`
- notifications, account settings, and printable stub output

The barangay workflow supports household/evacuee registration and masterlist
operations, disaster-event-aware admission and distribution records, and
stub/QR-assisted relief distribution. An archived historical occurrence is
view-only; a re-admission creates a new active occurrence rather than
mutating the archived record.

### Municipal Social Welfare and Development Office (MSWDO)

MSWDO users coordinate municipal-level disaster and beneficiary workflows. The
current UI provides:

- **Disaster Event Management** — `/mswdo/disaster-events`
- **Disaster Events Summary** — `/mswdo/disaster-reports`
- **Evacuee Masterlist Management** — `/mswdo/consolidated-masterlist`
- **Relief Goods Distribution** — `/mswdo/stub-distribution`
- **Distribution History** — `/mswdo/distribution-history`
- **Evacuee Analytics Dashboard** — `/mswdo/analytics`
- **Sync Center** — `/mswdo/sync`
- **Anomaly Tracking** — `/mswdo/anomalies`
- notifications, account settings, printable stub output, and the analytics
  dashboard alias `/mswdo/analytics-dashboard`

### Office of the Mayor

Mayor users manage the municipal inventory and public-donation operations. The
current UI provides:

- **Inventory Items Management** — `/inventory/items`
- inventory batches — `/inventory/batches`
- inventory transactions — `/inventory/transactions`
- **Relief Pack Templates Management** — `/inventory/relief-pack-templates`
- **Inventory Distribution Management** — `/inventory/distribution`
- **Inventory Forecasting Management** — `/inventory/forecasts`
- **Donation Management** — `/inventory/donations`
- **Inventory Tracking Management** — `/inventory/transactions`
- **Audit Trail** — `/inventory/system-logs`
- **Sync Center** — `/inventory/sync`
- **Anomaly Tracking** — `/inventory/anomalies`
- distribution history, notifications, and account settings

Inventory documentation is intentionally limited to implemented concepts:
items, batches, stock transactions, relief-pack templates, distribution,
forecasts, donations, and system logs.

### Public donor and NGO-facing portal

The public routes `/donations` and `/donor/information` provide aggregated
donation needs, public transparency/utilization information, and approved
contact/location information where configured. Public users do not receive
internal role access. The portal supports in-kind donation information; it
does not process cash or online payments.

Internal donation management remains an authorized Office of the Mayor
workflow.

## Core features

- Disaster-event-aware household and evacuee masterlists
- Household registration, admission, re-admission, and historical occurrence
  handling
- Barangay and municipal relief-goods distribution workflows
- Generated stub identities with QR verification and stub-number/serial
  fallback
- Inventory items, batches, stock transactions, relief-pack templates,
  distribution, forecasts, donations, and logs
- Public donation needs and transparency views
- Notifications, anomaly tracking, conflict review, and audit history
- PWA installation, scoped offline preparation, and reconnect synchronization
- Account Settings with controlled profile-picture upload and private storage

## Architecture and technology stack

```text
React/Vite PWA client
        │ API requests (HTTPS when deployed) and selected queued mutations
        ▼
Express/Node.js API ───────────────► PostgreSQL database
        │
        ├──► Supabase Storage (server-owned profile pictures)
        ├──► Resend (optional notification-email provider)
        └──► FastAPI analytics service (forecasting)
```

- **Client:** React, Vite, browser routing, service worker, and mode-scoped
  IndexedDB storage.
- **API:** Node.js and Express under `/api/v1`, with bearer-token
  authentication, role/scope checks, request validation, security middleware,
  and operational logging.
- **Database:** PostgreSQL configured through `DATABASE_URL` for normal runtime
  and `TEST_DATABASE_URL` for integration tests.
- **Analytics:** An independent Python/FastAPI service under `analytics/`.
  The Node API calls it through `ANALYTICS_SERVICE_URL`; the analytics service
  does not replace the application API or database.
- **Storage and email:** Supabase Storage is server-owned for profile
  pictures. Resend is optional for notification-email delivery.

## Offline and PWA capability

The service worker precaches the application shell and applies separate
runtime strategies to static assets, navigation, signed profile URLs, and
API requests. API requests use a network-only strategy; cached application
shell data must not be mistaken for a server-confirmed API response.

Offline capability is deliberately scoped:

- Offline IndexedDB databases and records are isolated by access mode and
  include authenticated user/role context. Operational preparation is also
  scoped to the relevant disaster event and barangay/municipal ownership.
- **Barangay:** prepared masterlist, stub/distribution, and selected
  distribution-transaction workflows are available offline.
- **MSWDO:** prepared consolidated-masterlist, analytics snapshot, and selected
  stub-distribution workflows are available offline. Event management,
  reports, distribution history, authoritative conflict/history views, and
  other unprepared operations remain online-only.
- **Office of the Mayor:** prepared inventory item/batch/transaction cache and
  selected create flows are available offline. Other inventory pages and
  online-only edits remain online-only.
- Queued work records a pending state locally. After reconnect, the client
  retries eligible work while the application is active and reports
  `SYNCED`, `CONFLICT`, `FAILED`, or `PENDING` outcomes.
- Offline work is not server-confirmed until synchronization succeeds. A
  fully closed application does not independently flush the queue; reopening
  the application allows the active synchronization path to run.
- Cached lookup data can support preparation and validation prompts, but it is
  not a substitute for server authority. Conflicts, duplicate prevention, and
  final committed state are resolved against the server.

### Sync Center

Every role's Sync Center uses the same tab order and names:

1. **Offline Queue**
2. **Conflict Review**
3. **Sync History**

Offline Queue is the local pending-work view. Conflict Review and Sync History
depend on the online-backed authoritative record and are disabled or limited
when the relevant server data is unavailable.

The service worker's navigation `networkTimeoutSeconds: 3` is a caching
strategy setting. It is not the application's normal-action performance
target.

## QR and stub behavior

DISTYNC generates a stub identity for a disaster-event/household distribution
record and can present a QR-linked verification flow through `/verify-stub`.
The user-facing QR link is built from `VITE_PUBLIC_APP_URL` when configured.
Printable and detail views use the display identity; the internal encoded QR
payload is not a required user-facing detail, and the final Stub Detail view
hides the raw encoded value.

Stub-number and serial-number identifiers provide a manual fallback. Server
validation is event-aware and checks the current claimable/active state.
Duplicate claims and other verification failures are rejected or recorded as
operational anomalies according to the current server policy. Offline lookup
can use prepared cached details, but claiming and final verification must be
revalidated by the server during synchronization or an online action.

## Security and authorization

- Demo and deployed access use Google OAuth client identity configuration and
  the normal authenticated RBAC flow. A Google client ID identifies the OAuth
  application; it does not assign a user's DISTYNC role.
- The API validates bearer tokens and applies role and scope middleware to
  internal routes. Under the normal auth flow, only active registered users
  with an authorized internal role can use internal workflows.
- Development authentication bypass is opt-in, exact-value, and available
  only when `SERVER_ACCESS_MODE=DEVELOPMENT`. It is not normal authentication
  and is rejected in `DEMO` mode.
- Express security middleware includes Helmet, CORS, request-size limits,
  structured validation, and operational logging. Demo/production deployment
  must configure explicit allowed frontend origins.
- Profile pictures use a private Supabase Storage bucket, server-generated
  object paths, and short-lived signed URLs. The Supabase service-role key is
  backend-only.
- `VITE_*` values are browser-visible configuration. A Supabase anon key, when
  used by the standalone browser adapter, is not a server secret; never put a
  database credential, JWT secret, or Supabase service-role key in the client
  environment file.
- `INVENTORY_STATE_BASIS_SECRET` is server-only material used for
  server-issued inventory stock-state basis signing and verification. Its
  value must never be committed, logged, or placed in client configuration.

DISTYNC documentation does not claim that the system is “100% secure,” that
all personally identifiable information is encrypted at rest, or that the
database is cryptographically immutable. The current PII encryption document
is a design specification, not an implementation or security sign-off.

## Access Mode Configuration

DISTYNC uses an explicit access mode for both the frontend and backend.
No access mode is guessed from `NODE_ENV`, Vite build mode, or missing
environment variables.

DISTYNC has exactly two application access modes:

| Environment purpose | Frontend | Backend | Development bypass |
| --- | --- | --- | --- |
| Local development | `DEVELOPMENT` | `DEVELOPMENT` | `true` when needed |
| Official demo | `DEMO` | `DEMO` | `false` |
| Production deployment | `DEMO` | `DEMO` | `false` |

### Frontend

Set `VITE_ACCESS_MODE` in `client/.env`.

- `VITE_ACCESS_MODE=DEVELOPMENT`
  Local development access. The development role switcher remains available.
- `VITE_ACCESS_MODE=DEMO`
  Official-facing demo access. The normal demo login and RBAC flow remain in use.

Use exact uppercase values only. `development`, `Demo`, and `PRODUCTION`
are invalid.

If `VITE_ACCESS_MODE` is missing or invalid, the normal React application
does not render. DISTYNC shows a configuration error screen instead.

`VITE_ACCESS_MODE` is consumed by the Vite build configuration and the
frontend runtime. Only `VITE_`-prefixed values are public browser
configuration; never place server secrets such as database credentials, JWT
secrets, or Supabase service-role keys in `client/.env`.

### Dedicated Frontend Builds

Use the dedicated frontend build commands when you want the build itself
to choose the access mode.

| Command | Access mode | Intended use |
| --- | --- | --- |
| `npm --prefix client run build:development` | `DEVELOPMENT` | Developer testing only |
| `npm --prefix client run build:demo` | `DEMO` | Official demo and deployment artifact |
| `npm run build:development` | `DEVELOPMENT` | Root wrapper for the client build |
| `npm run build:demo` | `DEMO` | Root wrapper for the client build |

These dedicated commands are authoritative. They set the intended
frontend mode themselves and do not rely on manually editing `client/.env`
before each build.

- `build:development` always targets `VITE_ACCESS_MODE=DEVELOPMENT` or fails.
- `build:demo` always targets `VITE_ACCESS_MODE=DEMO` or fails.
- `build:demo` must not silently produce a development-access artifact.
- Each build replaces the previous `client/dist` output.

The generic `npm run build` command remains a technical Vite build
command. It still requires a valid explicit `VITE_ACCESS_MODE` and does
not select the DISTYNC access mode for you. Use the dedicated build commands
for a mode-enforced artifact.

### Backend

Set `SERVER_ACCESS_MODE` in `server/.env`.

- `SERVER_ACCESS_MODE=DEVELOPMENT`
  Enables development-only server behavior when explicitly requested.
- `SERVER_ACCESS_MODE=DEMO`
  Enables official-facing demo behavior.

Use exact uppercase values only. `demo`, `Development`, and `PRODUCTION`
are invalid.

If `SERVER_ACCESS_MODE` is missing or invalid, the backend refuses to start.

### Development Authentication Bypass

Set `ENABLE_DEVELOPMENT_AUTH_BYPASS=true` only when development access is
intentionally required.

- Only the exact value `true` enables the bypass.
- Missing, empty, `false`, uppercase variants, spaced values, or invalid values keep the bypass disabled.
- The bypass works only when `SERVER_ACCESS_MODE=DEVELOPMENT`.
- `SERVER_ACCESS_MODE=DEMO` always rejects development login even if the bypass
  flag is `true`.
- `ENABLE_DEMO_AUTH_BYPASS` is not supported.

### Important Notes

- `PRODUCTION` is not a DISTYNC access mode.
- Official production deployments use `DEMO` on both frontend and backend.
- Vite build mode is not the DISTYNC access mode.
- `NODE_ENV` does not select the DISTYNC access mode.
- Development access and demo access are intentionally separate.
- Development access must never be used for official operations.

### Official Deployment Pairing

For an official-facing deployment:

- Build the frontend with `npm run build:demo`
- Set the backend to `SERVER_ACCESS_MODE=DEMO`
- Set `ENABLE_DEVELOPMENT_AUTH_BYPASS=false`

The frontend build command does not rewrite backend configuration. The
backend mode must still be configured separately.

## Browser Storage Isolation

DISTYNC now isolates browser-stored data by validated access mode.
`DEVELOPMENT` browser state is not reused in `DEMO`, and `DEMO` browser
state is not reused in `DEVELOPMENT`.

### What is isolated

- Authentication sessions use separate mode-specific keys.
- Selected roles use separate mode-specific keys.
- Account Settings cache is scoped by access mode, user ID, and role code.
- Registration reference cache uses mode-specific keys.
- IndexedDB offline data uses separate databases for `DEVELOPMENT` and `DEMO`.
- Offline queue records include access mode, user ID, and role code metadata.
- PWA runtime caches use mode-specific cache names.

### Account Settings cache lifecycle

Account Settings cache entries use mode-scoped keys and validated metadata.
DISTYNC stores them under keys shaped like:

- `distync:<ACCESS_MODE>:role-settings:<ROLE_CODE>:<USER_ID>`

Each cached value also records:

- Cache format version
- Access mode
- User ID
- Role code
- Cache timestamp

The cache is accepted only when the key and stored metadata both match the
current authenticated owner context.

### Account Settings cache cleanup

- Logout clears all Account Settings cache entries for the current user in the current mode.
- Switching to a different authenticated user clears the previous user’s Account Settings cache in the current mode.
- Switching between `DEVELOPMENT` and `DEMO` clears Account Settings cache entries for both modes.
- Invalid stored sessions and API authentication failures clear the affected Account Settings cache.
- Legacy unscoped settings cache entries such as `distync-role-settings:*` are deleted and never reused.
- Same-user, same-role, same-mode cache may still be used for offline fallback when the network fails but authentication remains valid.
- Unauthenticated state does not receive Account Settings cache fallback.
- Account Settings cache cleanup does not delete IndexedDB offline queue records or other operational offline data.

### Account Settings unsaved navigation protection

When Account Settings has unsaved profile, profile-picture, or notification
preference changes, in-app navigation away from Settings is intercepted by the
standard DISTYNC confirmation modal. Choosing Stay on This Page cancels the
navigation and preserves the draft. Choosing Discard Changes and Leave
continues to the originally requested route without saving.

Browser refresh, tab close, and external navigation use the browser-native
unsaved-changes warning while Settings is dirty. The unload listener is removed
when Settings is clean, after a successful Save Changes, after local discard, or
when Settings unmounts.

## Profile Picture Security

DISTYNC profile pictures are now treated as controlled authenticated account data.

### Storage model

- Account Settings uses controlled file upload only.
- Arbitrary external image URLs are not accepted for user profile pictures.
- Private profile pictures are stored in the `distync-profile-pictures` Supabase Storage bucket.
- The database stores a private object path and update metadata, not a permanent public URL.
- PostgreSQL persists `profile_picture_path` and related metadata only. Base64 profile-picture data is not stored.
- Base64 image content is used only as transient request transport during Save Changes.
- Display uses short-lived signed URLs returned by the backend.
- Signed URLs are not stored in PostgreSQL.
- Raw profile image data and Blob preview URLs are not stored in localStorage.
- Default avatar initials are shown when no profile picture is available.

### Backend behavior

- `GET /api/v1/settings/current` returns role settings plus fresh signed profile-picture metadata when a picture exists.
- Profile picture replacement/removal is persisted only through `PUT /api/v1/settings/current` when Account Settings saves.
- The backend generates the storage path server-side and ignores client-supplied user ownership.
- Replacing a picture uploads the new object first, updates the database, then removes the previous object after commit.
- If the database write fails after upload, the new object is deleted during cleanup.

### Upload rules

- Allowed MIME types: `image/jpeg`, `image/png`, `image/webp`
- Maximum size: 2 MB
- SVG is not accepted
- Empty uploads are rejected
- The backend keeps the decoded image/file limit at 2 MiB. Because Base64
  transport expands binary content by about 4/3, the request validator allows
  a larger bounded encoded string before the storage service decodes the image
  and enforces the 2 MB user-facing limit.
- Profile pictures are separate from household family-head verification photos

### Cache and session behavior

- Account Settings cache may store only safe profile-picture metadata such as path, file name, signed URL expiry, and update timestamp.
- Expired signed URLs are not reused from cache.
- Logout, user switching, and access-mode switching clear authenticated settings cache so another user’s signed URL is not reused.
- Offline fallback does not persist raw profile image content. When a valid signed URL is unavailable, DISTYNC falls back to the default avatar.

### Supabase setup

- Set `SUPABASE_SERVICE_ROLE_KEY` only on the backend.
- Do not expose the service-role key to frontend code.
- Keep the `distync-profile-pictures` bucket private.
- Apply the profile-picture hardening migration before using the feature in a shared environment.

### Mode switch behavior

When the same browser switches between `DEVELOPMENT` and `DEMO`:

- DISTYNC records the last validated access mode.
- Legacy unscoped auth, role, settings, and registration storage is removed.
- Mode-specific auth sessions and selected-role state are cleared.
- The app continues in an unauthenticated state.
- Previous-mode offline work is not transferred into the new mode.

Same-mode reloads still keep valid same-mode sessions and same-mode offline
data available.

### Legacy browser data

Legacy shared browser storage such as:

- `distync_auth_session`
- `distync_selected_role`
- `distync-role-settings:*`
- `distyncOfflineDb`
- `distync-pages`
- `distync-shell`
- `distync-static-assets`

is treated as unsafe for mode isolation. Legacy auth and role state is
removed. Legacy shared runtime caches are cleaned up. The old shared
IndexedDB database is deleted instead of being reassigned to `DEMO` or
`DEVELOPMENT`, because its original mode cannot be verified safely.

## Environment configuration

Use the checked-in templates:

- [root environment note](.env.example)
- [client/.env.example](client/.env.example)
- [server/.env.example](server/.env.example)

Create local `client/.env` and `server/.env` files from those templates. They
are ignored by Git. Never commit real secrets or copy a server service-role
key into a `VITE_*` variable.

### Client variables

| Variable | Required when | Purpose and safe handling |
| --- | --- | --- |
| `VITE_ACCESS_MODE` | Every client startup/build | Exact `DEVELOPMENT` or `DEMO`; no fallback. |
| `VITE_API_BASE_URL` | Required for a `DEMO` build; optional local fallback in development | API origin. Demo builds reject missing, invalid, or loopback values. |
| `VITE_GOOGLE_CLIENT_ID` | Required for a `DEMO` build | Google OAuth client identity; not a role assignment. |
| `VITE_PUBLIC_APP_URL` | Optional; configure for deployed QR links | Public application origin used to build user-facing QR links. |
| `VITE_SUPABASE_URL` | Optional standalone browser adapter | Browser-visible Supabase project URL; not a secret. |
| `VITE_SUPABASE_ANON_KEY` | Optional standalone browser adapter | Browser-visible anon key; never replace it with a service-role key. |

The dedicated `build:development` and `build:demo` scripts set and assert the
intended mode. `DISTYNC_BUILD_TARGET` is an internal build-helper variable and
is not a normal user-configured client secret or runtime setting.

### Server variables: required and security-sensitive

| Variable | Purpose |
| --- | --- |
| `SERVER_ACCESS_MODE` | Exact `DEVELOPMENT` or `DEMO`; required before startup. |
| `PORT` | API listen port; defaults to `5000`. |
| `DATABASE_URL` | PostgreSQL connection for normal runtime; required outside test mode. |
| `TEST_DATABASE_URL` | Dedicated PostgreSQL connection for integration tests; database name must include `test`. |
| `ALLOW_TEST_DB_MUTATIONS` | Must be exact `true` before mutating integration tests are allowed. |
| `GOOGLE_CLIENT_ID` | Google OAuth audience/client identity used by server token verification. |
| `JWT_SECRET` | Server token signing material; set a strong random value in shared and production environments. |
| `INVENTORY_STATE_BASIS_SECRET` | Required server-only signing/verification material for inventory stock-state basis tokens. |
| `CORS_ALLOWED_ORIGINS` | Comma-separated allowed frontend origins; required for `DEMO` and production server operation. |
| `NODE_ENV` | Controls test and production semantics; it does not select the DISTYNC access mode. |

### Server variables: integrations and optional tuning

| Variable | Purpose |
| --- | --- |
| `ANALYTICS_SERVICE_URL` | FastAPI analytics origin; defaults to `http://localhost:8000` and is required in production. |
| `ANALYTICS_TIMEOUT_MS` | Analytics request timeout; defaults to `15000`. |
| `SUPABASE_URL` | Canonical server-side Supabase project URL for profile-picture storage. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only Supabase Storage credential; never expose to the browser. |
| `PROFILE_PICTURE_STORAGE_BUCKET` | Profile-picture bucket name; defaults to `distync-profile-pictures`. |
| `OPEN_FOOD_FACTS_API_BASE_URL` | Optional inventory item lookup origin; defaults to `https://world.openfoodfacts.org`. |
| `RESEND_API_KEY` | Optional Resend provider credential for notification email. |
| `RESEND_FROM_EMAIL` | Resend sender address; provider approval/verification still applies. |
| `RESEND_FROM_NAME` | Resend sender display name; defaults to `DISTYNC`. |
| `EMAIL_NOTIFICATION_MAX_ATTEMPTS` | Notification-email retry limit; defaults to `3` when valid. |
| `EMAIL_NOTIFICATION_RETRY_BASE_SECONDS` | Base delay for notification-email retry; defaults to `900` seconds when valid. |
| `TEST_NOTIFICATION_EMAIL_RECIPIENT` | Required only by the opt-in controlled email verification command. |
| `ENABLE_STARTUP_MAINTENANCE` | Startup maintenance toggle; enabled unless set to exact `false`. |
| `ENABLE_INVENTORY_BATCH_STATUS_MAINTENANCE` | Optional inventory batch-status maintenance; enabled only by exact `true`. |
| `NOTIFICATION_SCAN_INTERVAL_MS` | Notification scan interval; defaults to `900000` ms. |
| `NOTIFICATION_OUTBOX_BATCH_SIZE` | Notification outbox batch size; defaults to `25`. |
| `INVENTORY_DOMAIN_EFFECT_BATCH_SIZE` | Inventory domain-effect batch size; defaults to `25`. |
| `INVENTORY_DOMAIN_EFFECT_SCAN_INTERVAL_MS` | Inventory domain-effect scan interval; defaults to `900000` ms. |
| `DATABASE_SSL` | Optional setting read by manual database scripts; not the normal API pool configuration. |
| `PUBLIC_DONATION_LOCATION_NAME` | Optional public donation receiving-location text. |
| `PUBLIC_DONATION_ADDRESS_LINE_1` | Optional public donation address text. |
| `PUBLIC_DONATION_ADDRESS_LINE_2` | Optional public donation address text. |
| `PUBLIC_DONATION_OFFICE_LINE_1` | Optional public donation office text. |
| `PUBLIC_DONATION_OFFICE_LINE_2` | Optional public donation office text. |
| `PUBLIC_DONATION_RECEIVING_DAYS` | Optional public donation receiving days. |
| `PUBLIC_DONATION_RECEIVING_TIME` | Optional public donation receiving hours. |
| `PUBLIC_DONATION_PHONE` | Optional public donation phone text. |
| `PUBLIC_DONATION_EMAIL` | Optional public donation email text. |
| `PUBLIC_DONATION_MAPS_URL` | Optional public donation map link. |

`ENABLE_DEMO_AUTH_BYPASS` is unsupported. The supported development-only flag
is `ENABLE_DEVELOPMENT_AUTH_BYPASS`, and it has effect only with
`SERVER_ACCESS_MODE=DEVELOPMENT`. `VITE_SUPABASE_URL` may be recognized by a
server-side compatibility fallback for profile storage, but `SUPABASE_URL` is
the canonical server setting and the service-role key remains server-only.

### Authentication configuration

Google OAuth configuration and DISTYNC role assignment are separate concerns:
the client and server Google client IDs identify the OAuth application, while
the server authorizes an active registered user and internal role. Configure
the authorized redirect/origin settings in Google for the actual client URL.
Use the development bypass only for explicitly controlled local development;
it is not a demo or production login path.

### Email configuration

Resend configuration is optional. If it is absent, the application does not
promise provider-backed notification-email delivery. When configured, the
outbox worker applies the implemented attempt and delay settings; provider
acceptance is not the same as mailbox receipt. The controlled verification
command is limited to development/test environments and requires an explicit
recipient.

### Analytics configuration

Forecasting is served by the independent FastAPI application. In a local
two-service setup, point `ANALYTICS_SERVICE_URL` at the analytics process. A
production server must set an explicit analytics URL; the local default is
not a production deployment configuration.

## Prerequisites

- Node.js and npm for the root, client, and server packages
- Python and pip (or an equivalent Python environment) for the analytics
  service
- A PostgreSQL database reachable through `DATABASE_URL`
- A Google OAuth client configuration for `DEMO` access
- Supabase Storage configuration when using profile pictures
- Resend configuration only when provider-backed email is required

Version constraints are maintained by the package manifests and deployment
environment rather than duplicated here.

## Local development

1. Install dependencies for the root, client, and server packages:
   `npm install`, `npm --prefix client install`, and
   `npm --prefix server install`.
2. Copy [client/.env.example](client/.env.example) to `client/.env` and
   [server/.env.example](server/.env.example) to `server/.env`.
3. For local development, set both access modes to `DEVELOPMENT`, configure a
   development `DATABASE_URL`, and enable
   `ENABLE_DEVELOPMENT_AUTH_BYPASS=true` only if a controlled local bypass is
   needed. Set a real server-only `JWT_SECRET` and
   `INVENTORY_STATE_BASIS_SECRET` for shared environments.
4. Start the client and API together with `npm run dev`. The individual
   commands are `npm run dev:client` and `npm run dev:server`.
5. Start the optional analytics service from the repository root with:

   ```text
   python -m uvicorn analytics.app.main:app --host 127.0.0.1 --port 8000
   ```

The development client uses the local API fallback when
`VITE_API_BASE_URL` is not set. Prefer setting it explicitly when working
with more than one local service or browser origin.

## Testing

The repository has separate client and server test commands; there is no root
`npm test` script.

| Scope | Command | Notes |
| --- | --- | --- |
| Client tests | `npm --prefix client test` | Runs the client Node test command. |
| Server unit tests | `npm --prefix server run test:unit` | Equivalent to `npm --prefix server test`. |
| Server integration tests | `npm --prefix server run test:integration` | Requires a dedicated test database and `ALLOW_TEST_DB_MUTATIONS=true` for mutating coverage. |
| Controlled notification-email check | `npm --prefix server run verify:notification-email` | Development/test only; provider acceptance is not mailbox receipt. |

Integration-test configuration fails closed when the test database is missing,
does not include `test` in its database name, or mutation authorization is not
explicitly enabled. Do not point integration tests at an operational database.

## Build

Use the mode-enforced root wrappers for release artifacts:

```text
npm run build:development
npm run build:demo
```

The equivalent client commands are `npm --prefix client run build:development`
and `npm --prefix client run build:demo`. The generic
`npm run build` delegates to Vite and requires a valid explicit
`VITE_ACCESS_MODE`; it does not choose a mode. A `DEMO` build also requires a
valid non-loopback `VITE_API_BASE_URL` and `VITE_GOOGLE_CLIENT_ID`.

Each client build replaces the previous `client/dist` output. Pair an
official/deployed `DEMO` frontend artifact with `SERVER_ACCESS_MODE=DEMO` and
`ENABLE_DEVELOPMENT_AUTH_BYPASS=false`.

## Deployment

An official deployment uses the `DEMO` configuration on both layers:

1. Build the client with `npm run build:demo`.
2. Configure the server with `SERVER_ACCESS_MODE=DEMO`.
3. Set `CORS_ALLOWED_ORIGINS` to the exact deployed frontend origin(s).
4. Set production database, OAuth, JWT, inventory-state-basis, and any
   Supabase/Resend/analytics credentials in the deployment secret store.
5. Keep `ENABLE_DEVELOPMENT_AUTH_BYPASS=false` and do not expose server
   secrets through client environment variables.

Use HTTPS at the deployed boundary and configure the Google OAuth origins and
redirects for the actual public client URL. Deployment providers and process
managers are outside this repository's source-level contract; validate their
runtime environment separately.

## Performance and validation targets

The current non-functional target for applicable normal user actions,
dashboard views, reports, and analytics is within 5 seconds under standard
conditions. Recorded capacity requirements are 100 simultaneous
transactions/minute, 50–75 concurrent users, and 200–300 API requests/minute.
These are requirements/targets, not a measured production SLA.

UAT acceptance is reported qualitatively unless an approved record supplies
participants, dates, or measurements. Documentation must not invent those
details.

The approved current RC1 security summary is **22/22 PASSED**. Where the
frozen performance and reliability scope is summarized, it uses **19 unique
performance cases** and **10 unique reliability cases**. These counts describe
the approved test scope/result record; they are not a production SLA or a new
docs-only test run.

## Repository structure

```text
client/       React/Vite PWA and browser-side workflows
server/       Express API, services, validation, and server tests
analytics/    Independent Python/FastAPI forecasting service
database/     Database and migration assets
docs/         Current notes plus dated audit, evidence, and design records
```

Application behavior is defined by the current source under `client/`,
`server/`, and `analytics/`. Database, migration, schema, service-worker, and
test files are implementation or evidence surfaces and are not changed by a
documentation-only finalization.

## Documentation

- [Notification final provenance](docs/architecture/notification-final-provenance.md)
  is the short current notification reference.
- Dated files under `docs/audits/` are historical offline audits and preserve
  their original scope, limitations, branches, and commit references.
- Dated notification remediation, legacy-policy, and archive files under
  `docs/architecture/` are historical/evidence records, not current feature
  promises.
- [PII encryption design specification](docs/architecture/rc1-pii-encryption-design-specification-20260911.md)
  is explicitly design-only and must not be read as implemented encryption or
  a completed security sign-off.
- Formal capstone reports, PDFs/DOCX deliverables, and user manuals are
  outside this repository documentation finalization scope.

