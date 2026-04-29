'use client';

import { Clock, Folder, Search } from 'lucide-react';

interface ActiveReportFiltersProps {
  selectedProject: string | null;
  selectedIteration: string | null;
  query: string;
  onClear: () => void;
}

export function ActiveReportFilters({
  selectedProject,
  selectedIteration,
  query,
  onClear,
}: ActiveReportFiltersProps) {
  if (!selectedProject && !selectedIteration && !query) return null;

  const chipClass = 'inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-[12px] font-medium text-primary shadow-sm backdrop-blur-sm';

  return (
    <div className="animate-macos-slide-down mb-6 flex flex-wrap items-center gap-2">
      {selectedProject && (
        <span className={chipClass}>
          <Folder className="h-3 w-3" />
          {selectedProject}
        </span>
      )}
      {selectedIteration && (
        <span className={chipClass}>
          <Clock className="h-3 w-3" />
          {selectedIteration}
        </span>
      )}
      {query && (
        <span className={chipClass}>
          <Search className="h-3 w-3" />
          {query}
        </span>
      )}
      <button
        type="button"
        onClick={onClear}
        className="inline-flex h-7 items-center gap-1 rounded-lg px-2.5 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
      >
        清除筛选
      </button>
    </div>
  );
}
