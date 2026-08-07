# DISTYNC Notification Remediation — Block 8 Report

## Email Reliability and Observability

**Status: `BLOCK_8_IMPLEMENTED_CONTROLLED_DELIVERY_PENDING`**

The pre-change audit found a Resend client and escaped HTML template, but direct fire-and-forget sends after notification creation. There was no persisted result, provider ID, retry, or email-level uniqueness guard. Immediate and summary notifications both passed through `createPersistentNotification`; the hourly summary flush assembled aggregate text then used that same path. Eligibility already used the canonical role-policy rows together with `resolveEffectiveNotificationPreferences`, so the settings and delivery decisions share one resolver.

### Canonical email policy matrix

| Rule | Role | Email policy | User configurable | Mode |
|---|---|---|---:|---|
| DISASTER_EVENT_CREATED | MSWDO | DEFAULT_ON | EMAIL_ONLY | IMMEDIATE |
| DISASTER_EVENT_UPDATED | Barangay / MSWDO / Mayor | DEFAULT_ON | EMAIL_ONLY | IMMEDIATE |
| HOUSEHOLD_REGISTERED | Barangay | UNAVAILABLE | ALL_SUPPORTED_CHANNELS | HOURLY_SUMMARY |
| HOUSEHOLD_REGISTERED | MSWDO | OPTIONAL | ALL_SUPPORTED_CHANNELS | HOURLY_SUMMARY |
| EVACUEE_ATTENDANCE_UPDATED | Barangay | UNAVAILABLE | ALL_SUPPORTED_CHANNELS | HOURLY_SUMMARY |
| EVACUEE_ATTENDANCE_UPDATED | MSWDO | OPTIONAL | ALL_SUPPORTED_CHANNELS | HOURLY_SUMMARY |
| HOUSEHOLD_VERIFICATION_UPDATED | Barangay / MSWDO | OPTIONAL | EMAIL_ONLY | IMMEDIATE |
| DISTRIBUTION_COMPLETED | MSWDO / Mayor | OPTIONAL | ALL_SUPPORTED_CHANNELS | HOURLY_SUMMARY |
| LOW_STOCK | Mayor | OPTIONAL | EMAIL_ONLY | THRESHOLD |
| CRITICAL_INVENTORY_SHORTAGE | Mayor | DEFAULT_ON | EMAIL_ONLY | THRESHOLD |
| NEAR_EXPIRY_STOCK | Mayor | OPTIONAL | EMAIL_ONLY | THRESHOLD |
| EXPIRED_STOCK / INVENTORY_INCIDENT | Mayor | DEFAULT_ON | EMAIL_ONLY | IMMEDIATE |
| DONATION_RECEIVED | Mayor | OPTIONAL | ALL_SUPPORTED_CHANNELS | IMMEDIATE |
| SYNC_FAILURE / SYNC_CONFLICT | Barangay / MSWDO / Mayor | DEFAULT_ON | EMAIL_ONLY | IMMEDIATE |
| DONATION_STOCK_ANOMALY | Mayor | DEFAULT_ON | EMAIL_ONLY | IMMEDIATE |
| EVACUATION_SUMMARY_REPORT | Mayor | OPTIONAL | ALL_SUPPORTED_CHANNELS | HOURLY_SUMMARY |
| SYSTEM_ALERT / SYSTEM_ANOMALY / OPERATIONAL_ANOMALY | applicable historical roles | retired/inactive | n/a | n/a |

### Final delivery architecture

`event → canonical rule + effective preference resolver → notification persisted → in-app recipients persisted → one email-delivery row per notification/user → atomic claim → Resend → SENT, RETRY_PENDING, FAILED, or SKIPPED`

Email is deliberately after notification persistence. A provider failure is recorded operationally and cannot roll back the in-app notification. The retry worker is part of the existing 15-minute notification maintenance cycle; it is not a new queue or startup-wide bulk sender.

### Schema and duplicate prevention

Migration: `database/migrations/2026-08-07_add_notification_email_delivery_tracking.sql` (**MIGRATION_PREPARED_NOT_APPLIED**).

