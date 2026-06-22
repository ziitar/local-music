# Persistent Authentication Design

## Overview

Implement persistent login for the Local Music app across Android and Web platforms using a dual-token (access + refresh) mechanism with platform-differentiated storage.

**Goals:**
- Android: stay logged in until explicit logout or app uninstall
- Web: stay logged in for 30 days
- Secure token storage with refresh token rotation
- Transparent token refresh (no user interruption)

## Current State

- JWT access token with **2-hour expiry** (`api/services/auth.ts:26`)
- Token stored in `localStorage` on all platforms
- **No refresh token** — expired token forces re-login
- No Capacitor native storage plugin installed
- `isNativePlatform()` detection exists in `src/config.ts`

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Token mechanism | Dual token (access + refresh) | Industry standard, secure |
| Android storage | `@capacitor/preferences` | Official Capacitor plugin, persists across app restarts, cleared only on uninstall |
| Web refresh token | `httpOnly` cookie | XSS-safe, not accessible via JS |
| Refresh token backend | PostgreSQL table | Supports revocation, auditing |
| Logout behavior | Current device only | Revoke only the current device's refresh token |
| Refresh token rotation | Yes | Prevents replay attacks |

## Database Schema

New `refresh_tokens` table in PostgreSQL:

```sql
CREATE TABLE refresh_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(64) NOT NULL UNIQUE,  -- SHA-256 hash, never store plaintext
  device_info TEXT,                          -- Optional device identifier
  expires_at TIMESTAMP,                      -- Web: 30 days; Android: NULL (never expires)
  created_at TIMESTAMP DEFAULT NOW(),
  revoked_at TIMESTAMP                       -- NULL = active, non-NULL = revoked
);

CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_hash ON refresh_tokens(token_hash);
```

**Key points:**
- Store SHA-256 hash of refresh token, not plaintext
- `expires_at = NULL` means never expires (Android)
- `revoked_at` supports soft deletion for audit trail
- `ON DELETE CASCADE` auto-cleans tokens when user is deleted

## Backend Changes

### `api/services/auth.ts` — New Functions

```typescript
// Generate 64-byte random token, return base64url string
function generateRefreshToken(): string

// SHA-256 hash for database storage
function hashToken(token: string): string

// Store refresh token in database
async function storeRefreshToken(
  userId: number,
  token: string,
  deviceInfo?: string,
  expiresAt?: Date  // null = never expires
): Promise<void>

// Validate refresh token: check hash, not revoked, not expired
async function validateRefreshToken(
  token: string
): Promise<{ userId: number; username: string; role: string } | null>

// Soft-delete refresh token
async function revokeRefreshToken(token: string): Promise<void>

// Revoke old token, generate and store new one (anti-replay)
async function rotateRefreshToken(
  oldToken: string,
  userId: number,
  deviceInfo?: string,
  expiresAt?: Date
): Promise<string>
```

### Modified Functions

- `loginUser` / `registerUser`: response includes `refreshToken` field
- `generateToken`: access token stays at 2h expiry (unchanged)

### Platform Detection

Frontend sends `X-Platform: native` header on login/register/refresh requests.
Backend uses this to decide refresh token expiry:
- `native` → `expiresAt = null` (never expires)
- default (web) → `expiresAt = NOW() + 30 days`

### `api/routes/auth.ts` — New Endpoints

**`POST /api/auth/refresh`**

```
Request:  Cookie (Web) or { refreshToken: string } (Native)
Response: { token: string } + Set-Cookie (Web) or { token: string, refreshToken: string } (Native)

Logic:
1. Extract refreshToken: from httpOnly cookie (Web) or request body (Native)
2. validateRefreshToken() → if invalid, return 401
3. rotateRefreshToken() → revoke old, create new
4. Web: return accessToken in body + new refreshToken as httpOnly cookie
   Native: return both tokens in body
```

**`POST /api/auth/logout`**

```
Request:  Cookie (Web) or { refreshToken: string } (Native)
Response: { success: boolean }

Logic:
1. Extract refreshToken: from cookie (Web) or body (Native)
2. revokeRefreshToken() → soft delete
3. Web: clear cookie via Set-Cookie: ...; Max-Age=0
4. Return success
```

**`POST /api/auth/login` and `POST /api/auth/register` (modified)**

```
Web response:   { ..., token } + Set-Cookie: refresh_token=...; HttpOnly; ...
Native response: { ..., token, refreshToken }
```

## Frontend Changes

### New File: `src/lib/storage.ts`

