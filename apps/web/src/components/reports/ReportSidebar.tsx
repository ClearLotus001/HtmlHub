'use client';

import Link from 'next/link';
import { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { FileText, Folder, FolderOpen, Folders, GripVertical, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react';
import type { CategoryNode } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Dialog, confirmDialog } from '@/components/ui/Dialog';
import { useToast } from '@/components/ui/Toast';

interface ReportSidebarProps {
  tree: CategoryNode[];
  loading: boolean;
  selectedCategory: string | null;
  selectedProject: string | null;
  selectedIteration: string | null;
  expandedCategories: Set<string>;
  expandedProjects: Set<string>;
  onSelectAll: () => void;
  onSelectCategory: (category: string) => void;
  onSelectProject: (category: string, project: string) => void;
  onCreateCategory: (name: string) => Promise<void>;
  onUpdateCategory?: (slug: string, name: string) => Promise<void>;
  onDeleteCategory?: (slug: string) => Promise<void>;
  onUpdateProject?: (category: string, project: string, newProject: string) => Promise<void>;
  onDeleteProject?: (category: string, project: string) => Promise<void>;
  onMoveProject?: (category: string, project: string, targetCategory: string, targetProject?: string) => Promise<void>;
  onMoveReport?: (id: string, category: string, project: string) => Promise<void>;
  onUpdateReportTitle?: (id: string, title: string) => Promise<void>;
  onDeleteReport?: (id: string) => Promise<void> | void;
}

type DragPayload =
  | { kind: 'project'; category: string; project: string }
  | { kind: 'report'; id: string; category: string; project: string };

const DND_MIME = 'application/x-htmlhub-nav';

function categoryMenuKey(slug: string) {
  return `category::${slug}`;
}

function projectMenuKey(category: string, project: string) {
  return `project::${category}::${project}`;
}

function projectKey(category: string, project: string) {
  return `${category}::${project}`;
}

function categoryDropKey(slug: string) {
  return `drop-category::${slug}`;
}

function projectDropKey(category: string, project: string) {
  return `drop-project::${category}::${project}`;
}

function readDragPayload(event: React.DragEvent): DragPayload | null {
  const raw = event.dataTransfer.getData(DND_MIME) || event.dataTransfer.getData('text/plain');
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as DragPayload;
    if (parsed.kind === 'project' || parsed.kind === 'report') return parsed;
  } catch {
    return null;
  }
  return null;
}

function writeDragPayload(event: React.DragEvent, payload: DragPayload) {
  const raw = JSON.stringify(payload);
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData(DND_MIME, raw);
  event.dataTransfer.setData('text/plain', raw);
}

