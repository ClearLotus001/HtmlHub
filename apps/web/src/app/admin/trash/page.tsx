'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  api,
  type TrashPageDto,
} from '@/lib/api';
import { formatBytes, formatTime } from '@/lib/utils';
import { alertDialog, confirmDialog } from '@/components/ui/Dialog';
import { Tooltip } from '@/components/ui/Tooltip';
import { Pagination } from '@/components/reports/Pagination';
import {
  ArrowLeft,
  Trash2,
  RotateCcw,
  Loader2,
  Search,
  Inbox,
  Folder,
  Clock,
  HardDrive,
  AlertTriangle,
  XCircle,
  X,
  Eye,
} from 'lucide-react';

const PAGE_SIZE = 20;

export default function TrashAdminPage() {
  const [items, setItems] = useState<TrashPageDto[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [qInput, setQInput] = useState('');
  const [q, setQ] = useState('');
  // 正在操作中的 id 集合（防止重复点击）
  const [operating, setOperating] = useState<Set<string>>(new Set());
  // ---- 选择状态管理 ----
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  // ---- 预览状态 ----
  const [previewId, setPreviewId] = useState<string | null>(null);
  const previewItem = previewId ? items.find((i) => i.id === previewId) : null;

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
        for (const id of currentPageIds) next.delete(id);
      } else {
        for (const id of currentPageIds) next.add(id);
      }
      return next;
    });
  }, [currentPageIds]);

  // 清空选择
  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  // 记录上一次搜索词，用于判断是否需要重置页码
  const prevQRef = useRef(q);

  const fetchList = useCallback(async (query: string, nextPage: number, signal: AbortSignal) => {
    setError(null);
    setLoading(true);
    try {
      const res = await api.trashList({ q: query || undefined, page: nextPage, pageSize: PAGE_SIZE });
      if (signal.aborted) return;
      setItems(res.items);
      setTotal(res.total);
    } catch (e: any) {
      if (signal.aborted) return;
      setError(e.message);
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, []);

  // 搜索词或页码变化时统一发起请求；搜索词变化时自动重置到第 1 页
  useEffect(() => {
    let targetPage = page;
    if (prevQRef.current !== q) {
      // 搜索词变化，强制回到第 1 页
      targetPage = 1;
      setPage(1);
      prevQRef.current = q;
      // 搜索词变化时清空选择
      setSelectedIds(new Set());
    }

    const ac = new AbortController();
    void fetchList(q, targetPage, ac.signal);
    return () => ac.abort();
  }, [fetchList, q, page]);

  // 翻页时清空选择
  useEffect(() => {
    setSelectedIds(new Set());
  }, [page]);

  // 手动刷新当前页（操作后调用）
  const refreshList = useCallback(() => {
    const ac = new AbortController();
    void fetchList(q, page, ac.signal);
  }, [fetchList, q, page]);

  const handleRestore = async (id: string) => {
    const ok = await confirmDialog(`确认恢复报告 ${id} 吗？恢复后将重新出现在报告列表中。`, { title: '恢复确认' });
    if (!ok) return;

    setOperating((prev) => new Set(prev).add(id));
    try {
      await api.trashRestore(id);
      await refreshList();
      await alertDialog('恢复成功', { type: 'success' });
    } catch (e: any) {
      await alertDialog(`恢复失败：${e.message}`, { type: 'error', title: '操作失败' });
    } finally {
      setOperating((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handlePurge = async (id: string) => {
    const ok = await confirmDialog(
      `确认彻底删除报告 ${id} 吗？物理文件将被永久清除，此操作不可撤销！`,
      { title: '彻底删除' },
    );
    if (!ok) return;

    setOperating((prev) => new Set(prev).add(id));
    try {
      const result = await api.trashPurge(id);
      await refreshList();
      await alertDialog(`已彻底删除，释放 ${formatBytes(result.bytes_freed)}`, { type: 'success' });
    } catch (e: any) {
      await alertDialog(`删除失败：${e.message}`, { type: 'error', title: '操作失败' });
    } finally {
      setOperating((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  // 批量恢复
  const handleBatchRestore = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    const ok = await confirmDialog(
      `确认恢复选中的 ${ids.length} 个报告吗？恢复后将重新出现在报告列表中。`,
      { title: '批量恢复确认' },
    );
    if (!ok) return;

    setOperating((prev) => {
      const next = new Set(prev);
      for (const id of ids) next.add(id);
      return next;
    });

    try {
      const result = await api.batchTrashRestore(ids);
      setSelectedIds(new Set());
      await refreshList();
      if (result.failed.length > 0) {
        await alertDialog(
          `成功恢复 ${result.succeeded} 个，${result.failed.length} 个失败：${result.failed.map((f) => f.id).join(', ')}`,
          { type: 'warning', title: '部分恢复失败' },
        );
      } else {
        await alertDialog(`成功恢复 ${result.succeeded} 个报告`, { type: 'success' });
      }
    } catch (e: any) {
      await alertDialog(`批量恢复失败：${e.message}`, { type: 'error', title: '操作失败' });
    } finally {
      setOperating((prev) => {
        const next = new Set(prev);
        for (const id of ids) next.delete(id);
        return next;
      });
    }
  };

  // 批量彻底删除
  const handleBatchPurge = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    const ok = await confirmDialog(
      `确认彻底删除选中的 ${ids.length} 个报告吗？物理文件将被永久清除，此操作不可撤销！`,
      { title: '批量彻底删除' },
    );
    if (!ok) return;

    setOperating((prev) => {
      const next = new Set(prev);
      for (const id of ids) next.add(id);
      return next;
    });

    try {
      const result = await api.batchTrashPurge(ids);
      setSelectedIds(new Set());
      await refreshList();
      if (result.failed.length > 0) {
        await alertDialog(
          `成功删除 ${result.succeeded} 个（释放 ${formatBytes(result.bytes_freed)}），${result.failed.length} 个失败：${result.failed.map((f) => f.id).join(', ')}`,
          { type: 'warning', title: '部分删除失败' },
        );
      } else {
        await alertDialog(`已彻底删除 ${result.succeeded} 个报告，释放 ${formatBytes(result.bytes_freed)}`, { type: 'success' });
      }
    } catch (e: any) {
      await alertDialog(`批量删除失败：${e.message}`, { type: 'error', title: '操作失败' });
    } finally {
      setOperating((prev) => {
        const next = new Set(prev);
        for (const id of ids) next.delete(id);
        return next;
      });
    }
  };

  // ---- 预览视图 ----
  if (previewId) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-background">
        {/* 预览顶栏 */}
        <div className="flex shrink-0 items-center gap-3 border-b border-border bg-card/80 px-4 py-3 backdrop-blur-sm">
          <button
            type="button"
            onClick={() => setPreviewId(null)}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-secondary px-3 text-[13px] font-medium text-secondary-foreground transition-all duration-200 hover:bg-accent active:scale-[0.98]"
          >
            <ArrowLeft className="h-4 w-4" />
            回收站
          </button>
          <div className="h-4 w-px bg-border" />
          <Eye className="h-4 w-4 text-muted-foreground" />
          <span className="text-[13px] font-medium text-foreground truncate">
            {previewItem?.title || previewId}
          </span>
          {previewItem && (
            <span className="text-[12px] text-muted-foreground">
              {previewItem.project}/{previewItem.iteration}
            </span>
          )}
        </div>
        {/* iframe 预览区 */}
        <iframe
          src={`/api/trash/${encodeURIComponent(previewId)}/preview`}
          className="flex-1 w-full border-0"
          title="报告预览"
          sandbox="allow-scripts allow-same-origin allow-popups"
        />
      </div>
    );
  }

  return (
    <div className="container py-6 max-w-5xl">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        返回列表
      </Link>

      <h1 className="mt-3 text-xl font-semibold flex items-center gap-2 text-foreground">
        <Trash2 className="h-5 w-5 text-primary" />
        回收站管理
      </h1>
      <p className="mt-1 text-[13px] text-muted-foreground">
        已删除的报告会在回收站中保留一段时间，期间可恢复。超过保留期后将被自动物理清理。
      </p>

      {/* 搜索栏 + 统计 */}
      <div className="animate-macos-slide-down glass-card rounded-2xl p-4 mt-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 sm:max-w-md">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              <Search className="h-4 w-4" />
            </div>
            <input
              type="text"
              aria-label="搜索回收站"
              placeholder="搜索报告标题、摘要..."
              value={qInput}
              onChange={(e) => setQInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') setQ(qInput.trim());
              }}
              className="h-10 w-full rounded-xl border border-border bg-card/50 pl-10 pr-4 text-[13px] text-foreground outline-none transition-all duration-200 placeholder:text-muted-foreground focus:border-primary/50 focus:bg-card focus:shadow-lg focus:shadow-primary/5"
            />
          </div>
          <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
            <span>共</span>
            <span className="inline-flex h-6 items-center justify-center rounded-lg bg-destructive/10 px-2 text-[13px] font-semibold text-destructive">
              {total}
            </span>
            <span>条待清理</span>
          </div>
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="animate-macos-fade-in mt-4 rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-[13px] text-destructive">
          <div className="flex items-center gap-2">
            <XCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        </div>
      )}

      {/* 加载中 */}
      {loading && (
        <div className="animate-macos-fade-in mt-6 flex items-center justify-center py-16">
          <div className="relative">
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
            <div className="absolute inset-0 h-7 w-7 animate-ping rounded-full bg-primary/20" />
          </div>
          <span className="ml-3 text-[13px] text-muted-foreground">加载中...</span>
        </div>
      )}

      {/* 空状态 */}
      {!loading && !error && items.length === 0 && (
        <div className="animate-macos-fade-in mt-6 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-muted/30 px-6 py-16 text-center">
          <div className="mb-4 rounded-2xl bg-card p-5 shadow-sm backdrop-blur-sm">
            <Inbox className="h-12 w-12 text-muted-foreground/60" />
          </div>
          <p className="text-base font-semibold text-foreground">回收站为空</p>
          <p className="mt-1.5 max-w-sm text-[13px] text-muted-foreground">
            {q ? '当前搜索条件下没有匹配的记录' : '没有已删除的报告，一切干净整洁 ✨'}
          </p>
        </div>
      )}

      {/* 列表 */}
      {!loading && !error && items.length > 0 && (
        <div className="animate-macos-fade-in mt-5 space-y-3">
          {/* 全选 & 批量删除工具栏 */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggleSelectAll}
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-all duration-200 ${
                isAllSelected
                  ? 'border-primary bg-primary text-primary-foreground'
                  : isPartialSelected
                    ? 'border-primary bg-primary/30 text-primary-foreground'
                    : 'border-border bg-card hover:border-primary/50'
              }`}
              aria-label={isAllSelected ? '取消全选' : '全选当前页'}
            >
              {(isAllSelected || isPartialSelected) && (
                <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none">
                  {isAllSelected ? (
                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  ) : (
                    <path d="M3 6h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  )}
                </svg>
              )}
            </button>
            <span className="text-[13px] text-muted-foreground">
              {selectedIds.size > 0
                ? `已选择 ${selectedIds.size} 项`
                : '全选当前页'}
            </span>
            {selectedIds.size > 0 && (
              <>
                <button
                  type="button"
                  onClick={handleBatchRestore}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary/10 px-3 text-[12px] font-medium text-primary transition-all duration-200 hover:bg-primary hover:text-primary-foreground active:scale-[0.98]"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  批量恢复
                </button>
                <button
                  type="button"
                  onClick={handleBatchPurge}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-destructive/10 px-3 text-[12px] font-medium text-destructive transition-all duration-200 hover:bg-destructive hover:text-destructive-foreground active:scale-[0.98]"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  批量彻底删除
                </button>
                <button
                  type="button"
                  onClick={clearSelection}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-secondary px-3 text-[12px] font-medium text-secondary-foreground transition-all duration-200 hover:bg-accent active:scale-[0.98]"
                >
                  <X className="h-3.5 w-3.5" />
                  取消选择
                </button>
              </>
            )}
          </div>

          {items.map((item) => {
            const isOperating = operating.has(item.id);
            const isSelected = selectedIds.has(item.id);
            return (
              <div
                key={item.id}
                className={`group/row glass-card rounded-2xl p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4 transition-all duration-200 ${isSelected ? 'ring-2 ring-primary shadow-lg shadow-primary/10' : ''}`}
              >
                {/* 选择复选框：默认隐藏，hover 或选中时显示 */}
                <button
                  type="button"
                  onClick={() => toggleSelect(item.id)}
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-all duration-200 ${
                    isSelected
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-card hover:border-primary/50 opacity-0 group-hover/row:opacity-100'
                  }`}
                  aria-label={isSelected ? '取消选择' : '选择'}
                >
                  {isSelected && (
                    <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>

                {/* 信息区 */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-[14px] font-semibold text-foreground truncate">
                    {item.title}
                  </h3>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Folder className="h-3 w-3 text-primary" />
                      {item.project}
                      <span className="text-border">/</span>
                      {item.iteration}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <HardDrive className="h-3 w-3" />
                      {formatBytes(item.size_bytes)} · {item.file_count} 个文件
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      删除于 {formatTime(item.deleted_at)}
                    </span>
                  </div>
                </div>

                {/* 操作区 */}
                <div className="flex items-center gap-2 shrink-0">
                  {/* 预览按钮 */}
                  {item.can_restore && (
                    <Tooltip content="预览报告内容">
                      <button
                        type="button"
                        onClick={() => setPreviewId(item.id)}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-secondary px-3 text-[12px] font-medium text-secondary-foreground transition-all duration-200 hover:bg-accent active:scale-[0.98]"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        预览
                      </button>
                    </Tooltip>
                  )}
                  {item.can_restore ? (
                    <Tooltip content="恢复到报告列表">
                      <button
                        type="button"
                        disabled={isOperating}
                        onClick={() => handleRestore(item.id)}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary/10 px-3 text-[12px] font-medium text-primary transition-all duration-200 hover:bg-primary hover:text-primary-foreground disabled:opacity-50 active:scale-[0.98]"
                      >
                        {isOperating ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <RotateCcw className="h-3.5 w-3.5" />
                        )}
                        恢复
                      </button>
                    </Tooltip>
                  ) : (
                    <Tooltip content="物理文件已丢失，无法恢复">
                      <span className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-muted px-3 text-[12px] font-medium text-muted-foreground cursor-not-allowed">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        不可恢复
                      </span>
                    </Tooltip>
                  )}
                  <Tooltip content="彻底删除，不可撤销">
                    <button
                      type="button"
                      disabled={isOperating}
                      onClick={() => handlePurge(item.id)}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-destructive/10 px-3 text-[12px] font-medium text-destructive transition-all duration-200 hover:bg-destructive hover:text-destructive-foreground disabled:opacity-50 active:scale-[0.98]"
                    >
                      {isOperating ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                      彻底删除
                    </button>
                  </Tooltip>
                </div>
              </div>
            );
          })}

          {/* 分页 */}
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </div>
      )}
    </div>
  );
}

