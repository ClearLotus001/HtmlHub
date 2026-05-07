﻿// API 响应中的页面 DTO
export interface PageDto {
  id: string;
  title: string;
  category: string;
  category_name: string;
  project: string;
  iteration: string;
  version: string | null;
  author: string | null;
  tags: string[];
  summary: string | null;
  cover: string | null;
  entry: string;
  size_bytes: number;
  file_count: number;
  source: 'standard' | 'auto_manifest' | 'single_html';
  created_at: string;
  uploaded_at: string;
  url: string;
  share_url: string;
}

export interface SidebarReportNode {
  id: string;
  title: string;
  uploaded_at: string;
}

export interface SidebarProjectNode {
  project: string;
  report_count: number;
  reports: SidebarReportNode[];
}

export interface CategoryNode {
  slug: string;
  name: string;
  report_count: number;
  projects: SidebarProjectNode[];
}

export interface CategoryDto {
  slug: string;
  name: string;
  report_count: number;
}

export interface ListResult {
  total: number;
  items: PageDto[];
}

export interface ListParams {
  category?: string;
  project?: string;
  iteration?: string;
  q?: string;
  page?: number;
  pageSize?: number;
}

// 上传时可传入的覆盖参数（查询字符串）
export interface UploadOverrides {
  category?: string;
  project?: string;
  iteration?: string;
  title?: string;
  author?: string;
  version?: string;
  tags?: string; // 以逗号分隔
  summary?: string;
  id?: string;
}

// 清理运行汇总
export interface CleanupRun {
  run_id: string;
  started_at: string;
  soft_deleted: number;
  purged: number;
  bytes_freed: number;
}

export interface CleanupSummary {
  run_id: string;
  started_at: string;
  finished_at: string;
  scanned: number;
  soft_deleted: number;
  purged: number;
  bytes_freed: number;
  errors: { id: string; message: string }[];
}

export interface CleanupConfig {
  enabled: boolean;
  cron: string;
  defaultRetainDays: number;
  trashRetainDays: number;
  batchLimit: number;
  rules: { match: { project?: string; tag?: string }; retainDays: number }[];
}

// 回收站页面 DTO（比 PageDto 多 deleted_at 和 can_restore）
export interface TrashPageDto extends PageDto {
  deleted_at: string;
  can_restore: boolean;
}

export interface TrashListResult {
  total: number;
  items: TrashPageDto[];
}

