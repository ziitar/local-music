import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { CoverImage } from "./ui/CoverImage.tsx";

interface DetailHeroProps {
  coverSrc?: string | null | undefined;
  coverAlt: string;
  fallbackIcon: LucideIcon;
  title: string;
  subtitle?: string | null;
  meta?: string;
  /** Whether to use rounded-full for the cover (e.g. artist). Default false (rounded-lg). */
  roundCover?: boolean;
  /** Action buttons rendered below meta. */
  actions?: ReactNode;
}

export function DetailHero({
  coverSrc,
  coverAlt,
  fallbackIcon,
  title,
  subtitle,
  meta,
  roundCover = false,
  actions,
}: DetailHeroProps) {
  const coverClass = roundCover
    ? "w-32 h-32 sm:w-48 sm:h-48 bg-muted rounded-full flex items-center justify-center overflow-hidden flex-shrink-0"
    : "w-32 h-32 sm:w-48 sm:h-48 bg-muted rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0";

  const fallbackClass = "h-12 w-12 sm:h-24 sm:w-24 text-muted-foreground";

  return (
    <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6 mb-6 sm:mb-8">
      <CoverImage
        src={coverSrc}
        alt={coverAlt}
        fallbackIcon={fallbackIcon}
        className={coverClass}
        fallbackClassName={fallbackClass}
      />
      <div className="text-center sm:text-left">
        <h1 className="text-2xl sm:text-3xl font-bold mb-2">{title}</h1>
        {subtitle && <p className="text-muted-foreground mb-2">{subtitle}</p>}
        {meta && <p className="text-sm text-muted-foreground">{meta}</p>}
        {actions && <div className="mt-3 sm:mt-4">{actions}</div>}
      </div>
    </div>
  );
}
