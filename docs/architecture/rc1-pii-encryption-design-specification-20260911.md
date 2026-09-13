# DISTYNC PII Encryption Design Specification

Design-only artifact prepared against the latest fetched origin/release/testing-rc1. This document records the verified RC1 baseline, the proposed encryption boundary, migration design, test design, and implementation gates. It does not constitute an implementation or production security sign-off.

## A. Repository State

| Item | Verified state |
|---|---|
| Audit base | origin/release/testing-rc1 |
| Remote commit | 5549ff39abc5049bc4be643e26ed119f0ea90bec |
| Commit date | 2026-09-11T21:43:28+08:00 |
| Commit subject | fix(inventory): harden transaction and distribution tracking |
| Main checkout | C:\dev\distync, branch release/testing-rc1, clean |
| Isolated design worktree | C:\dev\distync-pii-encryption-design-20260911, branch design/rc1-pii-encryption-spec-20260911, clean |
| Existing impact worktree | C:\dev\distync-pii-encryption-impact-20260911 was observed and left untouched |
| Remote fetch | Completed for origin release/testing-rc1; remote SHA matched the local audit base |
| Source changes | None |
| Test changes | None |
| Schema/migration changes | None |
| Database connection | Not attempted |
| Database mutation | Not attempted |
| Environment/Supabase/Render changes | None |
| Commit/push/merge/deployment | Documentation-only commit created for this specification update; push, merge, and deployment not performed |

The report is intentionally stored only in the isolated design worktree as a documentation-only artifact. It is not an application source file, test file, schema file, or migration.

The repository contains the relevant Node/Express backend, React/Vite PWA, PostgreSQL schema/migrations, Supabase Storage integration, offline Dexie stores, sync/conflict services, reports, notifications, audit/error logging, and an inventory-only FastAPI forecasting service. The checked-in schema contains the principal operational tables, but no checked-in CREATE POLICY or ENABLE ROW LEVEL SECURITY statements were found in the reviewed schema/migration tree. Live RLS state is therefore not confirmed.

## B. Design Executive Summary

DISTYNC RC1 currently stores and transports substantial beneficiary, staff, donor, consent, operational, audit, notification, synchronization, and photo data as readable values. The most important exposure is not one isolated table: the same identity data is copied through API DTOs, server-side JSONB payloads, audit and notification records, browser localStorage, Dexie IndexedDB, offline preparation snapshots, QR/stub detail responses, and report buffers.

The recommended target is a layered design:

1. Keep authorization, event/barangay scope, relational identifiers, workflow state, approved structured demographic classifications, and aggregate facts operationally queryable.
2. Encrypt raw PII and sensitive fields with AES-256-GCM using a versioned authenticated envelope.
3. Add separate HMAC-SHA-256 blind-index columns only for approved exact-match lookups. Never use a plain hash as a private search index.
4. Perform authorization and barangay/event scope checks before any decryption or signed-photo URL creation.
5. Replace family-head photo data URLs with opaque private-storage paths and short-lived, authorized signed URLs. Application-level encryption of photo bytes is not required for the minimum capstone; encrypt any approved offline photo bytes separately.
6. Encrypt the PWA’s offline payload and PII caches with a per-device/per-installation Web Crypto key. Destroy the key and purge protected data after safe logout, account/mode switch, revocation, or retention expiry, but do not silently destroy unresolved protected offline work.
7. Keep sync routing metadata minimal and readable, while encrypting the payload body at rest in IndexedDB and in server sync/conflict records.
8. Minimize logs, notifications, browser-visible duplicate results, and exports before considering encryption of residual display text.
9. Roll out additively with dual-read/dual-write, backfill, validation, rotation, and rollback gates. Do not drop legacy plaintext until all readers, clients, offline queues, reports, and recovery procedures have passed validation.

Current decision: READY AFTER BLOCKERS, not ready for immediate production encryption coding. The blockers are the unconfirmed live database/RLS posture, the need to stabilize the current PWA/offline/sync contract, the absence of approved key custody and retention decisions, and the need for a disposable migration-test database. The design itself is sufficiently concrete to begin a gated implementation after those decisions.

## C. Verified Audit Baseline

The following findings were rechecked against the RC1 source tree rather than carried forward as assumptions.

| Previous audit finding | RC1 verification | Evidence |
|---|---|---|
| No application-level PII encryption boundary | Confirmed | No field-encryption service or AES-GCM PII envelope was found. Existing uses of Node crypto are for UUIDs and public grouping behavior, not confidential field encryption. |
| Offline PII is readable | Confirmed | client/src/offline/syncQueue.js stores the complete mutation payload; masterlistCache.js, offlinePreparation.js, mswdoOfflinePreparation.js, and stubCache.js persist readable names, addresses, contacts, photos, and related snapshots. |
| Family-head photos can be data URLs | Confirmed | householdRegistration.service.js accepts/stores family_head_photo_url; offline preparation converts a fetched photo or data URL to a Base64 data URL. |
| Staff profile photo flow is stronger | Confirmed | profilePictureStorage.service.js validates bytes, uploads to a private Supabase Storage bucket through the server service role, stores an opaque path, and returns a short-lived signed URL. |
| Search and duplicate detection read plaintext | Confirmed | householdRegistration.repository.js, masterlist.repository.js, donation.repository.js, and the client local duplicate/search modules compare or search names, contacts, addresses, and donor values directly. |
| Sync/conflict records can contain identity payloads | Confirmed | sync.repository.js stores payload_json, local_payload_json, server_payload_json, and resolved_payload_json as JSONB. sync.service.js inspects family-head, donor, claimant, and remarks fields. |
| Audit/error/notification values can contain PII | Confirmed | systemLog.js and systemLog.repository.js persist old/new values, error context, and stack data; notification services interpolate family-head names; system-log detail allowlists include donor/contact/claimant/remarks fields. |
| QR values contain direct names/contacts | Not found in the current format | buildStubQrCodeValue builds DISTYNC-STUB|disasterEventId|householdId|stubNo. It is a stable linkable identifier, not a direct PII payload. |
| RLS is enabled and protecting live rows | Not confirmed | No checked-in policy/enable statements were found, and no live database connection was made. |
| Central PII key management exists | Not found | No PII data-key/HMAC-key configuration or key-version registry was found. |
| JWT/session data is browser-resident | Confirmed | The client stores the auth session in mode-scoped localStorage and locally decodes the JWT for expiry. The token payload includes user identity fields such as email and default barangay scope. |
| Analytics receives raw beneficiary PII | Not seen in the reviewed analytics contract | The FastAPI forecasting request contains inventory item identity, inventory labels, stock, and usage series only. The authentication and network exposure boundary for the analytics service is not confirmed and must be verified separately. |

Important current code paths:

- server/src/repositories/householdRegistration.repository.js: plaintext household/member inserts, exact normalized duplicate queries, and detail queries.
- server/src/services/householdRegistration.service.js: duplicate suggestion construction, household response mapping, registration side effects, notification text, and audit calls.
- server/src/repositories/masterlist.repository.js and server/src/services/masterlist.service.js: plaintext masterlist search, sorting, dashboard projection, and identity-bearing exports.
- client/src/offline/db.js: Dexie versions 2 through 5 for sync queue, stub cache, masterlist cache, preparation state, and inventory cache.
- client/src/offline/syncQueue.js and client/src/offline/syncService.js: full readable payloads are queued locally and submitted to /api/v1/sync/process.
- client/src/features/mswdo-masterlist/mswdoMasterlistOffline.js: client-side partial search uses readable family-head names, addresses, sectors, dates, and barangay values.
- server/src/utils/systemLog.js, server/src/repositories/systemLog.repository.js, and server/src/services/systemLog.service.js: readable audit/error values and identity-bearing system-log review.
- server/src/modules/notifications/notification.service.js and notification.repository.js: readable notification title/message/metadata, including family-head names in registration and attendance notifications.

### Verified route and store touchpoints

The following route and store names were read from RC1 and are the concrete integration points for a later implementation:

- /api/v1/households/duplicate-suggestions, /api/v1/households/register, /api/v1/households/:householdId, /api/v1/households/:householdId/archive, /api/v1/households/:householdId/restore, /api/v1/households/:householdId/evacuation-logs/:evacuationLogId/correct, and /api/v1/households/:householdId/depart in server/src/routes/householdRegistration.routes.js.
- /api/v1/masterlist/barangay-dashboard, /api/v1/masterlist/mswdo-dashboard, /api/v1/masterlist/export-metadata, /api/v1/masterlist/export, and /api/v1/masterlist/ in server/src/routes/masterlist.routes.js.
- /api/v1/distribution-transactions/inventory-distribution/export-options, /api/v1/distribution-transactions/inventory-distribution/export, /api/v1/distribution-transactions/inventory-distribution/:stubId, /api/v1/distribution-transactions/history, /api/v1/distribution-transactions/history/export, /api/v1/distribution-transactions/claim-from-qr, and /api/v1/distribution-transactions/ in server/src/routes/distributionTransaction.routes.js.
- /api/v1/donations/management-transparency, /api/v1/donations/public-portal, /api/v1/donations/export/transparency, /api/v1/donations/export/received, /api/v1/donations/needs, /api/v1/donations/:id/public-name, /api/v1/donations/:id/detail, /api/v1/donations/:id, /api/v1/donations/:id/items, /api/v1/donations/items/:id, and /api/v1/donations/items/:id/reassign-leftover in server/src/routes/donation.routes.js.
- /api/v1/stubs/barangay-dashboard, /api/v1/stubs/municipal-dashboard, /api/v1/stubs/search, /api/v1/stubs/:id/claim, /api/v1/stubs/history, /api/v1/stubs/history/export, /api/v1/stubs/:id, and /api/v1/stubs/verify in server/src/routes/stub.routes.js.
- /api/v1/sync/retry-audit, /api/v1/sync/process, /api/v1/sync/status-summary, /api/v1/sync/history, /api/v1/sync/conflicts/:conflictId, and /api/v1/sync/conflicts/:conflictId/resolve in server/src/routes/sync.routes.js.
- /api/v1/notifications/rules/current, /api/v1/notifications/, /api/v1/notifications/unread-count, /api/v1/notifications/:id/read, and /api/v1/notifications/read-all in server/src/modules/notifications/notification.routes.js.
- /api/v1/system-logs/review in server/src/routes/systemLog.routes.js, guarded by the SYSTEM_LOG_REVIEW policy.
- Dexie stores syncQueue, offlineStubCache, offlineMasterlistCache, offlinePreparation, and offlineInventoryCache in client/src/offline/db.js; mode-scoped localStorage auth-session, selected-role, role-settings, and registration reference keys in client/src/utils/modeStorage.js; and mode-scoped offline-device-id in client/src/offline/deviceIdentity.js.

## D. Final PII Classification Matrix

Classification is by field or data product, not by table alone. A relational row can contain Class A encrypted fields, Class C scope fields, and Class F workflow fields at the same time.

| Class | Meaning | Default treatment |
|---|---|---|
| A | Raw sensitive direct PII or identity-bearing household/member fact | AES-256-GCM field encryption; no direct SQL search; decrypt only after authorization |
| B | Direct identifier or exact-match identity value | AES-256-GCM plus a separately keyed HMAC blind index when the feature genuinely needs exact lookup |
| C | Operational, authorization-bearing, or approved structured demographic value | Keep queryable where required, but protect sensitive values with RBAC, event/barangay/municipality scoping, least-privilege DB access, and retention controls |
| D | Derived/display/log/notification value | Minimize, redact, aggregate, or replace with stable references; encrypt residual value only when retention is justified |
| E | Binary/photo object | Capstone: private object storage with an opaque path and authorized short-lived signed URL; encrypt any offline copy. Application-level object encryption is optional production hardening when the LGU threat model requires it |
| F | Non-PII or low-risk operational metadata | Keep queryable subject to normal integrity, retention, and authorization controls |

