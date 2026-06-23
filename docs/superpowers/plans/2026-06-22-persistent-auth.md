# Persistent Authentication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement dual-token (access + refresh) persistent authentication with platform-differentiated storage — Android stays logged in permanently, Web stays logged in for 30 days.

**Architecture:** Short-lived JWT access token (2h) paired with long-lived refresh token. Web stores refresh token in httpOnly cookie (XSS-safe, invisible to JS). Android stores refresh token in `@capacitor/preferences` (survives app restart, cleared on uninstall). Refresh token rotation on every use prevents replay attacks. Backend stores SHA-256 hash of refresh tokens in PostgreSQL.

**Tech Stack:** Deno 2 + Oak (backend), React 19 + Zustand (frontend), PostgreSQL, `@capacitor/preferences` (native storage), `jsonwebtoken` (JWT)

## Global Constraints

- Access token expiry: 2 hours (unchanged)
- Web refresh token expiry: 30 days
- Android refresh token expiry: never (NULL)
- Refresh token: 64 bytes random, base64url encoded
- Token hash: SHA-256, stored in DB (never plaintext)
- Cookie attributes: `HttpOnly; SameSite=Strict; Path=/api/auth; Max-Age=2592000`
- Platform detection: `X-Platform: native` header from frontend
- Logout: revoke current device only

## File Structure

| File | Responsibility | Action |
|------|---------------|--------|
| `dbs/schema.sql` | Database schema | Modify — add `refresh_tokens` table |
| `api/services/auth.ts` | Auth business logic | Modify — add refresh token functions, modify login/register |
| `api/routes/auth.ts` | HTTP endpoints | Modify — add `/refresh`, `/logout`; modify `/login`, `/register` |
| `src/types/index.ts` | TypeScript types | Modify — add `refreshToken` to `AuthResponse` |
| `src/lib/storage.ts` | Token storage abstraction | **Create** — `WebStorage` + `NativeStorage` |
| `src/services/api.ts` | API client | Modify — use storage abstraction, add auto-refresh |
| `src/stores/authStore.ts` | Auth state management | Modify — dual token login/logout/checkAuth |
| `package.json` | Dependencies | Modify — add `@capacitor/preferences` |

---

### Task 1: Database Schema — Add `refresh_tokens` Table

**Files:**
- Modify: `dbs/schema.sql:97-106` (after `play_history` table, before `config` table)

**Interfaces:**
- Produces: `refresh_tokens` table with columns `id`, `user_id`, `token_hash`, `device_info`, `expires_at`, `created_at`, `revoked_at`

- [ ] **Step 1: Add the `refresh_tokens` table to schema.sql**

Insert the following block after the `play_history` table definition (after line 97) and before the `config` table definition (line 99):

```sql
-- Refresh tokens table (for persistent auth)
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    device_info TEXT,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    revoked_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens(token_hash);
```

- [ ] **Step 2: Apply the schema to the running database**

```bash
docker-compose exec -T postgres psql -U postgres -d local_music < dbs/schema.sql
```

Expected: No errors. Table `refresh_tokens` created.

- [ ] **Step 3: Verify the table exists**

```bash
docker-compose exec -T postgres psql -U postgres -d local_music -c "\d refresh_tokens"
```

Expected: Table with columns `id`, `user_id`, `token_hash`, `device_info`, `expires_at`, `created_at`, `revoked_at`.

- [ ] **Step 4: Commit**

```bash
git add dbs/schema.sql
git commit -m "feat: add refresh_tokens table to database schema"
```

---

### Task 2: Backend — Refresh Token Service Functions

**Files:**
- Modify: `api/services/auth.ts` — add functions after `verifyToken` (line 36), before `registerUser` (line 38)

**Interfaces:**
- Consumes: `sql` from `../services/db.ts` (existing tagged template)
- Produces:
  - `generateRefreshToken(): string`
  - `hashToken(token: string): Promise<string>`
  - `storeRefreshToken(userId: number, token: string, deviceInfo?: string, expiresAt?: Date): Promise<void>`
  - `validateRefreshToken(token: string): Promise<{ userId: number; username: string; role: string } | null>`
  - `revokeRefreshToken(token: string): Promise<void>`
  - `rotateRefreshToken(oldToken: string, userId: number, deviceInfo?: string, expiresAt?: Date): Promise<string>`

