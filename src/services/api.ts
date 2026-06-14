import type {
  AuthResponse,
  Config,
  PlayHistory,
  Playlist,
  Song,
  SongsResponse,
  User,
} from "../types";

const API_BASE = window.location.origin;

function getToken(): string | null {
  return localStorage.getItem("token");
}

function setToken(token: string): void {
  localStorage.setItem("token", token);
}

function removeToken(): void {
  localStorage.removeItem("token");
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getToken();
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  if (token) {
    (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

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
      setToken(result.token);
    }

    return result;
  },

  async login(username: string, password: string): Promise<AuthResponse> {
    const result = await request<AuthResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });

    if (result.token) {
      setToken(result.token);
    }

    return result;
  },

  async me(): Promise<User> {
    return request<User>("/api/auth/me");
  },

  logout(): void {
    removeToken();
  },

  isAuthenticated(): boolean {
    return !!getToken();
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

  async delete(id: number): Promise<{ message: string }> {
    return request(`/api/songs/${id}`, { method: "DELETE" });
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