### Identity, household, member, and consent data

| Source/table and fields | Class | Design treatment |
|---|---|---|
| users.first_name, middle_name, last_name | B | Encrypt each value; store component and, where approved, composite name HMAC tokens for exact matching. Do not put names in JWTs. |
| users.email | B | Encrypt; maintain a normalized email HMAC token for login lookup. Email is never exposed as a search derivative to the browser. |
| users.google_sub | B | Encrypt or replace with an opaque provider identifier; maintain a provider-sub HMAC token for exact authentication lookup. |
| users.contact_number | B | Encrypt; maintain a canonical phone HMAC token only if exact contact lookup is required. |
| users.default_barangay_id, is_active, role relations, timestamps | C/F | Required for authorization and workflow; retain queryable with strict scope checks. |
| households.family_head_first_name, middle_name, last_name, suffix | B | Encrypt; maintain component/composite HMAC tokens for approved duplicate detection. No plaintext name search column by default. |
| households.contact_number | B | Encrypt; maintain phone HMAC token for exact duplicate corroboration only. |
| households.birth_date, current_address_details, photo_verification_notes | A | Encrypt; use bounded authorized retrieval for filtering or review. |
| households.sex, approved age-group and other standardized demographic categories where represented, and standardized sector/classification IDs used for official counts | C (sensitive) | Keep queryable for authorized aggregation/filtering, with strict RBAC, event/barangay scope, least-privilege DTOs, and retention controls. Do not treat queryability as public access. Encrypt identity-bearing detail or free-text notes instead. |
| households.household_size, is_active, registration timestamps, event/barangay/center/registrar FKs | C/F | Queryable for scope, joins, aggregates, and workflow. Do not expose more than the requester needs. |
| evacuees.first_name, middle_name, last_name, suffix | B | Encrypt; exact-match HMAC tokens only for approved duplicate workflows. |
| evacuees.birth_date and identity-bearing member detail | A/B | Encrypt the exact date of birth and direct identity-bearing values. Do not retain an exact readable birth date merely to derive age. |
| evacuees.sex, approved age group, civil-status/relationship categories where represented, pregnancy/lactation/PWD/Indigenous/4Ps and other standardized vulnerable-sector classifications, and sector relation IDs | C (sensitive) | Keep standardized categories and relational sector links queryable where required for authorized disaster-response counts, filtering, and aggregation. Apply RBAC, event/barangay scope, least-privilege DTOs, and retention controls; do not expose them through public or cross-scope endpoints. |
| evacuees.household_id, sector_id, is_family_head, is_active, timestamps | C/F | Keep relational/workflow metadata queryable, with authorization because relationships can reveal sensitive facts. |
| household_privacy_consents.acknowledged_by_name, representative relationship | A | Encrypt; retain consent status/version/timestamp as operational evidence. |
| household_privacy_consents.consent_status, notice version, acknowledged/recorded timestamps, actor/device/household/event FKs | C/F | Queryable for consent enforcement and audit, with narrow access. |

### Exact DOB versus derived age group

The exact date of birth is direct personal data and remains protected, for example `birth_date_enc`. A derived operational category such as `age_group = Adult` or `age_group = Senior Citizen` may remain queryable when required for authorized reporting. Do not retain a readable exact birth date merely to calculate or display the age group.

### Distribution, donations, and photos

| Source/table and fields | Class | Design treatment |
|---|---|---|
| distribution_transactions.claimed_by_name | B | Encrypt; exact token only if a real lookup requirement exists. Prefer actor ID for staff and do not duplicate a display name unnecessarily. |
| Distribution remarks, receipt/proof notes, and free text | A/D | Encrypt or redact; validate against accidental PII and cap length. |
| Distribution household/stub/event/device/verifier FKs, status, dates, sync state, receipt status | C/F | Queryable for workflow and authorization. |
| distribution_transactions.qr_reference_value and stubs.qr_code_value | C | Keep as a linkable operational identifier for the current flow; never treat possession as authorization. Consider an opaque random token in a future QR version. |
| Distribution item snapshots and donor snapshot fields | D/B | Keep item/catalog fields operational; encrypt donor name and any donor contact; remove donor names from derived remarks. |
| donations.donor_name | B | Encrypt; HMAC exact token for authorized donor search/rename only. |
| donations.contact_information | B | Encrypt; use a separately scoped contact HMAC only if exact matching is needed. |
| donations.donor_type, opt-in public flag, received/status/date/actor/event FKs | C/F | Keep workflow metadata queryable; public display is a separate policy-controlled derivative. |
| donations.donor_type_other, remarks | A/D | Encrypt or minimize. Do not place donor identity into inventory transaction remarks. |
| donations.donor_name_public | D | Treat as a disclosure policy flag, not as permission to expose the private donor field. Generate a separately reviewed public display value. |
| households.family_head_photo_url and photo bytes | E | Replace data-URL semantics with an opaque private-storage path plus approved metadata; return only short-lived authorized signed URLs. Application-level object-byte encryption is not a minimum capstone requirement; offline copies are encrypted locally. |
| user_role_settings.profile_picture_path and profile image bytes | E | Retain the existing private-storage pattern and apply the same signed-URL/no-data-URL rule. |

### Logs, notifications, synchronization, authentication, and analytics

| Source/data product | Class | Design treatment |
|---|---|---|
| audit_logs.old_values_json, new_values_json | D/A | Prefer safe allowlisted deltas containing IDs/statuses. Encrypt any retained identity-bearing detail as a versioned envelope. |
| error_logs.error_message, stack_trace, context_json | D/A | Redact names/contact/address/token/photo values before persistence. Encrypt residual diagnostic context if retention is approved. |
| Notification title/message/metadata | D | Use IDs, generic household references, and severity; do not interpolate family-head or donor names. Encrypt only necessary retained private detail. |
| sync_transactions.payload_json and conflict local/server/resolved JSON | A/D | Store the payload body as an encrypted envelope; keep only routing/dedup/status metadata readable. |
| Sync client ID, action/entity type, local/server IDs, device ID, event/barangay scope, timestamps, status | C/F | Queryable routing metadata with minimum disclosure; it can reveal activity volume and timing. |
| JWT access token, localStorage auth session, selected role | D/security secret | Minimize JWT claims; move to an HttpOnly/SameSite session design when separately approved. Never store PII keys or decrypted records with the token. |
| QR/stub identifiers and public event/catalog metadata | C/F | Operationally queryable but scoped; no PII should be encoded. |
| Forecast/analytics input and output | F/C | Keep inventory aggregates and item labels; prohibit beneficiary names, contacts, addresses, photos, and raw household rows. Verify service authentication before production exposure. |

## E. Final Encryption Boundary

The boundary is intentionally selective.

### Inside the boundary

- Raw names, email, phone, exact address, exact birth date, consent/representative values, claimant/donor free text, identity-bearing remarks, raw beneficiary/member identity values, and retained identity-bearing audit/error/notification detail.
- Sync mutation payload bodies and conflict payload bodies.
- Approved offline copies of family-head/staff photos and other PII, encrypted with the browser/device key.
- Browser caches and IndexedDB records that contain a name, address, contact, photo, household/member detail, donor detail, or complete registration payload.
- Any future field not listed as operational but capable of identifying or materially describing a person.

### Outside the encrypted field boundary, but still protected

- Primary keys and foreign keys required for authorized joins.
- Disaster-event and barangay scope keys required for routing and authorization.
- Roles, policy codes, workflow status, timestamps, counts, boolean lifecycle flags, and catalog/inventory fields that do not identify a person.
- Standardized structured demographic categories and sector relationship keys required for authorized official counts, filtering, dashboards, and aggregation. These remain sensitive linkable data and are not public or unrestricted.
- Exact birth dates are not outside the boundary merely because a derived age group is queryable; store the exact date only in its protected form and retain the derived category separately when operationally required.
- Family-head photo bytes in the capstone private object-storage boundary. The capstone protects them through private storage, server-controlled upload, record/event/barangay authorization, opaque paths, and short-lived signed URLs; application-level object-byte encryption is a production option, not a capstone prerequisite.
- QR/stub values in the current operational format, provided they contain no PII and every verification/detail route retains authentication and scope checks.
- Approved aggregate analytics such as counts by event, barangay, sector, inventory item, status, or date bucket.

Keeping a value queryable is not permission to expose it. Queryable operational metadata must still be server-scoped, rate-limited where appropriate, retained only as long as necessary, and unavailable to browser clients that do not need it.

### Design note for implementation and paper wording

The architecture distinguishes between (1) application-level encryption of direct PII, (2) RBAC/scope-protected structured demographic data required for authorized LGU aggregation, (3) private object-storage protection for family-head photos, and (4) browser-side encryption for offline copies. These categories must not be described as if every sensitive value or photo object uses the same encryption mechanism.

### Transport and rendering boundary

All client/server traffic remains TLS-protected. Database encryption does not replace TLS. Decryption occurs in backend memory only after authorization and only for the response or operation that needs it. The client may render authorized plaintext in memory, but must not persist it to generic localStorage, service-worker runtime caches, URL query strings, telemetry, console logs, or download filenames.

## F. Cryptographic Design

### Recommended primitive

Use AES-256-GCM for field and payload confidentiality and integrity:

- AES key: 32 random bytes.
- Nonce/IV: a fresh random 12-byte value for every encryption operation.
- Authentication tag: 16 bytes.
- Ciphertext: authenticated ciphertext bytes.
- No nonce reuse under the same key.
- Decryption must verify the tag before returning any plaintext.

Use the Node.js built-in crypto module on the server and the browser Web Crypto API for offline storage. Adding a general-purpose crypto package is not required for this design and would add supply-chain surface.

### Versioned envelope

For ordinary encrypted text fields, use one encoded text envelope in a new shadow column:

    enc:v1:<key-id>:<base64url(iv)>:<base64url(tag)>:<base64url(ciphertext)>

For binary offline values, use the same logical components in a compact binary or base64url representation. The envelope parser must validate version, algorithm, key ID, component lengths, and encoding before decryption.

One encoded envelope is preferred over separate IV/tag/ciphertext columns for RC1 because it is additive, self-describing, easier to backfill idempotently, and can support future versions without changing every consumer. Separate columns are acceptable for high-volume binary storage only after a measured storage decision; they are not required by this specification.

### Additional authenticated data

Bind the ciphertext to its intended use with AAD containing stable non-secret context, for example:

    envelope-version | table | column/purpose | record-id | event-id | barangay-id | access-mode

Do not put a secret in AAD. A copy of a ciphertext into a different record, column, event, or purpose must fail authentication. AAD changes are a compatibility-breaking envelope version change.

### Key separation

Never reuse a data-encryption key as a blind-index HMAC key or an offline-device key:

- PII_DATA_KEY_vN: AES-256-GCM for server field/payload encryption.
- PII_LOOKUP_HMAC_KEY_vN: HMAC-SHA-256 for exact-match blind indexes.
- OFFLINE_DEVICE_KEY_vN: browser-generated key for local protected storage.
- A separate signing/session secret remains an authentication concern and is not a PII encryption key.

