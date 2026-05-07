// 页面 manifest.json 数据结构
export interface PageManifest {
  schema_version: string;
  id: string;
  title: string;
  category?: string;
  project: string;
  iteration: string;
  version?: string;
  author?: string;
  tags?: string[];
  summary?: string;
  created_at: string;
  entry?: string;
  cover?: string;
}

// 页面来源：标准上传 / 自动生成 manifest / 单 HTML 自动封装
export type PageSource = 'standard' | 'auto_manifest' | 'single_html';

// 数据库 reports 表行
export interface PageRow {
  id: string;
  title: string;
  category: string;
  category_name?: string | null;
  project: string;
  iteration: string;
  version: string | null;
  author: string | null;
  tags: string | null; // JSON 字符串
  summary: string | null;
  cover: string | null;
  entry: string;
  size_bytes: number;
  file_count: number;
  source: PageSource;
  created_at: string;
  uploaded_at: string;
  deleted_at: string | null;
  trashed_path: string | null;
  purged_at: string | null;
}

// 对外输出的页面 DTO
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
  source: PageSource;
  created_at: string;
  uploaded_at: string;
  url: string; // 页面入口访问地址
  share_url: string; // 只读分享页地址
}

// 回收站页面 DTO（比 PageDto 多 deleted_at 和 can_restore 字段）
export interface TrashPageDto extends PageDto {
  deleted_at: string;
  can_restore: boolean;
}

// 行 -> DTO
export function rowToDto(row: PageRow): PageDto {
  const url = `/reports/${row.category}/${row.project}/${row.id}/${row.entry}`;
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    category_name: row.category_name || '默认分类',
    project: row.project,
    iteration: row.iteration,
    version: row.version,
    author: row.author,
    tags: row.tags ? JSON.parse(row.tags) : [],
    summary: row.summary,
    cover: row.cover,
    entry: row.entry,
    size_bytes: row.size_bytes,
    file_count: row.file_count,
    source: row.source,
    created_at: row.created_at,
    uploaded_at: row.uploaded_at,
    url,
    share_url: `/share/${row.id}`,
  };
}

// 行 -> 回收站 DTO
export function rowToTrashDto(row: PageRow): TrashPageDto {
  const base = rowToDto(row);
  return {
    ...base,
    deleted_at: row.deleted_at!,
    can_restore: !row.purged_at && !!row.trashed_path,
  };
}

// Manifest 字段正则
const ID_RE = /^[a-zA-Z0-9_-]{3,64}$/;
const CATEGORY_RE = /^[a-z0-9-]{1,40}$/;
const PROJECT_RE = /^[a-z0-9-]{1,40}$/;
const ITERATION_RE = /^[A-Za-z0-9._-]{1,40}$/;

// 校验 manifest 内容，失败抛错
export function validateManifest(raw: any): PageManifest {
  if (!raw || typeof raw !== 'object') {
    throw new Error('manifest.json 不是合法的 JSON 对象');
  }

  const m = raw as Partial<PageManifest>;

  if (m.schema_version !== '1.0') {
    throw new Error(`schema_version 必须为 "1.0"，当前为 ${m.schema_version}`);
  }
  if (!m.id || !ID_RE.test(m.id)) {
    throw new Error(`id 不合法：需匹配 ${ID_RE}`);
  }
  if (!m.title || typeof m.title !== 'string' || m.title.length > 200) {
    throw new Error('title 必须为 1-200 字符的字符串');
  }
  if (m.category && !CATEGORY_RE.test(m.category)) {
    throw new Error(`category 不合法：需匹配 ${CATEGORY_RE}`);
  }
  if (!m.project || !PROJECT_RE.test(m.project)) {
    throw new Error(`project 不合法：需匹配 ${PROJECT_RE}`);
  }
  if (!m.iteration || !ITERATION_RE.test(m.iteration)) {
    throw new Error(`iteration 不合法：需匹配 ${ITERATION_RE}`);
  }
  if (!m.created_at || typeof m.created_at !== 'string') {
    throw new Error('created_at 必选且为 ISO 8601 字符串');
  }
  if (m.tags && (!Array.isArray(m.tags) || m.tags.length > 10)) {
    throw new Error('tags 需为数组且数量不超过 10');
  }
  if (m.summary && m.summary.length > 500) {
    throw new Error('summary 长度不可超过 500 字');
  }

  return {
    schema_version: m.schema_version,
    id: m.id,
    title: m.title,
    category: sanitizeCategorySlug(m.category, 'default'),
    project: m.project,
    iteration: m.iteration,
    version: m.version,
    author: m.author,
    tags: m.tags,
    summary: m.summary,
    created_at: m.created_at,
    entry: m.entry || 'index.html',
    cover: m.cover,
  };
}

// 用于自动生成时的宽松校验（仅做正则修正而非抛错）
export function sanitizeCategorySlug(raw: string | undefined, fallback: string): string {
  if (!raw) return fallback;
  const cleaned = raw
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return cleaned || fallback;
}

export function sanitizeProject(raw: string | undefined, fallback: string): string {
  if (!raw) return fallback;
  const cleaned = raw
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return cleaned || fallback;
}

export function sanitizeIteration(raw: string | undefined, fallback: string): string {
  if (!raw) return fallback;
  const cleaned = raw.replace(/[^A-Za-z0-9._-]+/g, '-').slice(0, 40);
  return cleaned || fallback;
}
