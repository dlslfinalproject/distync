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

`VITE_ACCESS_MODE` is read only by the frontend Vite environment adapter.
Only `VITE_`-prefixed values are public browser configuration; never place
server secrets such as database credentials, JWT secrets, or Supabase service
role keys in `client/.env`.

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
not select the DISTYNC access mode for you. Use the dedicated build commands
for a mode-enforced artifact.

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

### Account Settings cache lifecycle

Account Settings cache entries use mode-scoped keys and validated metadata.
DISTYNC stores them under keys shaped like:

- `distync:<ACCESS_MODE>:role-settings:<ROLE_CODE>:<USER_ID>`

Each cached value also records:

- Cache format version
- Access mode
- User ID
- Role code
- Cache timestamp

The cache is accepted only when the key and stored metadata both match the
current authenticated owner context.

### Account Settings cache cleanup

- Logout clears all Account Settings cache entries for the current user in the current mode.
- Switching to a different authenticated user clears the previous user’s Account Settings cache in the current mode.
- Switching between `DEVELOPMENT` and `DEMO` clears Account Settings cache entries for both modes.
- Invalid stored sessions and API authentication failures clear the affected Account Settings cache.
- Legacy unscoped settings cache entries such as `distync-role-settings:*` are deleted and never reused.
- Same-user, same-role, same-mode cache may still be used for offline fallback when the network fails but authentication remains valid.
- Unauthenticated state does not receive Account Settings cache fallback.
- Account Settings cache cleanup does not delete IndexedDB offline queue records or other operational offline data.

### Account Settings unsaved navigation protection

When Account Settings has unsaved profile, profile-picture, or notification
preference changes, in-app navigation away from Settings is intercepted by the
standard DISTYNC confirmation modal. Choosing Stay on This Page cancels the
navigation and preserves the draft. Choosing Discard Changes and Leave
continues to the originally requested route without saving.

Browser refresh, tab close, and external navigation use the browser-native
unsaved-changes warning while Settings is dirty. The unload listener is removed
when Settings is clean, after a successful Save Changes, after local discard, or
when Settings unmounts.

## Profile Picture Security

DISTYNC profile pictures are now treated as controlled authenticated account data.

### Storage model

- Account Settings uses controlled file upload only.
- Arbitrary external image URLs are not accepted for user profile pictures.
- Private profile pictures are stored in the `distync-profile-pictures` Supabase Storage bucket.
- The database stores a private object path and update metadata, not a permanent public URL.
- PostgreSQL persists `profile_picture_path` and related metadata only. Base64 profile-picture data is not stored.
- Display uses short-lived signed URLs returned by the backend.
- Signed URLs are not stored in PostgreSQL.
- Raw profile image data and Blob preview URLs are not stored in localStorage.
- Default avatar initials are shown when no profile picture is available.

### Backend behavior

- `GET /api/v1/settings/current` returns role settings plus fresh signed profile-picture metadata when a picture exists.
- Profile picture replacement/removal is persisted only through `PUT /api/v1/settings/current` when Account Settings saves.
- The backend generates the storage path server-side and ignores client-supplied user ownership.
- Replacing a picture uploads the new object first, updates the database, then removes the previous object after commit.
- If the database write fails after upload, the new object is deleted during cleanup.

### Upload rules

- Allowed MIME types: `image/jpeg`, `image/png`, `image/webp`
- Maximum size: 2 MB
- SVG is not accepted
- Empty uploads are rejected
- Profile pictures are separate from household family-head verification photos

### Cache and session behavior

- Account Settings cache may store only safe profile-picture metadata such as path, file name, signed URL expiry, and update timestamp.
- Expired signed URLs are not reused from cache.
- Logout, user switching, and access-mode switching clear authenticated settings cache so another user’s signed URL is not reused.
- Offline fallback does not persist raw profile image content. When a valid signed URL is unavailable, DISTYNC falls back to the default avatar.

### Supabase setup

- Set `SUPABASE_SERVICE_ROLE_KEY` only on the backend.
- Do not expose the service-role key to frontend code.
- Keep the `distync-profile-pictures` bucket private.
- Apply the profile-picture hardening migration before using the feature in a shared environment.

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

