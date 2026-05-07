import {
  Inject,
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import Database from 'better-sqlite3';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { DB_TOKEN } from '../database.module';
import { config } from '../config';
import {
  PageDto,
  PageRow,
  PageSource,
  TrashPageDto,
  rowToDto,
  rowToTrashDto,
} from './page.types';
import { safeExtractZip } from './safe-unzip';
import { ManifestResolver, ManifestOverrides } from './manifest-resolver';

// 列表查询参数
export interface ListQuery {
  category?: string;
  project?: string;
  iteration?: string;
  q?: string;
  page?: number;
  pageSize?: number;
}

export interface CategoryDto {
  slug: string;
  name: string;
  report_count: number;
}

export interface ProjectReportNode {
  id: string;
  title: string;
  uploaded_at: string;
}

export interface CategoryTreeNode {
  slug: string;
  name: string;
  report_count: number;
  projects: { project: string; report_count: number; reports: ProjectReportNode[] }[];
}

interface CategoryRow {
  slug: string;
  name: string;
  created_at: string;
}

@Injectable()
export class PagesService {
  private readonly logger = new Logger(PagesService.name);
  private readonly pageFromSql = `
    FROM reports
    LEFT JOIN categories ON categories.slug = reports.category
  `;
  private readonly pageSelectSql = `
    SELECT reports.*, categories.name AS category_name
    ${this.pageFromSql}
  `;

  // 预编译语句缓存（better-sqlite3 推荐做法，避免重复 prepare 开销）
  private readonly stmts: ReturnType<typeof this.prepareStatements>;

  constructor(@Inject(DB_TOKEN) private readonly db: Database.Database) {
    this.stmts = this.prepareStatements();
    this.migrateLegacyIterationDirs();
  }

  /** 集中预编译所有常用 SQL 语句 */
  private prepareStatements() {
    return {
      findById: this.db.prepare<{ id: string }>(
        `${this.pageSelectSql} WHERE reports.id = @id AND reports.deleted_at IS NULL`,
      ),
      findByIdIncludeDeleted: this.db.prepare<{ id: string }>(
        'SELECT * FROM reports WHERE id = @id',
      ),
      checkIdExists: this.db.prepare<{ id: string }>(
        'SELECT id FROM reports WHERE id = @id AND deleted_at IS NULL',
      ),
      listCategories: this.db.prepare(`
        SELECT
          categories.slug,
          categories.name,
          COUNT(reports.id) AS report_count
        FROM categories
        LEFT JOIN reports
          ON reports.category = categories.slug
         AND reports.deleted_at IS NULL
        GROUP BY categories.slug, categories.name
        ORDER BY
          CASE WHEN categories.slug = 'default' THEN 0 ELSE 1 END,
          categories.created_at ASC,
          categories.name COLLATE NOCASE ASC
      `),
      getCategoryBySlug: this.db.prepare<{ slug: string }>(
        'SELECT slug, name, created_at FROM categories WHERE slug = @slug',
      ),
      getCategoryByName: this.db.prepare<{ name: string }>(
        'SELECT slug, name, created_at FROM categories WHERE name = @name',
      ),
      insertCategory: this.db.prepare<Pick<CategoryRow, 'slug' | 'name' | 'created_at'>>(
        'INSERT INTO categories (slug, name, created_at) VALUES (@slug, @name, @created_at)',
      ),
      updateCategoryName: this.db.prepare<{ slug: string; name: string }>(
        'UPDATE categories SET name = @name WHERE slug = @slug',
      ),
      deleteCategory: this.db.prepare<{ slug: string }>(
        'DELETE FROM categories WHERE slug = @slug',
      ),
      countReportsByCategory: this.db.prepare<{ category: string }>(
        'SELECT COUNT(*) AS c FROM reports WHERE category = @category AND deleted_at IS NULL',
      ),
      reassignReports: this.db.prepare<{ oldCategory: string; newCategory: string }>(
        'UPDATE reports SET category = @newCategory WHERE category = @oldCategory',
      ),
      countReportsByProject: this.db.prepare<{ category: string; project: string }>(
        'SELECT COUNT(*) AS c FROM reports WHERE category = @category AND project = @project AND deleted_at IS NULL',
      ),
      listReportsByProject: this.db.prepare<{ category: string; project: string }>(
        'SELECT * FROM reports WHERE category = @category AND project = @project AND deleted_at IS NULL',
      ),
      updateProject: this.db.prepare<{ category: string; oldProject: string; newProject: string }>(
        'UPDATE reports SET project = @newProject WHERE category = @category AND project = @oldProject',
      ),
      updateReportLocation: this.db.prepare<{ id: string; category: string; project: string }>(
        'UPDATE reports SET category = @category, project = @project WHERE id = @id',
      ),
      updateReportTitle: this.db.prepare<{ id: string; title: string }>(
        'UPDATE reports SET title = @title WHERE id = @id AND deleted_at IS NULL',
      ),
      listForCleanup: this.db.prepare<{ limit: number }>(
        'SELECT * FROM reports WHERE purged_at IS NULL ORDER BY uploaded_at ASC LIMIT @limit',
      ),
      insert: this.db.prepare(`
        INSERT INTO reports
          (id, title, category, project, iteration, version, author, tags, summary, cover,
           entry, size_bytes, file_count, source, created_at, uploaded_at)
        VALUES
          (@id, @title, @category, @project, @iteration, @version, @author, @tags, @summary, @cover,
           @entry, @size_bytes, @file_count, @source, @created_at, @uploaded_at)
      `),
      softDelete: this.db.prepare<{ deleted_at: string; trashed_path: string | null; id: string }>(
        'UPDATE reports SET deleted_at = @deleted_at, trashed_path = @trashed_path WHERE id = @id',
      ),
      restore: this.db.prepare<{ id: string }>(
        'UPDATE reports SET deleted_at = NULL, trashed_path = NULL WHERE id = @id',
      ),
      purge: this.db.prepare<{ purged_at: string; id: string }>(
        `UPDATE reports
         SET purged_at = @purged_at, trashed_path = NULL,
             deleted_at = COALESCE(deleted_at, @purged_at)
         WHERE id = @id`,
      ),
    };
  }

  // --------------------- 查询 ---------------------

  /** 列出页面（未删除） */
  list(query: ListQuery): { total: number; items: PageDto[] } {
    const page = Math.max(1, query.page || 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize || 20));
    const offset = (page - 1) * pageSize;

    const where: string[] = ['reports.deleted_at IS NULL'];
    const params: Record<string, any> = {};

    if (query.category) {
      where.push('reports.category = @category');
      params.category = query.category;
    }
    if (query.project) {
      where.push('reports.project = @project');
      params.project = query.project;
    }
    if (query.iteration) {
      where.push('reports.iteration = @iteration');
      params.iteration = query.iteration;
    }
    if (query.q) {
      where.push(`(
        reports.title LIKE @q OR
        reports.summary LIKE @q OR
        reports.tags LIKE @q OR
        reports.project LIKE @q OR
        reports.iteration LIKE @q OR
        categories.name LIKE @q
      )`);
      params.q = `%${query.q}%`;
    }

    const whereSql = `WHERE ${where.join(' AND ')}`;

    // 动态查询无法预编译，但使用命名参数仍然安全
    const total = (
      this.db
        .prepare(`SELECT COUNT(*) AS c ${this.pageFromSql} ${whereSql}`)
        .get(params) as { c: number }
    ).c;

    const rows = this.db
      .prepare(
        `${this.pageSelectSql} ${whereSql}
         ORDER BY reports.uploaded_at DESC
         LIMIT @limit OFFSET @offset`,
      )
      .all({ ...params, limit: pageSize, offset }) as PageRow[];

    return { total, items: rows.map(rowToDto) };
  }

  /** 查找单个页面 */
  findOne(id: string): PageDto {
    const row = this.stmts.findById.get({ id }) as PageRow | undefined;
    if (!row) throw new NotFoundException(`页面不存在：${id}`);
    return rowToDto(row);
  }

  /** 分类 / 项目 / 报告聚合，用于前端侧栏树 */
  projectTree(): CategoryTreeNode[] {
    const categories = this.listCategories();
    const rows = this.db.prepare(`
      SELECT
        reports.category AS slug,
        reports.project,
        reports.id,
        reports.title,
        reports.uploaded_at
      FROM reports
      WHERE reports.deleted_at IS NULL
      ORDER BY reports.category ASC, reports.project ASC, reports.uploaded_at DESC
    `).all() as { slug: string; project: string; id: string; title: string; uploaded_at: string }[];

    const projectMap = new Map<string, Map<string, { project: string; report_count: number; reports: ProjectReportNode[] }>>();
    for (const row of rows) {
      if (!projectMap.has(row.slug)) {
        projectMap.set(row.slug, new Map());
      }
      const projects = projectMap.get(row.slug)!;
      if (!projects.has(row.project)) {
        projects.set(row.project, { project: row.project, report_count: 0, reports: [] });
      }
      const project = projects.get(row.project)!;
      project.report_count += 1;
      project.reports.push({ id: row.id, title: row.title, uploaded_at: row.uploaded_at });
    }

    return categories.map((cat) => ({
      slug: cat.slug,
      name: cat.name,
      report_count: cat.report_count,
      projects: Array.from(projectMap.get(cat.slug)?.values() ?? []),
    }));
  }

  /** 分类列表（包含空分类） */
  listCategories(): CategoryDto[] {
    return this.stmts.listCategories.all() as CategoryDto[];
  }

  /** 新建分类 */
  createCategory(name: string): CategoryDto {
    const normalizedName = name.trim().replace(/\s+/g, ' ');
    if (!normalizedName) {
      throw new BadRequestException('分类名称不能为空');
    }

    const existing = this.stmts.getCategoryByName.get({ name: normalizedName }) as CategoryRow | undefined;
    if (existing) {
      throw new BadRequestException(`分类已存在：${normalizedName}`);
    }

    const baseSlug = this.slugifyCategoryName(normalizedName);
    const slug = this.buildUniqueCategorySlug(baseSlug);
    const created_at = new Date().toISOString();
    this.stmts.insertCategory.run({ slug, name: normalizedName, created_at });

    return this.getCategoryDto(slug);
  }

  /** 编辑分类名称 */
  updateCategory(slug: string, name: string): CategoryDto {
    if (slug === 'default') {
      throw new BadRequestException('默认分类不可编辑');
    }

    const existing = this.stmts.getCategoryBySlug.get({ slug }) as CategoryRow | undefined;
    if (!existing) {
      throw new NotFoundException(`分类不存在：${slug}`);
    }

    const normalizedName = name.trim().replace(/\s+/g, ' ');
    if (!normalizedName) {
      throw new BadRequestException('分类名称不能为空');
    }

    // 检查名称是否已被其他分类使用
    const dup = this.stmts.getCategoryByName.get({ name: normalizedName }) as CategoryRow | undefined;
    if (dup && dup.slug !== slug) {
      throw new BadRequestException(`分类名称已存在：${normalizedName}`);
    }

    this.stmts.updateCategoryName.run({ slug, name: normalizedName });
    return this.getCategoryDto(slug);
  }

  /** 删除分类（将分类下报告迁移到默认分类） */
  deleteCategory(slug: string): { ok: boolean; migrated: number } {
    if (slug === 'default') {
      throw new BadRequestException('默认分类不可删除');
    }

    const existing = this.stmts.getCategoryBySlug.get({ slug }) as CategoryRow | undefined;
    if (!existing) {
      throw new NotFoundException(`分类不存在：${slug}`);
    }

    // 统计该分类下的报告数量
    const { c: reportCount } = this.stmts.countReportsByCategory.get({ category: slug }) as { c: number };

    // 事务内执行：迁移报告 + 删除分类
    return this.db.transaction(() => {
      let migrated = 0;
      if (reportCount > 0) {
        // 将该分类下的报告迁移到默认分类，同时移动物理文件
        const rows = this.db.prepare(
          'SELECT * FROM reports WHERE category = @category AND deleted_at IS NULL',
        ).all({ category: slug }) as PageRow[];

        for (const row of rows) {
          const oldDir = this.finalDirOf(row.category, row.project, row.id);
          const newDir = this.finalDirOf('default', row.project, row.id);
          if (fs.existsSync(oldDir)) {
            fs.mkdirSync(path.dirname(newDir), { recursive: true });
            try {
              fs.renameSync(oldDir, newDir);
            } catch {
              // 如果移动失败（跨盘等），用复制+删除
              fs.cpSync(oldDir, newDir, { recursive: true });
              this.rmrf(oldDir);
            }
          }
        }

        this.stmts.reassignReports.run({ oldCategory: slug, newCategory: 'default' });
        migrated = reportCount;
      }

      this.stmts.deleteCategory.run({ slug });
      return { ok: true, migrated };
    })();
  }

  /** 重命名项目目录 */
  renameProject(category: string, project: string, newProject: string): { ok: boolean; updated: number; project: string } {
    this.ensureCategoryExists(category);
    if (this.isReservedDefaultProject(category, project)) {
      throw new BadRequestException('默认项目目录不可重命名');
    }
    if (project === newProject) {
      const { c } = this.stmts.countReportsByProject.get({ category, project }) as { c: number };
      return { ok: true, updated: c, project: newProject };
    }

    const { c: oldCount } = this.stmts.countReportsByProject.get({ category, project }) as { c: number };
    if (oldCount === 0) {
      throw new NotFoundException(`项目不存在：${project}`);
    }

    const { c: targetCount } = this.stmts.countReportsByProject.get({ category, project: newProject }) as { c: number };
    if (targetCount > 0) {
      throw new BadRequestException(`项目已存在：${newProject}`);
    }

    const rows = this.stmts.listReportsByProject.all({ category, project }) as PageRow[];
    return this.db.transaction(() => {
      for (const row of rows) {
        const oldDir = this.finalDirOf(row.category, row.project, row.id);
        const newDir = this.finalDirOf(row.category, newProject, row.id);
        if (!fs.existsSync(oldDir)) continue;
        fs.mkdirSync(path.dirname(newDir), { recursive: true });
        try {
          fs.renameSync(oldDir, newDir);
        } catch {
          fs.cpSync(oldDir, newDir, { recursive: true });
          this.rmrf(oldDir);
        }
      }

      this.stmts.updateProject.run({ category, oldProject: project, newProject });
      this.removeEmptyParents(path.join(config.reportsDir, category, project), path.join(config.reportsDir, category, project));
      return { ok: true, updated: rows.length, project: newProject };
    })();
  }

  /** 删除项目目录（将项目下报告移入回收站） */
  deleteProject(category: string, project: string): { ok: boolean; deleted: number } {
    this.ensureCategoryExists(category);
    if (this.isReservedDefaultProject(category, project)) {
      throw new BadRequestException('默认项目目录不可删除');
    }
    const rows = this.stmts.listReportsByProject.all({ category, project }) as PageRow[];
    if (rows.length === 0) {
      throw new NotFoundException(`项目不存在：${project}`);
    }

    return this.db.transaction(() => {
      for (const row of rows) {
        this.softDelete(row.id, 'project-delete');
      }
      return { ok: true, deleted: rows.length };
    })();
  }

  /** 移动单个报告到目标分类/项目 */
  moveReport(id: string, targetCategory: string, targetProject: string): PageDto {
    this.ensureCategoryExists(targetCategory);
    const row = this.stmts.findById.get({ id }) as PageRow | undefined;
    if (!row) throw new NotFoundException(`页面不存在：${id}`);

    const resolvedTargetProject = this.isReservedDefaultProject(row.category, row.project)
      && targetCategory !== 'default'
      && targetProject === 'default'
      ? targetCategory
      : targetProject;

    if (row.category === targetCategory && row.project === resolvedTargetProject) {
      return rowToDto(row);
    }

    return this.db.transaction(() => {
      this.moveReportDir(row, targetCategory, resolvedTargetProject);
      this.stmts.updateReportLocation.run({ id, category: targetCategory, project: resolvedTargetProject });
      return this.findOne(id);
    })();
  }

  /** 重命名报告标题 */
  updateReportTitle(id: string, title: string): PageDto {
    const normalizedTitle = title.trim().replace(/\s+/g, ' ');
    if (!normalizedTitle) throw new BadRequestException('报告标题不能为空');

    const row = this.stmts.findById.get({ id }) as PageRow | undefined;
    if (!row) throw new NotFoundException(`页面不存在：${id}`);
    if (row.title === normalizedTitle) return rowToDto(row);

    return this.db.transaction(() => {
      this.stmts.updateReportTitle.run({ id, title: normalizedTitle });
      this.syncManifestTitle(row, normalizedTitle);
      return this.findOne(id);
    })();
  }

  /** 移动项目目录到目标分类/项目；目标项目存在时合并 */
  moveProject(
    category: string,
    project: string,
    targetCategory: string,
    targetProject: string = project,
  ): { ok: boolean; moved: number; category: string; project: string } {
    this.ensureCategoryExists(category);
    this.ensureCategoryExists(targetCategory);
    if (this.isReservedDefaultProject(category, project)) {
      throw new BadRequestException('默认项目目录不可移动');
    }

    const rows = this.stmts.listReportsByProject.all({ category, project }) as PageRow[];
    if (rows.length === 0) {
      throw new NotFoundException(`项目不存在：${project}`);
    }

    if (category === targetCategory && project === targetProject) {
      return { ok: true, moved: 0, category: targetCategory, project: targetProject };
    }

    return this.db.transaction(() => {
      for (const row of rows) {
        this.moveReportDir(row, targetCategory, targetProject);
        this.stmts.updateReportLocation.run({ id: row.id, category: targetCategory, project: targetProject });
      }
      this.removeEmptyParents(path.join(config.reportsDir, category, project), path.join(config.reportsDir, category, project));
      return { ok: true, moved: rows.length, category: targetCategory, project: targetProject };
    })();
  }

  /**
   * 接收上传的 zip 文件，解压 → 解析/推断 manifest → 入库。
   */
  async ingestZip(
    zipAbsPath: string,
    originalName: string,
    overrides: ManifestOverrides = {},
  ): Promise<PageDto> {
    this.logger.log(`正在处理 ${originalName}`);

    // 1. 先解压到临时目录
    const stagingDir = this.makeStagingDir();

    let extractResult;
    try {
      extractResult = await safeExtractZip(zipAbsPath, stagingDir);
    } catch (e: any) {
      this.rmrf(stagingDir);
      throw new BadRequestException(e.message || '解压失败');
    }

    // 2. 解析/推断 manifest（支持缺失 + 入口智能识别）
    let resolved;
    try {
      resolved = ManifestResolver.resolve(stagingDir, overrides, originalName);
    } catch (e: any) {
      this.rmrf(stagingDir);
      throw new BadRequestException(e.message || 'manifest 解析失败');
    }

    const { manifest, autoGenerated } = resolved;

    // 3. 若无 manifest 且不允许宽松模式，拒绝
    if (autoGenerated && !config.compat.allowMissingManifest) {
      this.rmrf(stagingDir);
      throw new BadRequestException('zip 缺少 manifest.json');
    }

    // 4. id 唯一性
    if (this.stmts.checkIdExists.get({ id: manifest.id })) {
      this.rmrf(stagingDir);
      throw new BadRequestException(`页面 id 已存在：${manifest.id}`);
    }

    // 5. 回写 manifest 到解压目录（保证下载 zip 自带规范 manifest）
    if (autoGenerated) {
      ManifestResolver.writeManifest(stagingDir, manifest);
    }

    // 6. 提交文件和 DB 写入
    const source: PageSource = autoGenerated ? 'auto_manifest' : 'standard';
    return this.commitIngest(stagingDir, manifest, extractResult.totalBytes, extractResult.fileCount, source);
  }

  /**
   * 单个 HTML 文件直接上传：服务端自动封装为标准目录结构。
   */
  async ingestSingleHtml(
    htmlAbsPath: string,
    originalName: string,
    overrides: ManifestOverrides = {},
  ): Promise<PageDto> {
    if (!config.compat.allowSingleHtmlUpload) {
      throw new BadRequestException('未启用单 HTML 上传');
    }

    const stat = fs.statSync(htmlAbsPath);
    if (stat.size > config.upload.maxSingleHtmlBytes) {
      throw new BadRequestException(
        `单 HTML 文件超过上限 ${config.upload.maxSingleHtmlBytes} 字节`,
      );
    }

    // 1. 在 staging 目录中构造 index.html
    const stagingDir = this.makeStagingDir();
    fs.mkdirSync(stagingDir, { recursive: true });
    const destHtml = path.join(stagingDir, 'index.html');
    fs.copyFileSync(htmlAbsPath, destHtml);

    // 2. 推断 manifest
    let resolved;
    try {
      resolved = ManifestResolver.resolve(stagingDir, overrides, originalName);
    } catch (e: any) {
      this.rmrf(stagingDir);
      throw new BadRequestException(e.message || 'manifest 推断失败');
    }
    const { manifest } = resolved;

    // 3. id 唯一性
    if (this.stmts.checkIdExists.get({ id: manifest.id })) {
      this.rmrf(stagingDir);
      throw new BadRequestException(`页面 id 已存在：${manifest.id}`);
    }

    // 4. 写 manifest
    ManifestResolver.writeManifest(stagingDir, manifest);

    // 5. 提交文件和 DB 写入
    return this.commitIngest(stagingDir, manifest, stat.size, 1, 'single_html');
  }

  /** 软删除：标记 deleted_at，并将目录移动到 _trash/ */
  softDelete(id: string, _reason: string = 'manual'): PageRow {
    const row = this.stmts.findById.get({ id }) as PageRow | undefined;
    if (!row) throw new NotFoundException(`页面不存在：${id}`);

    const now = new Date().toISOString();
    const fromDir = this.finalDirOf(row.category, row.project, row.id);
    const trashDir = path.join(config.trashDir, `${row.id}-${Date.now()}`);

    let trashedPath: string | null = null;
    if (fs.existsSync(fromDir)) {
      fs.mkdirSync(path.dirname(trashDir), { recursive: true });
      fs.renameSync(fromDir, trashDir);
      trashedPath = trashDir;
    }

    this.stmts.softDelete.run({ deleted_at: now, trashed_path: trashedPath, id });

    return { ...row, deleted_at: now, trashed_path: trashedPath };
  }

  /** 从回收站恢复：要求 trashed_path 存在且未 purge */
  restore(id: string): PageDto {
    const row = this.stmts.findByIdIncludeDeleted.get({ id }) as PageRow | undefined;
    if (!row) throw new NotFoundException(`页面不存在：${id}`);
    if (!row.deleted_at) throw new BadRequestException('页面未被删除');
    if (row.purged_at) throw new BadRequestException('物理文件已被彻底清理，无法恢复');
    if (!row.trashed_path || !fs.existsSync(row.trashed_path)) {
      throw new BadRequestException('回收站文件不存在，无法恢复');
    }

    const finalDir = this.finalDirOf(row.category, row.project, row.id);
    if (fs.existsSync(finalDir)) this.rmrf(finalDir);
    fs.mkdirSync(path.dirname(finalDir), { recursive: true });
    fs.renameSync(row.trashed_path, finalDir);

    this.stmts.restore.run({ id });

    return this.findOne(id);
  }

  /** 物理清理：移除回收站目录 + 标记 purged_at，返回释放的字节数 */
  purge(id: string): number {
    const row = this.stmts.findByIdIncludeDeleted.get({ id }) as PageRow | undefined;
    if (!row) return 0;

    let freed = 0;
    if (row.trashed_path && fs.existsSync(row.trashed_path)) {
      freed = this.dirSize(row.trashed_path);
      this.rmrf(row.trashed_path);
    } else if (!row.deleted_at) {
      // 兜底：如果还在原位，也要一并删
      const origin = this.finalDirOf(row.category, row.project, row.id);
      if (fs.existsSync(origin)) {
        freed = this.dirSize(origin);
        this.rmrf(origin);
      }
    }

    this.stmts.purge.run({ purged_at: new Date().toISOString(), id });

    return freed;
  }

  /** 批量软删除：逐条执行 softDelete，返回成功/失败统计 */
  batchSoftDelete(ids: string[], reason = 'manual'): { succeeded: number; failed: { id: string; message: string }[] } {
    const failed: { id: string; message: string }[] = [];
    let succeeded = 0;

    for (const id of ids) {
      try {
        this.softDelete(id, reason);
        succeeded++;
      } catch (e: any) {
        failed.push({ id, message: e.message || '未知错误' });
      }
    }

    return { succeeded, failed };
  }

  /** 批量物理清理：逐条执行 purge，返回成功/失败统计和释放字节数 */
  batchPurge(ids: string[]): { succeeded: number; bytes_freed: number; failed: { id: string; message: string }[] } {
    const failed: { id: string; message: string }[] = [];
    let succeeded = 0;
    let bytesFreed = 0;

    for (const id of ids) {
      try {
        bytesFreed += this.purge(id);
        succeeded++;
      } catch (e: any) {
        failed.push({ id, message: e.message || '未知错误' });
      }
    }

    return { succeeded, bytes_freed: bytesFreed, failed };
  }

  /** 批量恢复：逐条执行 restore，返回成功/失败统计 */
  batchRestore(ids: string[]): { succeeded: number; failed: { id: string; message: string }[] } {
    const failed: { id: string; message: string }[] = [];
    let succeeded = 0;

    for (const id of ids) {
      try {
        this.restore(id);
        succeeded++;
      } catch (e: any) {
        failed.push({ id, message: e.message || '未知错误' });
      }
    }

    return { succeeded, failed };
  }

  /** 获取页面物理目录（下载用） */
  getPageDir(id: string): { dir: string; page: PageDto } {
    const page = this.findOne(id);
    const dir = this.finalDirOf(page.category, page.project, page.id);
    if (!fs.existsSync(dir)) {
      throw new NotFoundException(`物理目录缺失：${id}`);
    }
    return { dir, page };
  }

  /** 获取回收站中报告的物理目录（预览用） */
  getTrashPageDir(id: string): { dir: string; entry: string; row: PageRow } {
    const row = this.stmts.findByIdIncludeDeleted.get({ id }) as PageRow | undefined;
    if (!row) throw new NotFoundException(`页面不存在：${id}`);
    if (!row.deleted_at) throw new BadRequestException('该页面未被删除，请直接访问报告列表');
    if (row.purged_at) throw new BadRequestException('物理文件已被彻底清理，无法预览');
    if (!row.trashed_path || !fs.existsSync(row.trashed_path)) {
      throw new BadRequestException('回收站文件不存在，无法预览');
    }
    return { dir: row.trashed_path, entry: row.entry || 'index.html', row };
  }

  /** 列出回收站中的页面（已软删除、未物理清理） */
  listTrash(query: { q?: string; page?: number; pageSize?: number }): { total: number; items: TrashPageDto[] } {
    const page = Math.max(1, query.page || 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize || 20));
    const offset = (page - 1) * pageSize;

    const where: string[] = ['reports.deleted_at IS NOT NULL', 'reports.purged_at IS NULL'];
    const params: Record<string, any> = {};

    if (query.q) {
      where.push(`(
        reports.title LIKE @q OR
        reports.summary LIKE @q OR
        reports.tags LIKE @q OR
        categories.name LIKE @q
      )`);
      params.q = `%${query.q}%`;
    }

    const whereSql = `WHERE ${where.join(' AND ')}`;

    const total = (
      this.db
        .prepare(`SELECT COUNT(*) AS c ${this.pageFromSql} ${whereSql}`)
        .get(params) as { c: number }
    ).c;

    const rows = this.db
      .prepare(
        `${this.pageSelectSql} ${whereSql}
         ORDER BY reports.deleted_at DESC
         LIMIT @limit OFFSET @offset`,
      )
      .all({ ...params, limit: pageSize, offset }) as PageRow[];

    return { total, items: rows.map(rowToTrashDto) };
  }

  /** 列出满足条件的页面行（给 CleanupService 用，含已删除） */
  listForCleanup(): PageRow[] {
    return this.stmts.listForCleanup.all({ limit: config.cleanup.batchLimit }) as PageRow[];
  }

  // --------------------- 内部工具 ---------------------

  private insertPage(
    manifest: ReturnType<typeof ManifestResolver.resolve>['manifest'],
    sizeBytes: number,
    fileCount: number,
    source: PageSource,
  ): PageDto {
    const now = new Date().toISOString();
    this.stmts.insert.run({
      id: manifest.id,
      title: manifest.title,
      category: this.ensureCategoryExists(manifest.category || 'default'),
      project: manifest.project,
      iteration: manifest.iteration,
      version: manifest.version || null,
      author: manifest.author || null,
      tags: manifest.tags ? JSON.stringify(manifest.tags) : null,
      summary: manifest.summary || null,
      cover: manifest.cover || null,
      entry: manifest.entry || 'index.html',
      size_bytes: sizeBytes,
      file_count: fileCount,
      source,
      created_at: manifest.created_at,
      uploaded_at: now,
    });
    return this.findOne(manifest.id);
  }

  private commitIngest(
    stagingDir: string,
    manifest: ReturnType<typeof ManifestResolver.resolve>['manifest'],
    sizeBytes: number,
    fileCount: number,
    source: PageSource,
  ): PageDto {
    const category = this.ensureCategoryExists(manifest.category || 'default');
    const finalDir = this.finalDirOf(
      category,
      manifest.project,
      manifest.id,
    );
    let moved = false;

    try {
      manifest.category = category;
      return this.db.transaction(() => {
        if (fs.existsSync(finalDir)) this.rmrf(finalDir);
        fs.mkdirSync(path.dirname(finalDir), { recursive: true });
        fs.renameSync(stagingDir, finalDir);
        moved = true;
        return this.insertPage(manifest, sizeBytes, fileCount, source);
      })();
    } catch (e) {
      if (moved && fs.existsSync(finalDir)) {
        this.rmrf(finalDir);
      }
      if (!moved && fs.existsSync(stagingDir)) {
        this.rmrf(stagingDir);
      }
      throw e;
    }
  }

  private ensureCategoryExists(slug: string): string {
    const row = this.stmts.getCategoryBySlug.get({ slug }) as CategoryRow | undefined;
    if (!row) {
      throw new BadRequestException(`分类不存在：${slug}`);
    }
    return row.slug;
  }

  private getCategoryDto(slug: string): CategoryDto {
    const row = this.db.prepare(`
      SELECT
        categories.slug,
        categories.name,
        COUNT(reports.id) AS report_count
      FROM categories
      LEFT JOIN reports
        ON reports.category = categories.slug
       AND reports.deleted_at IS NULL
      WHERE categories.slug = @slug
      GROUP BY categories.slug, categories.name
    `).get({ slug }) as CategoryDto | undefined;

    if (!row) {
      throw new NotFoundException(`分类不存在：${slug}`);
    }
    return row;
  }

  private slugifyCategoryName(name: string): string {
    const ascii = name
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 24);

    if (ascii) return ascii;
    return `category-${Date.now().toString(36)}`;
  }

  private buildUniqueCategorySlug(baseSlug: string): string {
    const normalizedBase = baseSlug.slice(0, 32) || `category-${Date.now().toString(36)}`;
    let candidate = normalizedBase;
    let index = 2;

    while (this.stmts.getCategoryBySlug.get({ slug: candidate })) {
      const suffix = `-${index}`;
      candidate = `${normalizedBase.slice(0, Math.max(1, 40 - suffix.length))}${suffix}`;
      index += 1;
    }

    return candidate;
  }

  private finalDirOf(category: string, project: string, id: string): string {
    return path.join(config.reportsDir, category, project, id);
  }

  private isReservedDefaultProject(category: string, project: string): boolean {
    return category === 'default' && project === 'default';
  }

  private syncManifestTitle(row: PageRow, title: string): void {
    const manifestPath = path.join(this.finalDirOf(row.category, row.project, row.id), 'manifest.json');
    if (!fs.existsSync(manifestPath)) return;

    try {
      const raw = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as Record<string, unknown>;
      raw.title = title;
      fs.writeFileSync(manifestPath, JSON.stringify(raw, null, 2), 'utf-8');
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误';
      this.logger.warn(`同步 manifest 标题失败：${row.id} - ${message}`);
    }
  }

  private moveReportDir(row: PageRow, targetCategory: string, targetProject: string): void {
    const oldDir = this.finalDirOf(row.category, row.project, row.id);
    const newDir = this.finalDirOf(targetCategory, targetProject, row.id);
    if (oldDir === newDir || !fs.existsSync(oldDir)) return;
    if (fs.existsSync(newDir)) {
      throw new BadRequestException(`目标目录已存在：${row.id}`);
    }

    fs.mkdirSync(path.dirname(newDir), { recursive: true });
    try {
      fs.renameSync(oldDir, newDir);
    } catch {
      fs.cpSync(oldDir, newDir, { recursive: true });
      this.rmrf(oldDir);
    }

    if (this.isReservedDefaultProject(row.category, row.project)) {
      fs.mkdirSync(path.join(config.reportsDir, 'default', 'default'), { recursive: true });
      return;
    }
    this.removeEmptyParents(path.dirname(oldDir), path.join(config.reportsDir, row.category, row.project));
  }

  private legacyDirOf(category: string, project: string, iteration: string, id: string): string {
    return path.join(config.reportsDir, category, project, iteration, id);
  }

  private migrateLegacyIterationDirs(): void {
    const rows = this.db.prepare(`
      SELECT id, category, project, iteration
      FROM reports
      WHERE deleted_at IS NULL
    `).all() as Pick<PageRow, 'id' | 'category' | 'project' | 'iteration'>[];

    for (const row of rows) {
      const legacyDir = this.legacyDirOf(row.category, row.project, row.iteration, row.id);
      const finalDir = this.finalDirOf(row.category, row.project, row.id);
      if (!fs.existsSync(legacyDir) || fs.existsSync(finalDir)) continue;

      fs.mkdirSync(path.dirname(finalDir), { recursive: true });
      try {
        fs.renameSync(legacyDir, finalDir);
      } catch {
        fs.cpSync(legacyDir, finalDir, { recursive: true });
        this.rmrf(legacyDir);
      }

      this.removeEmptyParents(path.dirname(legacyDir), path.join(config.reportsDir, row.category, row.project));
    }
  }

  private removeEmptyParents(startDir: string, stopDir: string): void {
    let current = startDir;
    const stop = path.resolve(stopDir);
    while (path.resolve(current).startsWith(stop)) {
      if (!fs.existsSync(current) || fs.readdirSync(current).length > 0) break;
      fs.rmdirSync(current);
      if (path.resolve(current) === stop) break;
      current = path.dirname(current);
    }
  }

  private makeStagingDir(): string {
    return path.join(
      config.dataDir,
      '.staging',
      `upload-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    );
  }

  private dirSize(p: string): number {
    let total = 0;
    try {
      const stack = [p];
      while (stack.length) {
        const cur = stack.pop()!;
        const stat = fs.statSync(cur);
        if (stat.isDirectory()) {
          for (const name of fs.readdirSync(cur)) {
            stack.push(path.join(cur, name));
          }
        } else {
          total += stat.size;
        }
      }
    } catch {
      /* 忽略 */
    }
    return total;
  }

  private rmrf(p: string): void {
    try {
      fs.rmSync(p, { recursive: true, force: true });
    } catch {
      /* 忽略清理异常 */
    }
  }
}
