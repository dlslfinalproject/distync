# DISTYNC Notification Remediation — Block 7

## Offline and cache safety contract

### Decision

`NO_PERSISTENT_NOTIFICATION_CACHE_BY_DESIGN`. Before this block, notification
records and bell data existed only in React component memory. IndexedDB stores
the mode-scoped sync queue, and local storage stores scoped settings; neither
stores notifications. Adding a notification cache would add partial-history and
identity-lifecycle complexity without an existing consumer, so it is not used.

Cache storage, shape, bounds, compatibility, and cache-failure behavior are
therefore not applicable. The existing mode-scoped IndexedDB sync queue and
role-settings local-storage cache remain unchanged.

### Offline behavior

The Notification Center and bell show an explicit unavailable state when the
browser reports offline. Notification records are cleared from their in-memory
views, and the unread badge/count is unavailable rather than inferred from a
partial list. Refresh, Load More, Mark as Read, Mark All as Read, and the
notification primary action are disabled or guarded while offline. There is no
notification mutation queue and no local-only read-state change.

### Session isolation and races

In-memory notification state is scoped to `accessMode:userId:roleCode`, using
the authenticated stable user id. On logout, user replacement, role switch, or
access-mode replacement, the center clears notifications, pagination,
selection/detail state, pending mutation state, and bell state. Each fetch and
mutation captures that scope and discards its result when it no longer matches,
so a User A response cannot update User B's view.

### Reconnect and service worker

The online event triggers a normal first-page fetch using the active filters;
the server is authoritative and cursor pagination restarts from the first page.
The generated service worker uses `NetworkOnly` for `/api/` requests, so
authenticated notification API responses are not shared-cache entries.

| Action | Online | Offline |
|---|---|---|
| Mark as Read | Server mutation | Blocked |
| Mark All | Server mutation | Blocked |
| Load More | Cursor request | Hidden/blocked |
| Refresh | Server request | Disabled |
| Primary destination | Marks read then opens destination | Blocked |

### Intentional limits

Offline notification viewing, cross-tab notification synchronization, and
queued notification mutations are intentionally unsupported. Cache read/write
failure handling is not applicable because no notification persistence exists.

## Manual verification matrix

| Scenario | Expected | Verification |
|---|---|---|
| Online first load | Server notifications load | USER_VERIFICATION_REQUIRED |
| Go offline | Explicit unavailable state | SOURCE_VERIFIED |
| Mark one/all offline | Blocked, no success message | SOURCE_VERIFIED |
| Load More/Refresh offline | Disabled; no request | SOURCE_VERIFIED |
| Reconnect | Server refresh with active filters | SOURCE_VERIFIED |
| Logout while offline | State clears | SOURCE_VERIFIED |
| User A → User B | No old state visible | SOURCE_VERIFIED |
| Role switch | No old state visible | SOURCE_VERIFIED |
| Development ↔ Demo | No old state visible | SOURCE_VERIFIED |

## Multi-user safety matrix

| Transition | Cache before | Cache after | Old data visible? | Result |
|---|---|---|---:|---|
| User A → User B | In-memory A view | Cleared, then B server view | No | SOURCE_VERIFIED |
| Mayor → Barangay | Mayor view | Cleared, then Barangay server view | No | SOURCE_VERIFIED |
| Development → Demo | Development view | Cleared, then Demo server view | No | SOURCE_VERIFIED |
| Demo → Development | Demo view | Cleared, then Development server view | No | SOURCE_VERIFIED |
| Logout → offline entry | In-memory view | Cleared; unavailable offline | No | SOURCE_VERIFIED |

## Verification

- Client suite: 118 passed, 0 failed, 0 skipped.
- Server unit suite: 132 passed, 0 failed.
- Static preference check: passed (`node server/scripts/check-notification-preference-modern-only.js`).
- Production/PWA build: passed. Existing bundle-size and React Router directive warnings remain.
- Database: no migration created and no database integration test was run; integration still requires `TEST_DATABASE_URL`.
- Browser/network emulation: `USER_VERIFICATION_REQUIRED`.