### Plaintext failure policy

After the migration grace period, malformed envelopes, unknown key versions, tag mismatches, missing keys, and AAD mismatches fail closed. Do not silently return a legacy plaintext value after an encrypted value exists. During migration, legacy fallback is permitted only behind an explicit feature flag, with a metric/audit event that contains no plaintext.

## G. Backend Crypto Service Design

The proposed central service is server/src/services/piiCrypto.service.js. It is a design name only; no file was created.

### Responsibilities

The service should expose a small, typed API:

- encryptValue({ value, purpose, recordId, scope, keyVersion })
- decryptValue({ envelope, purpose, recordId, scope })
- encryptJson({ value, purpose, recordId, scope })
- decryptJson({ envelope, purpose, recordId, scope })
- generateLookupToken({ field, canonicalValue, scope, hmacVersion })
- verifyEnvelope(envelope)
- isEncryptedEnvelope(value)
- getKeyMetadata() without returning key bytes

The service owns envelope parsing, key lookup, AAD construction, byte encoding, Unicode/string normalization at the crypto boundary, typed errors, and constant-time comparison where applicable. It must not own RBAC decisions.

### Layering rule

Repositories retrieve ciphertext, blind-index tokens, and scope columns. They do not decrypt, format PII, or decide whether a requester may see a person. Services first establish role and event/barangay/record authorization, then call the crypto service for the minimum fields required. Controllers/routes remain responsible for HTTP status mapping and must never catch a crypto error by returning the original database value.

### Error model

Use stable non-sensitive codes such as:

- PII_ENCRYPTION_FAILED
- PII_DECRYPTION_FAILED
- PII_AUTH_TAG_MISMATCH
- PII_UNKNOWN_KEY_VERSION
- PII_MALFORMED_ENVELOPE
- PII_LOOKUP_TOKEN_INVALID
- PII_KEY_UNAVAILABLE
- PII_AUTHORIZATION_REQUIRED

Client-facing messages must be generic. Server logs may include the code, purpose, table, record ID, request correlation ID, and key version, but never the key, plaintext value, ciphertext, token input, full payload, or decrypted stack variables.

### Memory and response rules

Decrypt only inside the narrowest service scope. Avoid attaching plaintext to long-lived objects, request-wide debug contexts, error objects, audit old/new values, notification metadata, or global caches. Build the response DTO, then allow temporary plaintext references to be released. Signed photo URLs should be created only after the same authorization check.

## H. Key Management Design

### RC1 capstone minimum

For the capstone deployment, use server-only environment/secret-manager values with explicit key IDs and a documented custody procedure for central PII encryption and lookup tokens:

- One active data key version per environment.
- One active HMAC key version per environment.
- Old decryption/HMAC versions retained during rotation.
- Separate development, test, staging, and production secrets.
- No key in source control, schema, database rows, Vite VITE_* variables, browser storage, JWTs, API responses, or logs.
- No real production key generated as part of this design work.
- A recovery copy held in an approved encrypted password manager or secret-management system, with restricted access and dual approval for production recovery.

Render/server configuration must expose secrets only to the backend process. client/.env.example correctly warns that Vite variables are browser-visible; PII key material must never be added there.

### Production LGU target

Production should use a managed KMS or secrets manager with envelope encryption, key versioning, access policy, access auditing, rotation jobs, backup/recovery testing, and separation of duties. The application should receive short-lived KMS credentials or a narrowly scoped secret, not unrestricted access to an entire vault. Database backups containing encrypted PII should remain useless to a database-only reader without the separately governed key. If the LGU threat model includes storage administrators or backup readers, apply a separately governed storage/KMS control or object-level encryption to photo objects; that stronger object boundary is not required for the minimum capstone.

### Key registry metadata

The registry may record key ID, purpose, environment, creation time, activation time, retirement time, rotation state, and custody owner. It must not record key bytes. A database-backed registry is acceptable only for non-secret metadata and only if the control plane cannot be used to obtain the secret.

### Key compromise

If a key may be compromised:

1. Stop new writes using that key.
2. Activate a replacement data key and HMAC key.
3. Mark the old version compromised; do not delete it before recovery/reencryption is validated.
4. Reencrypt all affected encrypted values, including backups or object copies that use the compromised application/KMS object-encryption layer within the incident scope. For capstone private photos, follow the private-storage incident and access-revocation procedure; application-level object-byte encryption is not assumed.
5. Recompute blind indexes and remove the compromised HMAC version after dual-read validation.
6. Revoke access, investigate logs, notify the LGU incident owner, and document the affected key version and data scope.

## I. Authorization-Before-Decryption Design

The required order is:

1. Authenticate the request.
2. Resolve effective role and requester scope from trusted server-side state.
3. Validate the event/barangay/household/stub/record relationship.
4. Query only ciphertext, tokens, and operational metadata within that scope.
5. Apply business authorization to the selected record set.
6. Decrypt the minimum required fields.
7. Construct a role-specific DTO or report.
8. Log only safe IDs/statuses and return the response.

No repository method should fetch a full plaintext-capable household object before the service has established scope. The current getHouseholdDetails path in server/src/services/householdRegistration.service.js retrieves a summary before comparing Barangay scope; this is an ordering defect to correct before introducing decryption. getAuthorizedHouseholdSummaryForUpdate has the same design concern.

### Role/scoping behavior

- Barangay users: only their assigned barangay and allowed active event; no cross-barangay raw candidate data.
- MSWDO: municipality-level records required by the feature; sensitive fields only when the route and task require them.
- Mayor: municipality-wide oversight and approved reports; not blanket access to every raw field by default.
- System-log review: retain the existing policy gate, then apply field-level redaction.
- Public donation portal: only the explicit public derivative after donor_name_public policy evaluation; never decrypt the private donor record merely to render public data.

An authorization failure should return a consistent 403/404 policy response without revealing whether a hidden plaintext candidate exists. Blind-index matches must not be returned directly to an unauthorized caller.

## J. Search / Blind-Index Design

### Canonicalization

Canonicalization must be versioned and shared by server duplicate/search code and the client only where the client has already authorized/decrypted data. A recommended v1 pipeline is:

1. Convert to string and trim.
2. Unicode NFKC normalize.
3. Collapse internal whitespace.
4. Lowercase using a documented locale-neutral rule.
5. Apply field-specific punctuation and suffix rules.
6. For Philippine contact numbers, use one canonical digits format consistent with the existing normalizePhilippineContactNumber policy.
7. Represent missing optional components with an explicit delimiter-safe empty marker.

Do not silently change canonicalization. A change creates a new token version and a backfill plan.

### Token construction

Use HMAC-SHA-256 with a dedicated lookup key:

For exact identity fields that must support historical or re-admission matching, use a municipality-scoped identity domain that is stable across disaster events:

    identity_token = HMAC-SHA-256(PII_LOOKUP_HMAC_KEY_vN, "distync|identity-v1|municipality|<municipality-id>|<field-or-composite>|<canonical-value>")

The municipality identifier is the approved tenant/municipality scope, not a disaster event. The same normalized person therefore receives the same identity token across approved event history within that municipality. Do not include `disaster_event_id` in this identity domain.

Event/barangay-scoped operational tokens may also be used where isolation is desirable:

    operational_token = HMAC-SHA-256(PII_LOOKUP_HMAC_KEY_vN, "distync|lookup-v1|event|<disaster-event-id>|barangay|<barangay-id>|<field>|<canonical-value>")

These are separate token domains and are not interchangeable. Use the municipality-level identity token only for approved cross-event identity candidate discovery; use the event/barangay token for workflows that must remain locally isolated.

Encode as lowercase hex or base64url. Both domains must remain versioned, field-separated, and scope-bound. Domain separation prevents a token for a phone from being reused as a name token, and prevents a local operational token from being mistaken for a municipality-wide identity token. There is no default globally scoped token beyond the municipality boundary.

Never use SHA256(canonicalValue) for private names, phones, email, or donor identities. Plain hashes are vulnerable to dictionary attacks on low-entropy values.

### Recommended token columns

For households and evacuees, use municipality-scoped identity component tokens for first, middle, last, and suffix plus a composite normalized-person token when historical/re-admission matching requires it. Keep contact as a separate identity token for corroboration. Standardized sex, age-group, sector, and vulnerability categories remain queryable structured values for authorized reporting and can be used as corroborating filters only after the candidate scope is authorized; they do not need to be folded into the identity token. For users, email and provider-sub tokens are enough for login lookup. For donations, donor-name and contact tokens are optional and should be created only if the authorized donor-management workflows require them.

Candidate identity discovery and authorization to reveal/use a candidate are distinct. A token match never grants access. Candidate retrieval is:

1. Establish the requester's trusted municipality, role, and allowed event/barangay scope.
2. For a historical/re-admission workflow, query municipality-level identity-token equality across the approved event history for a bounded candidate set; for local workflows, apply event/barangay operational-token filtering first.
3. Resolve each candidate's event/barangay/household scope and apply the requester's RBAC and record policy.
4. Decrypt only authorized candidates and only the minimum direct identity fields required for comparison.
5. Apply exact comparison, structured-category/age-group/contact corroboration, and business classification in the service.
6. Return the minimum match summary permitted by the requester role.

Tokens must not be returned to the browser and must not be logged. Token columns should have ordinary indexes only if the leakage and access model has been accepted.

## K. Partial/Fuzzy Search Decision

AES-GCM ciphertext and exact HMAC tokens cannot support arbitrary substring search such as Mar, typo tolerance, or general fuzzy ranking without additional leakage. The design decision is:

### RC1 decision: authorized bounded retrieval plus server-side filtering

For the capstone, preserve the user experience by retrieving an authorized, bounded candidate projection, decrypting in the backend, applying the current normalized search/duplicate rules, sorting in memory, and returning one page. For ordinary masterlist search, enforce event/barangay scope, hard limits, rate limits, and a minimum search length. For approved historical/re-admission lookup, the bounded candidate projection may span multiple disaster events within the requester's municipality; event-specific filtering is applied separately after candidate discovery and authorization. Do not send the full decrypted corpus to the browser.

This is appropriate for the current operational scale and avoids creating a permanent plaintext search column. It requires performance measurement against the largest expected municipality/event dataset before production sign-off.

### Production scale option

If bounded retrieval is not sufficient, present a stakeholder-approved leakage decision:

- deterministic approved prefix tokens for a narrow set of prefixes, or
- a dedicated search service with a protected derived index and documented leakage, or
- a reviewed searchable-encryption design.

Prefix/n-gram tokens must be domain-separated, rate-limited, scope-bound, versioned, and omitted for sensitive fields such as address, health/vulnerability, and free text unless the LGU explicitly accepts the leakage. There is no recommendation to add a general plaintext search_text column.

Current affected paths include masterlist.repository.getHouseholdsByFilters, mswdoMasterlistOffline.matchesSearch, donation donor search, and household duplicate/possible-match functions. All should use the same policy: exact token candidate retrieval where possible, otherwise authorized server-side filtering; never client-side plaintext search over an unprotected cache. The identity-token path must preserve approved cross-event re-admission matching while keeping event-specific filters independent of token scope.

## L. Duplicate Detection Design

Current duplicate logic is substantive and should be preserved semantically:

- findDuplicateHouseholdRegistration
- findPotentialDuplicatePersonMatches
- findActiveCrossEventFamilyHeadMatches
- buildDuplicateRegistrationSuggestions
- localDuplicatePreflight.js

