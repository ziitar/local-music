interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export function Pagination({
  page,
  totalPages,
  onPageChange,
  className = "",
}: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <div className={`flex justify-center items-center gap-2 mt-6 backdrop-blur-sm bg-background/60 border-white/10 p-2 rounded-lg ${className}`}>
      <button
        className="px-3 py-1 rounded border text-sm disabled:opacity-50"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        上一页
      </button>
      <span className="text-sm text-foreground">
        {page} / {totalPages}
      </span>
      <button
        className="px-3 py-1 rounded border text-sm disabled:opacity-50"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        下一页
      </button>
    </div>
  );
}