Storage abstraction layer that auto-selects platform implementation:

```typescript
interface TokenStorage {
  getAccessToken(): string | null;
  setAccessToken(token: string): void;
  removeAccessToken(): void;
  getRefreshToken(): string | null;
  setRefreshToken(token: string): void;
  removeRefreshToken(): void;
}

class WebStorage implements TokenStorage {
  // accessToken → localStorage
  // refreshToken → httpOnly cookie (set by backend via Set-Cookie header)
  //   getRefreshToken() returns null (cookie is invisible to JS)
  //   setRefreshToken() is a no-op (backend sets cookie)
  //   removeRefreshToken() calls POST /api/auth/logout to clear cookie
}

class NativeStorage implements TokenStorage {
  // Both tokens → @capacitor/preferences
}

function createTokenStorage(): TokenStorage {
  // Uses isNativePlatform() to pick implementation
}
```

**Web refresh token flow:**
- Backend sets `refresh_token` as httpOnly cookie on login/register/refresh responses
- Cookie attributes: `HttpOnly; Secure; SameSite=Strict; Path=/api/auth; Max-Age=2592000`
- Frontend JS cannot read the cookie — refresh is triggered automatically by browser
- `POST /api/auth/refresh` reads token from cookie (not request body) on Web
- `POST /api/auth/logout` clears the cookie via `Set-Cookie: ...; Max-Age=0`

**Native refresh token flow:**
- Backend returns `refreshToken` in JSON response body
- Frontend stores in `@capacitor/preferences`
- `POST /api/auth/refresh` reads token from request body
- `POST /api/auth/logout` reads token from request body

### Modified: `src/services/api.ts`

```typescript
const storage = createTokenStorage();

// getToken / setToken / removeToken → delegate to storage

// New: transparent refresh on 401
async function requestWithRefresh<T>(endpoint, options): Promise<T> {
  try {
    return await request<T>(endpoint, options);
  } catch (error) {
    if (error.message === 'Invalid token' && storage.getRefreshToken()) {
      const success = await tryRefreshToken();
      if (success) return await request<T>(endpoint, options);
    }
    throw error;
  }
}

async function tryRefreshToken(): Promise<boolean> {
  // POST /api/auth/refresh { refreshToken }
  // On success: update both tokens in storage
  // On failure: clear all tokens, return false
}
```

### Modified: `src/stores/authStore.ts`

```typescript
const storage = createTokenStorage();

// login: store refreshToken after successful login
// logout: notify backend to revoke, then clear local storage
// checkAuth: try accessToken first, fall back to refreshToken

// Optional: auto-refresh timer
// Every 1.5h, refresh accessToken before 2h expiry
// Prevents user-facing 401 errors
```

### `login` flow:
1. Call `authApi.login(username, password)`
2. On success, store accessToken and refreshToken via storage
3. Update auth state

### `logout` flow:
1. Get refreshToken from storage
2. Call `authApi.logout(refreshToken)` — non-blocking, fire and forget
3. Clear both tokens from storage
4. Reset auth state

### `checkAuth` flow (app startup):
1. If accessToken exists → try `GET /api/auth/me`
2. If accessToken invalid but refreshToken exists → call `tryRefreshToken()`
3. If refresh succeeds → retry `GET /api/auth/me`
4. If all fails → clear state, redirect to login

## Dependency Changes

```bash
npm install @capacitor/preferences
npx cap sync android
```

## Files to Modify

| File | Change |
|------|--------|
| `dbs/schema.sql` | Add `refresh_tokens` table |
| `api/services/auth.ts` | Add refresh/rotate/revoke logic |
| `api/routes/auth.ts` | Add `/refresh` and `/logout` endpoints |
| `src/lib/storage.ts` | **New** — storage abstraction layer |
| `src/services/api.ts` | Use storage, add auto-refresh |
| `src/stores/authStore.ts` | Adapt to dual token, backend logout notification |
| `package.json` | Add `@capacitor/preferences` |

## Security Considerations

- Refresh token hash stored in DB (SHA-256), not plaintext
- Refresh token rotation on every use (anti-replay)
- Web refresh token in httpOnly cookie (XSS-safe)
- Android token in Preferences (survives app restart, cleared on uninstall)
- Soft-delete with `revoked_at` for audit trail
- `ON DELETE CASCADE` prevents orphaned tokens

## Out of Scope

- Multi-device management UI (view/revoke sessions)
- Token blacklist for access tokens
- Rate limiting on auth endpoints
- Device fingerprinting