The current database queries use normalized lower/collapsed whitespace equality. The current service adds name, sex, age, and contact comparison to classify HIGH versus POSSIBLE. That business behavior should be captured as tests before changing storage.

### Proposed flow

1. Normalize the incoming authorized request with canonicalization v1.
2. Compute approved municipality-scoped identity component/composite tokens for historical/re-admission matching. Compute event/barangay operational tokens separately where local isolation is required.
3. Query candidate IDs, token matches, event/barangay scope metadata, and only approved structured category metadata; keep the candidate set bounded.
4. Resolve each candidate's event/barangay/household scope and apply the requester's RBAC before any decryption.
5. Decrypt candidate names and direct corroborating values only for authorized candidates in the service.
6. Run the current comparison/scoring policy, including the existing name, sex, age, and contact semantics.
7. Return a same-barangay match summary only to an authorized registration actor.
8. For cross-barangay matches, return a restricted indicator and municipality-review workflow, not the other household's name/contact/address/photo or detailed household information.

The municipality-scoped identity token is specifically retained so archived-history matching, prior-event household recognition, and re-admission workflows continue to work after identity encryption. A candidate found in another disaster event is not automatically usable: candidate discovery is followed by scope resolution, authorization, minimum-field decryption, and the current duplicate/re-admission decision. Event-specific filters continue to operate independently of the cross-event token domain.

### Offline duplicate preflight

localDuplicatePreflight.js currently reads local_duplicate_profile, readable cached rows, and complete pending registration payloads, then returns family-head/member names and contact values in the error payload. After offline encryption:

- decrypt only after the current user/device has an unlocked offline key;
- keep the duplicate result in memory for the current screen;
- return a minimal generic error when the key is unavailable;
- never persist the preflight result, error object, or candidate summary in localStorage;
- preserve a local-only exact/possible match policy without inventing cross-device authority;
- let the server re-evaluate every queued registration using authoritative tokens and scope after reconnection.

Offline duplicate detection is an early warning, not an authorization or final uniqueness decision.

## M. Family-Head Photo Design

The current household flow accepts a Base64/data URL and stores it through family_head_photo_url; masterlist, stub, distribution, and offline preparation code can then carry the photo to API responses and IndexedDB. That is the wrong boundary for a family photo.

### Capstone recommendation

For the minimum capstone, reuse the existing staff profile pattern in profilePictureStorage.service.js:

1. Validate MIME, size, and magic bytes at the server.
2. Upload through the server-only Supabase service role to a private bucket.
3. Use an opaque path such as households/<household-id>/<uuid>.<ext>.
4. Store only the opaque path and non-sensitive metadata in the database.
5. Return a short-lived signed URL only after the requester passes record/event/barangay authorization.
6. Do not return a Base64 data URL in general household/masterlist/stub DTOs.
7. Do not use the path as a public identifier or include a name/contact in it.

This private-storage and signed-URL boundary is the capstone photo protection. Application-level encryption of the object bytes before upload is not required for RC1. It remains an optional production-LGU hardening measure when storage administrators, backup readers, independently governed object keys, or formal KMS requirements are in scope.

The existing households.family_head_photo_url column should not continue to be treated as an arbitrary client-supplied URL. The additive target is a distinct family_head_photo_path plus MIME/size/hash/capture metadata, or a tightly controlled path value in an explicitly migrated replacement column. A distinct column is safer because it prevents legacy data-URL semantics from being silently reintroduced.

### Production option

If the LGU threat model includes a storage administrator or backup reader, encrypt the object bytes with an envelope key before upload or use storage-side KMS encryption with independently governed keys. This is optional production hardening; private bucket plus server authorization is the minimum capstone boundary.

### Offline photo rule

When offline photo access is approved, fetch only after authorization, convert to an ArrayBuffer/Blob, encrypt with the offline device key, and store the ciphertext. Create an in-memory object URL only while rendering. Never store a Base64 photo data URL in Dexie, localStorage, a service-worker cache, a query string, or a generic API response.

## N. Offline PWA Encryption Design

### Current offline surface

The RC1 client has a mode-scoped Dexie database named from the access mode. The reviewed database versions contain:

- syncQueue, including the full mutation payload;
- offlineStubCache, including QR lookup values, family-head name, relief-pack assignments, and optional family-head photo data;
- offlineMasterlistCache, including full masterlist rows and offline household details;
- offlinePreparation, including cache status and MSWDO preparation snapshots;
- offlineInventoryCache, which is mostly operational but must be checked before any future donor or recipient fields are added.

The MSWDO preparation path explicitly hydrates photos into Base64 data URLs and persists a full snapshot. The Barangay path also caches detailed household data and photos. The current AuthContext logout/account-switch cleanup clears role settings and selected references but does not reliably wipe the current mode’s Dexie PII stores, pending PII queue entries, or every possible service-worker/cache copy. This must be fixed as part of the offline rollout, not assumed to be fixed by database encryption.

### Threat model and limitation

Browser-side encryption protects against casual inspection of IndexedDB/local files, accidental support exports, and a database viewer who does not have the browser key. It does not protect against:

- XSS or a compromised same-origin script while the application is running;
- a malicious browser extension with page access;
- a compromised device, unlocked browser profile, or memory scraper;
- a service-worker or dependency supply-chain compromise;
- an attacker who can invoke the application’s decryption code with the authorized user’s browser session.

Therefore CSP, dependency review, safe rendering, no HTML injection of PII, short-lived sessions, service-worker update integrity, and device custody remain required. Offline encryption is a defense-in-depth measure, not an authorization boundary.

### Device key design

For the capstone, generate a random AES-256-GCM key in the browser using Web Crypto. Prefer a non-extractable CryptoKey stored in a dedicated IndexedDB key store scoped by access mode, user ID, and device ID. Do not derive it from or store it beside the JWT. Do not send it to the server.

Normal browser restart should preserve prepared offline operation for the same device/user/mode. Safe logout, account switch, role/access-mode change, device ownership change, device revocation, or retention expiry deletes the key and purges protected PII only after pending-work policy has been satisfied. If protected unsynchronized work exists, normal logout or switching is blocked and the key/data remain available while the user stays signed in; explicit discard is required before destructive cleanup. If the key is lost or corrupt, the safe behavior is to mark protected data unavailable, preserve recoverable ciphertext and pending-work status where possible, and require key recovery or online re-preparation rather than fabricate plaintext or claim a successful sync.

A production alternative is a user-supplied offline unlock secret used through PBKDF2 or an approved password KDF to wrap a random device key. That supports selected offline continuity after logout but adds recovery, brute-force, and support risks. It is a stakeholder decision and is not required for the minimum capstone design.

### Local encryption format

Use AES-GCM with a fresh random 12-byte IV and 16-byte tag for every record or payload. Bind the envelope to mode, user, device, event, barangay, entity type, action, and record ID with AAD. Store an encrypted payload as one envelope string or encrypted binary record; keep the IV and tag with that envelope, never in a predictable global field.

Sensitive local values include names, contacts, addresses, birth/member details, photo bytes, donor identity, remarks, full registration payloads, and duplicate-match profiles. The local key store and encrypted data stores must be separate from generic application settings.

Readable local metadata may include access mode, user ID, role code, device ID, event/barangay routing scope, action/entity type, local/server IDs, status, timestamps, cache version, attempt count, and a bounded error code. Even that metadata can reveal activity and must be minimized. Names, addresses, contacts, photo data, full API response bodies, and raw errors are not allowed in readable metadata.

### Cache lifecycle

| Event | Required behavior |
|---|---|
| Successful sync | Mark the encrypted queue entry terminal, then delete the protected payload after required conflict/audit completion. Retain only a non-PII status/reference record if history is needed. |
| Retryable failure | Retain encrypted payload and a safe error code; do not persist server error bodies or plaintext payloads. |
| Manual conflict | Retain encrypted local payload; server stores encrypted conflict bodies. Decrypt only on an authorized conflict screen. |
| Logout with no pending protected work | Delete the device/user/mode offline key, purge protected user/device PII stores and protected Cache Storage entries, then complete logout. |
| Logout with pending protected work | Detect pending unsynchronized records before destructive cleanup; block normal logout and show a clear warning. Keep the user signed in so the work remains recoverable, or offer an explicit destructive discard path. Do not silently synchronize or delete the work. |
| Explicit discard and logout | After explicit confirmation, delete pending encrypted queue payloads and related protected local PII/photo/cache records, delete the relevant offline key, retain only approved non-PII status metadata, and complete logout. |
| Account switch with pending protected work | Apply the same pending-work check before switching. Block the switch until the user synchronizes or explicitly discards the current user's pending records; do not make them inaccessible merely by enabling another account. |
| Access-mode change with pending protected work | Apply the same pending-work check before changing mode. Block the switch until the work is synchronized or explicitly discarded; after a safe switch, cryptographically isolate mode stores and keys. |
| Account/mode switch with no pending protected work | Delete the prior user/mode key and purge its protected PII before enabling the next identity or mode. Do not rely on a role change alone. |
| Device revocation/reassignment | On next contact, receive a revoke/wipe instruction; while offline, the app cannot know revocation, so offline retention must be short. |
| Event closure | After pending-work reconciliation, wipe event-scoped household/member/photo data; retain only approved aggregate and operational completion metadata. |
| TTL expiry | Wipe expired protected data and its key as far as the browser API allows, but do not silently discard unresolved disaster-response work. Expiry of pending work must enter an explicit retention/discard workflow. A proposed default is 24 hours for MSWDO full snapshots and 72 hours for active Barangay queues, subject to LGU approval. |
| App/schema key version change | Migrate in place only if the old key and envelope are valid. If no protected work is pending and the old key is unavailable, wipe and reprepare; if protected work is pending, lock/preserve it for recovery or explicit discard instead. Never downgrade into an unencrypted store. |

Service-worker shell/static caches may remain for availability, but API responses containing PII must not be cached by generic runtime rules. The reviewed cache-name module scopes shell/page/static cache names by mode; the actual service-worker runtime route policy must be explicitly tested to prove that authenticated API responses and signed photo URLs are excluded.

### Protected logout and identity-switch policy

The client must inspect protected queue state before logout, account switch, or access-mode switch. When no unsynchronized protected records exist, it may destroy the relevant offline key and purge the protected stores as part of completion. When pending disaster-response work exists, normal logout/switch is blocked with a warning such as: "Unsynchronized offline records are stored on this device. Connect and synchronize them before signing out, or explicitly discard the pending records." The user may stay signed in and preserve the encrypted work, or explicitly confirm "Discard Pending Records and Sign Out." The application must not promise automatic synchronization on logout unless the current architecture can prove that behavior safely.

If the device is offline, the same block applies; lack of connectivity is not permission to destroy queued work. If a key is unavailable or corrupt, the app must lock the protected data, avoid plaintext recovery claims, and require key recovery or online re-preparation where possible. It must not present the data as successfully synchronized.

## O. Offline Sync Envelope Design

The current client sends a sync entry with a readable payload to /api/v1/sync/process, and the server persists that payload in sync_transactions.payload_json and conflict JSONB. The proposed envelope preserves the routing data required for idempotency and conflict handling while protecting the content.