- [ ] **Step 1: Add `generateRefreshToken` function**

Insert the following after the `verifyToken` function (after line 36) in `api/services/auth.ts`:

```typescript
// --- Refresh Token Functions ---

export function generateRefreshToken(): string {
  const bytes = new Uint8Array(64);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}
```

- [ ] **Step 2: Add `hashToken` function**

```typescript
export async function hashToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(token);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = new Uint8Array(hashBuffer);
  return Array.from(hashArray)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
```

- [ ] **Step 3: Add `storeRefreshToken` function**

```typescript
export async function storeRefreshToken(
  userId: number,
  token: string,
  deviceInfo?: string,
  expiresAt?: Date,
): Promise<void> {
  const tokenHash = await hashToken(token);
  await sql`
    INSERT INTO refresh_tokens (user_id, token_hash, device_info, expires_at)
    VALUES (${userId}, ${tokenHash}, ${deviceInfo || null}, ${expiresAt || null})
  `;
}
```

- [ ] **Step 4: Add `validateRefreshToken` function**

```typescript
export async function validateRefreshToken(
  token: string,
): Promise<{ userId: number; username: string; role: string } | null> {
  const tokenHash = await hashToken(token);
  const result = await sql`
    SELECT rt.user_id, u.username, u.role
    FROM refresh_tokens rt
    JOIN users u ON u.id = rt.user_id
    WHERE rt.token_hash = ${tokenHash}
      AND rt.revoked_at IS NULL
      AND (rt.expires_at IS NULL OR rt.expires_at > NOW())
  `;
  if (result.length === 0) return null;
  return {
    userId: result[0].user_id,
    username: result[0].username,
    role: result[0].role,
  };
}
```

- [ ] **Step 5: Add `revokeRefreshToken` function**

```typescript
export async function revokeRefreshToken(token: string): Promise<void> {
  const tokenHash = await hashToken(token);
  await sql`
    UPDATE refresh_tokens
    SET revoked_at = NOW()
    WHERE token_hash = ${tokenHash} AND revoked_at IS NULL
  `;
}
```

- [ ] **Step 6: Add `rotateRefreshToken` function**

```typescript
export async function rotateRefreshToken(
  oldToken: string,
  userId: number,
  deviceInfo?: string,
  expiresAt?: Date,
): Promise<string> {
  await revokeRefreshToken(oldToken);
  const newToken = generateRefreshToken();
  await storeRefreshToken(userId, newToken, deviceInfo, expiresAt);
  return newToken;
}
```

- [ ] **Step 7: Commit**

```bash
git add api/services/auth.ts
git commit -m "feat: add refresh token service functions (generate, hash, store, validate, revoke, rotate)"
```

---

### Task 3: Backend — Modify Login/Register to Return Refresh Token

**Files:**
- Modify: `api/services/auth.ts:38-128` — `registerUser` and `loginUser` functions

**Interfaces:**
- Consumes: `generateRefreshToken`, `storeRefreshToken` from Task 2
- Produces: `registerUser` and `loginUser` return type adds `refreshToken?: string`

- [ ] **Step 1: Update `registerUser` signature and logic**

In `api/services/auth.ts`, modify `registerUser` (line 38). Update the function signature to accept `isNative` and return `refreshToken`:

```typescript
export async function registerUser(
  username: string,
  password: string,
  isNative?: boolean,
): Promise<{ success: boolean; message: string; token?: string; refreshToken?: string; user?: { id: number; username: string; role: string } }> {
```

After the line that generates the access token (line 76):
```typescript
const token = generateToken({ userId: user.id, username: user.username, role: user.role });
```

Insert:
```typescript
const refreshToken = generateRefreshToken();
const expiresAt = isNative ? undefined : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
await storeRefreshToken(user.id, refreshToken, isNative ? 'native' : 'web', expiresAt);
```

