'use client';

import Link from 'next/link';
import { Inbox, Loader2, Upload } from 'lucide-react';

export function ReportLoadingState() {
  return (
    <div className="animate-macos-fade-in flex min-h-[200px] flex-col items-center justify-center rounded-2xl glass-card py-12">
      <div className="relative">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <div className="absolute inset-0 h-8 w-8 animate-ping rounded-full bg-primary/20" />
      </div>
      <p className="mt-4 text-[14px] font-medium text-muted-foreground">正在加载报告...</p>
    </div>
  );
}

export function ReportErrorState({ message }: { message: string }) {
  return (
    <div className="animate-macos-fade-in rounded-2xl border border-destructive/30 bg-destructive/10 p-5 text-[14px] text-destructive shadow-sm backdrop-blur-sm">
      <div className="flex items-center gap-2">
        <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-destructive" />
        {message}
      </div>
    </div>
  );
}

export function ReportEmptyState() {
  return (
    <div className="animate-macos-fade-in flex min-h-[240px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-muted/30 px-6 py-12 text-center">
      <div className="mb-6 rounded-2xl bg-card p-6 shadow-sm backdrop-blur-sm">
        <Inbox className="h-16 w-16 text-muted-foreground/60" />
      </div>
      <p className="text-lg font-semibold text-foreground">暂无报告</p>
      <p className="mt-2 max-w-md text-[14px] leading-relaxed text-muted-foreground">
        当前筛选条件下还没有可展示的内容，可以先上传一份测试报告开始使用。
      </p>
      <Link
        href="/upload"
        className="mt-6 inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-[14px] font-semibold text-primary-foreground shadow-sm shadow-primary/25 transition-all duration-200 hover:brightness-110 hover:shadow-md active:scale-[0.98]"
      >
        <Upload className="h-4 w-4" />
        上传报告
      </Link>
    </div>
  );
}