### Proposed client record

    {
      envelope_version: 1,
      client_sync_id: "...",
      action_key: "HOUSEHOLD_REGISTER",
      operation_type: "CREATE",
      entity_type: "HOUSEHOLD",
      entity_local_id: "...",
      entity_server_id: null,
      device_id: "...",
      user_id: "...",
      role_code: "BARANGAY",
      disaster_event_id: "...",
      barangay_id: "...",
      client_timestamp: "...",
      client_updated_at: "...",
      payload_ciphertext: "enc:v1:offline-k1:iv:tag:ciphertext",
      payload_aad_context: "scope-bound-v1",
      local_status: "PENDING",
      attempt_count: 0
    }

The exact wire names may follow the current validator contract, but the distinction is mandatory:

- readable routing metadata: client sync ID, action/entity, local/server IDs, device, actor/scope IDs, timestamps, protocol/envelope version, and bounded status;
- encrypted payload body: names, contacts, addresses, member details, consent representative data, photos, remarks, donor data, and any future PII;
- no raw payload is duplicated into context, error_message, notification metadata, or browser telemetry.

The server needs some routing metadata to deduplicate, enforce ownership, select an action handler, attribute a Barangay, and decide which authorized worker can review a conflict. Keep only what is necessary. This metadata leaks event/barangay association, action type, record existence, timing, device identity, and approximate activity volume; that leakage must be recorded in the threat model.

### Sync processing

The client decrypts the payload just in time in memory to make the authenticated TLS request. The server validates the envelope and routing metadata, authenticates the requester, verifies that the device/user/role/scope is allowed, and then passes a plaintext object in memory to the existing domain handler. Before persistence, the server stores an encrypted payload envelope in the sync transaction record. The server must not log the just-decrypted object.

sync.service.js currently uses payload fields for event/barangay attribution, timestamp conflicts, duplicate household conflicts, inventory resolution, and notification/audit side effects. The migration must move those routing fields to dedicated readable columns or a small safe routing object. A future encrypted payload cannot be the only place where the sync repository looks for scope.

For household duplicate/re-admission work, the authorized domain handler may compute the municipality-scoped identity token from the decrypted payload in memory. The event/barangay routing columns remain independent so event-specific filtering and authorization do not depend on the identity-token scope. A pending encrypted queue entry is protected operational work: it remains available while the user stays signed in, and logout/account switching follows the pending-work policy in Section N.

### Conflict storage and review

Store local, server, and resolved conflict bodies as encrypted JSON envelopes. Keep conflict ID, sync transaction ID, entity type, entity server ID, conflict type, status, strategy, timestamps, and safe resolution metadata readable. Authorized conflict review decrypts only the relevant body after the same scope check. Barangay cross-scope conflicts continue to return the existing restricted message without exposing the other household’s payload.

Idempotency must use client sync ID plus a stable hash of the canonical encrypted payload or a server-side canonical plaintext hash computed transiently. Do not use a plain readable JSON comparison as the sole idempotency primitive after migration.

## P. Logging / Error / Audit Protection Design

### Current exposure

server/src/utils/systemLog.js forwards old/new values and error context to systemLog.repository.js. The audit review repository searches JSON text and joins user/donor/distribution identity data. systemLog.service.js has allowlists that include donor name, donor contact, claimant name, QR reference, receipt number, and remarks. Express also uses Morgan development logging. Error handlers and route helpers call safe log wrappers, but “safe” currently means non-blocking persistence, not PII redaction.

### Target policy

Audit events should answer who did what, to which record, in which scope, and when. They should not reproduce a household form or a donor contact card.

Persist by default:

- actor user ID, role, device ID, and a server-generated correlation ID;
- action, entity type, entity ID, event/barangay scope IDs;
- status transition, outcome, reason code, validation category, and key/envelope version;
- a small allowlisted set of non-PII operational fields.

Do not persist by default:

- raw old/new household/member objects;
- names, email, phone, address, birth date, photo, consent representative name;
- JWTs, cookies, authorization headers, blind-index inputs, keys, full request/response bodies;
- donor names/contact and claimant free text when an actor ID or record ID is available.

If a legal/audit requirement requires a sensitive before/after value, store an encrypted JSON envelope in a dedicated audit detail field with a retention policy and explicit system-log access control. The normal log list should return a redacted summary, not decrypt every detail.

### Error handling

Redact before persistence, not only at display time. Apply field-aware redaction to error_message, stack_trace, and context_json; truncate length; replace possible PII with typed placeholders; and retain a stable error code. Error responses to clients should be generic and should not echo the submitted value. Console/Morgan production configuration must exclude request bodies, query values that carry PII, authorization headers, and signed photo URLs.

### Retention

Define separate retention for audit evidence, operational errors, notification history, and sync diagnostics. Purge encrypted detail and associated tokens when the underlying data-retention policy requires it. Key destruction is not the only deletion mechanism; the record and all derived copies must be inventoried.

## Q. Notification Privacy Design

The current notification service interpolates a family-head name into household-registration and evacuee-attendance messages. Sync conflict handling can extract family-head names from payloads. Notification rows persist title, message, and metadata JSON, and the client displays the message.

### Required notification shape

Use generic, actionable messages:

- “A household registration requires review.”
- “A household attendance update was recorded.”
- “A sync conflict requires review for household record H-opaque-id.”
- “Inventory transaction requires review.”

Include a stable internal reference or opaque record label only where the recipient is already authorized. Keep event/barangay IDs and action codes in metadata; do not place names, contacts, addresses, donor identities, or payload fragments there.

The notification detail screen may retrieve the authorized record separately and decrypt the minimum fields after authorization. A notification is not a permission grant.

### Email and browser notifications

Do not include beneficiary/donor PII in email subjects, push payloads, browser Notification API text, or lock-screen previews by default. If email is required, use a generic message and an authenticated deep link. The email delivery table may retain provider message IDs and sanitized error codes, not raw provider payloads or recipient PII beyond the minimum necessary. Any explicit opt-in for richer previews requires a documented privacy decision.

## R. Reports / Export Design

Identity-bearing export paths were verified in:

- server/src/services/masterlist.service.js, including CSV/Excel/PDF masterlist generation;
- server/src/services/distributionTransaction.service.js, including inventory distribution and history exports;
- server/src/services/stub.service.js, including stub claim history;
- server/src/services/donation.service.js, including received/transparency exports;
- the corresponding masterlist, distribution, stub, and donation routes.

### Identity-bearing report flow

1. Authenticate and authorize the route.
2. Resolve event/barangay/report scope before selecting identity ciphertext.
3. Query the minimum encrypted columns and operational columns.
4. Decrypt in backend memory only for the authorized rows and required report fields.
5. Render the CSV/XLSX/PDF buffer in memory.
6. Do not persist a temporary plaintext report unless an encrypted, access-controlled report store is separately approved.
7. Return Cache-Control: no-store, a short-lived response, and a generic filename without a person’s name.
8. Record a safe export audit event with actor, scope, report type, row count, and correlation ID.

The browser download itself is plaintext because the user needs to read it. That is outside database-at-rest encryption and must be covered by role policy, workstation controls, download warnings, retention, and export watermarking where appropriate. Do not send full reports to roles that only need aggregates.

### Aggregate reports

Aggregate reports should operate on counts, statuses, dates, event/barangay IDs, sector IDs, standardized sex/age-group and approved vulnerable-sector categories, inventory item IDs, and other approved operational derivatives. These structured demographic categories and sector links remain sensitive and require the same authorization, event/barangay scope, least-privilege response, and retention controls; they do not need to be decrypted merely to count or group rows. A report that includes family-head, member, donor, address, contact, exact DOB, or photo data is identity-bearing and follows the stricter path.

## S. Analytics Boundary

The reviewed FastAPI forecasting contract under analytics/app/forecasting accepts inventory item ID/name/code/category/unit, stock, reorder level, and numeric usage series. Its output is inventory forecast data; no household/member name, contact, address, consent, or photo field appears in the request/response schemas.

This is the correct data-minimization boundary for the current forecasting feature. Keep it that way:

- send aggregate inventory usage and approved catalog labels only;
- if a future authorized LGU analytics feature needs demographic information, send approved aggregates of queryable structured categories rather than raw person rows;
- do not send household IDs or beneficiary counts unless a future model genuinely requires them and the privacy review approves them;
- do not include raw operational payloads, audit JSON, sync payloads, or donor information;
- protect any analytics transport with TLS and a service-to-service credential;
- ensure analytics logs do not echo full request bodies.

The FastAPI route shown in the reviewed code does not itself show authentication middleware. The upstream Node integration and deployment/network boundary were not confirmed in this design audit. Treat direct exposure of the analytics service as a production blocker until authenticated service-to-service access, network restriction, rate limiting, and log redaction are verified.

## T. QR / Stub Decision

The current household service constructs a QR value in the form:

    DISTYNC-STUB|<disaster-event-id>|<household-id>|<stub-no>

The client wraps it in a verify-stub?qr= URL. The value contains stable event/household/stub identifiers but no family-head name, contact number, address, member details, or photo. It is therefore Class C linkable operational metadata, not a field that requires PII encryption for RC1.

Keep the current QR format for the encryption rollout to avoid unnecessary regression in printing, scanning, verification, and offline cache behavior. Preserve all existing requirements:

- QR possession is not authentication.
- QR verification/detail routes require the appropriate authenticated role.
- Service-level event/barangay/record scope checks run before returning household or distribution detail.
- A QR value is not accepted as a substitute for req.auth.
- QR values and signed URLs are not written to logs or notification text unnecessarily.

A future QR version may use a high-entropy opaque random token with server-side lookup and rotation/revocation. Do not add encrypted PII to the QR, because QR scanners, printouts, photos, and browser history are difficult to control.

## U. RLS / Authorization Relationship

Encryption, RBAC, service-level scoping, and PostgreSQL RLS solve different problems:

- Encryption protects stored values from a database-only reader, backup reader, and accidental plaintext persistence when keys are separately governed.
- Backend authentication and service authorization decide what an API caller may do.
- RLS can constrain row visibility for direct database clients and acts as a second authorization layer when correctly configured.
- Private Storage policies and signed URLs protect photo objects.
- Browser cache/key lifecycle protects offline copies.

No checked-in RLS policy/enable statements were found in the reviewed schema/migrations, and no live database connection was made. The live RLS state is NOT CONFIRMED. Do not claim that encryption compensates for missing RLS, and do not make the rollout depend on an unverified assumption.

Before production:

1. Inspect the live schema and policy state with a read-only database audit.
2. Confirm which DB role the Node backend uses and whether a Supabase service role bypasses RLS.
3. Test same-barangay, cross-barangay, MSWDO, Mayor, and direct-table access using disposable/test identities.
4. Keep backend scope checks even if RLS is enabled.
5. Avoid giving the browser a direct privileged Supabase data path for PII.

## V. Proposed Schema Changes

No schema change was made. The following is the additive target design.

### Encrypted shadow columns and tokens

