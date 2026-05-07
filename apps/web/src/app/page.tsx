'use client';

import { useMemo } from 'react';
import { Trash2, X } from 'lucide-react';
import { ActiveReportFilters } from '@/components/reports/ActiveReportFilters';
import { ReportCard } from '@/components/reports/ReportCard';
import { ReportSidebar } from '@/components/reports/ReportSidebar';
import { ReportEmptyState, ReportErrorState, ReportLoadingState } from '@/components/reports/ReportStates';
import { ReportToolbar } from '@/components/reports/ReportToolbar';
import { Pagination } from '@/components/reports/Pagination';
import { useReportFilters } from '@/hooks/useReportFilters';
import { useReports } from '@/hooks/useReports';

const DND_MIME = 'application/x-htmlhub-nav';

// 首页 = 报告列表（客户端渲染，方便交互）
export default function HomePage() {
  const filters = useReportFilters();
  const reportFilters = useMemo(
    () => ({
      category: filters.selectedCategory,
      project: filters.selectedProject,
      iteration: filters.selectedIteration,
      query: filters.q,
    }),
    [filters.selectedCategory, filters.selectedProject, filters.selectedIteration, filters.q],
  );
  const reports = useReports(reportFilters);
  const selectedCategoryLabel = useMemo(
    () => reports.tree.find((item) => item.slug === filters.selectedCategory)?.name ?? null,
    [reports.tree, filters.selectedCategory],
  );

  return (
    <div className="container py-5 md:py-6 lg:py-8 xl:min-h-[calc(100dvh-3.5rem)]">
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[340px_minmax(0,1fr)] xl:gap-6 xl:items-start">
        <ReportSidebar
          tree={reports.tree}
          loading={reports.loading}
          selectedCategory={filters.selectedCategory}
          selectedProject={filters.selectedProject}
          selectedIteration={filters.selectedIteration}
          expandedCategories={filters.expandedCategories}
          expandedProjects={filters.expandedProjects}
          onSelectAll={filters.selectAllReports}
          onSelectCategory={filters.selectCategory}
          onSelectProject={filters.selectProject}
          onCreateCategory={async (name) => {
            await reports.createCategory(name);
          }}
          onUpdateCategory={async (slug, name) => {
            await reports.updateCategory(slug, name);
          }}
          onDeleteCategory={async (slug) => {
            await reports.deleteCategory(slug);
          }}
          onUpdateProject={async (category, project, newProject) => {
            await reports.updateProject(category, project, newProject);
          }}
          onDeleteProject={async (category, project) => {
            await reports.deleteProject(category, project);
            filters.selectCategory(category);
          }}
          onMoveProject={async (category, project, targetCategory, targetProject) => {
            await reports.moveProject(category, project, targetCategory, targetProject);
          }}
          onMoveReport={async (id, category, project) => {
            await reports.moveReport(id, category, project);
          }}
          onUpdateReportTitle={async (id, title) => {
            await reports.updateReportTitle(id, title);
          }}
          onDeleteReport={reports.deleteReport}
        />

        <section className="min-w-0">
          <ReportToolbar
            qInput={filters.qInput}
            total={reports.total}
            onQueryInputChange={filters.setQInput}
            onSubmitSearch={filters.submitSearch}
          />

          <ActiveReportFilters
            selectedCategoryLabel={selectedCategoryLabel}
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
                  hasSelection={reports.selectedIds.size > 0}
                  onToggleSelect={reports.toggleSelect}
                  onRename={reports.updateReportTitle}
                  onDelete={reports.deleteReport}
                  onDragStart={(event) => {
                    const payload = JSON.stringify({
                      kind: 'report',
                      id: report.id,
                      category: report.category,
                      project: report.project,
                    });
                    event.dataTransfer.effectAllowed = 'move';
                    event.dataTransfer.setData(DND_MIME, payload);
                    event.dataTransfer.setData('text/plain', payload);
                  }}
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
