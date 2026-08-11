# Notification policy reconciliation — 2026-08-07

## NFA-001 — active legacy notification policies

**Severity:** HIGH  
**Status:** OPEN_MIGRATION_PENDING

### Root cause

`2026-07-29_finalize_notification_preference_structure.sql` activated the
legacy notification catalog. The later alias-consolidation migration covers
four direct aliases, and Block 3,
`2026-08-07_reconcile_notification_policy.sql`, retires
`DISTRIBUTION_UPDATE`. All five are still active live, which proves those
deactivations were not applied to this database (or were later manually
reversed). No current seed or startup path can restore them. The live database
has no migration tracking table, so an individual applied-migration record is
unavailable.

The current seed and runtime startup catalog do not activate the seven legacy
rules: the seed records them as inactive and startup upserts only the runtime
catalog, whose retired definitions are inactive. A fresh setup therefore does
not reintroduce this drift.

### Canonical active catalog

The runtime authority is `server/src/modules/notifications/notificationPolicy.js`.
It has 16 active rules and 26 active role-policy combinations. The seven
legacy rules below are not active runtime rules and must never be returned as
active Settings policies.

| Legacy rule | Action |
|---|---|
| `CRITICAL_STOCK` | Deactivate rule and policy; direct alias is historical only. |
| `DISASTER_EVENT_UPDATE` | Deactivate rule and policy; direct alias is historical only. |
| `DISTRIBUTION_UPDATE` | Deactivate rule and policy; preserve history; do not map to completion. |
| `DONATION_STOCK_UPDATE` | Deactivate rule and policy; no replacement is assumed. |
| `EVACUEE_ATTENDANCE_UPDATE` | Deactivate rule and policy; direct alias is historical only. |
| `HOUSEHOLD_VERIFICATION` | Deactivate rule and policy; direct alias is historical only. |
| `SYSTEM_ANOMALY` | Deactivate rule and policy; preserve history; do not map to a current anomaly. |

### Corrective migration

Apply `database/migrations/2026-08-07_deactivate_remaining_legacy_notification_policy.sql`
exactly once to the verified development database. It only sets `is_active =
FALSE` on the seven legacy rule rows and their policy rows. It does not delete
rules, notifications, summary events, email-delivery history, or user settings
JSON.

Root-cause classification: `ROOT_CAUSE_BLOCK_3_NOT_APPLIED_CURRENT_DB`.

Migration status: `CORRECTIVE_MIGRATION_PREPARED_NOT_APPLIED`.

### Validation

Before and after manual application, run:

```powershell
cd server
node scripts/audit-notification-policy-parity.js
```

After application, `activeRuleDiff.runtimeOnly` and
`activeRuleDiff.liveOnly` must both be empty; the expected active counts are
16 rules and 26 role-policy rows. The command is read-only and reports only
aggregate historical-notification and stale-preference-key counts.

### Preference preservation

No current canonical preference policy is changed by this remediation.

- `BARANGAY_CURRENT_PREFERENCES_CHANGED: NO`
- `MSWDO_CURRENT_PREFERENCES_CHANGED: NO`
- `MAYOR_CURRENT_PREFERENCES_CHANGED: NO`

Historical notifications keep their original `rule_code`; inactive rules are
not treated as invalid historical data.