| Existing area | Proposed additions | Keep readable |
|---|---|---|
| users | email_enc, email_bidx; google_sub_enc, google_sub_bidx; first_name_enc, middle_name_enc, last_name_enc; contact_number_enc, contact_number_bidx | id, role relation, default_barangay_id, is_active, timestamps |
| households | family_head_first_name_enc, family_head_first_name_bidx; corresponding middle/last/suffix encrypted/token fields; contact_number_enc/contact_number_bidx; birth_date_enc; current_address_details_enc; identity-bearing status/notes encrypted; municipality identity-token and optional event/barangay operational-token fields | id, event/barangay/center/registrar FKs, household_size if approved, sex/approved age-group and other standardized demographic category fields where represented, lifecycle/status/timestamps |
| evacuees | first/middle/last/suffix encrypted/token fields; birth_date_enc; identity-bearing/free-text age or vulnerability detail encrypted; municipality identity-token and optional event/barangay operational-token fields | id, household_id, sector relation, sex/approved age-group, civil-status/relationship categories where represented, pregnancy/lactation/PWD/Indigenous/4Ps and other approved standardized sector classifications, active/family-head workflow flags, timestamps |
| household_privacy_consents | acknowledged_by_name_enc, representative_relationship_enc | consent status, notice version, timestamps, actor/device/household/event FKs, sync metadata |
| distribution_transactions | claimed_by_name_enc, remarks_enc, any identity-bearing proof/detail enc | household/stub/event/device/verifier FKs, dates, status, receipt status, QR reference, sync metadata |
| distribution_transaction_items | donor_name_snapshot_enc and any donor contact snapshot enc | item IDs/codes/names/category/quantities/template/snapshot source fields that are not personal |
| donations | donor_name_enc/donor_name_bidx; contact_information_enc/contact_information_bidx; donor_type_other_enc; remarks_enc; optional reviewed public display derivative | event/actor/status/type/public-policy flag/date/item relations |
| audit_logs | safe summary columns; old_values_enc/new_values_enc for approved residual detail | actor/role/device/action/entity/scope/source key/timestamp |
| error_logs | safe error code and redacted summary; context_enc only when needed | actor/device/module/severity/reference/timestamp |
| notifications | safe title/message plus optional private_detail_enc; safe metadata | recipient relation, rule/type/severity/reference IDs/source key/timestamps |
| sync_transactions | payload_envelope, routing columns for event/barangay/device/action/entity, safe error code | sync ID, actor/device/entity/scope/status/timestamps/protocol |
| sync_conflicts | local_payload_envelope, server_payload_envelope, resolved_payload_envelope, safe conflict summary | conflict/sync/entity/status/type/strategy/actor/timestamps |
| households photo | family_head_photo_path, photo MIME/size/hash/capture metadata | opaque path, capture/status metadata only; no URL/data URL |

Column names are illustrative. Final names must follow the project’s migration conventions and avoid introducing a second competing source of truth.

Standardized demographic categories and relational sector links are intentionally listed under "Keep readable" only when they are represented in the actual schema and required for authorized official counts, filtering, dashboards, or aggregation. They remain sensitive linkable data: protect them with authentication, RBAC, event/barangay/municipality scope, least-privilege DTOs, and retention controls. Exact birth dates remain encrypted; a queryable derived `age_group` or equivalent category does not justify retaining a readable exact date. Do not encrypt primary keys or foreign keys in `household_sectors`/`evacuee_sectors` merely because an authorized join can reveal a sensitive classification.

### Ordinary field versus JSON envelope decision

Use separate encrypted shadow columns for ordinary fields that participate in normal row updates and validation. Use one encrypted JSON envelope for JSONB-like payloads such as sync bodies, conflict bodies, audit detail, and error context. This keeps token/search columns independent of ciphertext while preventing an expanding set of crypto component columns for arbitrary JSON.

### Constraints and indexes

Do not create plaintext uniqueness constraints on new encrypted values. Add unique or non-unique indexes on blind tokens only when the lookup policy has accepted equality leakage and collision handling. Continue enforcing relational foreign keys, status constraints, event/barangay scope, and immutable IDs. A token collision must result in candidate decryption and exact comparison, not an automatic identity match.

## W. Dual-Read / Dual-Write Migration Design

The migration must be additive and feature-flagged.

### Phase W1: prepare

- Add nullable encrypted shadow columns, token columns, photo-path columns, safe log fields, and encrypted sync/conflict fields.
- Add a crypto service, key IDs, key availability health checks, and metrics without exposing key material.
- Freeze the field inventory and canonicalization version.
- Add capability flags to the server, not to the client’s public environment.

### Phase W2: controlled dual write

For records written while legacy clients/readers still exist:

- validate and encrypt the new value first;
- if encryption fails, reject the write; never write a silently incomplete encrypted record;
- write the legacy column only while the compatibility flag is explicitly enabled;
- write the encrypted shadow and token in the same transaction as the legacy value;
- record only a safe dual-write outcome metric.

This temporary plaintext dual-write period is a migration exception, not the target state. It must have an owner, deadline, data-retention plan, and kill switch.

### Phase W3: dual read

Prefer the encrypted column. If it is absent, read the legacy value only for known pre-migration rows under a feature flag, encrypt it immediately on a controlled read or backfill, and emit a count/metric. If an encrypted value exists but cannot be decrypted, fail closed; do not fall back to a conflicting legacy value.

### Phase W4: backfill and compare

Backfill in batches, compute tokens using canonicalization v1, compare decrypted encrypted output to the legacy value without logging either, and quarantine mismatches. Validate counts, null behavior, Unicode, optional suffixes, timestamps, photo hashes, and report row totals.

### Phase W5: encrypted-only writes

After all supported server/client/offline readers understand the new contract, stop writing legacy plaintext. Old clients must be rejected or upgraded through a protocol-version gate; do not continue accepting a full plaintext legacy payload indefinitely.

### Phase W6: retire

After the retention and rollback window:

- verify no reads, writes, exports, SQL filters, logs, caches, or reports depend on legacy columns;
- snapshot encrypted data and migration evidence under approved controls;
- null/drop legacy plaintext in a separate reviewed migration;
- remove legacy fallback and compatibility flags;
- rotate keys only after the encrypted-only state is stable.

## X. Existing-Data Backfill Design

Backfill is a data-handling operation, even when it is not user-facing. It requires a disposable rehearsal, maintenance/runbook approval, and a recovery plan.

### Backfill order

1. Users and authentication lookup values.
2. Households, exact direct PII, and municipality-level family-head identity tokens.
3. Evacuees, exact direct PII, and approved standardized demographic/sector values. Keep the latter queryable where required for authorized aggregation; do not encrypt them solely because they are sensitive.
4. Consent records.
5. Distribution and donor snapshots.
6. Donations and donor tokens.
7. Audit/error/notification residual detail.
8. Sync transactions and conflicts.
9. Family photos to private storage paths and offline-cache invalidation. For the capstone, validate private-storage authorization and signed retrieval rather than requiring application-level object-byte encryption.

### Batch rules

- Use stable primary-key ranges or created-at ranges, never an unbounded table scan in one transaction.
- Lock only the row being converted or use an update predicate that skips already-converted rows.
- Make the job idempotent and restartable.
- Record batch ID, table, key version, counts, errors, and checksum summaries without recording plaintext.
- Do not run backfill in the browser.
- Pause or throttle during active registration/distribution windows.
- Recompute blind indexes from the source plaintext only in controlled server memory.

### Validation

For each batch compare:

- source row count versus encrypted-row count;
- null/non-null distribution;
- canonicalization/token presence;
- decrypt-and-compare sample under a privileged migration test identity;
- authorized API response contract;
- unauthorized/scope-negative response contract;
- photo object count, path format, MIME/size/hash, and signed URL authorization;
- report row count and aggregate totals.

Quarantine any mismatched or malformed row. Do not “repair” by guessing a name, contact, or address. A mismatch requires a data owner decision.

### Legacy data and unsupported values

Legacy data URLs, malformed contacts, Unicode edge cases, and free text that cannot be safely classified must be quarantined and reported by record ID. Never place the value in the error log. The operational choice is either manual review under authorization or a documented null/redaction policy.

## Y. Key Rotation Design

### Data-key rotation

New encrypted direct-PII writes use key version N+1. Reads accept N and N+1. A background re-encryption job reads the authorized ciphertext, decrypts with N, re-encrypts with N+1 and a fresh IV/AAD, validates the output, and atomically replaces the shadow value. Queryable structured demographic categories and relational sector links do not require data-key rotation. Capstone private photo objects are governed by the storage/signed-URL control rather than application-level object-byte re-encryption; any production object-encryption layer has its own rotation plan. Keep N until every encrypted field, sync/conflict envelope, and applicable backup/recovery policy in scope is validated.

### HMAC-key rotation

During rotation, write the new token version and query both old and new token columns for both municipality-scoped identity tokens and event/barangay-scoped operational tokens. Backfill the new tokens across the approved historical event range, measure old-token hits, then stop producing old tokens. Remove old token columns only after cross-event re-admission and local lookup migrations are complete and the old key is retired. HMAC tokens are not decryptable; losing an old HMAC key without recomputation means old equality lookups cannot be reproduced.

### Offline-key rotation

Generate a new device key when the local key version changes. If the old key is present, reencrypt each protected record in a bounded transaction-like loop, preserving pending queue entries. If the old key is unavailable or corrupt, lock the protected cache and mark pending work unavailable; require key recovery or an explicit discard decision before destructive cleanup and online re-preparation. Do not upload the offline key to recover a cache or present unrecoverable data as successfully synced.

### Rotation gates

- key custody and recovery verified;
- old and new key versions loaded in test/staging;
- IV uniqueness and envelope parsing tested;
- read/write/rotation metrics are clean;
- backfill mismatch count is resolved;
- rollback remains possible until the old key retirement decision;
- no key bytes appear in logs, crash reports, browser bundles, database rows, or exported configuration.

## Z. Rollback Design

Rollback must preserve confidentiality and avoid reintroducing plaintext.

### Before encrypted-only cutover

Keep legacy columns and encrypted columns. A feature flag may make the previous read path authoritative while encrypted values remain intact. New writes must continue to encrypt if the crypto service is healthy; if not, stop writes rather than silently produce new plaintext.

### After encrypted-only cutover

Rollback means restoring a previous application version that can read the encrypted shadow columns or entering a read-only/maintenance mode until compatibility is restored. Do not roll back to a version that writes only legacy plaintext. If the old version cannot read the new format, use an adapter or restore a pre-cutover encrypted-compatible build.

### Partial failure

If a backfill fails, stop at the batch boundary, keep source and shadow values, repair the cause, and resume idempotently. If photo migration partially fails, keep the old private/controlled path only until the path and object inventory are reconciled; never make a public object available to compensate.

### Recovery

Test recovery from encrypted database backup plus separately governed keys. A database restore without the correct key must produce an unavailable/degraded state, not silently expose or fabricate PII. Record recovery attempts as safe operational events.

## AA. Failure-Mode Design

