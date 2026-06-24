interface QualityBadgeProps {
  quality: string;
  /** "light" for bg-green-100 style, "dark" for bg-green-500/20 style */
  variant?: "light" | "dark";
  className?: string;
}

const lightColors: Record<string, string> = {
  lossless: "bg-green-100 text-green-800",
  "320k": "bg-blue-100 text-blue-800",
};

const darkColors: Record<string, string> = {
  lossless: "bg-green-500/20 text-green-300",
  "320k": "bg-blue-500/20 text-blue-300",
};

export function QualityBadge({
  quality,
  variant = "light",
  className = "",
}: QualityBadgeProps) {
  const colors = variant === "dark" ? darkColors : lightColors;
  const fallback =
    variant === "dark" ? "bg-gray-500/20 text-gray-300" : "bg-gray-100 text-gray-800";
  const colorClass = colors[quality] ?? fallback;

  return (
    <span className={`px-1.5 py-0.5 rounded text-xs ${colorClass} ${className}`}>
      {quality}
    </span>
  );
}
