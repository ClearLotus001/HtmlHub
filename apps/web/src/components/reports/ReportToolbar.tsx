'use client';

import { Search } from 'lucide-react';

interface ReportToolbarProps {
  qInput: string;
  total: number;
  onQueryInputChange: (value: string) => void;
  onSubmitSearch: () => void;
}

export function ReportToolbar({
  qInput,
  total,
  onQueryInputChange,
  onSubmitSearch,
}: ReportToolbarProps) {
  return (
    <div className="animate-macos-slide-down mb-6 glass-card rounded-2xl p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="relative flex-1 md:max-w-2xl">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
            <Search className="h-4 w-4" />
          </div>
          <input
            type="text"
            aria-label="搜索报告"
            placeholder="搜索报告标题、摘要、标签..."
            value={qInput}
            onChange={(e) => onQueryInputChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSubmitSearch();
            }}
            className="h-11 w-full rounded-xl border border-border bg-card/50 pl-11 pr-4 text-[14px] text-foreground outline-none transition-all duration-200 placeholder:text-muted-foreground focus:border-primary/50 focus:bg-card focus:shadow-lg focus:shadow-primary/5"
          />
        </div>
        <div className="flex items-center gap-2.5 text-[14px] text-muted-foreground">
          <span>共</span>
          <span className="inline-flex h-7 items-center justify-center rounded-lg bg-primary/10 px-2.5 text-[14px] font-semibold text-primary">
            {total}
          </span>
          <span>份报告</span>
        </div>
      </div>
    </div>
  );
}
