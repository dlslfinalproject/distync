# Legacy Notification Category Decision - reliefArrivalNotifications

## Historical Meaning

`reliefArrivalNotifications` was a legacy notification-preference category key stored in role settings for the Barangay Settings UI. Its Barangay-facing label described "supply arrival updates, release readiness, and barangay allocation notices."

## Evidence Matrix

| Evidence source | File/commit/migration | Date if available | What `reliefArrivalNotifications` meant | Role scope | Delivery consumer | Confidence |
| --- | --- | --- | --- | --- | --- | --- |
| Frontend toggle | `523bad8:client/src/pages/settings/RoleSettingsPage.jsx` | Commit in past history | Barangay Settings checkbox labeled "Relief Arrival Notifications" with local-preference wording | BARANGAY | None shown in UI code | HIGH |
| Settings persistence | `7f22c4c:server/src/services/settings.service.js` | Commit in past history | Stored under `notification_channels_json` defaults and sanitization keys | BARANGAY, MSWDO, MAYOR settings storage shape | None in service | HIGH |
| Notification runtime introduction | `34e15cb:server/src/modules/notifications/notification.service.js` | Commit in past history | Inventory and donation notification producers target `MAYOR`; no Barangay preference lookup exists | MAYOR for inventory/donation, BARANGAY only for sync/disaster registration paths | None for Barangay category | HIGH |
| Historical notification repository | `34e15cb:server/src/modules/notifications/notification.repository.js` | Commit in past history | No user preference row lookup for delivery existed yet | All roles | None | HIGH |
| Notification rules seed | `database/seeds/initial_seed.sql` | Current seed, historical rule baseline retained | Inventory/donation rules seeded for `MAYOR`; `DISTRIBUTION_UPDATE` seeded for `MSWDO`; no Barangay equivalent | MAYOR, MSWDO, BARANGAY specific rules elsewhere | Rule set only | HIGH |
| Notification policy migration | `database/migrations/2026-07-29_finalize_notification_preference_structure.sql` | 2026-07-29 | Barangay enabled-rule backfill list excluded inventory/donation/distribution successor candidates tied to `reliefArrivalNotifications` | BARANGAY | None | HIGH |
| Current frontend role config | `client/src/pages/settings/settingsConfig.js` | Current | Barangay label still describes supply/release/allocation notices; Mayor now uses the same key label for Relief Operations | BARANGAY and MAYOR labels differ by role grouping | UI grouping only | MEDIUM |
| Current shared resolver | `server/src/modules/notifications/notificationPreferenceUtils.js` before this decision update | Current | Legacy map grouped `reliefArrivalNotifications` with Mayor inventory/donation rules, but those rules do not apply to Barangay | MAYOR rules only | Current resolver only after policy hardening | MEDIUM |

## Historical Runtime Flow Trace

### Barangay path

`reliefArrivalNotifications`
-> stored in old Settings UI
-> persisted to `notification_channels_json`
-> no historical Barangay notification rule code
-> no historical delivery lookup using `notification_channels_json`
-> no verified Barangay producer for supply-arrival notices

### Mayor path

Inventory and donation alerts were introduced with actual producers for:

- `LOW_STOCK`
- `CRITICAL_STOCK`
- `NEAR_EXPIRY_STOCK`
- `EXPIRED_STOCK`
- `INVENTORY_INCIDENT`
- `DONATION_STOCK_UPDATE`
- `DONATION_STOCK_ANOMALY`

Those producers targeted `MAYOR`, not `BARANGAY`.

## Current Policy Comparison

For `BARANGAY`, the current policy rows are:

- `DISASTER_EVENT_UPDATE`
- `HOUSEHOLD_REGISTERED`
- `HOUSEHOLD_VERIFICATION`
- `EVACUEE_ATTENDANCE_UPDATE`
- `DISTRIBUTION_UPDATE`
- `SYNC_CONFLICT`
- `SYSTEM_ANOMALY`

No current Barangay rule is a proven direct successor to historical `reliefArrivalNotifications`.

## Chosen Outcome

`NEVER_FUNCTIONAL_CATEGORY_CONFIRMED`

For the Barangay role, `reliefArrivalNotifications` was stored in Settings but was not proven to have a historical delivery consumer.

For Barangay users, `reliefArrivalNotifications` is a retired legacy Settings category with no identified historical Barangay notification producer or delivery consumer and no supported current equivalent. It must not be converted into a modern notification-rule preference. Retiring this legacy category must not alter any currently effective Barangay notification behavior.

## Mapping Decision

- Keep the current role-aware legacy rule map intact for roles that actually have applicable current rules.
- Add a reviewed Barangay-specific disposition for `reliefArrivalNotifications`.
- Treat it as obsolete metadata during dry-run analysis for Barangay.
- Keep it visible in reports as a reviewed obsolete category.
- Do not persist obsolete category metadata into `notification_rule_preferences_json`.

## Role Scope

