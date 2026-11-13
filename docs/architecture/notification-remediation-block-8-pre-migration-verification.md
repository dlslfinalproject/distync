# DISTYNC Block 8 — Pre-Migration Verification Report

## Email Delivery Tracking

**Decision: `MIGRATION_APPROVED_FOR_MANUAL_APPLICATION`**

The migration remains unchanged. One runtime defect was corrected before approval: inactive users had been filtered out by the retry candidate query, so a pre-existing `RETRY_PENDING` row could remain pending forever. Candidates now include inactive users; the existing effective-recipient resolver then yields no eligible recipient and records `SKIPPED` with `EMAIL_NO_LONGER_ELIGIBLE`.

### Migration under review

`database/migrations/2026-08-07_add_notification_email_delivery_tracking.sql` creates `notification_email_deliveries`, one row per `(notification_id, recipient_user_id)`, with state, retry, provider-ID, and sanitized-error fields. Apply it **exactly once** through the established manual migration procedure; it intentionally uses ordinary `CREATE TABLE`/`CREATE INDEX`, not `IF NOT EXISTS`.

### Focused verification results

| Verification | Result | Evidence | Change needed? |
|---|---|---|---:|
| `updated_at` maintained | PASS | Every state-changing SQL path explicitly sets `updated_at = NOW()`; query-contract test added. | No |
| One-email-per-user identity | PASS | Recipient plans are reduced by `userId` before delivery; DB uniqueness is `(notification_id, recipient_user_id)`. | No |
| User FK lifecycle | PASS, source verified | `users.is_active` is the user-lifecycle model and no user hard-delete path was found. | No |
| Stale `SENDING` recovery | PASS | Maintenance retry candidates include stale `SENDING`; atomic claim safely reacquires it after 15 minutes. | No |

### State updates and `updated_at`

| Transition | Function | `updated_at` |
|---|---|---:|
| Initial/retry/stale claim → `SENDING` | `claimNotificationEmailDelivery` | Yes |
| `SENDING` → `SENT` | `markNotificationEmailDeliveryResult` | Yes |
| `SENDING` → `RETRY_PENDING` | `markNotificationEmailDeliveryResult` | Yes |
| `SENDING` → `FAILED` | `markNotificationEmailDeliveryResult` | Yes |
| Eligible/retry target → `SKIPPED` | `markNotificationEmailDeliverySkipped` | Yes |
| Invalid address → `FAILED` without provider attempt | `markNotificationEmailDeliveryFailedWithoutAttempt` | Yes |

### Delivery identity and multi-role behavior

`createPersistentNotification` merges recipient plans in a `Map` keyed by `userId`. A user reached through two roles or recipient paths gets one final recipient plan and one email-delivery identity. The retained `role_code` is effective-policy/audit context only; it must not be added to the unique constraint. Different roles do not create legitimate separate messages for the same final notification and user.

| Scenario | Expected email count |
|---|---:|
| Single-role user | 1 |
| Multi-role user, same final notification | 1 |
| Same user via two recipient paths | 1 |
| Same user with two email-eligible roles | 1 |

`ONE_EMAIL_PER_NOTIFICATION_USER_CONFIRMED`.

### User lifecycle and foreign keys

The schema has `users.is_active NOT NULL DEFAULT true`; recipient and preference queries already select active users. No `DELETE FROM users` or user-account hard-delete service/route exists in the source audit. Therefore this is **SOFT_DEACTIVATION**.

- `notification_id … ON DELETE CASCADE` is appropriate: telemetry belongs to its notification.
- `recipient_user_id … REFERENCES users(id)` uses the intentional default restrictive behavior, preserving historical delivery records and preventing accidental destructive user deletion.
- `role_code … REFERENCES roles(code)` is appropriate because role codes are stable policy identifiers.

### Recovery, retries, and atomic claim

`retryNotificationEmailDeliveries` runs in the existing notification maintenance cycle (initialization and every configured scan interval). `getRetryableNotificationEmailDeliveries` selects due `RETRY_PENDING` rows and stale `SENDING` rows older than 15 minutes. The subsequent `INSERT … ON CONFLICT … DO UPDATE … WHERE` claim is the concurrency boundary; it increments only an actual claimed provider attempt and never claims `SENT`, `FAILED`, or `SKIPPED`.

The stale index is justified by the `status = 'SENDING' AND last_attempt_at <= cutoff` branch. The retry partial index is justified by the `status = 'RETRY_PENDING' AND next_retry_at <= NOW()` branch. No startup code synthesizes delivery rows for historical notifications, so applying this migration cannot backfill or mass-send historical email.

The provider key is `notification-email/<delivery-id>`. A delivery ID is persistent across retries, making the key stable for retries and distinct for different logical deliveries. Resend idempotency therefore protects the crash window after provider acceptance and before the local `SENT` update.

| Current | Event | Next |
|---|---|---|
| `SENDING` | provider success | `SENT` |
| `SENDING` | transient failure within cap | `RETRY_PENDING` |
| `SENDING` | permanent/unknown failure or cap reached | `FAILED` |
| `RETRY_PENDING` | due, active, and eligible | `SENDING` |
| `RETRY_PENDING` | inactive/disabled/unavailable | `SKIPPED` |
| `SENT` / `FAILED` / `SKIPPED` | duplicate claim | no-op |

### Schema compatibility

The source schema confirms `notifications.id` and `users.id` are UUIDs, `roles.code` is a compatible character-varying key for the text FK, and `gen_random_uuid()` is already used throughout the schema. The table is positioned after its dependencies in the schema snapshot. Development-DB schema inspection was not completed; this is `SOURCE_VERIFIED_ONLY`. DB integration remains `NOT_RUN_REQUIRES_TEST_DATABASE`.

### Controlled verification script

`npm run verify:notification-email` runs only in `development` or `test`, requires `TEST_NOTIFICATION_EMAIL_RECIPIENT` and configured Resend credentials, and makes one direct provider call. It does not create notifications, scan users, process the retry backlog, alter recipients, or expose secrets. It reports `PROVIDER_ACCEPTED_CONTROLLED_EMAIL` only after a provider message ID is returned; it does not claim mailbox delivery. Do not run it until an explicitly approved dedicated test address is configured.

### Test results

- Server unit: **137 passed, 0 failed**.
- Client: **118 passed, 0 failed**.
- Modern notification-preference check: passed.
- Production/PWA build: passed.
- Development DB mutation: **NONE**.
- Real email sent: **NO**.

### Manual application steps

1. Back up or otherwise confirm the target development database.
2. Apply `2026-08-07_add_notification_email_delivery_tracking.sql` once.
3. Verify the new table, unique constraint, and both partial indexes.
4. Confirm the table is initially empty; do not backfill historical notifications.
5. Restart the backend only if the local migration workflow requires it.
6. Configure a dedicated `TEST_NOTIFICATION_EMAIL_RECIPIENT` and valid sender/provider configuration.
7. Run `npm run verify:notification-email` exactly once and record provider acceptance without treating it as mailbox receipt.
8. Optionally confirm mailbox receipt separately with the test-recipient owner.

### Completion gate

All 28 requested gates are **YES**, except DB integration which is intentionally **NOT_RUN_REQUIRES_TEST_DATABASE** and does not block this source-level/manual-application decision. No uncontrolled email or development-database mutation occurred.