Change the return statement (line 78):
```typescript
return { success: true, message: "User registered successfully", token, refreshToken, user };
```

- [ ] **Step 2: Update `loginUser` signature and logic**

Modify `loginUser` (line 85). Update the function signature:

```typescript
export async function loginUser(
  username: string,
  password: string,
  isNative?: boolean,
): Promise<
  {
    success: boolean;
    message: string;
    token?: string;
    refreshToken?: string;
    user?: { id: number; username: string; role: string };
  }
> {
```

After the line that generates the access token (line 116):
```typescript
const token = generateToken({ userId: user.id, username: user.username, role: user.role });
```

Insert:
```typescript
const refreshToken = generateRefreshToken();
const expiresAt = isNative ? undefined : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
await storeRefreshToken(user.id, refreshToken, isNative ? 'native' : 'web', expiresAt);
```

Change the return statement (lines 118-123):
```typescript
return {
  success: true,
  message: "Login successful",
  token,
  refreshToken,
  user: { id: user.id, username: user.username, role: user.role },
};
```

- [ ] **Step 3: Verify compilation**

```bash
deno check api/services/auth.ts
```

Expected: No type errors.

- [ ] **Step 4: Commit**

```bash
git add api/services/auth.ts
git commit -m "feat: modify loginUser/registerUser to generate and return refresh token"
```

---

### Task 4: Backend — Add Refresh and Logout Routes, Modify Login/Register Routes

**Files:**
- Modify: `api/routes/auth.ts` — add `/refresh` and `/logout` endpoints; modify `/login` and `/register`

**Interfaces:**
- Consumes: `validateRefreshToken`, `rotateRefreshToken`, `revokeRefreshToken`, `generateToken`, `loginUser`, `registerUser` from `api/services/auth.ts`
- Produces:
  - `POST /api/auth/refresh` — returns new access token (+ cookie on web, + refreshToken body on native)
  - `POST /api/auth/logout` — revokes refresh token, clears cookie on web

- [ ] **Step 1: Update imports in `api/routes/auth.ts`**

Replace the import block (lines 1-8):

```typescript
import { Router } from "@oak/oak";
import {
  changePassword,
  generateToken,
  getUserById,
  loginUser,
  registerUser,
  revokeRefreshToken,
  rotateRefreshToken,
  validateRefreshToken,
  verifyToken,
} from "../services/auth.ts";
```

- [ ] **Step 2: Add cookie and platform helper functions**

Add after `const router = new Router();` (line 10):

```typescript
const REFRESH_COOKIE_NAME = "refresh_token";
const REFRESH_COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 days in seconds

function isNativePlatform(ctx: { request: { headers: Headers } }): boolean {
  return ctx.request.headers.get("X-Platform") === "native";
}

function setRefreshCookie(ctx: { response: { headers: Headers } }, token: string): void {
  ctx.response.headers.set(
    "Set-Cookie",
    `${REFRESH_COOKIE_NAME}=${token}; HttpOnly; SameSite=Strict; Path=/api/auth; Max-Age=${REFRESH_COOKIE_MAX_AGE}`,
  );
}

function clearRefreshCookie(ctx: { response: { headers: Headers } }): void {
  ctx.response.headers.set(
    "Set-Cookie",
    `${REFRESH_COOKIE_NAME}=; HttpOnly; SameSite=Strict; Path=/api/auth; Max-Age=0`,
  );
}

function getRefreshTokenFromCookie(ctx: { request: { headers: Headers } }): string | null {
  const cookie = ctx.request.headers.get("Cookie") || "";
  const match = cookie.match(new RegExp(`${REFRESH_COOKIE_NAME}=([^;]+)`));
  return match ? match[1] : null;
}
```

- [ ] **Step 3: Modify the `/api/auth/register` route**

Replace the existing register route (lines 12-20):

```typescript
router.post("/api/auth/register", async (ctx) => {
  const body = await ctx.request.body.json();
  const { username, password } = body;
  const isNative = isNativePlatform(ctx);

  const result = await registerUser(username, password, isNative);

  if (result.success && result.refreshToken) {
    if (isNative) {
      // Native: refreshToken already in response body
    } else {
      // Web: set httpOnly cookie, remove refreshToken from body
      setRefreshCookie(ctx, result.refreshToken);
      delete result.refreshToken;
    }
  }

  ctx.response.status = result.success ? 201 : 400;
  ctx.response.body = result;
});
```

