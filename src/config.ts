/**
 * Centralized API base URL configuration.
 *
 * Resolution priority:
 * 1. VITE_API_BASE_URL env var (build-time injection for mobile builds)
 * 2. localStorage 'api_base_url' (user-configured on native platforms)
 * 3. window.location.origin (web fallback, same-origin as backend)
 */

const STORAGE_KEY = 'api_base_url';

/** Check if running on a Capacitor native platform. */
export function isNativePlatform(): boolean {
  // Capacitor sets window.Capacitor when running natively
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return typeof cap?.isNativePlatform === 'function' && cap.isNativePlatform();
}

function resolveApiBase(): string {
  // Priority 1: Build-time environment variable
  const envBase = import.meta.env.VITE_API_BASE_URL as string | undefined;
  if (envBase) return envBase;

  // Priority 2: Persisted user setting (for native apps)
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return stored;
  } catch {
    // localStorage unavailable
  }

  // Priority 3: Native platform without configuration
  if (isNativePlatform()) {
    return '';
  }

  // Priority 4: Web fallback — same origin as the backend
  return window.location.origin;
}

/** The resolved API base URL (computed once at module load). */
export const API_BASE = resolveApiBase();

/** Save a new API base URL to localStorage and reload the app. */
export function setApiBaseUrl(url: string): void {
  const normalized = url.replace(/\/+$/, '');
  localStorage.setItem(STORAGE_KEY, normalized);
  // Use location.href assignment instead of reload() for better Capacitor
  // Android compatibility — reload() can lose the Capacitor bridge.
  window.location.href = window.location.href.split('#')[0];
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
