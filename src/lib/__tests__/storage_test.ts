/**
 * Tests for token storage abstraction layer in src/lib/storage.ts
 *
 * User Journeys:
 * 1. As a web user, access token is stored in localStorage.
 * 2. As a web user, refresh token is managed by httpOnly cookie (storage returns null).
 * 3. As an Android user, both tokens are stored in @capacitor/preferences.
 * 4. As any user, the correct storage implementation is selected based on platform.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the config module
vi.mock("../../config.ts", () => ({
  isNativePlatform: vi.fn(() => false),
}));

// Mock @capacitor/preferences
vi.mock("@capacitor/preferences", () => ({
  Preferences: {
    get: vi.fn(({ key }: { key: string }) => {
      const store: Record<string, string | null> = {
        access_token: "mock-access-token",
        refresh_token: "mock-refresh-token",
      };
      return Promise.resolve({ value: store[key] ?? null });
    }),
    set: vi.fn(() => Promise.resolve()),
    remove: vi.fn(() => Promise.resolve()),
  },
}));

describe("WebStorage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("stores access token in localStorage", async () => {
    const { createTokenStorage } = await import("../storage.ts");
    const storage = createTokenStorage();
    await storage.setAccessToken("test-token");
    expect(localStorage.getItem("token")).toBe("test-token");
  });

  it("reads access token from localStorage", async () => {
    const { createTokenStorage } = await import("../storage.ts");
    const storage = createTokenStorage();
    localStorage.setItem("token", "stored-token");
    const token = await storage.getAccessToken();
    expect(token).toBe("stored-token");
  });

  it("removes access token from localStorage", async () => {
    const { createTokenStorage } = await import("../storage.ts");
    const storage = createTokenStorage();
    localStorage.setItem("token", "to-remove");
    await storage.removeAccessToken();
    expect(localStorage.getItem("token")).toBeNull();
  });

  it("returns null for refresh token (httpOnly cookie is invisible to JS)", async () => {
    const { createTokenStorage } = await import("../storage.ts");
    const storage = createTokenStorage();
    const refreshToken = await storage.getRefreshToken();
    expect(refreshToken).toBeNull();
  });

  it("setRefreshToken is a no-op for web", async () => {
    const { createTokenStorage } = await import("../storage.ts");
    const storage = createTokenStorage();
    // Should not throw
    await storage.setRefreshToken("some-token");
    // localStorage should not have a refresh_token key
    expect(localStorage.getItem("refresh_token")).toBeNull();
  });

  it("removeRefreshToken is a no-op for web", async () => {
    const { createTokenStorage } = await import("../storage.ts");
    const storage = createTokenStorage();
    // Should not throw
    await storage.removeRefreshToken();
  });
});

describe("createTokenStorage", () => {
  it("returns WebStorage when not on native platform", async () => {
    const { isNativePlatform } = await import("../../config.ts");
    vi.mocked(isNativePlatform).mockReturnValue(false);
    const { createTokenStorage } = await import("../storage.ts");
    const storage = createTokenStorage();
    // WebStorage returns null for refresh token
    expect(await storage.getRefreshToken()).toBeNull();
  });
});
