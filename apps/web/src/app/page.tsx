'use client';

import { useMemo } from 'react';
import { Trash2, X, CheckSquare } from 'lucide-react';
import { ActiveReportFilters } from '@/components/reports/ActiveReportFilters';
import { ReportCard } from '@/components/reports/ReportCard';
import { ReportSidebar } from '@/components/reports/ReportSidebar';
import { ReportEmptyState, ReportErrorState, ReportLoadingState } from '@/components/reports/ReportStates';
import { ReportToolbar } from '@/components/reports/ReportToolbar';
import { Pagination } from '@/components/reports/Pagination';
import { useReportFilters } from '@/hooks/useReportFilters';
import { useReports } from '@/hooks/useReports';

// 首页 = 报告列表（客户端渲染，方便交互）
export default function HomePage() {
  const filters = useReportFilters();
  const reportFilters = useMemo(
    () => ({
      project: filters.selectedProject,
      iteration: filters.selectedIteration,
      query: filters.q,
    }),
    [filters.selectedProject, filters.selectedIteration, filters.q],
  );
  const reports = useReports(reportFilters);

  return (
    <div className="container py-5 md:py-6 lg:py-8">
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[260px_minmax(0,1fr)] xl:gap-6">
        <ReportSidebar
          tree={reports.tree}
          loading={reports.loading}
          selectedProject={filters.selectedProject}
          selectedIteration={filters.selectedIteration}
          expandedProjects={filters.expandedProjects}
          onSelectAll={filters.selectAllReports}
          onSelectProject={filters.selectProject}
          onSelectIteration={filters.selectIteration}
        />

        <section className="min-w-0">
          <ReportToolbar
            qInput={filters.qInput}
            total={reports.total}
            onQueryInputChange={filters.setQInput}
            onSubmitSearch={filters.submitSearch}
          />

          <ActiveReportFilters
            selectedProject={filters.selectedProject}
            selectedIteration={filters.selectedIteration}
            query={filters.q}
            onClear={filters.clearFilters}
          />

          {/* 全选 & 批量删除工具栏 */}
          {!reports.loading && !reports.error && reports.items.length > 0 && (
            <div className="mb-4 flex items-center gap-3">
              <button
                type="button"
                onClick={reports.toggleSelectAll}
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-all duration-200 ${
                  reports.isAllSelected
                    ? 'border-primary bg-primary text-primary-foreground'
                    : reports.isPartialSelected
                      ? 'border-primary bg-primary/30 text-primary-foreground'
                      : 'border-border bg-card hover:border-primary/50'
                }`}
                aria-label={reports.isAllSelected ? '取消全选' : '全选当前页'}
              >
                {(reports.isAllSelected || reports.isPartialSelected) && (
                  <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none">
                    {reports.isAllSelected ? (
                      <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    ) : (
                      <path d="M3 6h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    )}
                  </svg>
                )}
              </button>
              <span className="text-[13px] text-muted-foreground">
                {reports.selectedIds.size > 0
                  ? `已选择 ${reports.selectedIds.size} 项`
                  : '全选当前页'}
              </span>
              {reports.selectedIds.size > 0 && (
                <>
                  <button
                    type="button"
                    onClick={reports.batchDelete}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-destructive/10 px-3 text-[12px] font-medium text-destructive transition-all duration-200 hover:bg-destructive hover:text-destructive-foreground active:scale-[0.98]"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    批量删除
                  </button>
                  <button
                    type="button"
                    onClick={reports.clearSelection}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-secondary px-3 text-[12px] font-medium text-secondary-foreground transition-all duration-200 hover:bg-accent active:scale-[0.98]"
                  >
                    <X className="h-3.5 w-3.5" />
                    取消选择
                  </button>
                </>
              )}
            </div>
          )}

          {reports.loading && <ReportLoadingState />}
          {reports.error && <ReportErrorState message={reports.error} />}
          {!reports.loading && !reports.error && reports.items.length === 0 && <ReportEmptyState />}

          <div className="card-grid grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4">
            {reports.items.map((report) => (
              <div key={report.id}>
                <ReportCard
                  report={report}
                  selected={reports.selectedIds.has(report.id)}
                  onToggleSelect={reports.toggleSelect}
                  onDelete={reports.deleteReport}
                />
              </div>
            ))}
          </div>

          <Pagination
            page={reports.page}
            totalPages={reports.totalPages}
            onPageChange={reports.setPage}
          />
        </section>
      </div>
    </div>
  );
}
