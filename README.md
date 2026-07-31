A system for synchronized relief distribution in disaster operations for Municipality of Malvar, Batangas

## Access Mode Configuration

DISTYNC uses an explicit access mode for both the frontend and backend.
No access mode is guessed from `NODE_ENV`, Vite build mode, or missing
environment variables.

### Frontend

Set `VITE_ACCESS_MODE` in `client/.env`.

- `VITE_ACCESS_MODE=DEVELOPMENT`
  Local development access. The development role switcher remains available.
- `VITE_ACCESS_MODE=DEMO`
  Official-facing demo access. The normal demo login and RBAC flow remain in use.

If `VITE_ACCESS_MODE` is missing or invalid, the normal React application
does not render. DISTYNC shows a configuration error screen instead.

### Backend

Set `SERVER_ACCESS_MODE` in `server/.env`.

- `SERVER_ACCESS_MODE=DEVELOPMENT`
  Enables development-only server behavior when explicitly requested.
- `SERVER_ACCESS_MODE=DEMO`
  Enables official-facing demo behavior.

If `SERVER_ACCESS_MODE` is missing or invalid, the backend refuses to start.

### Development Authentication Bypass

Set `ENABLE_DEVELOPMENT_AUTH_BYPASS=true` only when development access is
intentionally required.

- Missing, empty, `false`, or invalid values keep the bypass disabled.
- The bypass works only when `SERVER_ACCESS_MODE=DEVELOPMENT`.
- `SERVER_ACCESS_MODE=DEMO` always rejects development login even if the bypass
  flag is `true`.

### Important Notes

- Vite build mode is not the DISTYNC access mode.
- `NODE_ENV` does not select the DISTYNC access mode.
- Development access and demo access are intentionally separate.
- Development access must never be used for official operations.

