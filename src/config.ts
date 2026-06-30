/**
 * Centralized API base URL configuration.
 *
 * Resolution priority:
 * 1. VITE_API_BASE_URL env var (build-time injection)
 * 2. localStorage 'api_base_url' (user-configured)
 * 3. window.location.origin + Vite base path (web fallback, same-origin as backend)
 */

const STORAGE_KEY = 'api_base_url';

function resolveApiBase(): string {
  // Priority 1: Build-time environment variable
  const envBase = import.meta.env.VITE_API_BASE_URL as string | undefined;
  if (envBase) return envBase;

  // Priority 2: Persisted user setting
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return stored;
  } catch {
    // localStorage unavailable
  }

  // Priority 3: Web fallback — same origin as the backend, with subpath
  // import.meta.env.BASE_URL is set by Vite's `base` config (e.g. "/music/")
  const basePath = (import.meta.env.BASE_URL as string).replace(/\/+$/, '');
  return window.location.origin + basePath;
}

/** The resolved API base URL (computed once at module load). */
export const API_BASE = resolveApiBase();

/** Save a new API base URL to localStorage and reload the app. */
export function setApiBaseUrl(url: string): void {
  const normalized = url.replace(/\/+$/, '');
  console.log('[LocalMusic] Setting API base URL:', normalized);
  localStorage.setItem(STORAGE_KEY, normalized);

  const currentUrl = window.location.href.split('#')[0];
  console.log('[LocalMusic] Reloading to:', currentUrl);
  window.location.href = currentUrl;
}

/** Remove the stored API base URL and reload. */
export function clearApiBaseUrl(): void {
  localStorage.removeItem(STORAGE_KEY);
  window.location.href = window.location.href.split('#')[0];
}

/** Returns true if an API base URL is available. */
export function isApiConfigured(): boolean {
  return API_BASE !== '' && API_BASE.length > 0;
}
