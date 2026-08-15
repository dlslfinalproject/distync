# Barangay Evacuee Masterlist Performance Smoke Suite

This is a deployed, authenticated browser performance-smoke harness for the
Barangay Evacuee Masterlist. It measures one legitimate Barangay user in one
browser page at a time against:

- Frontend: `https://distync.onrender.com`
- Backend: `https://distync-api-test.onrender.com`

It does not bypass Google authentication and does not modify DISTYNC production
application behavior.

## One-time Auth Setup

```bash
npm run perf:barangay:auth
```

The setup opens a headed Chromium browser. Sign in manually with the authorized
Barangay Google account, confirm the Barangay Masterlist is visible, then press
Enter in the terminal. The local storage state is saved to:

```text
.performance-auth/barangay-storage-state.json
```

That directory is ignored by Git and must never be committed.

## Performance Run

```bash
npm run perf:barangay:masterlist
```

The runner refuses unapproved hosts, requires the saved Barangay storage state,
uses one browser/page sequentially, writes sanitized JSON/CSV reports under
`performance-results/barangay-masterlist/`, and stops on auth loss.

Default sample counts:

- 20 warm refreshes
- 5 cache-bypass refreshes
- 3 normal event switches when at least two events exist
- 2 rapid event switches when at least two events exist

Mutation coverage is skipped by default. Enable it only for a clearly synthetic
record with:

```bash
DISTYNC_PERF_ALLOW_MUTATIONS=true npm run perf:barangay:masterlist
```

The current implementation still marks the mutation scenario skipped because no
synthetic deployed record is assumed by the harness.

