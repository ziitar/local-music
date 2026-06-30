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

import { API_BASE } from "../config";
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

async function tryRefreshToken(): Promise<boolean> {
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }

  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      const headers: HeadersInit = { "Content-Type": "application/json" };

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

async function request<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  console.log('[LocalMusic] request() called for:', endpoint);
  const token = await getToken();
  console.log('[LocalMusic] getToken result:', token ? 'has token' : 'no token');

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  if (token) {
    (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
  }

  const fetchOptions: RequestInit = { ...options, headers, credentials: "same-origin" };

  const url = `${API_BASE}${endpoint}`;
  console.log('[LocalMusic] Fetching URL:', url);
  let response = await fetch(url, fetchOptions);
  console.log('[LocalMusic] Response status:', response.status);

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
        credentials: "same-origin",
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
      await fetch(`${API_BASE}/api/auth/logout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
      });
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

export const songs = {
  async scan(): Promise<
    { success: boolean; message: string; scanned: number; added: number }
  > {
    return request("/api/songs/scan", { method: "POST" });
  },

  async list(
    params: {
      page?: number;
      limit?: number;
      search?: string;
      quality?: string;
      artist?: string;
    } = {},
    signal?: AbortSignal,
  ): Promise<SongsResponse> {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.set("page", String(params.page));
    if (params.limit) searchParams.set("limit", String(params.limit));
    if (params.search) searchParams.set("search", params.search);
    if (params.quality) searchParams.set("quality", params.quality);
    if (params.artist) searchParams.set("artist", params.artist);

    const query = searchParams.toString();
    return request(`/api/songs${query ? `?${query}` : ""}`, { signal });
  },

  async get(id: number): Promise<Song> {
    return request<Song>(`/api/songs/${id}`);
  },

  async streamUrl(
    id: number,
    options?: { isCueTrack?: boolean; bitrate?: string },
  ): Promise<string> {
    const params = new URLSearchParams();
    if (options?.isCueTrack) params.set("cue", "1");
    if (options?.bitrate) params.set("bitrate", options.bitrate);
    const query = params.toString();
    return `${API_BASE}/api/songs/${id}/stream${query ? `?${query}` : ""}`;
  },

  async stopStream(songId: number): Promise<void> {
    try {
      await request("/api/songs/stop-stream", {
        method: "POST",
        body: JSON.stringify({ songId }),
      });
    } catch {
      // 忽略错误，best-effort 清理
    }
  },

  async delete(id: number): Promise<{ message: string }> {
    return request(`/api/songs/${id}`, { method: "DELETE" });
  },

  async analyzeLoudness(): Promise<{ message: string }> {
    return request("/api/songs/analyze-loudness", { method: "POST" });
  },
};

export const playlists = {
  async create(name: string, description?: string): Promise<Playlist> {
    return request("/api/playlists", {
      method: "POST",
      body: JSON.stringify({ name, description }),
    });
  },

  async list(): Promise<Playlist[]> {
    return request("/api/playlists");
  },

  async get(id: number): Promise<Playlist> {
    return request(`/api/playlists/${id}`);
  },

  async update(
    id: number,
    name: string,
    description?: string,
  ): Promise<{ message: string }> {
    return request(`/api/playlists/${id}`, {
      method: "PUT",
      body: JSON.stringify({ name, description }),
    });
  },

  async delete(id: number): Promise<{ message: string }> {
    return request(`/api/playlists/${id}`, { method: "DELETE" });
  },

  async addSong(
    playlistId: number,
    songId: number,
  ): Promise<{ message: string }> {
    return request(`/api/playlists/${playlistId}/songs`, {
      method: "POST",
      body: JSON.stringify({ songId }),
    });
  },

  async removeSong(
    playlistId: number,
    songId: number,
  ): Promise<{ message: string }> {
    return request(`/api/playlists/${playlistId}/songs/${songId}`, {
      method: "DELETE",
    });
  },
};

export const history = {
  async list(limit: number = 50): Promise<PlayHistory[]> {
    return request(`/api/history?limit=${limit}`);
  },

  async add(songId: number): Promise<{ message: string }> {
    return request("/api/history", {
      method: "POST",
      body: JSON.stringify({ songId }),
    });
  },

  async clear(): Promise<{ message: string }> {
    return request("/api/history", { method: "DELETE" });
  },
};

export const config = {
  async get(): Promise<Config> {
    return request<Config>("/api/config");
  },

  async update(config: Config): Promise<{ success: boolean; message: string }> {
    return request("/api/config", {
      method: "PUT",
      body: JSON.stringify(config),
    });
  },
};

export const artists = {
  async list(
    params: { page?: number; limit?: number; search?: string } = {},
  ): Promise<ArtistsResponse> {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.set("page", String(params.page));
    if (params.limit) searchParams.set("limit", String(params.limit));
    if (params.search) searchParams.set("search", params.search);
    const query = searchParams.toString();
    return request(`/api/artists${query ? `?${query}` : ""}`);
  },

  async get(id: number): Promise<Artist> {
    return request(`/api/artists/${id}`);
  },
};

export const albums = {
  async list(
    params: { page?: number; limit?: number; search?: string; artist?: string } = {},
  ): Promise<AlbumsResponse> {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.set("page", String(params.page));
    if (params.limit) searchParams.set("limit", String(params.limit));
    if (params.search) searchParams.set("search", params.search);
    if (params.artist) searchParams.set("artist", params.artist);
    const query = searchParams.toString();
    return request(`/api/albums${query ? `?${query}` : ""}`);
  },

  async get(id: number): Promise<Album> {
    return request(`/api/albums/${id}`);
  },
};

export const lyrics = {
  async get(title: string, artist: string): Promise<LyricsResponse> {
    const searchParams = new URLSearchParams();
    searchParams.set("title", title);
    if (artist) searchParams.set("artist", artist);
    return request(`/api/lyrics?${searchParams.toString()}`);
  },
};
