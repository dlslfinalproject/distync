# Notification Preference Modernization Evidence Manifest

Date: 2026-08-03
Status: `PARTIALLY_COMPLETED`

## Purpose

This manifest preserves a non-sensitive project record for DISTYNC's notification-preference modernization evidence retention attempt on 2026-08-03.

## Live Verification Confirmed

- Live Supabase schema is modern-only:
  - `enabled_notification_rule_codes_json`: absent
  - `notification_channels_json`: absent
  - `notification_rule_preferences_json`: present as `jsonb NOT NULL DEFAULT '{}'::jsonb`
- Live `user_role_settings` counts on 2026-08-03:
  - total rows: `4`
  - populated modern rows: `1`
  - policy-default rows: `3`
  - malformed modern rows: `0`
  - duplicate `(user_id, role_code)` rows: `0`
- Live authenticated API checks on 2026-08-03 succeeded for:
  - Barangay `GET /api/v1/settings/current`
  - MSWDO `GET /api/v1/settings/current`
  - Mayor `GET /api/v1/settings/current`
  - one missing-row Barangay `GET /api/v1/settings/current`
- Live API checks on 2026-08-03 also confirmed:
  - missing-row `GET` did not create a settings row
  - the approved Barangay row still resolves `DISTRIBUTION_UPDATE` to `inApp: false` and `email: false`
  - live legacy-field `PUT` was rejected with `400`
  - a reversible MSWDO live save persisted and then reset a modern optional preference

## Permanent References

- Architecture decision:
  - `docs/architecture/legacy-notification-category-decision-reliefArrivalNotifications.md`
- Forward migration retained:
  - `database/migrations/2026-08-03_remove_legacy_notification_preference_columns.sql`
- Current schema retained:
  - `database/schema/distync_schema.sql`
- Static checker retained:
  - `server/scripts/check-notification-preference-modern-only.js`
- Finalization report:
  - `tmp/notification-preference-cleanup-finalization-report.md`
  - `tmp/notification-preference-cleanup-finalization-report.json`

## Sensitive Evidence Still Held Outside Permanent Docs

The following files were intentionally not copied into versioned documentation because they include internal row identifiers and removed legacy values:

- `tmp/notification-preference-legacy-columns-final-backup.json`
- `tmp/notification-preference-legacy-columns-final-backup.md`
- `tmp/notification-preference-legacy-columns-recovery-preview.sql`
- `tmp/notification-preference-modern-only-transition-report.json`

## Archive Limitation Recorded On 2026-08-03

- A fully validated secure archive copy was not completed in this session.
- The retained `tmp/notification-preference-legacy-columns-final-backup.json` artifact needs manual review before any external archival copy because:
  - the recorded SHA-256 inside the file does not match the file's current SHA-256
  - the captured Barangay modern state no longer matches the later live row state

## Cleanup Decision

- Obsolete backfill tooling was not deleted on 2026-08-03.
- Obsolete focused tests were not deleted on 2026-08-03.
- Intermediate `tmp/` reports were not deleted on 2026-08-03.

Those deletions remain blocked until browser verification, delivery verification, log review, and backup/archive validation all pass.