| Failure | Required behavior | Forbidden behavior |
|---|---|---|
| Missing active data key | Fail closed for protected writes/reads; health check marks encryption unavailable | Generate an ad hoc key, use a default key, or write plaintext |
| Unknown key version | Return generic protected-data-unavailable error and safe metric | Try every secret or expose the envelope |
| Malformed envelope | Reject and quarantine record | Parse best-effort or return the original field |
| GCM tag/AAD mismatch | Treat as tampering/corruption; no plaintext returned | Retry with different AAD or legacy fallback |
| HMAC token generation failure | Reject lookup/write that requires the token | Store a plain hash or searchable plaintext |
| Blind-index collision | Decrypt authorized candidates and exact-compare | Treat the token as proof of identity |
| Unauthorized record request | 403/404 policy response without decryption | Decrypt then decide, or reveal candidate existence |
| Scope unavailable | Deny protected operation | Default to municipality-wide access |
| Signed photo URL failure | Generic unavailable-photo response and safe event | Return the storage path or Base64 bytes |
| Offline key unavailable | Lock protected cache, mark the protected data unavailable, preserve recoverable ciphertext/pending-work status where possible, and require key recovery or online re-preparation; destructive cleanup requires the explicit pending-work discard path | Treat ciphertext as plaintext, fabricate recovery, claim successful sync, or use a shared fallback key |
| Logout with pending queue | Detect pending protected work and block normal logout; keep the user signed in until synchronization completes or the user explicitly confirms discard, then delete the relevant key/data | Silently delete the key/data, silently synchronize without a supported safe flow, or leave readable payloads behind |
| Account/mode switch with pending queue | Apply the same block and preserve the current identity's encrypted work until synchronization or explicit discard; isolate stores only after the pending-work decision | Make pending work inaccessible merely by switching identities/modes |
| Browser storage quota failure | Stop caching new PII; preserve server truth; show generic offline-unavailable state | Evict arbitrary records without policy or write a plaintext fallback |
| Sync payload cannot decrypt | Keep encrypted queue entry and safe error code; require retry/reprepare | Send the ciphertext as domain JSON or log the payload |
| Sync scope metadata inconsistent | Reject and create safe conflict/diagnostic record | Trust client barangay/event values without server validation |
| Server DB ciphertext damaged | Fail closed for that record and raise an incident metric | Return legacy plaintext without an explicit migration exception |
| Export generation failure | Discard in-memory buffer and return generic error | Persist a plaintext temporary file in an uncontrolled location |
| Notification contains accidental PII | Redact before persistence/send; alert the safe telemetry path | Rely only on UI masking |
| Key rotation interrupted | Resume idempotently from last safe batch | Delete the old key or assume all rows converted |

## AB. Security Test Design

The following is a design for tests; no new tests were created or executed.

### Cryptographic unit and service tests

- AES-256-GCM round trip for empty, Unicode, long, and binary values.
- Fresh IV uniqueness across a large sample; reject malformed IV/tag lengths.
- One-bit ciphertext, IV, tag, key ID, and AAD tampering all fail closed.
- Unknown key version and missing key return stable non-sensitive codes.
- Envelope parser rejects extra/ambiguous components and algorithm downgrade.
- A ciphertext copied between record IDs, columns, events, or barangays fails AAD validation.
- Data key and HMAC key separation is asserted.
- HMAC canonicalization tests cover whitespace, case, NFKC, suffix variants, optional values, and Philippine phone formats.
- Same canonical value produces the same municipality-scoped identity token across approved disaster events; different municipality, field, or value produces a different token.
- Event/barangay operational tokens remain distinct from municipality-level identity tokens and change when their operational scope changes.
- Approved structured demographic categories and sector relation IDs remain queryable for authorized aggregation without being mistaken for encrypted direct PII.
- No key, plaintext, ciphertext, or token input appears in thrown error messages or logs.

### Authorization-before-decryption tests

- Unauthorized role cannot cause a decrypt call for a hidden household.
- Cross-barangay Barangay request is rejected before crypto-service invocation.
- MSWDO/Mayor receive only fields allowed by the route and report policy.
- Missing or stale requester scope denies the request.
- Public donation endpoint never invokes private donor decryption.
- Stub QR possession without authentication is rejected.
- Family photo signed URL is not generated before scope authorization.
- Audit/log review returns safe summaries and cannot request arbitrary JSON paths.

### Search and duplicate tests

- Exact name/contact/email lookup uses HMAC tokens and returns correct candidates.
- HMAC token match alone is not enough; exact decrypted comparison handles collisions.
- Current HIGH/POSSIBLE duplicate classification remains behaviorally equivalent.
- The same normalized person recorded in two disaster events can become a valid bounded candidate through the municipality-level identity token.
- Historical/re-admission matching works across archived and prior-event records without making the token itself an authorization grant.
- Event-specific filtering continues to work independently of the cross-event identity-token scope.
- Same-barangay suggestions contain the minimum permitted fields.
- Cross-barangay suggestions contain only a restricted indicator.
- A cross-barangay candidate never exposes the candidate's name, contact, exact address, photo, or detailed household information to a Barangay user.
- Partial search is bounded, authorized, server-side, and does not expose a full corpus.
- Empty/short search, Unicode, suffix, and phone normalization behavior is stable.
- Client local duplicate preflight cannot read protected stores without the correct user/device key.

### Photo tests

- Client cannot submit an arbitrary public family photo URL.
- MIME, magic-byte, size, and path rules are enforced.
- Private storage object cannot be fetched without an authorized signed URL.
- Signed URL TTL and revocation behavior are correct.
- Household DTOs contain a signed URL only for authorized callers and never a data URL.
- The minimum capstone photo test does not require application-level object-byte encryption; it requires private storage, server-controlled upload, scope-before-signed-URL authorization, and no central data URL/photo bytes after migration.
- Offline photo store contains ciphertext/binary envelope and no Base64 data URL.

### Required named scenarios

TC-S-023 — PII field encryption and authorization:

1. Use a disposable test database and test-only generated keys.
2. Create a test household/member/donor/photo through the authorized test path.
3. Inspect raw database shadow columns and assert that direct PII such as the known name, contact, exact address, and exact DOB does not occur as readable plaintext.
4. Assert valid encrypted envelope, key ID, required identity-token presence, and no key material in storage.
5. Assert authorized API round trip returns the expected direct PII value and authorized aggregate reporting can use queryable sex/age-group/sector categories without requiring those categories to be encrypted.
6. Assert unauthorized role and wrong-barangay requests fail without a decrypt invocation; a municipality-level candidate token does not bypass that check.
7. Flip one ciphertext/tag/AAD bit and assert a generic failure with no plaintext.
8. Clean up only the disposable test data.

TC-S-024 — offline cache and sync protection:

1. Prepare a scoped offline cache for a test user/device.
2. Create a household registration/update/stub claim while network access is disabled.
3. Inspect IndexedDB object stores and assert names, contacts, addresses, photo bytes, and full payloads are absent in readable form; only envelopes and approved routing metadata remain.
4. Reconnect and sync; assert the server raw sync/conflict record is encrypted and the authorized result is correct.
5. Assert unauthorized conflict review is denied and Barangay cross-scope details remain restricted.
6. Assert successful terminal sync removes protected payloads according to policy, and a re-admission payload can be evaluated against an earlier disaster event without exposing cross-Barangay PII.
7. Assert logout with no pending protected work removes the device key and protected stores.
8. Assert logout while a registration is pending, including while offline, is blocked and preserves the encrypted work until synchronization or explicit discard.
9. Assert explicit discard deletes pending encrypted payloads, related protected local data, and the relevant key only after confirmation.
10. Assert account switch and access-mode switch with pending work follow the same block/preserve-or-explicit-discard policy.
11. Assert successful synchronization followed by logout performs safe key destruction and purge.
12. Assert missing/corrupt-key behavior locks protected data, does not claim successful sync, and requires recovery or re-preparation.

These scenarios must run only with a disposable test database and test keys. They are not being run in this design-only task.

## AC. Regression-Test Matrix

| Area | Existing behavior to preserve | Encryption regression to add |
|---|---|---|
| Authentication | Google identity lookup, session creation, role resolution | Encrypted email/provider lookup token; minimized JWT; no names in token |
| Household registration | validation, consent requirement, duplicate checks, registration side effects | encrypted writes, token generation, safe notifications/audit, legacy compatibility |
| Household detail/update | role and Barangay scope, member/sector/stub response | scope-before-decrypt and field-level DTO; structured demographic categories remain available only to authorized scoped consumers |
| Possible-match lookup | request-key behavior in possibleMatchLookupControl.js | municipality-scoped cross-event candidate lookup plus event/barangay operational tokens, minimum result, no unauthorized PII |
| Local duplicate preflight | cached/pending candidate detection and HIGH/POSSIBLE policy | protected cache unlock, no readable queue/profile, safe error payload |
| Masterlist | filters, partial search, sorting, pagination, dashboard totals | bounded server-side decrypt/filter for direct PII, queryable authorized demographic aggregation, and no plaintext offline search |
| MSWDO preparation | cache preparation, photo display, status/version handling | encrypted snapshot/key lifecycle/offline photo bytes and no data URLs; structured demographic categories remain scoped/queryable |
| Stub/QR | print, scan, verify, detail, offline stub cache | QR remains non-PII; auth/scope before detail decrypt or signed photo URL; protected cache |
| Distribution | claim, history, inventory snapshots, receipt/QR references | claimed-by/remarks/donor snapshot encryption and export scoping |
| Donations | private management, public opt-in transparency, donor search | private donor encryption/token; public derivative isolation |
| Notifications | recipient scope, unread/read state, deduplication | generic text/metadata and no lock-screen PII |
| System logs | Mayor/policy review, audit/error visibility | redaction, encrypted residual detail, safe search and retention |
| Sync | idempotency, action handlers, conflicts, retries, offline queue | encrypted payload/envelope, routing metadata, protected conflict review |
| Reports | CSV/XLSX/PDF output and row totals | authorize/decrypt in memory, no-store, no PII filename/temp persistence |
| Analytics | inventory forecast request/response | no beneficiary PII; authenticated service-to-service boundary |
| PWA/service worker | mode caches and update status | no authenticated API/photo PII in runtime cache; purge test |
| Logout/account switch | current session/settings cleanup | no-pending key destruction and purge; pending-work block/preserve-or-explicit-discard behavior for logout and mode/account switch |
| Migration | existing rows and old clients | dual read/write, backfill, mismatch quarantine, cutover/rollback |
| Rotation/recovery | service availability | old/new key reads, cross-event and local-token dual lookup, reencrypt, backup restore without changing queryable category semantics |

## AD. Capstone Implementation Recommendation

### Minimum secure capstone

The smallest defensible RC1 implementation is:

1. Add a backend crypto service using Node built-in AES-256-GCM and HMAC-SHA-256.
2. Encrypt household/member/donor/user direct identity fields and exact DOB in additive shadow columns; add municipality-level identity blind indexes for approved cross-event/re-admission matching and separate event/barangay operational indexes where required. Keep approved standardized demographic categories and sector relation IDs queryable under strict RBAC/scope for authorized counts.
3. Fix service read ordering so municipality/event/barangay scope and authorization precede decryption or signed-photo URL generation.
4. Move family-head photos to the existing private-storage pattern; stop accepting/returning general data URLs. Do not make application-level object-byte encryption a capstone prerequisite.
5. Encrypt current offline queue, household/masterlist/stub/preparation PII stores and any approved offline photo copies with a browser-generated per-device key.
6. Add explicit no-pending logout cleanup, pending-work logout/account-mode switch blocking, explicit discard, event-TTL handling, and no-Pii service-worker cache tests.
7. Redact notifications and audit/error logs; encrypt only retained residual detail.
8. Encrypt sync/conflict bodies while preserving safe routing metadata.
9. Add dual-read/dual-write migrations and the named TC-S-023/TC-S-024 test coverage.

### Production-grade additions

- Managed KMS/HSM/secrets manager and envelope-key hierarchy.
- Formal key registry, dual control, recovery drills, compromise response, and rotation automation.
- Verified PostgreSQL RLS and Storage policies as a second authorization layer.
- HttpOnly/SameSite session cookies or an equivalent hardened token storage strategy.
- CSP, dependency/SRI/service-worker integrity, XSS review, DLP scanning, and browser/device management.
- Protected report vault with expiration, watermarking, access logging, and controlled sharing.
- Searchable-encryption/prefix-index design only after leakage and scale approval.
- Object-level encryption/KMS for family photos if storage-admin/backup-reader threats are in scope; this is not required for the minimum capstone.
- Formal retention/destruction schedules for records, caches, exports, notifications, logs, backups, and keys.
- Independent penetration test and LGU privacy/security review.