// 基础 fetch 封装
async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    cache: 'no-store',
  });
  if (!res.ok) {
    let msg = `${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      if (body?.message) msg = Array.isArray(body.message) ? body.message.join('; ') : body.message;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  return res.json();
}

export const api = {
  list(params: ListParams = {}): Promise<ListResult> {
    const sp = new URLSearchParams();
    if (params.category) sp.set('category', params.category);
    if (params.project) sp.set('project', params.project);
    if (params.iteration) sp.set('iteration', params.iteration);
    if (params.q) sp.set('q', params.q);
    if (params.page) sp.set('page', String(params.page));
    if (params.pageSize) sp.set('pageSize', String(params.pageSize));
    const qs = sp.toString();
    return request<ListResult>(`/api/pages${qs ? `?${qs}` : ''}`);
  },

  categoryTree(): Promise<CategoryNode[]> {
    return request<CategoryNode[]>('/api/projects');
  },

  categories(): Promise<CategoryDto[]> {
    return request<CategoryDto[]>('/api/categories');
  },

  createCategory(name: string): Promise<CategoryDto> {
    return request<CategoryDto>('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
  },

  updateCategory(slug: string, name: string): Promise<CategoryDto> {
    return request<CategoryDto>(`/api/categories/${encodeURIComponent(slug)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
  },

  async deleteCategory(slug: string): Promise<{ ok: boolean; migrated: number }> {
    return request<{ ok: boolean; migrated: number }>(`/api/categories/${encodeURIComponent(slug)}`, {
      method: 'DELETE',
    });
  },

  updateProject(category: string, project: string, newProject: string): Promise<{ ok: boolean; updated: number; project: string }> {
    return request<{ ok: boolean; updated: number; project: string }>(
      `/api/categories/${encodeURIComponent(category)}/projects/${encodeURIComponent(project)}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project: newProject }),
      },
    );
  },

  async deleteProject(category: string, project: string): Promise<{ ok: boolean; deleted: number }> {
    return request<{ ok: boolean; deleted: number }>(
      `/api/categories/${encodeURIComponent(category)}/projects/${encodeURIComponent(project)}`,
      { method: 'DELETE' },
    );
  },

  moveProject(category: string, project: string, targetCategory: string, targetProject?: string): Promise<{ ok: boolean; moved: number; category: string; project: string }> {
    return request<{ ok: boolean; moved: number; category: string; project: string }>(
      `/api/categories/${encodeURIComponent(category)}/projects/${encodeURIComponent(project)}/location`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: targetCategory, project: targetProject }),
      },
    );
  },

  moveReport(id: string, category: string, project: string): Promise<PageDto> {
    return request<PageDto>(`/api/pages/${encodeURIComponent(id)}/location`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category, project }),
    });
  },

  updateReportTitle(id: string, title: string): Promise<PageDto> {
    return request<PageDto>(`/api/pages/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    });
  },

  get(id: string): Promise<PageDto> {
    return request<PageDto>(`/api/pages/${encodeURIComponent(id)}`);
  },

  // 上传：支持 zip 与 html，通过 overrides 传递补充元信息
  async upload(file: File, overrides: UploadOverrides = {}): Promise<PageDto> {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(overrides)) {
      if (v !== undefined && v !== null && `${v}`.trim() !== '') sp.set(k, `${v}`);
    }
    const fd = new FormData();
    fd.append('file', file);
    const qs = sp.toString();
    const res = await fetch(`/api/pages/upload${qs ? `?${qs}` : ''}`, {
      method: 'POST',
      body: fd,
    });
    if (!res.ok) {
      let msg = `${res.status} ${res.statusText}`;
      try {
        const body = await res.json();
        if (body?.message) msg = Array.isArray(body.message) ? body.message.join('; ') : body.message;
      } catch {
        /* ignore */
      }
      throw new Error(msg);
    }
    return res.json();
  },

  shareUrl(id: string): string {
    return `/share/${encodeURIComponent(id)}`;
  },

  async remove(id: string): Promise<void> {
    const res = await fetch(`/api/pages/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  },

  /** 批量软删除（同时兼容单个删除，ids 传一个即可） */
  async batchRemove(ids: string[]): Promise<{ succeeded: number; failed: { id: string; message: string }[] }> {
    const res = await fetch('/api/pages/batch', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    });
    if (!res.ok) {
      let msg = `${res.status} ${res.statusText}`;
      try {
        const body = await res.json();
        if (body?.message) msg = Array.isArray(body.message) ? body.message.join('; ') : body.message;
      } catch { /* ignore */ }
      throw new Error(msg);
    }
    return res.json();
  },

  async restore(id: string): Promise<PageDto> {
    const res = await fetch(`/api/pages/${encodeURIComponent(id)}/restore`, {
      method: 'PUT',
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return res.json();
  },

  downloadUrl(id: string): string {
    return `/api/pages/${encodeURIComponent(id)}/download`;
  },

  // 清理相关
  cleanupConfig(): Promise<CleanupConfig> {
    return request<CleanupConfig>('/api/cleanup/config');
  },
  updateCleanupConfig(data: Partial<CleanupConfig>): Promise<CleanupConfig> {
    return request<CleanupConfig>('/api/cleanup/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },
  cleanupRun(dryRun = false): Promise<CleanupSummary> {
    return request<CleanupSummary>(
      `/api/cleanup/run${dryRun ? '?dryRun=1' : ''}`,
      { method: 'POST' },
    );
  },
  cleanupRuns(limit = 20): Promise<CleanupRun[]> {
    return request<CleanupRun[]>(`/api/cleanup/runs?limit=${limit}`);
  },

  // 回收站相关
  trashList(params: { q?: string; page?: number; pageSize?: number } = {}): Promise<TrashListResult> {
    const sp = new URLSearchParams();
    if (params.q) sp.set('q', params.q);
    if (params.page) sp.set('page', String(params.page));
    if (params.pageSize) sp.set('pageSize', String(params.pageSize));
    const qs = sp.toString();
    return request<TrashListResult>(`/api/trash${qs ? `?${qs}` : ''}`);
  },

  async trashRestore(id: string): Promise<PageDto> {
    const res = await fetch(`/api/pages/${encodeURIComponent(id)}/restore`, {
      method: 'PUT',
    });
    if (!res.ok) {
      let msg = `${res.status} ${res.statusText}`;
      try {
        const body = await res.json();
        if (body?.message) msg = Array.isArray(body.message) ? body.message.join('; ') : body.message;
      } catch { /* ignore */ }
      throw new Error(msg);
    }
    return res.json();
  },

  /** 批量恢复（同时兼容单个恢复，ids 传一个即可） */
  async batchTrashRestore(ids: string[]): Promise<{ succeeded: number; failed: { id: string; message: string }[] }> {
    const res = await fetch('/api/pages/batch/restore', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    });
    if (!res.ok) {
      let msg = `${res.status} ${res.statusText}`;
      try {
        const body = await res.json();
        if (body?.message) msg = Array.isArray(body.message) ? body.message.join('; ') : body.message;
      } catch { /* ignore */ }
      throw new Error(msg);
    }
    return res.json();
  },

  async trashPurge(id: string): Promise<{ ok: boolean; bytes_freed: number }> {
    const res = await fetch(`/api/trash/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      let msg = `${res.status} ${res.statusText}`;
      try {
        const body = await res.json();
        if (body?.message) msg = Array.isArray(body.message) ? body.message.join('; ') : body.message;
      } catch { /* ignore */ }
      throw new Error(msg);
    }
    return res.json();
  },

  /** 批量物理删除（同时兼容单个删除，ids 传一个即可） */
  async batchTrashPurge(ids: string[]): Promise<{ succeeded: number; bytes_freed: number; failed: { id: string; message: string }[] }> {
    const res = await fetch('/api/trash/batch', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    });
    if (!res.ok) {
      let msg = `${res.status} ${res.statusText}`;
      try {
        const body = await res.json();
        if (body?.message) msg = Array.isArray(body.message) ? body.message.join('; ') : body.message;
      } catch { /* ignore */ }
      throw new Error(msg);
    }
    return res.json();
  },
};
