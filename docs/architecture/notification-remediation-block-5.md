# Notification remediation block 5: scalable retrieval

Date: 2026-08-07

## Query audit and index decision

| Query | Tables | WHERE / join | ORDER BY | Limit | Candidate index |
| --- | --- | --- | --- | --- | --- |
| Unread badge | `notification_recipients` | `user_id`, `read_at IS NULL` | — | — | partial `user_id WHERE read_at IS NULL` |
| Bell | recipients, notifications, policies | recipient user, unread, rule/role policy | generated time, notification id DESC | 5 | recipient user/notification plus unread partial |
| Center All | recipients, notifications, policies | recipient user, role policy | generated time, notification id DESC | page + 1 | recipient user/notification |
| Center Unread | same | recipient user, unread | generated time, notification id DESC | page + 1 | unread partial plus recipient user/notification |
| Category / priority combinations | same | recipient user plus policy category/priority | generated time, notification id DESC | page + 1 | no new filter index: recipient scope is the leading selective predicate |
| Mark one read | recipients | notification id, user id | — | 1 | existing unique `(notification_id, user_id)` |
| Mark all read | recipients | user id, unread | — | — | unread partial |
| Detail lookup | notifications | primary-key id | — | 1 | existing primary key |

Existing notification indexes are the `notifications` primary key, the unique recipient delivery index `(notification_id, user_id)`, and policy role index `idx_notification_rule_role_policies_role_code`. The Block 5 migration adds only `idx_notification_recipients_user_notification` and partial `idx_notification_recipients_unread_user`. It deliberately adds no JSON, rule-code, priority, category, or timestamp index: current runtime filtering starts with recipient ownership; JSON is not queried; and a cross-table recipient-first listing cannot use a notification ordering index to avoid the final sort.

## Pagination API

`GET /api/v1/notifications?limit=25`

`GET /api/v1/notifications?limit=25&cursor=<opaque-base64url>`

`GET /api/v1/notifications?status=unread&category=INVENTORY_MONITORING&priority=critical`

The response is `{ items, nextCursor, filterOptions }`. `nextCursor` encodes only `{ generatedAt, id }`; its structure, timestamp, UUID, and length are validated server-side. Limits are positive integers from 1 to 50. Status, category format, and priority are validated; authenticated recipient ownership always comes from `req.auth.userId`.

Filters execute in the database before `ORDER BY n.generated_at DESC, n.id DESC`, then the keyset predicate and `LIMIT pageSize + 1`. The UUID tie-breaker prevents loss or duplication for equal timestamps. A notification inserted after page one sorts above the cursor and therefore does not shift or duplicate the remaining traversal.

The Center resets its cursor and list when tabs, filters, or Refresh change; Load more appends the next filtered page. A read item is removed from the Unread tab locally, while Mark All refreshes that tab. The bell remains an independent unread five-item request and does not retain a history cursor. Historical rows remain listable; rows with missing policy data simply have no canonical category/priority match for those optional filters.

## Retention direction

No business-approved retention period exists: `RETENTION_POLICY_NOT_YET_BUSINESS_APPROVED`. This block creates no purge job and deletes no notification history. Recommended future policy: archive/retain read history according to an approved records schedule; keep unread rows until read or explicitly resolved; separately clean processed summary-queue rows only under an approved operational retention policy.

## Verification status

`QUERY_STRUCTURE_OPTIMIZED`; `INDEXES_PREPARED_OR_APPLIED` (migration prepared, not applied here); `REAL_DB_QUERY_PLAN_VERIFICATION_PENDING`; `LOAD_TEST_PENDING`.

No unsafe database mutation was performed. Integration status remains `NOT_RUN_REQUIRES_TEST_DATABASE` until a disposable `TEST_DATABASE_URL` is supplied. Blocks 1–4 behavior remains unchanged: summaries, rule code/metadata response fields, policy-based severity, and the fail-closed test guard are preserved.

Completion gate: `BLOCK_5_IMPLEMENTED_DB_VERIFICATION_PENDING` once safe unit/client/build checks pass. Same-timestamp, cursor validation, filter-before-pagination, and bounded-limit behavior are covered by SQL-contract/unit tests; real PostgreSQL plans and load evidence remain pending.