- Reviewed obsolete disposition applies to `BARANGAY`.
- This decision does not remove or redefine Mayor relief-operation rules.

## User-Visible Impact

- No runtime behavior changes are introduced.
- The dry-run no longer treats the Barangay category as an unknown unmapped value.
- The category is retired in migration analysis only, not exposed as a modern saved preference.

## Delivery Impact

- No live notification send path is changed.
- No mandatory or optional active Barangay rule is weakened.

## Migration Treatment

- Omit `reliefArrivalNotifications` from proposed modern JSON for Barangay.
- Report it explicitly as `reviewed obsolete category`.
- Allow backfill readiness only if all active per-rule effective behavior remains equivalent.

## Backfill Eligibility

- Eligible only through a separate approved guarded backfill task.
- This document does not approve execution of any SQL update.

## Remaining Uncertainty

- No historical Barangay notification producer or delivery consumer was found in the available repository history.
- Git history shows UI/storage usage clearly, but no archived product note explains why the Barangay label existed without a delivery path.
- Live delivery was not replayed historically; the conclusion is based on repository evidence.

## Approval Status

- Historical-policy audit completed.
- Safe dry-run interpretation approved for analysis tooling.
- Live one-row guarded backfill explicitly approved and executed on 2026-08-03 for `user_role_settings.id = 09d11ebe-509f-441a-b7c4-5a1f11db3e06`.
- Execution wrote only `notification_rule_preferences_json`, preserved legacy columns, preserved `last_preference_save_at`, advanced `updated_at`, and kept effective Barangay notification behavior unchanged.
- No audit row was created by the direct guarded SQL path used for this one-row backfill.

## Modern-Only Transition Status

- Phase 1 writer cleanup completed on 2026-08-03.
- Phase 2 runtime cleanup code was prepared on 2026-08-03 so active Settings and notification delivery now resolve from modern preferences or policy defaults only.
- Phase 3 forward migration was staged as `database/migrations/2026-08-03_remove_legacy_notification_preference_columns.sql`.
- Final legacy-column backup artifacts were generated at:
  - `tmp/notification-preference-legacy-columns-final-backup.json`
  - `tmp/notification-preference-legacy-columns-final-backup.md`
  - `tmp/notification-preference-legacy-columns-recovery-preview.sql`
- Historical backfill CLI entrypoints were retired and should no longer be used for normal execution.
- Controlled live migration execution, multi-instance deployment verification, actual Settings API verification, manual browser verification, and live notification-delivery verification were not completed in this coding session.

## Final Cleanup Verification Attempt - 2026-08-03

- Live Supabase schema verification on 2026-08-03 confirmed that `enabled_notification_rule_codes_json` and `notification_channels_json` were absent from `public.user_role_settings`.
- Live Supabase schema verification on 2026-08-03 confirmed that `notification_rule_preferences_json` remained present as `jsonb NOT NULL DEFAULT '{}'::jsonb`.
- Live row counts on 2026-08-03 matched the expected post-migration shape:
  - total rows: `4`
  - rows with populated modern preferences: `1`
  - rows using policy defaults: `3`
  - malformed modern rows: `0`
  - duplicate `(user_id, role_code)` rows: `0`
- Live authenticated API verification on 2026-08-03 confirmed:
  - Barangay, MSWDO, Mayor, and one missing-row Barangay `GET /api/v1/settings/current` responses returned `200`
  - missing-row `GET` did not create a `user_role_settings` row
  - the approved Barangay row still resolved `DISTRIBUTION_UPDATE` to `inApp: false` and `email: false`
  - legacy payload fields were rejected by live `PUT /api/v1/settings/current` with `400`
  - a reversible MSWDO live save updated a modern optional preference, persisted it, preserved it across a profile-only save, and then reset the row back to `{}` modern preferences
- Active frontend configuration references to the obsolete `reliefArrivalNotifications` key were removed from `client/src/pages/settings/settingsConfig.js` on 2026-08-03 so the retired category no longer remains in active client settings metadata.
- Post-drop repository integration coverage was updated on 2026-08-03 so `server/test/settings.repository.integration.test.js` no longer queries or inserts the removed legacy columns.

## Finalization Blockers Recorded On 2026-08-03

- Full cleanup finalization did not complete on 2026-08-03.
- Manual browser verification was blocked in this environment because Browser Use could not access the local Vite app on `localhost:5173`, so Barangay/MSWDO/Mayor UI checks were not completed through the actual browser.
- Live notification-delivery replay and live email verification were not completed on 2026-08-03.
- Backend and database live log review after the verification steps was not completed from this environment.
- The stored artifact `tmp/notification-preference-legacy-columns-final-backup.json` did not fully validate on 2026-08-03:
  - its recorded SHA-256 did not match the file's current SHA-256
  - its captured Barangay modern state no longer matched the later live row state
- Because manual/browser/delivery/log/archive gates did not all pass, obsolete one-time backfill tooling and intermediate `tmp/` artifacts were not deleted on 2026-08-03.
