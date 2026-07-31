A system for synchronized relief distribution in disaster operations for Municipality of Malvar, Batangas

## Access Mode Configuration

DISTYNC uses an explicit access mode for both the frontend and backend.
No access mode is guessed from `NODE_ENV`, Vite build mode, or missing
environment variables.

DISTYNC has exactly two application access modes:

| Environment purpose | Frontend | Backend | Development bypass |
| --- | --- | --- | --- |
| Local development | `DEVELOPMENT` | `DEVELOPMENT` | `true` when needed |
| Official demo | `DEMO` | `DEMO` | `false` |
| Production deployment | `DEMO` | `DEMO` | `false` |

### Frontend

Set `VITE_ACCESS_MODE` in `client/.env`.

- `VITE_ACCESS_MODE=DEVELOPMENT`
  Local development access. The development role switcher remains available.
- `VITE_ACCESS_MODE=DEMO`
  Official-facing demo access. The normal demo login and RBAC flow remain in use.

Use exact uppercase values only. `development`, `Demo`, and `PRODUCTION`
are invalid.

If `VITE_ACCESS_MODE` is missing or invalid, the normal React application
does not render. DISTYNC shows a configuration error screen instead.

### Dedicated Frontend Builds

Use the dedicated frontend build commands when you want the build itself
to choose the access mode.

| Command | Access mode | Intended use |
| --- | --- | --- |
| `npm --prefix client run build:development` | `DEVELOPMENT` | Developer testing only |
| `npm --prefix client run build:demo` | `DEMO` | Official demo and deployment artifact |
| `npm run build:development` | `DEVELOPMENT` | Root wrapper for the client build |
| `npm run build:demo` | `DEMO` | Root wrapper for the client build |

These dedicated commands are authoritative. They set the intended
frontend mode themselves and do not rely on manually editing `client/.env`
before each build.

- `build:development` always targets `VITE_ACCESS_MODE=DEVELOPMENT` or fails.
- `build:demo` always targets `VITE_ACCESS_MODE=DEMO` or fails.
- `build:demo` must not silently produce a development-access artifact.
- Each build replaces the previous `client/dist` output.

The generic `npm run build` command remains a technical Vite build
command. It still requires a valid explicit `VITE_ACCESS_MODE` and does
not select the DISTYNC access mode for you.

### Backend

Set `SERVER_ACCESS_MODE` in `server/.env`.

- `SERVER_ACCESS_MODE=DEVELOPMENT`
  Enables development-only server behavior when explicitly requested.
- `SERVER_ACCESS_MODE=DEMO`
  Enables official-facing demo behavior.

Use exact uppercase values only. `demo`, `Development`, and `PRODUCTION`
are invalid.

If `SERVER_ACCESS_MODE` is missing or invalid, the backend refuses to start.

### Development Authentication Bypass

Set `ENABLE_DEVELOPMENT_AUTH_BYPASS=true` only when development access is
intentionally required.

- Only the exact value `true` enables the bypass.
- Missing, empty, `false`, uppercase variants, spaced values, or invalid values keep the bypass disabled.
- The bypass works only when `SERVER_ACCESS_MODE=DEVELOPMENT`.
- `SERVER_ACCESS_MODE=DEMO` always rejects development login even if the bypass
  flag is `true`.
- `ENABLE_DEMO_AUTH_BYPASS` is not supported.

### Important Notes

- `PRODUCTION` is not a DISTYNC access mode.
- Official production deployments use `DEMO` on both frontend and backend.
- Vite build mode is not the DISTYNC access mode.
- `NODE_ENV` does not select the DISTYNC access mode.
- Development access and demo access are intentionally separate.
- Development access must never be used for official operations.

### Official Deployment Pairing

For an official-facing deployment:

- Build the frontend with `npm run build:demo`
- Set the backend to `SERVER_ACCESS_MODE=DEMO`
- Set `ENABLE_DEVELOPMENT_AUTH_BYPASS=false`

The frontend build command does not rewrite backend configuration. The
backend mode must still be configured separately.

## Browser Storage Isolation

DISTYNC now isolates browser-stored data by validated access mode.
`DEVELOPMENT` browser state is not reused in `DEMO`, and `DEMO` browser
state is not reused in `DEVELOPMENT`.

### What is isolated

- Authentication sessions use separate mode-specific keys.
- Selected roles use separate mode-specific keys.
- Account Settings cache is scoped by access mode, user ID, and role code.
- Registration reference cache uses mode-specific keys.
- IndexedDB offline data uses separate databases for `DEVELOPMENT` and `DEMO`.
- Offline queue records include access mode, user ID, and role code metadata.
- PWA runtime caches use mode-specific cache names.

### Mode switch behavior

When the same browser switches between `DEVELOPMENT` and `DEMO`:

- DISTYNC records the last validated access mode.
- Legacy unscoped auth, role, settings, and registration storage is removed.
- Mode-specific auth sessions and selected-role state are cleared.
- The app continues in an unauthenticated state.
- Previous-mode offline work is not transferred into the new mode.

Same-mode reloads still keep valid same-mode sessions and same-mode offline
data available.

### Legacy browser data

Legacy shared browser storage such as:

- `distync_auth_session`
- `distync_selected_role`
- `distync-role-settings:*`
- `distyncOfflineDb`
- `distync-pages`
- `distync-shell`
- `distync-static-assets`

is treated as unsafe for mode isolation. Legacy auth and role state is
removed. Legacy shared runtime caches are cleaned up. The old shared
IndexedDB database is deleted instead of being reassigned to `DEMO` or
`DEVELOPMENT`, because its original mode cannot be verified safely.

