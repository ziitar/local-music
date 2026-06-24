import { isNativePlatform } from "../config.ts";
import { Preferences } from "@capacitor/preferences";

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

  async getAccessToken(): Promise<string | null> {
    console.log('[LocalMusic] NativeStorage.getAccessToken()');
    const result = await Preferences.get({ key: NativeStorage.ACCESS_TOKEN_KEY });
    console.log('[LocalMusic] getAccessToken result:', result.value ? 'has value' : 'null');
    return result.value;
  }

  async setAccessToken(token: string): Promise<void> {
    console.log('[LocalMusic] NativeStorage.setAccessToken()');
    await Preferences.set({ key: NativeStorage.ACCESS_TOKEN_KEY, value: token });
  }

  async removeAccessToken(): Promise<void> {
    console.log('[LocalMusic] NativeStorage.removeAccessToken()');
    await Preferences.remove({ key: NativeStorage.ACCESS_TOKEN_KEY });
  }

  async getRefreshToken(): Promise<string | null> {
    console.log('[LocalMusic] NativeStorage.getRefreshToken()');
    const result = await Preferences.get({ key: NativeStorage.REFRESH_TOKEN_KEY });
    console.log('[LocalMusic] getRefreshToken result:', result.value ? 'has value' : 'null');
    return result.value;
  }

  async setRefreshToken(token: string): Promise<void> {
    console.log('[LocalMusic] NativeStorage.setRefreshToken()');
    await Preferences.set({ key: NativeStorage.REFRESH_TOKEN_KEY, value: token });
  }

  async removeRefreshToken(): Promise<void> {
    console.log('[LocalMusic] NativeStorage.removeRefreshToken()');
    await Preferences.remove({ key: NativeStorage.REFRESH_TOKEN_KEY });
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
