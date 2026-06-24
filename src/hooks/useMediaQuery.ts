import { useEffect, useState } from "react";

/**
 * Subscribe to a CSS media query and return whether it currently matches.
 * Uses matchMedia for efficient, event-driven updates — no polling or resize listeners.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    const mql = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);

    // Set initial value in case it changed between render and effect
    setMatches(mql.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [query]);

  return matches;
}

/** Convenience: true when viewport >= 768px (Tailwind `md` breakpoint). */
export function useIsDesktop(): boolean {
  return useMediaQuery("(min-width: 768px)");
}

/** Convenience: true when viewport >= 640px (Tailwind `sm` breakpoint). */
export function useIsSm(): boolean {
  return useMediaQuery("(min-width: 640px)");
}
