'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { Clock, Copy, Check, Download, Eye, Folders, HardDrive, Pencil, Tag, Trash2 } from 'lucide-react';
import type { PageDto } from '@/lib/api';
import { api } from '@/lib/api';
import { formatBytes, formatTime } from '@/lib/utils';
import { Dialog } from '@/components/ui/Dialog';
import { Tooltip } from '@/components/ui/Tooltip';
import { useToast } from '@/components/ui/Toast';

interface ReportCardProps {
  report: PageDto;
  selected?: boolean;
  /** 是否有任意项被选中（用于控制勾选框始终显示） */
  hasSelection?: boolean;
  onToggleSelect?: (id: string) => void;
  onRename?: (id: string, title: string) => Promise<unknown>;
  onDelete: (id: string) => void;
  onDragStart?: (event: React.DragEvent) => void;
}

export function ReportCard({ report, selected, hasSelection, onToggleSelect, onRename, onDelete, onDragStart }: ReportCardProps) {
  const { addToast } = useToast();
  const [copied, setCopied] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameTitle, setRenameTitle] = useState(report.title);
  const [renaming, setRenaming] = useState(false);

  const checkboxAlwaysVisible = selected || hasSelection;

  const handleCopyShare = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      const shareUrl = `${window.location.origin}${api.shareUrl(report.id)}`;
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
      const textarea = document.createElement('textarea');
      textarea.value = `${window.location.origin}${api.shareUrl(report.id)}`;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [report.id]);

  const submitRename = useCallback(async () => {
    if (!onRename) return;
    const title = renameTitle.trim().replace(/\s+/g, ' ');
    if (!title) {
      addToast({ type: 'warning', title: '标题不能为空', message: '请输入新的报告标题。' });
      return;
    }

    try {
      setRenaming(true);
      await onRename(report.id, title);
      addToast({ type: 'success', title: '报告已重命名', message: `已重命名为"${title}"` });
      setRenameOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : '重命名报告失败';
      addToast({ type: 'error', title: '重命名失败', message });
    } finally {
      setRenaming(false);
    }
  }, [addToast, onRename, renameTitle, report.id]);

  return (
    <>
      <div
        draggable={Boolean(onDragStart)}
      onDragStart={onDragStart}
      className={`glass-card group relative flex h-full flex-col overflow-hidden transition-all duration-200 hover:shadow-lg hover:shadow-primary/5 ${onDragStart ? 'cursor-grab active:cursor-grabbing' : ''} ${selected ? 'ring-2 ring-primary shadow-lg shadow-primary/10' : ''}`}
    >
      {/* 勾选框 */}
      {onToggleSelect && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onToggleSelect(report.id); }}
          className={`absolute right-2.5 top-2.5 z-10 flex h-5 w-5 items-center justify-center rounded-md border-2 transition-all duration-200 ${
            selected
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-border bg-card/80 hover:border-primary/50'
          } ${checkboxAlwaysVisible ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
          aria-label={selected ? '取消选择' : '选择'}
        >
          {selected && (
            <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none">
              <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>
      )}

      <div className="flex flex-1 flex-col p-4">
        {/* 顶部：分类标签 */}
        <div className="mb-2.5 flex items-center pr-6">
          <span className="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary ring-1 ring-primary/15">
            <Folders className="h-3 w-3" />
            {report.category_name}
          </span>
        </div>

        {/* 标题 */}
        <h3 className="line-clamp-2 min-h-[2.5rem] text-[14px] font-semibold leading-5 text-foreground group-hover:text-primary transition-colors duration-200">
          {report.title}
        </h3>

        {/* 摘要 */}
        {report.summary && (
          <p className="line-clamp-2 mt-1.5 text-[12px] leading-5 text-muted-foreground">
            {report.summary}
          </p>
        )}

        {/* 标签 */}
        {report.tags.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1">
            {report.tags.slice(0, 4).map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-0.5 rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-medium text-accent-foreground"
              >
                <Tag className="h-2.5 w-2.5" />
                {tag}
              </span>
            ))}
            {report.tags.length > 4 && (
              <span className="rounded-full bg-accent px-1.5 py-0.5 text-[10px] text-muted-foreground">
                +{report.tags.length - 4}
              </span>
            )}
          </div>
        )}

        {/* 元信息 */}
        <div className="mt-auto pt-3">
          <div className="flex items-center gap-3 border-t border-border/50 pt-3 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatTime(report.uploaded_at)}
            </span>
            <span className="inline-flex items-center gap-1">
              <HardDrive className="h-3 w-3" />
              {formatBytes(report.size_bytes)}
            </span>
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="mt-3 flex items-center gap-1.5">
          <Link
            href={`/reports/${report.id}`}
            className="inline-flex h-8 flex-1 items-center justify-center gap-1 rounded-lg bg-primary/10 text-[12px] font-semibold text-primary transition-all duration-200 hover:bg-primary hover:text-primary-foreground active:scale-[0.98]"
          >
            <Eye className="h-3 w-3" />
            预览
          </Link>
          <Tooltip content="复制分享链接" side="bottom">
            <button
              type="button"
              onClick={handleCopyShare}
              className={`inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg transition-all duration-200 ${
                copied
                  ? 'bg-green-500/10 text-green-600'
                  : 'bg-secondary text-secondary-foreground hover:bg-primary/10 hover:text-primary'
              }`}
              aria-label="复制分享链接"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          </Tooltip>
          <Tooltip content="下载" side="bottom">
            <a
              href={api.downloadUrl(report.id)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-secondary text-secondary-foreground transition-all duration-200 hover:bg-primary/10 hover:text-primary"
              aria-label={`下载报告 ${report.title}`}
            >
              <Download className="h-3.5 w-3.5" />
            </a>
          </Tooltip>
          {onRename && (
            <Tooltip content="重命名" side="bottom">
              <button
                type="button"
                onClick={() => {
                  setRenameTitle(report.title);
                  setRenameOpen(true);
                }}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-secondary text-secondary-foreground transition-all duration-200 hover:bg-primary/10 hover:text-primary"
                aria-label={`重命名报告 ${report.title}`}
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            </Tooltip>
          )}
          <Tooltip content="删除" side="bottom">
            <button
              type="button"
              onClick={() => onDelete(report.id)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-secondary text-secondary-foreground transition-all duration-200 hover:bg-destructive/10 hover:text-destructive"
              aria-label={`删除报告 ${report.title}`}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </Tooltip>
        </div>
      </div>
    </div>

      <Dialog
        open={renameOpen}
        onClose={() => {
          if (renaming) return;
          setRenameOpen(false);
        }}
        title="重命名报告"
        description="修改报告在列表和导航中的显示标题，不会改变报告 ID 或访问链接。"
        size="sm"
      >
        <div className="space-y-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-foreground">报告标题</span>
            <input
              autoFocus
              value={renameTitle}
              onChange={(e) => setRenameTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void submitRename();
                }
              }}
              className="h-10 rounded-xl border border-border bg-card px-3 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
            />
          </label>
          <div className="flex justify-end gap-2.5">
            <button
              type="button"
              disabled={renaming}
              onClick={() => setRenameOpen(false)}
              className="inline-flex h-9 cursor-pointer items-center justify-center rounded-xl border border-border px-4 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground disabled:opacity-50"
            >
              取消
            </button>
            <button
              type="button"
              disabled={renaming}
              onClick={() => void submitRename()}
              className="inline-flex h-9 cursor-pointer items-center justify-center rounded-xl bg-primary px-5 text-[13px] font-semibold text-primary-foreground shadow-sm transition-all hover:brightness-110 active:scale-[0.97] disabled:opacity-50"
            >
              {renaming ? '保存中...' : '保存'}
            </button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
