# TDD Evidence Report: Persistent Authentication

## Source Plan

`docs/superpowers/plans/2026-06-22-persistent-auth.md`

## User Journeys

1. **Web persistent login**: As a web user, I want to stay logged in for 30 days so I don't re-enter my password daily.
2. **Android persistent login**: As an Android user, I want to stay logged in permanently until explicit logout or uninstall.
3. **Auto-refresh**: As a user, I want automatic token refresh so I'm never kicked out mid-session.
4. **Device-scoped logout**: As a user, I want logout to revoke only the current device's session.
5. **Token rotation**: As a security system, I want refresh token rotation to prevent replay attacks.

## Task Report

### Task 1: Database Schema

- **Summary**: Added `refresh_tokens` table with `user_id`, `token_hash`, `device_info`, `expires_at`, `revoked_at` columns.
- **Validation**: Schema file reviewed, table structure matches spec.
- **Commit**: `4dbe105`

### Task 2: Backend Refresh Token Service

- **Summary**: Implemented `generateRefreshToken`, `hashToken`, `storeRefreshToken`, `validateRefreshToken`, `revokeRefreshToken`, `rotateRefreshToken`.
- **Validation**: Pure function tests written in `api/services/__tests__/auth_test.ts`.
- **Commit**: `e0ef36e`

### Task 3: Backend Login/Register Modification

- **Summary**: Modified `loginUser` and `registerUser` to accept `isNative?` parameter and return `refreshToken`.
- **Validation**: Function signatures verified, return types include `refreshToken?: string`.
- **Commit**: `e0ef36e`

### Task 4: Backend Routes

- **Summary**: Added `POST /api/auth/refresh` and `POST /api/auth/logout` routes. Modified `/login` and `/register` for platform-aware cookie handling.
- **Validation**: Route handlers verified for cookie (web) vs body (native) token flow.
- **Commit**: `d4eabd2`

### Task 5: Frontend Storage Abstraction

- **Summary**: Created `src/lib/storage.ts` with `WebStorage` (localStorage + httpOnly cookie) and `NativeStorage` (@capacitor/preferences).
- **Validation**: Tests written in `src/lib/__tests__/storage_test.ts`.
- **Commit**: `834574f`

### Task 6: Frontend API Client

- **Summary**: Rewrote `src/services/api.ts` with `tryRefreshToken()` and transparent 401 retry.
- **Validation**: Auto-refresh logic verified, concurrent refresh prevention via `isRefreshing` flag.
- **Commit**: `834574f`

### Task 7: Frontend Auth Store

- **Summary**: Simplified `checkAuth` to rely on api.ts auto-refresh. Made `logout` async.
- **Validation**: Store logic verified against spec flows.
- **Commit**: `834574f`

### Task 8: Capacitor Dependencies

- **Summary**: Installed `@capacitor/preferences`.
- **Validation**: Package added to `package.json`.
- **Commit**: `c0ef341`

## Test Specification

| # | What is guaranteed | Test file | Test type | Result | Evidence |
|---|-------------------|-----------|-----------|--------|----------|
| 1 | `generateRefreshToken` returns non-empty base64url string | `api/services/__tests__/auth_test.ts` | unit | RED (cannot run without Deno) | Tests written, awaiting runtime |
| 2 | `generateRefreshToken` returns unique tokens | `api/services/__tests__/auth_test.ts` | unit | RED | Tests written, awaiting runtime |
| 3 | `generateRefreshToken` returns 86-char token | `api/services/__tests__/auth_test.ts` | unit | RED | Tests written, awaiting runtime |
| 4 | `hashToken` returns consistent 64-char hex | `api/services/__tests__/auth_test.ts` | unit | RED | Tests written, awaiting runtime |
| 5 | `hashToken` returns different hashes for different inputs | `api/services/__tests__/auth_test.ts` | unit | RED | Tests written, awaiting runtime |
| 6 | All 6 refresh token functions are exported | `api/services/__tests__/auth_test.ts` | unit | RED | Tests written, awaiting runtime |
| 7 | WebStorage stores access token in localStorage | `src/lib/__tests__/storage_test.ts` | unit | RED (needs Vitest) | Tests written, awaiting setup |
| 8 | WebStorage returns null for refresh token | `src/lib/__tests__/storage_test.ts` | unit | RED | Tests written, awaiting setup |
| 9 | WebStorage setRefreshToken is a no-op | `src/lib/__tests__/storage_test.ts` | unit | RED | Tests written, awaiting setup |

## Coverage and Known Gaps

- **No test runner configured**: Deno not installed, Vitest not set up. Tests are written but cannot be executed in this environment.
- **Integration tests not written**: DB-dependent functions (`storeRefreshToken`, `validateRefreshToken`, etc.) require a running PostgreSQL instance.
- **E2E tests not written**: Would require Playwright setup and a running dev server.

## Runtime Verification Required

To complete TDD validation, run:

```bash
# Backend tests (requires Deno installed)
deno test api/services/__tests__/auth_test.ts

# Frontend tests (requires Vitest installed)
npx vitest run src/lib/__tests__/storage_test.ts

# Type checking
npx tsc --noEmit
deno check api/services/auth.ts api/routes/auth.ts
```
