# Notification remediation — Block 3

## Policy decisions

- `LOW_STOCK` remains active. Inventory batches already use a distinct ten-unit low-stock threshold and a five-unit critical-shortage threshold. The producer now emits `LOW_STOCK` only when a batch first crosses below the low threshold; its delivery state remains latched while the batch is critical and resets only after normal stock is restored.
- `SYSTEM_ALERT` is retired. It has no producer and overlaps the actionable `SYNC_FAILURE` and `SYNC_CONFLICT` rules.
- `OPERATIONAL_ANOMALY` is retired. It has no producer; inventory and donation anomaly flows use dedicated rules.
- `DISTRIBUTION_UPDATE` is retained as inactive history, not mapped to `DISTRIBUTION_COMPLETED`, because an update lifecycle is not semantically identical to a completed distribution.

## Authority and compatibility

All active rules have static priority. Final notification severity is read from the active role policy in the notification service; producer-supplied severity is ignored. A rule spanning multiple recipient roles must have one policy priority or notification creation fails safely.

The Block 3 migration only deactivates the named policy/rule rows. It neither rewrites historical notifications nor user preferences. Existing direct-alias preference migration remains authoritative: canonical keys win; legacy keys fill only missing channel values; policy still forces mandatory in-app delivery and unavailable email off.

## Migration verification

Before applying `2026-08-07_reconcile_notification_policy.sql` to a development database, run read-only counts for active policy rows, known legacy rows, and `notification_rule_preferences_json` legacy keys. The migration was prepared but not applied by this implementation task.
