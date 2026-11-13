# Notification remediation block 4: automated test baseline

Date: 2026-08-07

## Safe runnable commands

Run these commands from the stated working directory:

| Command | Working directory | Expected result |
| --- | --- | --- |
| `npm run test:unit` | `server/` | 131 passing server unit tests; no database mutation |
| `npm test` | `client/` | 112 passing client tests |
| `node server/scripts/check-notification-preference-modern-only.js` | repository root | modern-only notification preference guard passes |
| `npm run build` | `client/` | Vite production build passes |

The server unit runner discovers every `server/test/*.test.js` file except
`*.integration.test.js`. The client runner uses Node's default `node --test`
discovery, which currently discovers 24 test files (23 `.mjs` and 1 `.js`) and
112 tests. No test files
are excluded beyond the explicit server integration suffix, and this block adds
no skip or only markers.

## Database integration safety

Use `npm run test:integration` only with all of the following configured:

- `NODE_ENV=test`
- a disposable `TEST_DATABASE_URL`
- `ALLOW_TEST_DB_MUTATIONS=true`

The command invokes `scripts/verify-test-database.js` before its integration
glob. Without `TEST_DATABASE_URL`, it must stop with the fail-closed message
that database-mutating integration tests will not use the default connection.
It must never fall back to `DATABASE_URL`.

On 2026-08-07, no disposable `TEST_DATABASE_URL` was available. The guard was
verified and integration tests were therefore `NOT_RUN_REQUIRES_TEST_DATABASE`.

## Block 4 result

Initial safe baseline: server unit 131 passed / 0 failed; client 88 passed / 4
failed. Final runnable baseline: server unit 131 passed / 0 failed; client 112
passed / 0 failed on three consecutive full runs. The client production build
and notification-preference static guard pass.

The client failures came from extensionless relative ESM imports of
`offline/db.js`, which Vite resolves but Node's ESM loader does not. All direct
production importers now use the explicit `.js` extension. The affected
Settings tests also explicitly configure the access mode, matching application
startup and preserving fail-closed access-mode validation.

The notification catalog test now checks the canonical `SYNC_FAILURE` behavior
and role-specific user-facing descriptions instead of a fragile source-text
property-name pattern.