- [ ] **Step 4: Modify the `/api/auth/login` route**

Replace the existing login route (lines 22-30):

```typescript
router.post("/api/auth/login", async (ctx) => {
  const body = await ctx.request.body.json();
  const { username, password } = body;
  const isNative = isNativePlatform(ctx);

  const result = await loginUser(username, password, isNative);

  if (result.success && result.refreshToken) {
    if (isNative) {
      // Native: refreshToken already in response body
    } else {
      // Web: set httpOnly cookie, remove refreshToken from body
      setRefreshCookie(ctx, result.refreshToken);
      delete result.refreshToken;
    }
  }

  ctx.response.status = result.success ? 200 : 401;
  ctx.response.body = result;
});
```

- [ ] **Step 5: Add the `/api/auth/refresh` route**

Add before `export default router;` (line 93):

```typescript
router.post("/api/auth/refresh", async (ctx) => {
  const isNative = isNativePlatform(ctx);

  let refreshToken: string | null = null;
  if (isNative) {
    const body = await ctx.request.body.json();
    refreshToken = body.refreshToken;
  } else {
    refreshToken = getRefreshTokenFromCookie(ctx);
  }

  if (!refreshToken) {
    ctx.response.status = 401;
    ctx.response.body = { success: false, message: "No refresh token provided" };
    return;
  }

  const payload = await validateRefreshToken(refreshToken);
  if (!payload) {
    ctx.response.status = 401;
    ctx.response.body = { success: false, message: "Invalid or expired refresh token" };
    return;
  }

  const expiresAt = isNative ? undefined : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const newRefreshToken = await rotateRefreshToken(
    refreshToken,
    payload.userId,
    isNative ? 'native' : 'web',
    expiresAt,
  );

  const accessToken = generateToken({
    userId: payload.userId,
    username: payload.username,
    role: payload.role,
  });

  if (isNative) {
    ctx.response.body = { token: accessToken, refreshToken: newRefreshToken };
  } else {
    setRefreshCookie(ctx, newRefreshToken);
    ctx.response.body = { token: accessToken };
  }
});
```

- [ ] **Step 6: Add the `/api/auth/logout` route**

Add after the refresh route:

```typescript
router.post("/api/auth/logout", async (ctx) => {
  const isNative = isNativePlatform(ctx);

  let refreshToken: string | null = null;
  if (isNative) {
    const body = await ctx.request.body.json();
    refreshToken = body.refreshToken;
  } else {
    refreshToken = getRefreshTokenFromCookie(ctx);
  }

  if (refreshToken) {
    await revokeRefreshToken(refreshToken);
  }

  if (!isNative) {
    clearRefreshCookie(ctx);
  }

  ctx.response.body = { success: true };
});
```

- [ ] **Step 7: Verify compilation**

```bash
deno check api/routes/auth.ts
```

Expected: No type errors.

- [ ] **Step 8: Commit**

```bash
git add api/routes/auth.ts
git commit -m "feat: add /refresh and /logout routes, modify /login and /register for dual-token auth"
```

---

### Task 5: Frontend — Update Types and Create Storage Abstraction

**Files:**
- Modify: `src/config.ts:13` — export `isNativePlatform`
- Modify: `src/types/index.ts:109-114` — add `refreshToken` to `AuthResponse`
- Create: `src/lib/storage.ts` — token storage abstraction layer

**Interfaces:**
- Consumes: `isNativePlatform` from `src/config.ts`
- Produces: `tokenStorage` singleton, `createTokenStorage()` factory, `TokenStorage` interface

- [ ] **Step 1: Export `isNativePlatform` from `src/config.ts`**

In `src/config.ts`, change line 13 from:

```typescript
function isNativePlatform(): boolean {
```

to:

```typescript
export function isNativePlatform(): boolean {
```

