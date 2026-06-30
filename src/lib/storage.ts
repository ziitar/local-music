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

export function createTokenStorage(): TokenStorage {
  return new WebStorage();
}

/** Singleton token storage instance */
export const tokenStorage = createTokenStorage();
