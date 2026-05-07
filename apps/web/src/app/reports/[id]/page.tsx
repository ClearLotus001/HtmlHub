'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, type PageDto } from '@/lib/api';
import { formatBytes, formatTime } from '@/lib/utils';
import {
  ArrowLeft,
  Download,
  ExternalLink,
  Loader2,
  AlertCircle,
  Maximize2,
  Link2,
  Folders,
} from 'lucide-react';
import { useToast } from '@/components/ui/Toast';

interface Props {
  params: Promise<{ id: string }>;
}

async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  document.execCommand('copy');
  textarea.remove();
}

// 报告详情页 + iframe 沙箱预览
export default function ReportDetailPage({ params }: Props) {
  const router = useRouter();
  const { addToast } = useToast();
  const resolvedParams = use(params); // Next.js 15+: 解包 async params
  const id = resolvedParams.id;

  const [report, setReport] = useState<PageDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    api
      .get(id)
      .then(setReport)
      .catch((e) => setError(e.message));
  }, [id]);

  const copyShareLink = async () => {
    if (!report) return;
    try {
      const url = new URL(report.share_url || api.shareUrl(report.id), window.location.origin).toString();
      await copyText(url);
      addToast({
        type: 'success',
        title: '分享链接已复制',
        message: '对方打开后将看到全屏静态展示页。',
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : '复制失败';
      addToast({ type: 'error', title: '复制失败', message });
    }
  };

  if (error) {
    return (
      <div className="container py-20">
        <div className="glass-card rounded-2xl border-destructive/30 p-5 text-destructive shadow-sm">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            <span>{error}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => router.push('/')}
          className="mt-4 text-[14px] text-primary hover:underline"
        >
          返回列表
        </button>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="container flex items-center justify-center py-20">
        <div className="glass-card rounded-2xl px-8 py-12">
          <div className="flex items-center gap-3 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-[14px]">加载中...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={fullscreen ? 'fixed inset-0 z-50 bg-background' : 'container py-6 md:py-8'}>
      {/* 顶部信息栏 - macOS 玻璃态 */}
      {!fullscreen && (
        <div className="animate-macos-slide-down mb-5">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            返回列表
          </Link>
          <div className="mt-4 flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-[22px] font-bold text-foreground">{report.title}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground">
                <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-primary ring-1 ring-primary/15">
                  <Folders className="h-3 w-3" />
                  {report.category_name}
                </span>
                <span className="inline-flex items-center rounded-md bg-accent px-2 py-0.5 text-accent-foreground ring-1 ring-primary/20">
                  {report.project}
                </span>
                <span className="inline-flex items-center rounded-md bg-accent px-2 py-0.5 text-accent-foreground ring-1 ring-primary/20">
                  {report.iteration}
                </span>
                {report.version && <span>v{report.version}</span>}
                {report.author && <span>作者：{report.author}</span>}
                <span>{formatTime(report.uploaded_at)}</span>
                <span>
                  {formatBytes(report.size_bytes)} · {report.file_count} 文件
                </span>
              </div>
              {report.summary && (
                <p className="mt-2.5 text-[13px] leading-relaxed text-muted-foreground">
                  {report.summary}
                </p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => void copyShareLink()}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary/10 px-3 text-[12px] font-semibold text-primary transition-all duration-200 hover:bg-primary hover:text-primary-foreground active:scale-[0.98]"
              >
                <Link2 className="h-3.5 w-3.5" />
                复制分享链接
              </button>
              <a
                href={report.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-secondary px-3 text-[12px] font-medium text-secondary-foreground transition-colors hover:bg-secondary/80"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                新标签
              </a>
              <a
                href={api.downloadUrl(report.id)}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-secondary px-3 text-[12px] font-medium text-secondary-foreground transition-colors hover:bg-secondary/80"
              >
                <Download className="h-3.5 w-3.5" />
                下载
              </a>
              <button
                type="button"
                onClick={() => setFullscreen(true)}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-[12px] font-semibold text-primary-foreground shadow-sm shadow-primary/25 transition-all duration-200 hover:brightness-110 active:scale-[0.98]"
              >
                <Maximize2 className="h-3.5 w-3.5" />
                全屏
              </button>
            </div>
          </div>
        </div>
      )}

      {fullscreen && (
        <div className="animate-macos-scale-in absolute right-4 top-4 z-10 flex gap-2">
          <button
            type="button"
            onClick={() => setFullscreen(false)}
            className="h-8 rounded-lg bg-card px-4 text-[12px] font-medium text-card-foreground shadow-lg ring-1 ring-border backdrop-blur-md transition-all hover:bg-card/90 active:scale-[0.98]"
          >
            退出全屏
          </button>
        </div>
      )}

      {/* iframe 预览：严格沙箱，保证安全隔离 - macOS 风格 */}
      <div className={fullscreen ? 'h-screen' : 'animate-macos-fade-in'}>
        <iframe
          src={report.url}
          title={report.title}
          className={
            fullscreen
              ? 'h-full w-full border-0'
              : 'w-full rounded-xl border border-border bg-card shadow-sm'
          }
          style={fullscreen ? { height: '100vh' } : { height: 'calc(100vh - 280px)', minHeight: 600 }}
          sandbox="allow-scripts"
          referrerPolicy="no-referrer"
        />
      </div>
    </div>
  );
}
