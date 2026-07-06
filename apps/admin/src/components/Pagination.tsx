import type { PaginationMeta } from "@travel/contracts";

interface PaginationProps {
  meta: PaginationMeta;
  onChange(page: number): void;
}

export function Pagination({ meta, onChange }: PaginationProps) {
  if (meta.totalPages <= 1) return null;
  return (
    <nav aria-label="列表分页" className="pagination">
      <button
        disabled={meta.page <= 1}
        onClick={() => onChange(meta.page - 1)}
        type="button"
      >
        上一页
      </button>
      <span>
        第 {meta.page} / {meta.totalPages} 页
      </span>
      <button
        disabled={meta.page >= meta.totalPages}
        onClick={() => onChange(meta.page + 1)}
        type="button"
      >
        下一页
      </button>
    </nav>
  );
}
