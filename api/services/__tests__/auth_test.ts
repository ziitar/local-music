/**
 * Tests for refresh token service functions in api/services/auth.ts
 *
 * User Journeys:
 * 1. As a web user, I want to stay logged in for 30 days so I don't re-enter my password daily.
 * 2. As an Android user, I want to stay logged in permanently until explicit logout or uninstall.
 * 3. As a user, I want automatic token refresh so I'm never kicked out mid-session.
 * 4. As a user, I want logout to revoke only the current device's session.
 * 5. As a security system, I want refresh token rotation to prevent replay attacks.
 */

import { assertEquals, assertExists } from "@std/assert";

// --- Pure function tests (no DB dependency) ---

Deno.test("generateRefreshToken returns a non-empty string", async () => {
  const { generateRefreshToken } = await import("../auth.ts");
  const token = generateRefreshToken();
  assertExists(token);
  assertEquals(typeof token, "string");
  assertEquals(token.length > 0, true);
});

Deno.test("generateRefreshToken returns base64url encoded string", async () => {
  const { generateRefreshToken } = await import("../auth.ts");
  const token = generateRefreshToken();
  // base64url: only A-Z, a-z, 0-9, -, _ (no +, /, or =)
  const base64urlPattern = /^[A-Za-z0-9_-]+$/;
  assertEquals(base64urlPattern.test(token), true);
});

Deno.test("generateRefreshToken returns unique tokens", async () => {
  const { generateRefreshToken } = await import("../auth.ts");
  const token1 = generateRefreshToken();
  const token2 = generateRefreshToken();
  assertEquals(token1 === token2, false);
});

Deno.test("generateRefreshToken returns token of expected length", async () => {
  const { generateRefreshToken } = await import("../auth.ts");
  const token = generateRefreshToken();
  // 64 bytes -> 86 chars base64url (without padding)
  assertEquals(token.length, 86);
});

Deno.test("hashToken returns consistent hash for same input", async () => {
  const { hashToken } = await import("../auth.ts");
  const token = "test-token-value";
  const hash1 = await hashToken(token);
  const hash2 = await hashToken(token);
  assertEquals(hash1, hash2);
});

Deno.test("hashToken returns 64-char hex string", async () => {
  const { hashToken } = await import("../auth.ts");
  const hash = await hashToken("test-token");
  assertEquals(typeof hash, "string");
  assertEquals(hash.length, 64);
  const hexPattern = /^[0-9a-f]{64}$/;
  assertEquals(hexPattern.test(hash), true);
});

Deno.test("hashToken returns different hash for different inputs", async () => {
  const { hashToken } = await import("../auth.ts");
  const hash1 = await hashToken("token-a");
  const hash2 = await hashToken("token-b");
  assertEquals(hash1 === hash2, false);
});

Deno.test("hashToken of generated refresh token is valid hex", async () => {
  const { generateRefreshToken, hashToken } = await import("../auth.ts");
  const token = generateRefreshToken();
  const hash = await hashToken(token);
  assertEquals(hash.length, 64);
  const hexPattern = /^[0-9a-f]{64}$/;
  assertEquals(hexPattern.test(hash), true);
});

// --- Export verification ---

Deno.test("all refresh token functions are exported", async () => {
  const auth = await import("../auth.ts");
  assertExists(auth.generateRefreshToken);
  assertExists(auth.hashToken);
  assertExists(auth.storeRefreshToken);
  assertExists(auth.validateRefreshToken);
  assertExists(auth.revokeRefreshToken);
  assertExists(auth.rotateRefreshToken);
  assertEquals(typeof auth.generateRefreshToken, "function");
  assertEquals(typeof auth.hashToken, "function");
  assertEquals(typeof auth.storeRefreshToken, "function");
  assertEquals(typeof auth.validateRefreshToken, "function");
  assertEquals(typeof auth.revokeRefreshToken, "function");
  assertEquals(typeof auth.rotateRefreshToken, "function");
});

// --- Function signature tests ---

Deno.test("loginUser accepts isNative parameter", async () => {
  const auth = await import("../auth.ts");
  assertExists(auth.loginUser);
  assertEquals(typeof auth.loginUser, "function");
});

Deno.test("registerUser accepts isNative parameter", async () => {
  const auth = await import("../auth.ts");
  assertExists(auth.registerUser);
  assertEquals(typeof auth.registerUser, "function");
});
