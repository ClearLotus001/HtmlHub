'use client';

import { Folder, FolderOpen } from 'lucide-react';
import type { ProjectNode } from '@/lib/api';
import { cn } from '@/lib/utils';

interface ReportSidebarProps {
  tree: ProjectNode[];
  loading: boolean;
  selectedProject: string | null;
  selectedIteration: string | null;
  expandedProjects: Set<string>;
  onSelectAll: () => void;
  onSelectProject: (project: string) => void;
  onSelectIteration: (project: string, iteration: string) => void;
}

export function ReportSidebar({
  tree,
  loading,
  selectedProject,
  selectedIteration,
  expandedProjects,
  onSelectAll,
  onSelectProject,
  onSelectIteration,
}: ReportSidebarProps) {
  return (
    <aside className="animate-macos-fade-in glass-card rounded-2xl p-5 xl:sticky xl:top-[4.5rem] xl:max-h-[calc(100dvh-6rem)] xl:overflow-auto">
      <div className="mb-4 flex items-center gap-2 px-2 py-1.5">
        <div className="h-1.5 w-1.5 rounded-full bg-primary" />
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          项目导航
        </span>
      </div>

      <button
        type="button"
        onClick={onSelectAll}
        className={cn(
          'flex min-h-10 w-full items-center gap-2 rounded-xl px-3 text-left text-sm font-medium transition-all duration-200',
          !selectedProject
            ? 'bg-primary/10 text-primary shadow-sm shadow-primary/10'
            : 'text-muted-foreground hover:bg-accent hover:text-foreground',
        )}
      >
        <Folder className={cn('h-4 w-4 shrink-0', !selectedProject ? 'text-primary' : 'text-muted-foreground')} />
        全部报告
      </button>

      <div className="mt-3 space-y-1.5">
        {tree.map((node) => {
          const expanded = expandedProjects.has(node.project);
          const isActive = selectedProject === node.project;
          return (
            <div key={node.project}>
              <button
                type="button"
                onClick={() => onSelectProject(node.project)}
                className={cn(
                  'flex min-h-10 w-full items-center gap-2 rounded-xl px-3 text-left text-sm font-medium transition-all duration-200',
                  isActive && !selectedIteration
                    ? 'bg-primary/10 text-primary shadow-sm shadow-primary/10'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                )}
                aria-expanded={expanded}
              >
                {expanded ? (
                  <FolderOpen className="h-4 w-4 shrink-0 text-primary/70" />
                ) : (
                  <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
                <span className="truncate">{node.project}</span>
                <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                  {node.iterations.length}
                </span>
              </button>

              {expanded && (
                <div className="ml-4 mt-1.5 space-y-1 border-l-2 border-primary/10 pl-4">
                  {node.iterations.map((it) => (
                    <button
                      key={it}
                      type="button"
                      onClick={() => onSelectIteration(node.project, it)}
                      className={cn(
                        'flex min-h-8 w-full items-center rounded-lg px-3 text-left text-xs font-medium transition-all duration-200',
                        selectedProject === node.project && selectedIteration === it
                          ? 'bg-primary/10 text-primary shadow-sm shadow-primary/10'
                          : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                      )}
                    >
                      <span className="truncate">{it}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {tree.length === 0 && !loading && (
          <div className="px-2 py-5 text-center text-xs text-muted-foreground">
            暂无项目
          </div>
        )}
      </div>
    </aside>
  );
}
