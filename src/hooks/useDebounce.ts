import { useEffect, useState } from "react";

/**
 * Debounce a value by `delay` ms.
 * Returns the debounced value that updates only after the input stabilises.
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
