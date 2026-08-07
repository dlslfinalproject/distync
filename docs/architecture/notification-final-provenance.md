# Final notification provenance

New `notifications` rows persist a canonical `rule_code` and a safe `metadata_json` object. `rule_code` is canonicalized against the server policy catalog before persistence; unknown rules fail safely and are not written.

`metadata_json` is allowlisted per rule. It stores IDs, bounded counts, timestamps, and limited summary aggregates only. URLs, HTML, credentials, raw request bodies, full entities, names, and arbitrary nested queue payloads are excluded. Summary finalization persists `windowStart`, `windowEnd`, `eventCount`, and a bounded operational breakdown rather than the raw accumulated event array.

The schema keeps `rule_code` nullable for pre-migration rows. Historical provenance is intentionally left null when it cannot be derived deterministically. API responses expose `ruleCode: null` and `metadata: {}` for those rows so existing notification cards, detail views, and role-safe destination fallback continue to work.
