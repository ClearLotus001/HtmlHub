﻿'use client';

import { useRef, useState, type DragEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, type UploadOverrides } from '@/lib/api';
import { formatBytes } from '@/lib/utils';
import {
  ArrowLeft,
  Upload,
  FileArchive,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Settings2,
  HelpCircle,
  CheckCircle,
  XCircle,
  FileUp,
  X,
  FileCode2,
  Info,
} from 'lucide-react';

// 上传页：拖拽或选择 zip / html
export default function UploadPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showSpec, setShowSpec] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  // 覆盖字段（宽松模式下用户可补齐）
  const [overrides, setOverrides] = useState<UploadOverrides>({});

  const onPick = (f: File | null) => {
    setError(null);
    setSuccess(null);
    if (!f) {
      setFile(null);
      return;
    }
    if (!/\.(zip|html?)$/i.test(f.name)) {
      setError('仅支持 .zip 或 .html 文件');
      setFile(null);
      return;
    }
    setFile(f);
    setIsAnimating(true);
    setTimeout(() => setIsAnimating(false), 500);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) onPick(f);
  };

  const submit = async () => {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const dto = await api.upload(file, overrides);
      setSuccess(`上传成功：${dto.title}`);
      setTimeout(() => router.push(`/reports/${dto.id}`), 800);
    } catch (e: any) {
      setError(e.message || '上传失败');
    } finally {
      setUploading(false);
    }
  };

  const clearFile = () => {
    setFile(null);
    setOverrides({});
    setError(null);
    setSuccess(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const isHtml = file ? /\.html?$/i.test(file.name) : false;
  const isZip = file ? /\.zip$/i.test(file.name) : false;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/20">
      {/* 装饰性背景元素 - macOS 风格 */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-20 right-20 w-72 h-72 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-20 left-20 w-96 h-96 bg-accent/20 rounded-full blur-3xl" />
      </div>

      <div className="relative container max-w-4xl mx-auto px-6 py-10 md:py-12">
        {/* 顶部导航 */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-[13px] text-muted-foreground hover:text-foreground transition-colors group"
        >
          <ArrowLeft className="h-3.5 w-3.5 group-hover:-translate-x-1 transition-transform" />
          返回报告列表
        </Link>

        {/* 标题区域 - macOS 风格 */}
        <div className="mt-6 mb-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 bg-gradient-to-br from-primary to-primary/85 rounded-xl shadow-md shadow-primary/20">
              <FileUp className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-[28px] font-bold text-foreground">
                上传 AI 报告
              </h1>
              <p className="mt-1.5 text-[14px] text-muted-foreground leading-relaxed">
                支持 <code className="px-1.5 py-0.5 bg-secondary rounded text-[13px] font-mono text-primary">.zip</code>{' '}
                （推荐带 manifest.json）或单个{' '}
                <code className="px-1.5 py-0.5 bg-secondary rounded text-[13px] font-mono text-primary">.html</code>{' '}
                文件。缺失字段系统会自动推断。
              </p>
            </div>
          </div>
        </div>

        {/* 主内容区 - 不对称布局 */}
        <div className="grid lg:grid-cols-[1fr,380px] gap-8 items-start">
          {/* 左侧：上传区域 */}
          <div className="space-y-6">
            {/* 拖拽上传区 - macOS 玻璃态 */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => !file && inputRef.current?.click()}
              className={`
                relative group cursor-pointer overflow-hidden
                glass-card p-12
                transition-all duration-500 ease-out
                ${dragging
                  ? 'border-primary scale-[1.02] shadow-2xl shadow-primary/20'
                  : file
                  ? 'border-green-500/50 bg-green-500/10'
                  : 'hover:border-primary hover:shadow-xl'
                }
              `}
            >
              {/* 装饰性网格背景 */}
              <div className="absolute inset-0 opacity-[0.015] group-hover:opacity-[0.03] transition-opacity">
                <div className="h-full w-full" style={{
                  backgroundImage: 'linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)',
                  backgroundSize: '40px 40px'
                }} />
              </div>

              <input
                ref={inputRef}
                type="file"
                accept=".zip,.html,.htm"
                className="hidden"
                onChange={(e) => onPick(e.target.files?.[0] || null)}
              />

              <div className="relative text-center">
                {file ? (
                  <div className={`transition-all duration-500 ${isAnimating ? 'scale-95 opacity-0' : 'scale-100 opacity-100'}`}>
                    <div className="mb-6 inline-flex p-4 bg-green-500/10 rounded-2xl">
                      {isZip ? (
                        <FileArchive className="h-12 w-12 text-green-600 dark:text-green-400" />
                      ) : (
                        <FileCode2 className="h-12 w-12 text-green-600 dark:text-green-400" />
                      )}
                    </div>
                    <h3 className="text-lg font-semibold text-foreground mb-2">{file.name}</h3>
                    <p className="text-sm text-muted-foreground mb-4">{formatBytes(file.size)}</p>
                    <div className="flex items-center justify-center gap-3">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); clearFile(); }}
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm text-secondary-foreground hover:text-foreground bg-secondary hover:bg-secondary/80 rounded-xl transition-colors"
                      >
                        <X className="h-4 w-4" />
                        更换文件
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="mb-6 inline-flex p-4 bg-primary/10 rounded-2xl group-hover:scale-110 transition-transform duration-500">
                      <Upload className="h-12 w-12 text-primary" />
                    </div>
                    <div>
                      <p className="text-lg font-semibold text-foreground mb-1">
                        拖拽文件到此处
                      </p>
                      <p className="text-sm text-muted-foreground">
                        或 <span className="text-primary font-medium">点击选择文件</span>
                      </p>
                    </div>
                    <div className="pt-4 flex items-center justify-center gap-6 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 bg-primary rounded-full" />
                        .zip 最大 200MB
                      </span>
                      <span className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                        .html 最大 20MB
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 文件类型提示 - macOS 风格 */}
            {isHtml && (
              <div className="animate-macos-slide-down rounded-2xl bg-amber-50/80 border border-amber-200/80 p-4 flex items-start gap-3 backdrop-blur-sm dark:bg-amber-900/30 dark:border-amber-700/50">
                <Info className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5 dark:text-amber-400" />
                <div className="text-[14px]">
                  <p className="font-semibold text-amber-900 dark:text-amber-200">单 HTML 文件</p>
                  <p className="mt-1 text-amber-700 dark:text-amber-300">
                    服务端将自动封装为标准目录结构。如需指定项目/迭代，请在右侧面板填写元数据。
                  </p>
                </div>
              </div>
            )}

            {/* 消息提示 - macOS 风格 */}
            {error && (
              <div className="animate-shake rounded-2xl bg-red-50/80 border border-red-200/80 p-4 flex items-center gap-3 backdrop-blur-sm dark:bg-red-900/30 dark:border-red-700/50">
                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 dark:text-red-400" />
                <p className="text-[14px] text-red-800 dark:text-red-300">{error}</p>
              </div>
            )}
            {success && (
              <div className="animate-macos-fade-in rounded-2xl bg-green-50/80 border border-green-200/80 p-4 flex items-center gap-3 backdrop-blur-sm dark:bg-green-900/30 dark:border-green-700/50">
                <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 dark:text-green-400" />
                <p className="text-[14px] text-green-800 dark:text-green-300">{success}</p>
              </div>
            )}
          </div>

          {/* 右侧：元数据和规范 - macOS 玻璃态 */}
          <div className="space-y-6">
            {/* 元数据面板 */}
            <div className="animate-macos-slide-down glass-card rounded-2xl overflow-hidden">
              <div className="p-6 border-b border-border">
                <button
                  type="button"
                  onClick={() => setShowAdvanced((v) => !v)}
                  className="w-full flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3">
                    <Settings2 className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                    <span className="font-semibold text-foreground">补充元数据</span>
                    <span className="text-xs text-muted-foreground font-normal">(可选)</span>
                  </div>
                  <div className={`transition-transform duration-300 ${showAdvanced ? 'rotate-180' : ''}`}>
                    <svg className="h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>
              </div>

              {showAdvanced && (
                <div className="p-6 space-y-4 animate-macos-slide-down">
                  <Field
                    label="项目 (project)"
                    placeholder="small-case / uncategorized"
                    value={overrides.project || ''}
                    onChange={(v) => setOverrides({ ...overrides, project: v })}
                    hint="小写字母/数字/短横线"
                  />
                  <Field
                    label="迭代 (iteration)"
                    placeholder="v1.0 / 2026-Q1"
                    value={overrides.iteration || ''}
                    onChange={(v) => setOverrides({ ...overrides, iteration: v })}
                    hint="留空使用 YYYY-MM"
                  />
                  <Field
                    label="标题"
                    placeholder="报告标题"
                    value={overrides.title || ''}
                    onChange={(v) => setOverrides({ ...overrides, title: v })}
                    hint="留空自动获取"
                  />
                  <Field
                    label="作者"
                    value={overrides.author || ''}
                    onChange={(v) => setOverrides({ ...overrides, author: v })}
                  />
                  <Field
                    label="版本"
                    placeholder="1.0.0"
                    value={overrides.version || ''}
                    onChange={(v) => setOverrides({ ...overrides, version: v })}
                  />
                  <Field
                    label="标签"
                    placeholder="性能, 评测"
                    value={overrides.tags || ''}
                    onChange={(v) => setOverrides({ ...overrides, tags: v })}
                    hint="逗号分隔"
                  />
                  <Field
                    label="摘要"
                    value={overrides.summary || ''}
                    onChange={(v) => setOverrides({ ...overrides, summary: v })}
                    hint="不超过 500 字"
                    multiline
                  />
                </div>
              )}
            </div>

            {/* 规范提示面板 */}
            <div className="animate-macos-slide-down glass-card rounded-2xl overflow-hidden">
              <div className="p-6 border-b border-border">
                <button
                  type="button"
                  onClick={() => setShowSpec((v) => !v)}
                  className="w-full flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3">
                    <HelpCircle className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                    <span className="font-semibold text-foreground">报告规范</span>
                  </div>
                  <div className={`transition-transform duration-300 ${showSpec ? 'rotate-180' : ''}`}>
                    <svg className="h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>
              </div>

              {showSpec && (
                <div className="p-6 space-y-6 animate-macos-slide-down text-[14px]">
                  <div>
                    <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                      <div className="w-1 h-4 bg-primary rounded-full" />
                      支持的上传格式
                    </h4>
                    <div className="space-y-2">
                      {[
                        { title: '标准 zip', desc: '含完整 manifest.json，字段严格校验（推荐）', icon: CheckCircle2 },
                        { title: '宽松 zip', desc: '缺少 manifest.json，系统自动推断元信息', icon: HelpCircle },
                        { title: '单 HTML', desc: '直接上传 .html 文件（≤ 20MB）', icon: FileCode2 },
                      ].map((item, i) => {
                        const Icon = item.icon;
                        return (
                          <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors">
                            <Icon className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="font-medium text-foreground">{item.title}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                      <div className="w-1 h-4 bg-green-500 rounded-full" />
                      ZIP 目录结构
                    </h4>
                    <pre className="bg-secondary/80 text-foreground border border-border rounded-xl p-4 text-xs overflow-x-auto font-mono">
{`report.zip
├── index.html          # 入口文件
├── manifest.json       # 元信息（可选）
└── assets/             # 资源目录
    ├── css/
    ├── js/
    └── images/`}
                    </pre>
                  </div>

                  <div>
                    <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                      <div className="w-1 h-4 bg-amber-500 rounded-full" />
                      资源引用规则
                    </h4>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                        <CheckCircle className="h-4 w-4 flex-shrink-0" />
                        <span>使用 <code className="bg-green-500/15 px-1 rounded">相对路径</code> 引用资源</span>
                      </div>
                      <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                        <CheckCircle className="h-4 w-4 flex-shrink-0" />
                        <span>示例：<code className="bg-green-500/15 px-1 rounded">assets/images/chart.png</code></span>
                      </div>
                      <div className="flex items-center gap-2 text-destructive">
                        <XCircle className="h-4 w-4 flex-shrink-0" />
                        <span>禁止引用外部 CDN 或绝对路径</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                      <div className="w-1 h-4 bg-purple-500 rounded-full" />
                      文件大小限制
                    </h4>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { label: 'ZIP 文件', value: '200 MB' },
                        { label: '解压后', value: '500 MB' },
                        { label: '单 HTML', value: '20 MB' },
                        { label: '文件数量', value: '5000 个' },
                      ].map((item, i) => (
                        <div key={i} className="p-2.5 bg-muted/50 rounded-lg">
                          <p className="text-xs text-muted-foreground">{item.label}</p>
                          <p className="text-sm font-semibold text-foreground mt-0.5">{item.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 底部操作栏 - macOS 风格 */}
        <div className="mt-10 flex items-center justify-between">
          <div className="text-[13px] text-muted-foreground">
            {file ? (
              <span className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                已选择文件，准备上传
              </span>
            ) : (
              <span>请选择或拖拽文件到上传区域</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {file && (
              <button
                type="button"
                onClick={clearFile}
                disabled={uploading}
                className="h-9 px-5 rounded-lg border border-border text-[13px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50 transition-colors"
              >
                清除
              </button>
            )}
            <button
              type="button"
              onClick={submit}
              disabled={!file || uploading}
              className="h-9 px-6 rounded-lg bg-primary text-[13px] font-semibold text-primary-foreground shadow-sm shadow-primary/25 hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2 transition-all duration-200 active:scale-[0.98]"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  上传中...
                </>
              ) : (
                <>
                  <Upload className="h-3.5 w-3.5" />
                  开始上传
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// 表单字段
function Field({
  label,
  value,
  onChange,
  placeholder,
  hint,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
  multiline?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1.5 group">
      <span className="text-xs font-medium text-foreground flex items-center justify-between">
        {label}
        {hint && <span className="text-[11px] text-muted-foreground font-normal">{hint}</span>}
      </span>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
          className="px-3 py-2 rounded-xl border border-border bg-card text-sm text-foreground outline-none transition-all duration-200 placeholder:text-muted-foreground focus:border-primary/50 focus:ring-2 focus:ring-primary/20 resize-none"
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="h-10 px-3 rounded-xl border border-border bg-card text-sm text-foreground outline-none transition-all duration-200 placeholder:text-muted-foreground focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
        />
      )}
    </label>
  );
}