### Concrete implementation targets

The first implementation slice should touch only the approved crypto/migration surface:

- New backend service: server/src/services/piiCrypto.service.js.
- Shared canonicalization/token helper under server/src/utils or server/src/services, with tests.
- Household registration repository/service and duplicate routes/services.
- Masterlist repository/service and offline preparation/cache adapters.
- Profile/family photo storage service and household/stub/distribution DTO mappers.
- sync.repository.js, sync.service.js, sync.validator.js, and client syncQueue/syncService.
- systemLog and notification safe-payload builders.
- Additive database migration files only after the migration design is approved.
- Client offline key/key-store, encrypted record codec, logout purge, and protected-store adapters.

No source changes were made in this task.

## AE. Production LGU Hardening Recommendations

These are production-LGU controls beyond the minimum secure capstone boundary. They strengthen custody, device, object, recovery, and governance controls; they do not change the capstone requirement to encrypt direct PII while keeping approved structured demographic categories queryable under strict RBAC/scope.

- Establish a data inventory and retention owner for beneficiary, donor, staff, consent, photo, audit, notification, export, and backup copies.
- Obtain written approval for offline retention duration, offline unlock behavior, public donor display, duplicate-match disclosure, and search leakage.
- Separate production secrets from staging/development and prohibit copying production data to developer machines.
- Use managed KMS/secrets with audit trails, rotation/recovery drills, least privilege, and dual approval.
- Verify database roles, RLS policies, Storage bucket policies, signed URL TTLs, and service-role bypass behavior.
- Enforce TLS for browser, API, Storage, sync, and analytics traffic; use service-to-service authentication for FastAPI.
- Harden the PWA against XSS and supply-chain compromise with CSP, dependency lock/review, update integrity, and safe DOM rendering.
- Manage devices that cache offline PII: screen lock, disk encryption, browser profile policy, remote wipe/revocation, and restricted shared-device use.
- Apply object-level/KMS photo encryption only if the LGU threat model requires protection from storage administrators or backup readers; private storage plus authenticated, scoped, short-lived signed retrieval remains the capstone minimum.
- Disable production request-body/Morgan debug logging and centralize redacted logs with access review.
- Restrict exports: least privilege, no-store, watermarking, short-lived download links where possible, and documented destruction.
- Test disaster recovery using an encrypted backup and separately recovered keys; document the expected degraded behavior if keys are unavailable.
- Perform independent security testing before broad LGU rollout and after major schema/key/storage changes.

## AF. Implementation Stages

| Stage | Deliverable | Gate |
|---|---|---|
| 0. Decisions and baseline | Approve direct-PII versus queryable-demographic boundary, role matrix, cross-event/re-admission matching, retention, search leakage, pending-offline-work/logout policy, photo policy, key custody, and live DB/RLS/Storage audit plan | Written stakeholder decision set; disposable test DB available |
| 1. Crypto foundation | Backend envelope, key loader, HMAC tokens, canonicalization, error/redaction policy | Unit/tamper/key separation tests pass; no secrets in bundle/logs |
| 2. Additive schema | Shadow encrypted/token/photo/safe-log/sync columns and indexes, plus readable approved demographic/category and sector-link fields where required | Migration rehearsed and reversible on a copy; no app behavior change yet |
| 3. Authorization refactor | Municipality/event/barangay candidate-scope resolution and scope-before-fetch/decrypt or signed URL in household, masterlist, stub, distribution, donations, logs, and reports | Negative role/barangay tests pass before any decrypt or signed-URL call; cross-event candidate matching remains bounded |
| 4. Server dual read/write | Encrypt new writes, compatibility reads, backfill tooling, DTO mapping | Old/new row contract and mismatch metrics are clean |
| 5. Photos and outputs | Private family-photo path, signed URLs, report/notification/log redaction; no application-level object encryption dependency for capstone | No data URLs/PII messages; private-storage and signed URL tests pass |
| 6. Offline and sync | Device key, encrypted Dexie stores, protected envelopes, pending-work logout/account-mode switch policy, purge/TTL, encrypted sync/conflicts | TC-S-024 and offline regression matrix pass |
| 7. Backfill/cutover | Batch direct PII and both token domains, validate queryable demographic aggregates, stop legacy writes, remove fallback after window, invalidate legacy photo data URLs | Counts/checksums/re-admission/report totals/recovery verified; rollback remains safe |
| 8. Rotation and production hardening | KMS, RLS/Storage verification, optional production object encryption, rotation/recovery, monitoring, penetration review | Go/no-go approval by engineering and LGU data owner |

## AG. Do-Not-Implement-Yet List

- Do not add a plaintext search_text or normalized-name column merely to preserve fuzzy search.
- Do not use plain SHA-256 hashes for names, phones, email, or donor identities.
- Do not put AES/HMAC/offline keys in Vite variables, browser localStorage, IndexedDB alongside data, JWTs, source code, or database rows.
- Do not encrypt primary/foreign/scope/status fields, or approved standardized demographic/sector category fields required for authorized aggregation, in a way that breaks authorization and operational joins without an approved replacement.
- Do not decrypt a full table before checking role and municipality/event/barangay scope. A municipality-scoped blind-index candidate lookup for approved cross-event matching is not permission to decrypt or reveal the candidate.
- Do not return Base64 family photos in household/masterlist/stub DTOs or cache them as data URLs.
- Do not put names, contacts, addresses, or photos in QR values, URLs, notification metadata, push payloads, error messages, audit JSON, or sync routing metadata.
- Do not expose encrypted database values or blind tokens to the browser as a substitute for a DTO.
- Do not implement general fuzzy/searchable encryption before the leakage/scale decision.
- Do not drop legacy columns before dual-read, backfill, client upgrade, report, offline, restore, and rollback gates pass.
- Do not rotate or destroy keys without a tested recovery copy and verified re-encryption coverage.
- Do not connect to or mutate the live database during design work.
- Do not treat an unverified RLS state or the existing RBAC checks as proof that encryption is unnecessary.

## AH. Go/No-Go Criteria

### Go criteria for implementation

- The field classification and role/route matrix is approved.
- The direct-PII versus queryable structured-demographic boundary is approved, including exact-DOB encryption and queryable age-group/sector-category behavior.
- Cross-event duplicate/re-admission behavior is approved and its municipality-level identity-token design is tested alongside event-specific filtering.
- Live DB role/RLS/Storage posture has been read-only verified.
- Key custody, environment separation, recovery, rotation, and compromise response are approved.
- Offline retention, key-loss, device-revocation, public donor, and pending-work logout/account-mode switch policies are approved.
- Current PWA/offline preparation, sync queue, conflict resolution, masterlist search, duplicate detection, and photo flow are stable and test-covered.
- A disposable test database and safe migration rehearsal environment exist.
- TC-S-023 and TC-S-024 are implemented and pass.
- Authorization-negative tests prove no decryption or signed URL generation before scope authorization.
- No source/test/schema/migration changes are merged until the design gate is explicitly approved.

### No-go criteria

- Any protected write can succeed when the data key or HMAC key is unavailable.
- Any encrypted field silently falls back to a conflicting plaintext value.
- Raw PII remains in current offline queue/cache paths without an explicit temporary migration exception.
- Cross-event duplicate/re-admission matching is broken, or an identity-token match is treated as authorization.
- A Barangay user can observe another Barangay’s candidate name/contact/address/photo.
- Family photos remain public, data-URL based, or client-supplied arbitrary URLs.
- Pending protected offline work can be silently lost during logout, account switching, mode switching, TTL cleanup, or key handling.
- Logs/notifications/exports contain unbounded raw PII or tokens.
- RLS/Storage policy status is unknown for a production release.
- Key recovery, old-key retention, or rotation has not been tested.
- Migration counts, mismatch handling, or rollback are unproven.

Current release decision: NO-GO for immediate production rollout; GO to gated design-approved implementation after blockers are closed.

## AI. Final Design Recommendation

Adopt a hybrid, scope-preserving design:

- AES-256-GCM for direct PII, exact DOB, sensitive identity-bearing fields, JSON payloads, and residual protected detail.
- Queryable but strictly RBAC/event/barangay/municipality-scoped standardized demographic categories and sector relation links required for authorized LGU counts, filtering, dashboards, and aggregation.
- HMAC-SHA-256 blind indexes with versioned canonicalization and separate domains: municipality-level identity tokens for approved cross-event duplicate/re-admission candidate discovery, and event/barangay operational tokens where local isolation is required.
- Private opaque photo storage with server-controlled upload, authorization-before-access, and short-lived signed URLs for the capstone; application-level object-byte/KMS encryption remains optional production hardening. Encrypt approved browser/offline photo copies locally.
- Per-device browser Web Crypto key for offline PII, with explicit no-pending logout cleanup, pending-work preservation or explicit discard, account/mode-switch protection, and approved retention.
- Plain readable relational/scope/workflow metadata only where the application must join, route, authorize, deduplicate, or aggregate.
- Authorization and scope before every decryption or signed URL.
- Server-side bounded search for RC1; no general plaintext search derivative.
- Generic notifications and safe audit/error records.
- Encrypted sync/conflict bodies with minimal readable routing metadata.
- Additive dual-read/dual-write/backfill/cutover/rotation/rollback stages.

For the minimum secure capstone/RC1, this gives meaningful protection using the existing Node/PostgreSQL/Supabase stack, private object storage, browser Web Crypto, additive migrations, and gated regression tests. It does not depend on an enterprise HSM, external KMS migration, custom searchable-encryption platform, application-level encryption of private photo objects, enterprise device management, a report vault, or a major authentication redesign. Production LGU deployment should add managed key custody, verified RLS/Storage controls, device management, hardened sessions, formal retention, recovery drills, independent review, and object-level/KMS photo encryption when the threat model requires it.

## AJ. Design Validation

The design was validated against:

- the fetched RC1 commit and clean isolated worktree state;
- the checked-in database schema and relevant migration/index inventory;
- backend auth, household registration, masterlist, distribution, donation, stub, sync, notification, system-log, photo-storage, and export paths;
- client auth/session, mode storage, Dexie schema, sync queue, offline preparation, masterlist/stub/photo, duplicate-preflight, and PWA cache paths;
- the analytics forecasting request/response contract.

The audit confirms the main prior findings about readable PII, Base64 photo propagation, plaintext offline queues/caches, searchable duplicate data, identity-bearing logs/notifications/exports, and absent checked-in RLS policy statements. The QR value was checked and found to be linkable operational metadata without direct PII. The analytics contract was checked and found inventory-only, while its production authentication/network boundary remains unconfirmed.

Not performed:

- no live database connection or RLS query;
- no application/test execution;
- no migration rehearsal;
- no key generation;
- no Supabase Storage mutation;
- no browser DevTools inspection of a running production-like PWA;
- no external penetration test or legal/privacy sign-off.

Those are release gates, not assumptions.

## AK. Safety Confirmation

DESIGN ONLY

Source changes: NO

Test changes: NO

Schema changes: NO

Migration created: NO

Migration executed: NO

Database connected: NO

Database mutated: NO

Encryption key created: NO

Environment changed: NO

Supabase changed: NO

Render changed: NO

Commit created: YES (documentation-only commit for this specification update)

Push performed: NO

Merge performed: NO

Deployment performed: NO
