﻿'use client';

import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, type CategoryDto, type UploadOverrides } from '@/lib/api';
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
  FolderPlus,
  Folders,
} from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';

// 上传页：拖拽或选择 zip / html
export default function UploadPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const { addToast } = useToast();

  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(true);
  const [showSpec, setShowSpec] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [creatingCategory, setCreatingCategory] = useState(false);

  // 覆盖字段（宽松模式下用户可补齐）
  const [overrides, setOverrides] = useState<UploadOverrides>({ category: 'default' });

  const loadCategories = useCallback(async () => {
    try {
      setCategoriesLoading(true);
      const result = await api.categories();
      setCategories(result);
      setOverrides((prev) => ({
        ...prev,
        category: prev.category && result.some((item) => item.slug === prev.category)
          ? prev.category
          : (result.find((item) => item.slug === 'default')?.slug || result[0]?.slug || 'default'),
      }));
    } catch (e) {
      const message = e instanceof Error ? e.message : '加载分类失败';
      setError(message);
    } finally {
      setCategoriesLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

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
    setOverrides((prev) => ({ category: prev.category || 'default' }));
    setError(null);
    setSuccess(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const submitNewCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) {
      addToast({ type: 'warning', title: '请输入分类名称', message: '分类名称不能为空。' });
      return;
    }

    try {
      setCreatingCategory(true);
      const created = await api.createCategory(name);
      setOverrides((prev) => ({ ...prev, category: created.slug }));
      setCreateDialogOpen(false);
      setNewCategoryName('');
      addToast({ type: 'success', title: '分类已创建', message: `已切换到"${created.name}"分类。` });
      // 后台刷新分类列表，不阻塞 UI 反馈
      loadCategories().catch(() => {/* ignore */});
    } catch (e) {
      const message = e instanceof Error ? e.message : '创建分类失败';
      addToast({ type: 'error', title: '创建失败', message });
    } finally {
      setCreatingCategory(false);
    }
  };

  const isHtml = file ? /\.html?$/i.test(file.name) : false;
  const isZip = file ? /\.zip$/i.test(file.name) : false;
  const selectedCategory = categories.find((item) => item.slug === overrides.category);
  const destinationPreview = [
    selectedCategory?.slug || overrides.category || 'default',
    overrides.project || 'project',
    overrides.iteration || 'YYYY-MM',
    overrides.id || 'report-id',
  ].join('/');

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/20">
      {/* 装饰性背景元素 - macOS 风格 */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute right-20 top-20 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute bottom-20 left-20 h-96 w-96 rounded-full bg-accent/20 blur-3xl" />
      </div>

      <div className="relative container mx-auto max-w-4xl px-6 py-10 md:py-12">
        {/* 顶部导航 */}
        <Link
          href="/"
          className="group inline-flex items-center gap-2 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-1" />
          返回报告列表
        </Link>

        {/* 标题区域 - macOS 风格 */}
        <div className="mb-10 mt-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-xl bg-gradient-to-br from-primary to-primary/85 p-2.5 shadow-md shadow-primary/20">
              <FileUp className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-[28px] font-bold text-foreground">
                上传 AI 报告
              </h1>
              <p className="mt-1.5 text-[14px] leading-relaxed text-muted-foreground">
                支持 <code className="rounded bg-secondary px-1.5 py-0.5 text-[13px] font-mono text-primary">.zip</code>{' '}
                （推荐带 manifest.json）或单个{' '}
                <code className="rounded bg-secondary px-1.5 py-0.5 text-[13px] font-mono text-primary">.html</code>{' '}
                文件。现在可以直接指定上传到某个分类目录。
              </p>
            </div>
          </div>
        </div>

        {/* 主内容区 - 不对称布局 */}
        <div className="grid items-start gap-8 lg:grid-cols-[1fr,380px]">
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
              <div className="absolute inset-0 opacity-[0.015] transition-opacity group-hover:opacity-[0.03]">
                <div className="h-full w-full" style={{
                  backgroundImage: 'linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)',
                  backgroundSize: '40px 40px',
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
                    <div className="mb-6 inline-flex rounded-2xl bg-green-500/10 p-4">
                      {isZip ? (
                        <FileArchive className="h-12 w-12 text-green-600 dark:text-green-400" />
                      ) : (
                        <FileCode2 className="h-12 w-12 text-green-600 dark:text-green-400" />
                      )}
                    </div>
                    <h3 className="mb-2 text-lg font-semibold text-foreground">{file.name}</h3>
                    <p className="mb-4 text-sm text-muted-foreground">{formatBytes(file.size)}</p>
                    <div className="flex items-center justify-center gap-3">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); clearFile(); }}
                        className="inline-flex items-center gap-2 rounded-xl bg-secondary px-4 py-2 text-sm text-secondary-foreground transition-colors hover:bg-secondary/80 hover:text-foreground"
                      >
                        <X className="h-4 w-4" />
                        更换文件
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="mb-6 inline-flex rounded-2xl bg-primary/10 p-4 transition-transform duration-500 group-hover:scale-110">
                      <Upload className="h-12 w-12 text-primary" />
                    </div>
                    <div>
                      <p className="mb-1 text-lg font-semibold text-foreground">
                        拖拽文件到此处
                      </p>
                      <p className="text-sm text-muted-foreground">
                        或 <span className="font-medium text-primary">点击选择文件</span>
                      </p>
                    </div>
                    <div className="flex items-center justify-center gap-6 pt-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                        .zip 最大 200MB
                      </span>
                      <span className="flex items-center gap-1.5">
                        <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
                        .html 最大 20MB
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {selectedCategory && (
              <div className="glass-card rounded-2xl p-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
                    <Folders className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-foreground">当前上传分类</p>
                    <p className="mt-1 text-[14px] text-muted-foreground">
                      将上传到 <span className="font-medium text-foreground">{selectedCategory.name}</span> 分类目录
                    </p>
                    <code className="mt-2 inline-flex rounded-lg bg-secondary px-2.5 py-1 text-[12px] text-muted-foreground">
                      /reports/{destinationPreview}
                    </code>
                  </div>
                </div>
              </div>
            )}

            {/* 文件类型提示 - macOS 风格 */}
            {isHtml && (
              <div className="animate-macos-slide-down flex items-start gap-3 rounded-2xl border border-amber-200/80 bg-amber-50/80 p-4 backdrop-blur-sm dark:border-amber-700/50 dark:bg-amber-900/30">
                <Info className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600 dark:text-amber-400" />
                <div className="text-[14px]">
                  <p className="font-semibold text-amber-900 dark:text-amber-200">单 HTML 文件</p>
                  <p className="mt-1 text-amber-700 dark:text-amber-300">
                    服务端将自动封装为标准目录结构。如需指定分类/项目/迭代，请在右侧面板填写元数据。
                  </p>
                </div>
              </div>
            )}

            {/* 消息提示 - macOS 风格 */}
            {error && (
              <div className="animate-shake flex items-center gap-3 rounded-2xl border border-red-200/80 bg-red-50/80 p-4 backdrop-blur-sm dark:border-red-700/50 dark:bg-red-900/30">
                <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-600 dark:text-red-400" />
                <p className="text-[14px] text-red-800 dark:text-red-300">{error}</p>
              </div>
            )}
            {success && (
              <div className="animate-macos-fade-in flex items-center gap-3 rounded-2xl border border-green-200/80 bg-green-50/80 p-4 backdrop-blur-sm dark:border-green-700/50 dark:bg-green-900/30">
                <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-green-600 dark:text-green-400" />
                <p className="text-[14px] text-green-800 dark:text-green-300">{success}</p>
              </div>
            )}
          </div>

          {/* 右侧：元数据和规范 - macOS 玻璃态 */}
          <div className="space-y-6">
            {/* 元数据面板 */}
            <div className="animate-macos-slide-down glass-card overflow-hidden rounded-2xl">
              <div className="border-b border-border p-6">
                <button
                  type="button"
                  onClick={() => setShowAdvanced((v) => !v)}
                  className="group flex w-full items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <Settings2 className="h-5 w-5 text-muted-foreground transition-colors group-hover:text-primary" />
                    <span className="font-semibold text-foreground">补充元数据</span>
                    <span className="text-xs font-normal text-muted-foreground">(可选)</span>
                  </div>
                  <div className={`transition-transform duration-300 ${showAdvanced ? 'rotate-180' : ''}`}>
                    <svg className="h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>
              </div>

              {showAdvanced && (
                <div className="animate-macos-slide-down space-y-4 p-6">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-foreground">分类目录</span>
                      <button
                        type="button"
                        onClick={() => setCreateDialogOpen(true)}
                        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-primary transition-colors hover:bg-primary/10"
                      >
                        <FolderPlus className="h-3.5 w-3.5" />
                        新建分类
                      </button>
                    </div>
                    <Select
                      value={overrides.category || 'default'}
                      options={categories.map((cat) => ({
                        value: cat.slug,
                        label: `${cat.name}（${cat.report_count}）`,
                      }))}
                      onChange={(v) => setOverrides({ ...overrides, category: v })}
                      placeholder="选择分类"
                      loading={categoriesLoading}
                      className="w-full"
                    />
                    <p className="text-[11px] text-muted-foreground">上传后的静态文件会归档到所选分类目录中。</p>
                  </div>

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
            <div className="animate-macos-slide-down glass-card overflow-hidden rounded-2xl">
              <div className="border-b border-border p-6">
                <button
                  type="button"
                  onClick={() => setShowSpec((v) => !v)}
                  className="group flex w-full items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <HelpCircle className="h-5 w-5 text-muted-foreground transition-colors group-hover:text-primary" />
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
                <div className="animate-macos-slide-down space-y-6 p-6 text-[14px]">
                  <div>
                    <h4 className="mb-3 flex items-center gap-2 font-semibold text-foreground">
                      <div className="h-4 w-1 rounded-full bg-primary" />
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
                          <div key={i} className="flex items-start gap-3 rounded-xl bg-muted/50 p-3 transition-colors hover:bg-muted">
                            <Icon className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                            <div>
                              <p className="font-medium text-foreground">{item.title}</p>
                              <p className="mt-0.5 text-xs text-muted-foreground">{item.desc}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <h4 className="mb-3 flex items-center gap-2 font-semibold text-foreground">
                      <div className="h-4 w-1 rounded-full bg-green-500" />
                      ZIP 目录结构
                    </h4>
                    <pre className="overflow-x-auto rounded-xl border border-border bg-secondary/80 p-4 font-mono text-xs text-foreground">
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
                    <h4 className="mb-3 flex items-center gap-2 font-semibold text-foreground">
                      <div className="h-4 w-1 rounded-full bg-amber-500" />
                      资源引用规则
                    </h4>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                        <CheckCircle className="h-4 w-4 flex-shrink-0" />
                        <span>使用 <code className="rounded bg-green-500/15 px-1">相对路径</code> 引用资源</span>
                      </div>
                      <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                        <CheckCircle className="h-4 w-4 flex-shrink-0" />
                        <span>示例：<code className="rounded bg-green-500/15 px-1">assets/images/chart.png</code></span>
                      </div>
                      <div className="flex items-center gap-2 text-destructive">
                        <XCircle className="h-4 w-4 flex-shrink-0" />
                        <span>禁止引用外部 CDN 或绝对路径</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="mb-3 flex items-center gap-2 font-semibold text-foreground">
                      <div className="h-4 w-1 rounded-full bg-purple-500" />
                      文件大小限制
                    </h4>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { label: 'ZIP 文件', value: '200 MB' },
                        { label: '解压后', value: '500 MB' },
                        { label: '单 HTML', value: '20 MB' },
                        { label: '文件数量', value: '5000 个' },
                      ].map((item, i) => (
                        <div key={i} className="rounded-lg bg-muted/50 p-2.5">
                          <p className="text-xs text-muted-foreground">{item.label}</p>
                          <p className="mt-0.5 text-sm font-semibold text-foreground">{item.value}</p>
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
                <div className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
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
                className="h-9 rounded-lg border border-border px-5 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
              >
                清除
              </button>
            )}
            <button
              type="button"
              onClick={submit}
              disabled={!file || uploading || categoriesLoading}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-6 text-[13px] font-semibold text-primary-foreground shadow-sm shadow-primary/25 transition-all duration-200 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98]"
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

      <Dialog
        open={createDialogOpen}
        onClose={() => {
          if (creatingCategory) return;
          setCreateDialogOpen(false);
        }}
        title="新建分类"
        description="创建后会自动选中该分类，作为本次上传的归档目录。"
        size="sm"
      >
        <div className="space-y-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-foreground">分类名称</span>
            <input
              autoFocus
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void submitNewCategory();
                }
              }}
              placeholder="例如：客户验收 / 版本发布 / 回归测试"
              className="h-10 rounded-xl border border-border bg-card px-3 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
            />
          </label>
          <div className="flex justify-end gap-2.5">
            <button
              type="button"
              disabled={creatingCategory}
              onClick={() => setCreateDialogOpen(false)}
              className="inline-flex h-9 items-center justify-center rounded-xl border border-border px-4 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground disabled:opacity-50"
            >
              取消
            </button>
            <button
              type="button"
              disabled={creatingCategory}
              onClick={() => void submitNewCategory()}
              className="inline-flex h-9 items-center justify-center rounded-xl bg-primary px-5 text-[13px] font-semibold text-primary-foreground shadow-sm transition-all hover:brightness-110 active:scale-[0.97] disabled:opacity-50"
            >
              {creatingCategory ? '创建中...' : '创建并使用'}
            </button>
          </div>
        </div>
      </Dialog>
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
    <label className="group flex flex-col gap-1.5">
      <span className="flex items-center justify-between text-xs font-medium text-foreground">
        {label}
        {hint && <span className="text-[11px] font-normal text-muted-foreground">{hint}</span>}
      </span>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
          className="resize-none rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground outline-none transition-all duration-200 placeholder:text-muted-foreground focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="h-10 rounded-xl border border-border bg-card px-3 text-sm text-foreground outline-none transition-all duration-200 placeholder:text-muted-foreground focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
        />
      )}
    </label>
  );
}
