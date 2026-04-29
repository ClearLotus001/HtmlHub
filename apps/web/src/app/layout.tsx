﻿import type { Metadata } from 'next';
import './globals.css';
import Link from 'next/link';
import { FileText, Upload, Trash2, FileCode2, Archive } from 'lucide-react';
import { ThemeProvider, ThemeToggle } from '@/components/ThemeProvider';
import { DialogProvider } from '@/components/ui/Dialog';
import { ToastProvider } from '@/components/ui/Toast';

export const metadata: Metadata = {
  title: 'HtmlHub',
  description: 'HTML 报告集中展示与管理平台',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" data-scroll-behavior="smooth" suppressHydrationWarning>
      <body className="antialiased">
        <ThemeProvider>
          <ToastProvider>
            <DialogProvider>
              <div className="flex min-h-screen flex-col bg-background">
            {/* macOS 玻璃态顶部导航栏 */}
            <header className="sticky top-0 z-50 border-b border-border bg-card/70 shadow-sm shadow-foreground/5 backdrop-blur-2xl backdrop-saturate-200">
              <div className="container flex h-14 items-center gap-6">
                {/* Logo 区域 */}
                <Link href="/" className="group flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/85 shadow-md shadow-primary/20 transition-transform duration-300 group-hover:scale-105">
                    <FileText className="h-4 w-4 text-primary-foreground" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[13px] font-semibold leading-tight text-foreground">
                      HtmlHub
                    </span>
                    <span className="text-[10px] leading-tight text-muted-foreground">
                      报告管理平台
                    </span>
                  </div>
                </Link>

                {/* 导航菜单 - macOS 风格 */}
                <nav className="ml-8 hidden items-center gap-0.5 md:flex">
                  {[
                    { href: '/', label: '报告列表', icon: FileText },
                    { href: '/upload', label: '上传报告', icon: Upload },
                    { href: '/admin/cleanup', label: '清理管理', icon: Trash2 },
                    { href: '/admin/trash', label: '回收站', icon: Archive },
                    { href: '/api-docs', label: 'API 文档', icon: FileCode2 },
                  ].map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="relative inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium text-muted-foreground transition-all duration-200 hover:bg-foreground/5 hover:text-foreground"
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {item.label}
                      </Link>
                    );
                  })}
                </nav>

                {/* 右侧操作区 */}
                <div className="ml-auto flex items-center gap-2">
                  {/* 主题切换按钮 */}
                  <ThemeToggle />

                  {/* 上传按钮 - macOS 风格 */}
                  <Link
                    href="/upload"
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-4 text-[13px] font-semibold text-primary-foreground shadow-sm shadow-primary/25 transition-all duration-200 hover:brightness-110 hover:shadow-md hover:shadow-primary/30 active:scale-[0.98]"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">上传</span>
                  </Link>
                </div>
              </div>
            </header>

            {/* 主内容区 */}
            <main className="flex-1">{children}</main>
          </div>
            </DialogProvider>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