- [ ] **Step 2: Update `AuthResponse` type**

In `src/types/index.ts`, change lines 109-114 to add `refreshToken`:

```typescript
export interface AuthResponse {
  success: boolean;
  message: string;
  token?: string;
  refreshToken?: string;
  user?: User;
}
```

- [ ] **Step 3: Create `src/lib/storage.ts`**

```typescript
import { isNativePlatform } from "../config.ts";

export interface TokenStorage {
  getAccessToken(): Promise<string | null>;
  setAccessToken(token: string): Promise<void>;
  removeAccessToken(): Promise<void>;
  getRefreshToken(): Promise<string | null>;
  setRefreshToken(token: string): Promise<void>;
  removeRefreshToken(): Promise<void>;
}

class WebStorage implements TokenStorage {
  private static ACCESS_TOKEN_KEY = "token";

  async getAccessToken(): Promise<string | null> {
    return localStorage.getItem(WebStorage.ACCESS_TOKEN_KEY);
  }

  async setAccessToken(token: string): Promise<void> {
    localStorage.setItem(WebStorage.ACCESS_TOKEN_KEY, token);
  }

  async removeAccessToken(): Promise<void> {
    localStorage.removeItem(WebStorage.ACCESS_TOKEN_KEY);
  }

  async getRefreshToken(): Promise<string | null> {
    // Web refresh token is in httpOnly cookie — invisible to JS
    return null;
  }

  async setRefreshToken(_token: string): Promise<void> {
    // Web refresh token is set by backend via Set-Cookie — no-op
  }

  async removeRefreshToken(): Promise<void> {
    // Web refresh token is cleared by backend via Set-Cookie — no-op
  }
}

class NativeStorage implements TokenStorage {
  private static ACCESS_TOKEN_KEY = "access_token";
  private static REFRESH_TOKEN_KEY = "refresh_token";

  private async getPreferences() {
    const { Preferences } = await import("@capacitor/preferences");
    return Preferences;
  }

  async getAccessToken(): Promise<string | null> {
    const prefs = await this.getPreferences();
    const result = await prefs.get({ key: NativeStorage.ACCESS_TOKEN_KEY });
    return result.value;
  }

  async setAccessToken(token: string): Promise<void> {
    const prefs = await this.getPreferences();
    await prefs.set({ key: NativeStorage.ACCESS_TOKEN_KEY, value: token });
  }

  async removeAccessToken(): Promise<void> {
    const prefs = await this.getPreferences();
    await prefs.remove({ key: NativeStorage.ACCESS_TOKEN_KEY });
  }

  async getRefreshToken(): Promise<string | null> {
    const prefs = await this.getPreferences();
    const result = await prefs.get({ key: NativeStorage.REFRESH_TOKEN_KEY });
    return result.value;
  }

  async setRefreshToken(token: string): Promise<void> {
    const prefs = await this.getPreferences();
    await prefs.set({ key: NativeStorage.REFRESH_TOKEN_KEY, value: token });
  }

  async removeRefreshToken(): Promise<void> {
    const prefs = await this.getPreferences();
    await prefs.remove({ key: NativeStorage.REFRESH_TOKEN_KEY });
  }
}

export function createTokenStorage(): TokenStorage {
  if (isNativePlatform()) {
    return new NativeStorage();
  }
  return new WebStorage();
}

/** Singleton token storage instance */
export const tokenStorage = createTokenStorage();
```

- [ ] **Step 4: Commit**

```bash
git add src/config.ts src/types/index.ts src/lib/storage.ts
git commit -m "feat: add token storage abstraction layer with WebStorage and NativeStorage"
```

---

### Task 6: Frontend — Modify API Client for Auto-Refresh

**Files:**
- Modify: `src/services/api.ts` — replace localStorage with storage, add auto-refresh on 401

**Interfaces:**
- Consumes: `tokenStorage` from `src/lib/storage.ts` (Task 5), `isNativePlatform` from `src/config.ts`
- Produces: Same public API (`auth.login`, `auth.register`, etc.) with transparent refresh

- [ ] **Step 1: Replace imports and token functions**

In `src/services/api.ts`, replace lines 1-28 with:

