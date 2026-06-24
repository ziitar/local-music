import type { LucideIcon } from "lucide-react";
import { API_BASE } from "../../config.ts";

interface CoverImageProps {
  /** Relative path from the API (e.g. "/uploads/cover.jpg"). Falsy shows fallback. */
  src?: string | null | undefined;
  alt: string;
  /** Icon component rendered when `src` is falsy. */
  fallbackIcon: LucideIcon;
  className?: string;
  fallbackClassName?: string;
  imgClassName?: string;
}

export function CoverImage({
  src,
  alt,
  fallbackIcon: FallbackIcon,
  className = "",
  fallbackClassName = "h-6 w-6 text-muted-foreground",
  imgClassName = "w-full h-full object-cover",
}: CoverImageProps) {
  return (
    <div className={className}>
      {src ? (
        <img src={API_BASE + src} alt={alt} className={imgClassName} />
      ) : (
        <FallbackIcon className={fallbackClassName} />
      )}
    </div>
  );
}
