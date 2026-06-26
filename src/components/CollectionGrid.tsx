import { useIsDesktop } from "../hooks/useMediaQuery.ts";
import type { ReactNode } from "react";

interface CollectionGridProps<T> {
  items: T[];
  /** Render a single desktop grid card. */
  renderCard: (item: T) => ReactNode;
  /** Render a single mobile list row. */
  renderMobileItem: (item: T, index: number, array: T[]) => ReactNode;
  /** Tailwind grid columns class for desktop. Defaults to "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4". */
  columns?: string;
}

export function CollectionGrid<T>({
  items,
  renderCard,
  renderMobileItem,
  columns = "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4",
}: CollectionGridProps<T>) {
  const isDesktop = useIsDesktop();

  if (isDesktop) {
    return (
      <div className={`grid ${columns} gap-3 sm:gap-4`}>
        {items.map(renderCard)}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {items.map(renderMobileItem)}
    </div>
  );
}
