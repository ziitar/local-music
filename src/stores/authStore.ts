import { create } from "zustand";
import { auth as authApi } from "../services/api.ts";
import type { User } from "../types/index.ts";

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;

  login: (
    username: string,
    password: string,
  ) => Promise<{ success: boolean; message: string }>;
  register: (
    username: string,
    password: string,
  ) => Promise<{ success: boolean; message: string }>;
  changePassword: (
    oldPassword: string,
    newPassword: string,
  ) => Promise<{ success: boolean; message: string }>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  isAdmin: false,

  login: async (username, password) => {
    try {
      const result = await authApi.login(username, password);
      if (result.success && result.user) {
        set({
          user: result.user,
          isAuthenticated: true,
          isAdmin: result.user.role === 'admin',
        });
        return { success: true, message: result.message };
      }
      return { success: false, message: result.message };
    } catch (error) {
      return { success: false, message: (error as Error).message };
    }
  },

  register: async (username, password) => {
    try {
      const result = await authApi.register(username, password);
      if (result.success && result.user) {
        set({
          user: result.user,
          isAuthenticated: true,
          isAdmin: result.user.role === 'admin',
        });
        return { success: true, message: result.message };
      }
      return { success: false, message: result.message };
    } catch (error) {
      return { success: false, message: (error as Error).message };
    }
  },

  changePassword: async (oldPassword, newPassword) => {
    try {
      const result = await authApi.changePassword(oldPassword, newPassword);
      return result;
    } catch (error) {
      return { success: false, message: (error as Error).message };
    }
  },

  logout: async () => {
    await authApi.logout();
    set({ user: null, isAuthenticated: false, isAdmin: false });
  },

  checkAuth: async () => {
    try {
      // api.ts handles auto-refresh transparently
      // me() succeeds if access token is valid OR refresh succeeds
      const user = await authApi.me();
      set({
        user,
        isAuthenticated: true,
        isLoading: false,
        isAdmin: user.role === 'admin',
      });
    } catch {
      // Both access token and refresh failed
      await authApi.logout();
      set({ user: null, isAuthenticated: false, isLoading: false, isAdmin: false });
    }
  },
}));
