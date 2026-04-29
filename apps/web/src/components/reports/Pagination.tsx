'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

/**
 * 生成页码按钮列表，超出范围用 -1 表示省略号
 */
function getPageNumbers(current: number, total: number): number[] {
  // 总页数 <= 7 时全部显示
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages: number[] = [1];

  if (current > 3) {
    pages.push(-1); // 省略号
  }

  // 当前页附近的页码
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  if (current < total - 2) {
    pages.push(-1); // 省略号
  }

  pages.push(total);
  return pages;
}

export function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  // 只有 1 页时不显示分页
  if (totalPages <= 1) return null;

  const pages = getPageNumbers(page, totalPages);

  const btnBase =
    'inline-flex h-8 min-w-[2rem] items-center justify-center rounded-lg text-[13px] font-medium transition-all duration-200';

  return (
    <nav aria-label="分页导航" className="mt-6 flex items-center justify-center gap-1.5">
      {/* 上一页 */}
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        aria-label="上一页"
        className={`${btnBase} px-2 ${
          page <= 1
            ? 'cursor-not-allowed text-muted-foreground/40'
            : 'text-muted-foreground hover:bg-foreground/5 hover:text-foreground'
        }`}
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      {/* 页码按钮 */}
      {pages.map((p, idx) =>
        p === -1 ? (
          <span
            key={`ellipsis-${idx}`}
            className="inline-flex h-8 min-w-[2rem] items-center justify-center text-[13px] text-muted-foreground"
          >
            ···
          </span>
        ) : (
          <button
            key={p}
            type="button"
            onClick={() => onPageChange(p)}
            aria-current={p === page ? 'page' : undefined}
            className={`${btnBase} px-2.5 ${
              p === page
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-foreground/5 hover:text-foreground'
            }`}
          >
            {p}
          </button>
        ),
      )}

      {/* 下一页 */}
      <button
        type="button"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        aria-label="下一页"
        className={`${btnBase} px-2 ${
          page >= totalPages
            ? 'cursor-not-allowed text-muted-foreground/40'
            : 'text-muted-foreground hover:bg-foreground/5 hover:text-foreground'
        }`}
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </nav>
  );
}
