'use client';

import Link from 'next/link';
import { Clock, Download, Eye, Folder, HardDrive, Tag, Trash2 } from 'lucide-react';
import type { PageDto } from '@/lib/api';
import { api } from '@/lib/api';
import { formatBytes, formatTime } from '@/lib/utils';
import { Tooltip } from '@/components/ui/Tooltip';

interface ReportCardProps {
  report: PageDto;
  selected?: boolean;
  /** 是否有任意项被选中（用于控制勾选框始终显示） */
  hasSelection?: boolean;
  onToggleSelect?: (id: string) => void;
  onDelete: (id: string) => void;
}

export function ReportCard({ report, selected, hasSelection, onToggleSelect, onDelete }: ReportCardProps) {
  // 勾选框可见条件：已选中 或 有任意选中项 或 鼠标悬停在卡片上（通过 group-hover 实现）
  const checkboxAlwaysVisible = selected || hasSelection;

  return (
    <div className={`glass-card group relative flex h-full flex-col overflow-hidden transition-all duration-200 ${selected ? 'ring-2 ring-primary shadow-lg shadow-primary/10' : ''}`}>
      {/* 勾选框：绝对定位在右上角，不遮挡文字 */}
      {onToggleSelect && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onToggleSelect(report.id); }}
          className={`absolute right-2 top-2 z-10 flex h-5 w-5 items-center justify-center rounded-md border-2 transition-all duration-200 ${
            selected
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-border bg-card hover:border-primary/50'
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
        {/* 项目与迭代标签 - 右侧预留勾选框空间 */}
        <div className="mb-3 flex items-center pr-6">
          <div className="flex flex-1 flex-wrap gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-lg bg-accent px-2 py-0.5 text-[11px] font-semibold text-accent-foreground ring-1 ring-border">
              <Folder className="h-3 w-3 text-primary" />
              {report.project}
            </span>
            <span className="inline-flex items-center gap-1 rounded-lg bg-primary/80 px-2 py-0.5 text-[11px] font-semibold text-primary-foreground">
              <Clock className="h-3 w-3" />
              {report.iteration}
            </span>
          </div>
        </div>

        <h3 className="line-clamp-2 min-h-[2.5rem] text-[14px] font-semibold leading-5 text-foreground">
          {report.title}
        </h3>

        {report.summary && (
          <p className="line-clamp-2 mt-1.5 min-h-[2.5rem] text-[12px] leading-5 text-muted-foreground">
            {report.summary}
          </p>
        )}

        {report.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {report.tags.slice(0, 4).map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[10px] font-medium text-accent-foreground ring-1 ring-primary/20"
              >
                <Tag className="h-2.5 w-2.5" />
                {tag}
              </span>
            ))}
          </div>
        )}

        <div className="mt-3 space-y-1.5 border-t border-border/60 pt-3 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Clock className="h-3 w-3" />
            <span>{formatTime(report.uploaded_at)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <HardDrive className="h-3 w-3" />
            <span>
              {formatBytes(report.size_bytes)} · {report.file_count} 个文件
            </span>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-1.5">
          <Link
            href={`/reports/${report.id}`}
            className="inline-flex h-8 flex-1 items-center justify-center gap-1 rounded-lg bg-primary/10 text-[12px] font-semibold text-primary transition-all duration-200 hover:bg-primary hover:text-primary-foreground active:scale-[0.98]"
          >
            <Eye className="h-3 w-3" />
            预览
          </Link>
          <Tooltip content="下载" side="bottom">
            <a
              href={api.downloadUrl(report.id)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-secondary text-secondary-foreground transition-all duration-200 hover:bg-primary/10 hover:text-primary"
              aria-label={`下载报告 ${report.title}`}
            >
              <Download className="h-3.5 w-3.5" />
            </a>
          </Tooltip>
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
  );
}