export function ReportSidebar({
  tree,
  loading,
  selectedCategory,
  selectedProject,
  selectedIteration,
  expandedCategories,
  expandedProjects,
  onSelectAll,
  onSelectCategory,
  onSelectProject,
  onCreateCategory,
  onUpdateCategory,
  onDeleteCategory,
  onUpdateProject,
  onDeleteProject,
  onMoveProject,
  onMoveReport,
  onUpdateReportTitle,
  onDeleteReport,
}: ReportSidebarProps) {
  const { addToast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [categoryName, setCategoryName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);

  const [editingProject, setEditingProject] = useState<{ category: string; project: string } | null>(null);
  const [editProjectName, setEditProjectName] = useState('');
  const editProjectInputRef = useRef<HTMLInputElement>(null);

  const [editingReportId, setEditingReportId] = useState<string | null>(null);
  const [editReportTitle, setEditReportTitle] = useState('');
  const editReportInputRef = useRef<HTMLInputElement>(null);

  const [menuKey, setMenuKey] = useState<string | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const totalReports = useMemo(
    () => tree.reduce((sum, item) => sum + item.report_count, 0),
    [tree],
  );

  useEffect(() => {
    if (!menuKey) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuKey(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuKey]);

  useEffect(() => {
    if (editingSlug && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingSlug]);

  useEffect(() => {
    if (editingProject && editProjectInputRef.current) {
      editProjectInputRef.current.focus();
      editProjectInputRef.current.select();
    }
  }, [editingProject]);

  useEffect(() => {
    if (editingReportId && editReportInputRef.current) {
      editReportInputRef.current.focus();
      editReportInputRef.current.select();
    }
  }, [editingReportId]);

  const submitCategory = async () => {
    const name = categoryName.trim();
    if (!name) {
      addToast({ type: 'warning', title: '请输入分类名称', message: '分类名称不能为空。' });
      return;
    }

    try {
      setSubmitting(true);
      await onCreateCategory(name);
      addToast({ type: 'success', title: '分类已创建', message: `已新增分类"${name}"。` });
      setDialogOpen(false);
      setCategoryName('');
    } catch (error) {
      const message = error instanceof Error ? error.message : '创建分类失败';
      addToast({ type: 'error', title: '创建失败', message });
    } finally {
      setSubmitting(false);
    }
  };

  const startEditing = useCallback((slug: string, currentName: string) => {
    setEditingSlug(slug);
    setEditName(currentName);
    setMenuKey(null);
  }, []);

  const cancelEditing = useCallback(() => {
    setEditingSlug(null);
    setEditName('');
  }, []);

  const submitEdit = useCallback(async () => {
    if (!editingSlug || !onUpdateCategory) return;
    const name = editName.trim();
    if (!name) {
      addToast({ type: 'warning', title: '名称不能为空', message: '请输入新的分类名称。' });
      return;
    }

    try {
      await onUpdateCategory(editingSlug, name);
      addToast({ type: 'success', title: '分类已更新', message: `已重命名为"${name}"` });
      setEditingSlug(null);
      setEditName('');
    } catch (error) {
      const message = error instanceof Error ? error.message : '更新分类失败';
      addToast({ type: 'error', title: '更新失败', message });
    }
  }, [editingSlug, editName, onUpdateCategory, addToast]);

  const handleDelete = useCallback(async (slug: string, name: string) => {
    if (!onDeleteCategory) return;
    setMenuKey(null);

    const ok = await confirmDialog(
      `确定要删除分类"${name}"吗？分类下的报告将迁移到默认分类。`,
      { title: '删除分类确认' },
    );
    if (!ok) return;

    try {
      await onDeleteCategory(slug);
      addToast({ type: 'success', title: '分类已删除', message: '分类下报告已迁移到默认分类。' });
    } catch (error) {
      const message = error instanceof Error ? error.message : '删除分类失败';
      addToast({ type: 'error', title: '删除失败', message });
    }
  }, [onDeleteCategory, addToast]);

  const startProjectEditing = useCallback((category: string, project: string) => {
    setEditingProject({ category, project });
    setEditProjectName(project);
    setMenuKey(null);
  }, []);

  const cancelProjectEditing = useCallback(() => {
    setEditingProject(null);
    setEditProjectName('');
  }, []);

  const submitProjectEdit = useCallback(async () => {
    if (!editingProject || !onUpdateProject) return;
    const newProject = editProjectName.trim().toLowerCase();
    if (!newProject) {
      addToast({ type: 'warning', title: '项目名称不能为空', message: '请输入新的项目目录名称。' });
      return;
    }

    try {
      await onUpdateProject(editingProject.category, editingProject.project, newProject);
      addToast({ type: 'success', title: '项目已重命名', message: `已重命名为"${newProject}"` });
      setEditingProject(null);
      setEditProjectName('');
    } catch (error) {
      const message = error instanceof Error ? error.message : '重命名项目失败';
      addToast({ type: 'error', title: '重命名失败', message });
    }
  }, [editingProject, editProjectName, onUpdateProject, addToast]);

  const handleProjectDelete = useCallback(async (category: string, project: string, count: number) => {
    if (!onDeleteProject) return;
    setMenuKey(null);

    const ok = await confirmDialog(
      `确定要删除项目目录"${project}"吗？该目录下 ${count} 个报告将移入回收站。`,
      { title: '删除项目目录确认' },
    );
    if (!ok) return;

    try {
      await onDeleteProject(category, project);
      addToast({ type: 'success', title: '项目目录已删除', message: '目录下报告已移入回收站。' });
    } catch (error) {
      const message = error instanceof Error ? error.message : '删除项目目录失败';
      addToast({ type: 'error', title: '删除失败', message });
    }
  }, [onDeleteProject, addToast]);

  const showReservedDefaultProjectNotice = useCallback((action: 'rename' | 'delete' | 'move') => {
    setMenuKey(null);
    const titleMap = {
      rename: '默认目录不可重命名',
      delete: '默认目录不可删除',
      move: '默认目录不可移动',
    };
    addToast({
      type: 'warning',
      title: titleMap[action],
      message: '系统保留目录 default/default 受保护，但目录下的报告可以单独重命名、删除或移动。',
    });
  }, [addToast]);

  const startReportEditing = useCallback((id: string, title: string) => {
    setEditingReportId(id);
    setEditReportTitle(title);
  }, []);

  const cancelReportEditing = useCallback(() => {
    setEditingReportId(null);
    setEditReportTitle('');
  }, []);

  const submitReportEdit = useCallback(async () => {
    if (!editingReportId || !onUpdateReportTitle) return;
    const title = editReportTitle.trim().replace(/\s+/g, ' ');
    if (!title) {
      addToast({ type: 'warning', title: '标题不能为空', message: '请输入新的报告标题。' });
      return;
    }

    try {
      await onUpdateReportTitle(editingReportId, title);
      addToast({ type: 'success', title: '报告已重命名', message: `已重命名为"${title}"` });
      setEditingReportId(null);
      setEditReportTitle('');
    } catch (error) {
      const message = error instanceof Error ? error.message : '重命名报告失败';
      addToast({ type: 'error', title: '重命名失败', message });
    }
  }, [editingReportId, editReportTitle, onUpdateReportTitle, addToast]);

  const movePayloadToCategory = useCallback(async (payload: DragPayload, targetCategory: string) => {
    try {
      if (payload.kind === 'project') {
        if (payload.category === 'default' && payload.project === 'default') {
          showReservedDefaultProjectNotice('move');
          return;
        }
        if (!onMoveProject || payload.category === targetCategory) return;
        await onMoveProject(payload.category, payload.project, targetCategory, payload.project);
        addToast({ type: 'success', title: '目录已移动', message: `已移动项目目录 "${payload.project}"。` });
        return;
      }

      if (!onMoveReport || payload.category === targetCategory) return;
      const targetProject = payload.category === 'default' && payload.project === 'default'
        ? targetCategory
        : payload.project;
      await onMoveReport(payload.id, targetCategory, targetProject);
      addToast({ type: 'success', title: '报告已移动', message: `已移动到目标分类下的 "${targetProject}" 项目目录。` });
    } catch (error) {
      const message = error instanceof Error ? error.message : '移动失败';
      addToast({ type: 'error', title: '移动失败', message });
    }
  }, [onMoveProject, onMoveReport, showReservedDefaultProjectNotice, addToast]);

  const movePayloadToProject = useCallback(async (payload: DragPayload, targetCategory: string, targetProject: string) => {
    try {
      if (payload.kind === 'project') {
        if (payload.category === 'default' && payload.project === 'default') {
          showReservedDefaultProjectNotice('move');
          return;
        }
        if (!onMoveProject) return;
        if (payload.category === targetCategory && payload.project === targetProject) return;
        await onMoveProject(payload.category, payload.project, targetCategory, targetProject);
        addToast({ type: 'success', title: '目录已移动', message: `已移动到 "${targetProject}"。` });
        return;
      }

      if (!onMoveReport) return;
      if (payload.category === targetCategory && payload.project === targetProject) return;
      await onMoveReport(payload.id, targetCategory, targetProject);
      addToast({ type: 'success', title: '报告已移动', message: `已移动到项目 "${targetProject}"。` });
    } catch (error) {
      const message = error instanceof Error ? error.message : '移动失败';
      addToast({ type: 'error', title: '移动失败', message });
    }
  }, [onMoveProject, onMoveReport, showReservedDefaultProjectNotice, addToast]);

  const allowDrop = (event: React.DragEvent, key: string) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setDragOverKey(key);
  };

  return (
    <>
      <aside className="animate-macos-fade-in glass-card flex flex-col rounded-2xl p-5 xl:sticky xl:top-[4.5rem] xl:min-h-[calc(100dvh-6rem)] xl:max-h-[calc(100dvh-6rem)] xl:overflow-hidden">
        <div className="mb-4 shrink-0 px-2 py-1.5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              <span className="truncate text-xs font-bold uppercase tracking-wider text-muted-foreground">
                项目导航
              </span>
            </div>
            <button
              type="button"
              onClick={() => setDialogOpen(true)}
              className="inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-white px-2.5 text-[12px] font-medium text-muted-foreground shadow-sm transition-colors hover:border-primary/30 hover:bg-primary/5 hover:text-primary dark:bg-zinc-900"
            >
              <Plus className="h-3.5 w-3.5" />
              <span className="whitespace-nowrap">新建分类</span>
            </button>
          </div>
          <div className="mt-2 truncate rounded-lg bg-muted/60 px-2.5 py-1.5 text-[11px] leading-none text-muted-foreground">
            分类 / 项目 / 报告 · 拖拽移动
          </div>
        </div>

        <button
          type="button"
          onClick={onSelectAll}
          className={cn(
            'flex min-h-10 w-full shrink-0 cursor-pointer items-center gap-2 rounded-xl px-3 text-left text-sm font-medium transition-all duration-200',
            !selectedCategory
              ? 'bg-primary/10 text-primary shadow-sm shadow-primary/10'
              : 'text-muted-foreground hover:bg-accent hover:text-foreground',
          )}
        >
          <Folder className={cn('h-4 w-4 shrink-0', !selectedCategory ? 'text-primary' : 'text-muted-foreground')} />
          <span className="truncate">全部报告</span>
          <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            {totalReports}
          </span>
        </button>

        <div className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto">
          {tree.map((node) => {
            const expanded = expandedCategories.has(node.slug);
            const isCategoryActive = selectedCategory === node.slug && !selectedProject;
            const isEditing = editingSlug === node.slug;
            const isDefault = node.slug === 'default';
            const catDropKey = categoryDropKey(node.slug);

            return (
              <div key={node.slug} className="space-y-1.5">
                <div
                  className={cn(
                    'group/cat relative flex items-center rounded-xl transition-colors',
                    dragOverKey === catDropKey && 'bg-primary/10 ring-1 ring-primary/30',
                  )}
                  onDragOver={(event) => allowDrop(event, catDropKey)}
                  onDragLeave={() => setDragOverKey((current) => (current === catDropKey ? null : current))}
                  onDrop={(event) => {
                    event.preventDefault();
                    setDragOverKey(null);
                    const payload = readDragPayload(event);
                    if (payload) void movePayloadToCategory(payload, node.slug);
                  }}
                >
                  {isEditing ? (
                    <div className="flex min-h-10 w-full items-center gap-2 rounded-xl bg-accent px-3">
                      <Folders className="h-4 w-4 shrink-0 text-primary" />
                      <input
                        ref={editInputRef}
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            void submitEdit();
                          }
                          if (e.key === 'Escape') {
                            cancelEditing();
                          }
                        }}
                        onBlur={() => void submitEdit()}
                        className="h-7 flex-1 rounded-md border border-primary/30 bg-card px-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary/30"
                      />
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => onSelectCategory(node.slug)}
                        className={cn(
                          'flex min-h-10 min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-xl px-3 text-left text-sm font-medium transition-all duration-200',
                          isCategoryActive
                            ? 'bg-primary/10 text-primary shadow-sm shadow-primary/10'
                            : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                        )}
                        aria-expanded={expanded}
                      >
                        {expanded ? (
                          <Folders className="h-4 w-4 shrink-0 text-primary/70" />
                        ) : (
                          <Folders className="h-4 w-4 shrink-0 text-muted-foreground" />
                        )}
                        <span className="truncate">{node.name}</span>
                        <span className="ml-auto shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                          {node.report_count}
                        </span>
                      </button>

                      {!isDefault && (onUpdateCategory || onDeleteCategory) && (
                        <div className="relative shrink-0" ref={menuKey === categoryMenuKey(node.slug) ? menuRef : undefined}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const key = categoryMenuKey(node.slug);
                              setMenuKey(menuKey === key ? null : key);
                            }}
                            className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground/50 opacity-0 transition-all hover:bg-accent hover:text-foreground group-hover/cat:opacity-100"
                            aria-label="分类操作"
                          >
                            <MoreHorizontal className="h-3.5 w-3.5" />
                          </button>

                          {menuKey === categoryMenuKey(node.slug) && (
                            <div className="absolute right-0 top-full z-50 mt-1 w-32 rounded-xl border border-border bg-white p-1 text-foreground shadow-2xl shadow-black/20 ring-1 ring-black/5 animate-in fade-in slide-in-from-top-1 duration-150 dark:bg-zinc-900 dark:shadow-black/50 dark:ring-white/10">
                              {onUpdateCategory && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    startEditing(node.slug, node.name);
                                  }}
                                  className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-[12px] text-foreground transition-colors hover:bg-accent"
                                >
                                  <Pencil className="h-3 w-3" />
                                  重命名
                                </button>
                              )}
                              {onDeleteCategory && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    void handleDelete(node.slug, node.name);
                                  }}
                                  className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-[12px] text-destructive transition-colors hover:bg-destructive/10"
                                >
                                  <Trash2 className="h-3 w-3" />
                                  删除分类
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>

                {expanded && (
                  <div className="ml-4 space-y-1.5 border-l-2 border-primary/10 pl-4">
                    {node.projects.map((projectNode) => {
                      const menuId = projectMenuKey(node.slug, projectNode.project);
                      const dropId = projectDropKey(node.slug, projectNode.project);
                      const expandedProject = expandedProjects.has(projectKey(node.slug, projectNode.project));
                      const isProjectActive = selectedCategory === node.slug && selectedProject === projectNode.project && !selectedIteration;
                      const isProjectEditing = editingProject?.category === node.slug && editingProject.project === projectNode.project;
                      const isReservedDefaultProject = node.slug === 'default' && projectNode.project === 'default';
                      return (
                        <div key={`${node.slug}-${projectNode.project}`} className="space-y-1">
                          <div
                            className={cn(
                              'group/project relative flex items-center rounded-xl transition-colors',
                              dragOverKey === dropId && 'bg-primary/10 ring-1 ring-primary/30',
                            )}
                            draggable={!isProjectEditing && !isReservedDefaultProject}
                            onDragStart={(event) => {
                              if (isReservedDefaultProject) return;
                              writeDragPayload(event, { kind: 'project', category: node.slug, project: projectNode.project });
                            }}
                            onDragEnd={() => setDragOverKey(null)}
                            onDragOver={(event) => {
                              event.stopPropagation();
                              allowDrop(event, dropId);
                            }}
                            onDragLeave={(event) => {
                              event.stopPropagation();
                              setDragOverKey((current) => (current === dropId ? null : current));
                            }}
                            onDrop={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              setDragOverKey(null);
                              const payload = readDragPayload(event);
                              if (payload) void movePayloadToProject(payload, node.slug, projectNode.project);
                            }}
                          >
                            {isProjectEditing ? (
                              <div className="flex min-h-9 w-full items-center gap-2 rounded-xl bg-accent px-3">
                                <FolderOpen className="h-3.5 w-3.5 shrink-0 text-primary" />
                                <input
                                  ref={editProjectInputRef}
                                  value={editProjectName}
                                  onChange={(e) => setEditProjectName(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      void submitProjectEdit();
                                    }
                                    if (e.key === 'Escape') {
                                      cancelProjectEditing();
                                    }
                                  }}
                                  onBlur={() => void submitProjectEdit()}
                                  className="h-7 flex-1 rounded-md border border-primary/30 bg-card px-2 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary/30"
                                />
                              </div>
                            ) : (
                              <>
                                {!isReservedDefaultProject && (
                                  <GripVertical className="ml-1 h-3.5 w-3.5 shrink-0 cursor-grab text-muted-foreground/30 opacity-0 transition-opacity group-hover/project:opacity-100" />
                                )}
                                <button
                                  type="button"
                                  onClick={() => onSelectProject(node.slug, projectNode.project)}
                                  className={cn(
                                    'flex min-h-9 min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-xl px-2 text-left text-xs font-medium transition-all duration-200',
                                    isProjectActive
                                      ? 'bg-primary/10 text-primary shadow-sm shadow-primary/10'
                                      : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                                  )}
                                  aria-expanded={expandedProject}
                                >
                                  <Folder className={cn('h-3.5 w-3.5 shrink-0', isProjectActive ? 'text-primary/70' : 'text-muted-foreground')} />
                                  <span className="truncate">{projectNode.project}</span>
                                  <span className="ml-auto shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                                    {projectNode.report_count}
                                  </span>
                                </button>

                                {(onUpdateProject || onDeleteProject) && (
                                  <div className="relative shrink-0" ref={menuKey === menuId ? menuRef : undefined}>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setMenuKey(menuKey === menuId ? null : menuId);
                                      }}
                                      className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground/50 opacity-0 transition-all hover:bg-accent hover:text-foreground group-hover/project:opacity-100"
                                      aria-label="项目目录操作"
                                    >
                                      <MoreHorizontal className="h-3.5 w-3.5" />
                                    </button>

                                    {menuKey === menuId && (
                                      <div className="absolute right-0 top-full z-50 mt-1 w-32 rounded-xl border border-border bg-white p-1 text-foreground shadow-2xl shadow-black/20 ring-1 ring-black/5 animate-in fade-in slide-in-from-top-1 duration-150 dark:bg-zinc-900 dark:shadow-black/50 dark:ring-white/10">
                                        {onUpdateProject && (
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              if (isReservedDefaultProject) {
                                                showReservedDefaultProjectNotice('rename');
                                                return;
                                              }
                                              startProjectEditing(node.slug, projectNode.project);
                                            }}
                                            className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-[12px] text-foreground transition-colors hover:bg-accent"
                                          >
                                            <Pencil className="h-3 w-3" />
                                            重命名
                                          </button>
                                        )}
                                        {onDeleteProject && (
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              if (isReservedDefaultProject) {
                                                showReservedDefaultProjectNotice('delete');
                                                return;
                                              }
                                              void handleProjectDelete(node.slug, projectNode.project, projectNode.report_count);
                                            }}
                                            className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-[12px] text-destructive transition-colors hover:bg-destructive/10"
                                          >
                                            <Trash2 className="h-3 w-3" />
                                            删除目录
                                          </button>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </>
                            )}
                          </div>

                          {expandedProject && projectNode.reports.length > 0 && (
                            <div className="ml-6 space-y-1 border-l border-primary/10 pl-3">
                              {projectNode.reports.map((report) => {
                                const isReportEditing = editingReportId === report.id;
                                return isReportEditing ? (
                                  <div
                                    key={report.id}
                                    className="flex min-h-8 items-center gap-2 rounded-lg bg-accent px-2.5 text-[12px] font-medium text-foreground"
                                  >
                                    <FileText className="h-3.5 w-3.5 shrink-0 text-primary" />
                                    <input
                                      ref={editReportInputRef}
                                      value={editReportTitle}
                                      onChange={(e) => setEditReportTitle(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          e.preventDefault();
                                          void submitReportEdit();
                                        }
                                        if (e.key === 'Escape') {
                                          cancelReportEditing();
                                        }
                                      }}
                                      onBlur={() => void submitReportEdit()}
                                      className="h-6 min-w-0 flex-1 rounded-md border border-primary/30 bg-card px-2 text-[12px] text-foreground outline-none focus:ring-1 focus:ring-primary/30"
                                    />
                                  </div>
                                ) : (
                                  <div
                                    key={report.id}
                                    draggable
                                    onDragStart={(event) => {
                                      const target = event.target as HTMLElement;
                                      if (target.closest('button')) {
                                        event.preventDefault();
                                        return;
                                      }
                                      writeDragPayload(event, { kind: 'report', id: report.id, category: node.slug, project: projectNode.project });
                                    }}
                                    onDragEnd={() => setDragOverKey(null)}
                                    className="group/report flex min-h-8 cursor-grab items-center gap-1 rounded-lg px-2.5 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground active:cursor-grabbing"
                                    title={report.title}
                                  >
                                    <Link
                                      href={`/reports/${report.id}`}
                                      className="flex min-w-0 flex-1 items-center gap-2"
                                    >
                                      <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70 group-hover/report:text-primary" />
                                      <span className="truncate">{report.title}</span>
                                    </Link>
                                    {onUpdateReportTitle && (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          startReportEditing(report.id, report.title);
                                        }}
                                        className="flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground/50 opacity-0 transition-all hover:bg-background hover:text-foreground group-hover/report:opacity-100"
                                        aria-label={`重命名报告 ${report.title}`}
                                      >
                                        <Pencil className="h-3 w-3" />
                                      </button>
                                    )}
                                    {onDeleteReport && (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          void onDeleteReport(report.id);
                                        }}
                                        className="flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground/60 transition-all hover:bg-destructive/10 hover:text-destructive"
                                        aria-label={`删除报告 ${report.title}`}
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </button>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {node.projects.length === 0 && !loading && (
                      <div className="rounded-xl border border-dashed border-border/80 bg-background/60 px-3 py-4 text-center text-xs text-muted-foreground">
                        该分类下暂时没有报告
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {tree.length === 0 && !loading && (
            <div className="px-2 py-5 text-center text-xs text-muted-foreground">
              暂无分类
            </div>
          )}
        </div>
      </aside>

      <Dialog
        open={dialogOpen}
        onClose={() => {
          if (submitting) return;
          setDialogOpen(false);
        }}
        title="新建分类"
        description="新分类会立即出现在左侧导航中，上传报告时也可以直接选择。"
        size="sm"
      >
        <div className="space-y-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-foreground">分类名称</span>
            <input
              autoFocus
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void submitCategory();
                }
              }}
              placeholder="例如：性能压测 / 客户演示 / 周报归档"
              className="h-10 rounded-xl border border-border bg-card px-3 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
            />
          </label>
          <div className="flex justify-end gap-2.5">
            <button
              type="button"
              disabled={submitting}
              onClick={() => setDialogOpen(false)}
              className="inline-flex h-9 cursor-pointer items-center justify-center rounded-xl border border-border px-4 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground disabled:opacity-50"
            >
              取消
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => void submitCategory()}
              className="inline-flex h-9 cursor-pointer items-center justify-center rounded-xl bg-primary px-5 text-[13px] font-semibold text-primary-foreground shadow-sm transition-all hover:brightness-110 active:scale-[0.97] disabled:opacity-50"
            >
              {submitting ? '创建中...' : '创建分类'}
            </button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
