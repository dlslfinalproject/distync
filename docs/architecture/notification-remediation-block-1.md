# Notification remediation — Block 1

## Test database safety

`npm test` runs unit tests only and never selects `DATABASE_URL` while
`NODE_ENV=test`. Database-mutating tests must be run with `npm run
test:integration`; that command requires all of the following:

- `TEST_DATABASE_URL` is set explicitly;
- its database name includes `test`;
- `ALLOW_TEST_DB_MUTATIONS=true` is set.

The test runtime fails closed when any condition is missing. Normal development
and production runtimes continue to use `DATABASE_URL`. Do not place real
credentials in `.env.example` or commit local `.env` files.

## Summary queue compatibility

Event-based hourly summaries store an `events` JSON array in one row per
role/rule/context/window. The repository atomically appends a new source event
on a summary-key conflict and ignores an event with the same deterministic
event ID. Flush treats legacy object payloads as one event, so already-pending
pre-Block-1 rows remain readable.

Evacuation summary reports are not event-queued aggregates: they are calculated
from source records for the last completed Asia/Manila hour and use the queue
only as a single delivery bucket.
