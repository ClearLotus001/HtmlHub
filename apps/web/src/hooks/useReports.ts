'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { alertDialog, confirmDialog } from '@/components/ui/Dialog';
import { api, type CategoryDto, type CategoryNode, type PageDto } from '@/lib/api';

// 每页显示的报告数量
const PAGE_SIZE = 20;

interface ReportFilters {
  category: string | null;
  project: string | null;
  iteration: string | null;
  query: string;
}

export function useReports(filters: ReportFilters) {
  const [tree, setTree] = useState<CategoryNode[]>([]);
  const [items, setItems] = useState<PageDto[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  // 仅首次加载时为 true，后续切换筛选条件不再触发全屏 loading
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // 用于标记是否已完成过首次加载
  const hasFetched = useRef(false);

  // ---- 选择状态管理 ----
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // 当前页所有 id
  const currentPageIds = items.map((item) => item.id);

  // 是否全选（当前页）
  const isAllSelected = currentPageIds.length > 0 && currentPageIds.every((id) => selectedIds.has(id));
  // 是否部分选中
  const isPartialSelected = !isAllSelected && currentPageIds.some((id) => selectedIds.has(id));

  // 切换单个选中
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // 全选/取消全选（当前页）
  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (currentPageIds.every((id) => next.has(id))) {
        // 取消全选
        for (const id of currentPageIds) next.delete(id);
      } else {
        // 全选
        for (const id of currentPageIds) next.add(id);
      }
      return next;
    });
  }, [currentPageIds]);

  // 清空选择
  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const fetchList = useCallback(async (nextFilters: ReportFilters, nextPage: number) => {
    // 首次加载才显示全屏 loading，后续切换保持旧数据可见
    if (!hasFetched.current) {
      setInitialLoading(true);
    }
    setError(null);
    try {
      const [treeRes, listRes] = await Promise.all([
        api.categoryTree(),
        api.list({
          category: nextFilters.category || undefined,
          project: nextFilters.project || undefined,
          iteration: nextFilters.iteration || undefined,
          q: nextFilters.query || undefined,
          page: nextPage,
          pageSize: PAGE_SIZE,
        }),
      ]);
      setTree(treeRes);
      setItems(listRes.items);
      setTotal(listRes.total);
      hasFetched.current = true;
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : '加载失败';
      setError(message);
    } finally {
      setInitialLoading(false);
    }
  }, []);

  const createCategory = useCallback(async (name: string): Promise<CategoryDto> => {
    const result = await api.createCategory(name);
    await fetchList(filters, page);
    return result;
  }, [fetchList, filters, page]);

  const updateCategory = useCallback(async (slug: string, name: string): Promise<CategoryDto> => {
    const result = await api.updateCategory(slug, name);
    await fetchList(filters, page);
    return result;
  }, [fetchList, filters, page]);

  const deleteCategory = useCallback(async (slug: string): Promise<void> => {
    const result = await api.deleteCategory(slug);
    if (result.migrated > 0) {
      await alertDialog(`分类已删除，${result.migrated} 个报告已迁移到默认分类。`, { type: 'success', title: '删除成功' });
    }
    await fetchList(filters, page);
  }, [fetchList, filters, page]);

  const updateProject = useCallback(async (category: string, project: string, newProject: string) => {
    const result = await api.updateProject(category, project, newProject);
    await fetchList(filters, page);
    return result;
  }, [fetchList, filters, page]);

  const deleteProject = useCallback(async (category: string, project: string) => {
    const result = await api.deleteProject(category, project);
    await fetchList(filters, page);
    return result;
  }, [fetchList, filters, page]);

  const moveProject = useCallback(async (category: string, project: string, targetCategory: string, targetProject?: string) => {
    const result = await api.moveProject(category, project, targetCategory, targetProject);
    await fetchList(filters, page);
    return result;
  }, [fetchList, filters, page]);

  const moveReport = useCallback(async (id: string, category: string, project: string) => {
    const result = await api.moveReport(id, category, project);
    await fetchList(filters, page);
    return result;
  }, [fetchList, filters, page]);

  const updateReportTitle = useCallback(async (id: string, title: string) => {
    const result = await api.updateReportTitle(id, title);
    await fetchList(filters, page);
    return result;
  }, [fetchList, filters, page]);

  // 筛选条件变化时重置到第 1 页，并清空选择
  useEffect(() => {
    setPage(1);
    setSelectedIds(new Set());
  }, [filters.category, filters.project, filters.iteration, filters.query]);

  // 翻页时清空选择
  useEffect(() => {
    setSelectedIds(new Set());
  }, [page]);

  useEffect(() => {
    queueMicrotask(() => {
      void fetchList(filters, page);
    });
  }, [fetchList, filters, page]);

  const deleteReport = useCallback(async (id: string) => {
    const ok = await confirmDialog(`确认删除报告 ${id} 吗？`, { title: '删除确认' });
    if (!ok) return;

    try {
      await api.remove(id);
      await fetchList(filters, page);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : '未知错误';
      await alertDialog(`删除失败：${message}`, { type: 'error', title: '操作失败' });
    }
  }, [fetchList, filters, page]);

  // 批量删除
  const batchDelete = useCallback(async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    const ok = await confirmDialog(
      `确认删除选中的 ${ids.length} 个报告吗？删除后将移入回收站。`,
      { title: '批量删除确认' },
    );
    if (!ok) return;

    try {
      const result = await api.batchRemove(ids);
      setSelectedIds(new Set());
      await fetchList(filters, page);
      if (result.failed.length > 0) {
        await alertDialog(
          `成功删除 ${result.succeeded} 个，${result.failed.length} 个失败：${result.failed.map((f) => f.id).join(', ')}`,
          { type: 'warning', title: '部分删除失败' },
        );
      } else {
        await alertDialog(`成功删除 ${result.succeeded} 个报告`, { type: 'success' });
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : '未知错误';
      await alertDialog(`批量删除失败：${message}`, { type: 'error', title: '操作失败' });
    }
  }, [selectedIds, fetchList, filters, page]);

  return {
    tree,
    items,
    total,
    loading: initialLoading,
    error,
    createCategory,
    updateCategory,
    deleteCategory,
    updateProject,
    deleteProject,
    moveProject,
    moveReport,
    updateReportTitle,
    deleteReport,
    // 选择相关
    selectedIds,
    isAllSelected,
    isPartialSelected,
    toggleSelect,
    toggleSelectAll,
    clearSelection,
    batchDelete,
    // 分页
    page,
    totalPages,
    pageSize: PAGE_SIZE,
    setPage,
  };
}
