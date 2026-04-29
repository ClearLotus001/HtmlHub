'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, type ReportDto } from '@/lib/api';
import { formatBytes, formatTime } from '@/lib/utils';
import {
  ArrowLeft,
  Download,
  ExternalLink,
  Loader2,
  AlertCircle,
  Maximize2,
} from 'lucide-react';

interface Props {
  params: Promise<{ id: string }>;
}

// 报告详情页 + iframe 沙箱预览
export default function ReportDetailPage({ params }: Props) {
  const router = useRouter();
  const resolvedParams = use(params); // Next.js 15+: 解包 async params
  const id = resolvedParams.id;
  
  const [report, setReport] = useState<ReportDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    api
      .get(id)
      .then(setReport)
      .catch((e) => setError(e.message));
  }, [id]);

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
      <div className="container py-20 flex items-center justify-center">
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
            className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            返回列表
          </Link>
          <div className="mt-4 flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-[22px] font-bold truncate text-foreground">{report.title}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground">
                <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-accent text-accent-foreground ring-1 ring-primary/20">
                  {report.project}
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-accent text-accent-foreground ring-1 ring-primary/20">
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
            <div className="flex items-center gap-2 shrink-0">
              <a
                href={report.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-secondary text-[12px] font-medium text-secondary-foreground hover:bg-secondary/80 transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                新标签
              </a>
              <a
                href={api.downloadUrl(report.id)}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-secondary text-[12px] font-medium text-secondary-foreground hover:bg-secondary/80 transition-colors"
              >
                <Download className="h-3.5 w-3.5" />
                下载
              </a>
              <button
                type="button"
                onClick={() => setFullscreen(true)}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-primary text-[12px] font-semibold text-primary-foreground shadow-sm shadow-primary/25 transition-all duration-200 hover:brightness-110 active:scale-[0.98]"
              >
                <Maximize2 className="h-3.5 w-3.5" />
                全屏
              </button>
            </div>
          </div>
        </div>
      )}

      {fullscreen && (
        <div className="animate-macos-scale-in absolute top-4 right-4 z-10 flex gap-2">
          <button
            type="button"
            onClick={() => setFullscreen(false)}
            className="h-8 px-4 rounded-lg bg-card text-[12px] font-medium text-card-foreground shadow-lg ring-1 ring-border backdrop-blur-md transition-all hover:bg-card/90 active:scale-[0.98]"
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
              ? 'w-full h-full border-0'
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
