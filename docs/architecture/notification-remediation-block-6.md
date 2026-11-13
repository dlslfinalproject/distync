# DISTYNC Notification Remediation — Block 6

## Accessibility and interaction hardening

Status: `BLOCK_6_IMPLEMENTED_MANUAL_VERIFICATION_PENDING`

### Implementation summary

The Notification Center detail drawer now reuses the shared `FormModalShell`, preserving its right-side drawer presentation while treating it as a modal dialog. The shell is portaled to `document.body` and provides `role="dialog"`, `aria-modal="true"`, generated title and concise message associations, focus entry, Tab/Shift+Tab containment, Escape handling, backdrop dismissal, scroll locking, and listener cleanup.

Focus initially lands on the close button, which is the first useful non-destructive control. The originating primary action is retained and receives focus after close when still connected; otherwise focus returns to the Notification Center heading. The drawer close button is a real button named “Close notification details”.

The notification page keeps per-notification read and primary-action guards in refs, so repeated interactions for the same notification produce one request/navigation chain. Mark All has a dedicated synchronous ref guard, while Load More and Refresh have synchronous pending guards. A request generation prevents stale list/filter/tab responses from replacing newer state. Errors clear pending states and retain loaded data for retry.

No notification policy, pagination architecture, backend route, database schema, or migration changed.

### Mutation inventory

| Action | Pending guard | Error recovery | Result |
| --- | --- | --- | --- |
| Mark one read | `pendingReadIdsRef` per notification | `finally` clears pending state | protected |
| Primary action | `pendingPrimaryIdsRef` per notification | `finally` clears pending state | protected |
| Mark all | `isMarkingAllReadRef` | `finally` clears pending state | protected |
| Load more | `isLoadingMoreRef` | retains existing items/cursor | protected |
| Refresh | `isRefreshingRef` plus request generation | pending state clears; stale responses discarded | protected |

### Responsive and long-content safeguards

The existing card layout continues to wrap its flex children and uses `minWidth: 0` for the content column. The page constrains horizontal overflow, cards use `overflowWrap: "anywhere"`, and the drawer width is constrained to the viewport (`min(480px, 100vw)`) with internal vertical scrolling. Controls keep the existing 42px minimum target size.

### Verification

| Check | Result | Notes |
| --- | --- | --- |
| Client tests | `PASS` | 115 passed, 0 failed |
| Server unit tests | `PASS` | 132 passed, 0 failed |
| Notification preference static check | `PASS` | modern-only check passed |
| Production build | `PASS` | pre-existing module-directive and chunk-size warnings only |
| Database integration | `NOT_RUN_REQUIRES_TEST_DATABASE` | unchanged from prior blocks |
| Browser keyboard/detail check | `USER_VERIFICATION_REQUIRED` | local development role access required a backend that was not running |
| Large/half-width/tablet/mobile visual check | `USER_VERIFICATION_REQUIRED` | same local backend prerequisite |

### Manual verification matrix

| Scenario | Expected |
| --- | --- |
| Open detail by keyboard | focus moves to Close notification details |
| Tab / Shift+Tab | focus wraps within the drawer |
| Escape or close button | drawer closes and returns focus to trigger or Notifications heading |
| Overflow | opens with keyboard, focuses Mark as read, Escape restores trigger focus |
| Filter | exposes expanded state and native keyboard-accessible selects |
| Large desktop / half-width / tablet / mobile | no horizontal overflow; card content wraps; drawer stays in viewport |
| Long title/message/metadata | wraps without breaking card or drawer layout |

### Files changed

- `client/src/components/shared/FormModalShell.jsx` — hardens modal scroll, focus cleanup, return focus, and close naming.
- `client/src/pages/inventory/MayorNotificationsPage.jsx` — adopts the shared detail drawer and guards notification interactions.
- `client/tests/notificationAccessibilityInteraction.test.mjs` — checks the dialog and guard contracts.
- `client/tests/notificationOverflowAndFilters.test.mjs` — retains notification menu/filter accessibility contract checks.

### Remaining gap

Run the manual matrix above in an authenticated local or deployed environment with notification records. No further Block 6 implementation work is pending.