`notification_email_deliveries` contains `notification_id`, `recipient_user_id`, `role_code`, `status`, `attempt_count`, timing fields, provider message ID, and sanitized error fields. The unique constraint on `(notification_id, recipient_user_id)` defines one logical email delivery. An `INSERT … ON CONFLICT … DO UPDATE … WHERE` claim moves only an eligible row to `SENDING` and increments the count; the network call occurs after that claim commits. `SENT` cannot be claimed again.

The provider call uses the persisted delivery UUID as Resend's idempotency key. This also protects the short crash window between provider acceptance and the local result update. Resend retains its idempotency keys for 24 hours; this implementation's three attempts occur at 0, 15, and 45 minutes by default.

### Status, retry, and safety model

- `SENDING`: an atomically claimed provider attempt is in progress.
- `SENT`: Resend accepted the request and supplied a message ID; this is not mailbox receipt.
- `RETRY_PENDING`: a transient failure; retry is due on the maintenance cycle.
- `FAILED`: invalid recipient, permanent/unknown provider failure, or exhausted retries.
- `SKIPPED`: configuration is missing or eligibility changed before retry.

The default maximum is 3 provider attempts and the default base delay is 900 seconds, with bounded exponential delays. Only timeouts/network-like errors, 429, 5xx, and Resend's concurrent-idempotency response retry. 4xx validation/rejection errors are terminal; unknown errors are terminal by default. Missing provider configuration does not increment attempts. Retried rows re-resolve user activity, role policy, and modern preferences; disabled, unavailable, deactivated, or missing-email recipients become `SKIPPED`.

Provider message IDs are stored only after acceptance. Error text is capped and redacts credential-shaped API key/Bearer content; raw provider responses are neither stored nor rendered. The existing template escapes title, message, severity, and timestamp, and contains no metadata-derived links or raw rule codes.

### Summary behavior

Summary events are aggregated before final notification creation. The final aggregated title/message is passed to the same tracked-delivery service, so each eligible recipient receives at most one logical email per generated summary notification. `HOUSEHOLD_REGISTERED`, attendance, and distribution summaries retain their existing source-event aggregation; the Mayor evacuation report retains its final aggregate content.

### Verification

- Server unit suite: **134 passed, 0 failed** after adding failure-classification and sanitization coverage.
- Client suite: **118 passed, 0 failed**.
- Modern-preference static check: passed.
- Production/PWA build: passed.
- DB integration: `NOT_RUN_REQUIRES_TEST_DATABASE`; no `TEST_DATABASE_URL` was used and no development DB was mutated by tests.
- Migration: prepared only, not applied.
- Controlled send command: `npm run verify:notification-email`. It requires development/test mode, configured Resend credentials, and an explicit `TEST_NOTIFICATION_EMAIL_RECIPIENT`; it creates no notification records. This audit ran it without that recipient and received `EMAIL_DELIVERY_NOT_VERIFIED_NO_SAFE_TEST_RECIPIENT`. No real email was sent.

The relevant environment placeholders are documented in `server/.env.example`: `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `RESEND_FROM_NAME`, `EMAIL_NOTIFICATION_MAX_ATTEMPTS`, `EMAIL_NOTIFICATION_RETRY_BASE_SECONDS`, and `TEST_NOTIFICATION_EMAIL_RECIPIENT`.

### Manual verification after migration

1. Review and apply the new migration to a non-production or approved development database.
2. Configure Resend and a safe controlled recipient, then run `npm run verify:notification-email` from `server/` with `NODE_ENV=development`.
3. Trigger an eligible immediate rule and verify one `notification_email_deliveries` row reaches `SENT` with `attempt_count = 1` and a provider ID.
4. Simulate one transient provider failure; verify `RETRY_PENDING`, a future `next_retry_at`, then one later successful `SENT` row without a second logical delivery row.
5. Trigger an hourly summary and verify its final aggregate notification has one tracked email row per eligible recipient.
