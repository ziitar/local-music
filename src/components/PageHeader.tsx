import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  /** Element rendered on the right side (search input, button, etc.). */
  action?: ReactNode;
  className?: string;
}

export function PageHeader({ title, action, className = "" }: PageHeaderProps) {
  return (
    <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0 mb-4 sm:mb-6 ${className}`}>
      <h1 className="text-2xl sm:text-3xl font-bold">{title}</h1>
      {action && <div className="w-full sm:w-auto">{action}</div>}
    </div>
  );
}