```typescript
import type {
  Album,
  AlbumsResponse,
  Artist,
  ArtistsResponse,
  AuthResponse,
  Config,
  LyricsResponse,
  PlayHistory,
  Playlist,
  Song,
  SongsResponse,
  User,
} from "../types";

import { API_BASE, isNativePlatform } from "../config";
import { tokenStorage } from "../lib/storage.ts";

let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

async function getToken(): Promise<string | null> {
  return tokenStorage.getAccessToken();
}

async function setToken(token: string): Promise<void> {
  return tokenStorage.setAccessToken(token);
}

async function removeToken(): Promise<void> {
  return tokenStorage.removeAccessToken();
}
```

- [ ] **Step 2: Add `tryRefreshToken` function**

Add after `removeToken`:

```typescript
async function tryRefreshToken(): Promise<boolean> {
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }

  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      const headers: HeadersInit = { "Content-Type": "application/json" };

      if (isNativePlatform()) {
        const refreshToken = await tokenStorage.getRefreshToken();
        if (!refreshToken) return false;

        const response = await fetch(`${API_BASE}/api/auth/refresh`, {
          method: "POST",
          headers,
          body: JSON.stringify({ refreshToken }),
        });

        if (!response.ok) return false;

        const data = await response.json();
        await setToken(data.token);
        await tokenStorage.setRefreshToken(data.refreshToken);
        return true;
      }

      // Web: browser sends httpOnly cookie automatically
      const response = await fetch(`${API_BASE}/api/auth/refresh`, {
        method: "POST",
        headers,
        credentials: "same-origin",
      });

      if (!response.ok) return false;

      const data = await response.json();
      await setToken(data.token);
      return true;
    } catch {
      return false;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}
```

- [ ] **Step 3: Modify `request` function for auto-refresh**

Replace the existing `request` function (lines 30-57):

```typescript
async function request<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const token = await getToken();
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  if (token) {
    (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
  }
  if (isNativePlatform()) {
    (headers as Record<string, string>)["X-Platform"] = "native";
  }

  const fetchOptions: RequestInit = { ...options, headers };
  if (!isNativePlatform()) {
    fetchOptions.credentials = "same-origin";
  }

  let response = await fetch(`${API_BASE}${endpoint}`, fetchOptions);

  // If 401, try to refresh and retry
  if (response.status === 401) {
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      const newToken = await getToken();
      if (newToken) {
        (headers as Record<string, string>)["Authorization"] = `Bearer ${newToken}`;
      }
      response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers,
        ...(!isNativePlatform() ? { credentials: "same-origin" } : {}),
      });
    }
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({
      message: "Request failed",
    }));
    throw new Error(error.message || "Request failed");
  }

  return response.json();
}
```

- [ ] **Step 4: Update `auth` object methods**

Replace the `auth` object (lines 59-107):

```typescript
export const auth = {
  async register(username: string, password: string): Promise<AuthResponse> {
    const result = await request<AuthResponse>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });

    if (result.token) {
      await setToken(result.token);
    }
    if (result.refreshToken) {
      await tokenStorage.setRefreshToken(result.refreshToken);
    }

    return result;
  },

  async login(username: string, password: string): Promise<AuthResponse> {
    const result = await request<AuthResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });

    if (result.token) {
      await setToken(result.token);
    }
    if (result.refreshToken) {
      await tokenStorage.setRefreshToken(result.refreshToken);
    }

    return result;
  },

  async me(): Promise<User> {
    return request<User>("/api/auth/me");
  },

  async changePassword(
    oldPassword: string,
    newPassword: string,
  ): Promise<{ success: boolean; message: string }> {
    return request("/api/auth/password", {
      method: "PUT",
      body: JSON.stringify({ oldPassword, newPassword }),
    });
  },

  async logout(): Promise<void> {
    try {
      if (isNativePlatform()) {
        const refreshToken = await tokenStorage.getRefreshToken();
        if (refreshToken) {
          await fetch(`${API_BASE}/api/auth/logout`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refreshToken }),
          });
        }
      } else {
        await fetch(`${API_BASE}/api/auth/logout`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
        });
      }
    } catch {
      // Ignore logout API errors — still clear local state
    }

    await removeToken();
    await tokenStorage.removeRefreshToken();
  },

  async isAuthenticated(): Promise<boolean> {
    const token = await getToken();
    return !!token;
  },
};
```

- [ ] **Step 5: Commit**

```bash
git add src/services/api.ts
git commit -m "feat: implement auto-refresh and platform-aware token storage in API client"
```

---

### Task 7: Frontend — Modify Auth Store for Dual Token

**Files:**
- Modify: `src/stores/authStore.ts` — adapt logout/checkAuth for dual-token flow

**Interfaces:**
- Consumes: `auth` from `src/services/api.ts` (Task 6) — `auth.logout` is now async, `auth.isAuthenticated` is now async
- Produces: Same `useAuthStore` Zustand store, updated internal logic

- [ ] **Step 1: Update `logout` to be async**

In `src/stores/authStore.ts`, change the `logout` type in the interface (line 23):

```typescript
logout: () => Promise<void>;
```

Update the implementation (lines 76-79):

```typescript
logout: async () => {
  await authApi.logout();
  set({ user: null, isAuthenticated: false, isAdmin: false });
},
```

- [ ] **Step 2: Simplify `checkAuth` to rely on auto-refresh**

Replace the `checkAuth` implementation (lines 81-99). The `request` function in api.ts now handles refresh transparently, so `me()` either succeeds (possibly after refresh) or throws (if both tokens invalid):

```typescript
checkAuth: async () => {
  try {
    const user = await authApi.me();
    set({
      user,
      isAuthenticated: true,
      isLoading: false,
      isAdmin: user.role === 'admin',
    });
  } catch {
    await authApi.logout();
    set({ user: null, isAuthenticated: false, isLoading: false, isAdmin: false });
  }
},
```

- [ ] **Step 3: Commit**

```bash
git add src/stores/authStore.ts
git commit -m "feat: adapt auth store for dual-token flow with auto-refresh"
```

---

### Task 8: Capacitor — Install Preferences Plugin and Sync

**Files:**
- Modify: `package.json` — add `@capacitor/preferences`

- [ ] **Step 1: Install the Preferences plugin**

```bash
npm install @capacitor/preferences
```

- [ ] **Step 2: Sync Capacitor**

```bash
npx cap sync android
```

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json android/
git commit -m "feat: install @capacitor/preferences for native token storage"
```

---

### Task 9: End-to-End Verification

**Files:** None (manual testing)

- [ ] **Step 1: Start the backend server**

```bash
deno task server:start:dev
```

Expected: Server starts on port 8000 without errors.

- [ ] **Step 2: Start the frontend dev server**

```bash
npm run dev
```

Expected: Vite starts on port 5173.

- [ ] **Step 3: Test login flow (Web)**

1. Open `http://localhost:5173` in browser
2. Login with valid credentials
3. DevTools → Application → Cookies → verify `refresh_token` httpOnly cookie exists
4. DevTools → Application → Local Storage → verify `token` exists

Expected: Login succeeds, httpOnly cookie set, access token in localStorage.

- [ ] **Step 4: Test auto-refresh (Web)**

1. Delete `token` from localStorage (simulate expiry)
2. Make any API request (navigate to a page)
3. Network tab → should see `/api/auth/refresh` then the original request retried

Expected: Transparent refresh, no login redirect.

- [ ] **Step 5: Test logout (Web)**

1. Click logout
2. Verify `token` removed from localStorage
3. Verify `refresh_token` cookie cleared (Max-Age=0)
4. Verify redirected to login page

Expected: Both tokens cleared, logged out.

- [ ] **Step 6: Test persistent login (Web)**

1. Login
2. Close browser tab
3. Reopen → should still be logged in (refresh cookie restores session)

Expected: No login prompt after reopening.

- [ ] **Step 7: Verify token rotation**

1. Login, note refresh_token cookie value
2. Trigger a refresh (delete access token, make a request)
3. Check cookie value again — should be different

Expected: Refresh token changes on every refresh.
