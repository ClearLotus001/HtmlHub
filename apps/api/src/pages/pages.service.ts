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
  project?: string;
  iteration?: string;
  q?: string;
  page?: number;
  pageSize?: number;
}

@Injectable()
export class PagesService {
  private readonly logger = new Logger(PagesService.name);

  // 预编译语句缓存（better-sqlite3 推荐做法，避免重复 prepare 开销）
  private readonly stmts: ReturnType<typeof this.prepareStatements>;

  constructor(@Inject(DB_TOKEN) private readonly db: Database.Database) {
    this.stmts = this.prepareStatements();
  }

  /** 集中预编译所有常用 SQL 语句 */
  private prepareStatements() {
    return {
      findById: this.db.prepare<{ id: string }>(
        'SELECT * FROM reports WHERE id = @id AND deleted_at IS NULL',
      ),
      findByIdIncludeDeleted: this.db.prepare<{ id: string }>(
        'SELECT * FROM reports WHERE id = @id',
      ),
      checkIdExists: this.db.prepare<{ id: string }>(
        'SELECT id FROM reports WHERE id = @id AND deleted_at IS NULL',
      ),
      projectTree: this.db.prepare(`
        SELECT project, iteration, COUNT(*) AS cnt
        FROM reports
        WHERE deleted_at IS NULL
        GROUP BY project, iteration
        ORDER BY project ASC, iteration DESC
      `),
      listForCleanup: this.db.prepare<{ limit: number }>(
        'SELECT * FROM reports WHERE purged_at IS NULL ORDER BY uploaded_at ASC LIMIT @limit',
      ),
      insert: this.db.prepare(`
        INSERT INTO reports
          (id, title, project, iteration, version, author, tags, summary, cover,
           entry, size_bytes, file_count, source, created_at, uploaded_at)
        VALUES
          (@id, @title, @project, @iteration, @version, @author, @tags, @summary, @cover,
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

    const where: string[] = ['deleted_at IS NULL'];
    const params: Record<string, any> = {};

    if (query.project) {
      where.push('project = @project');
      params.project = query.project;
    }
    if (query.iteration) {
      where.push('iteration = @iteration');
      params.iteration = query.iteration;
    }
    if (query.q) {
      where.push('(title LIKE @q OR summary LIKE @q OR tags LIKE @q)');
      params.q = `%${query.q}%`;
    }

    const whereSql = `WHERE ${where.join(' AND ')}`;

    // 动态查询无法预编译，但使用命名参数仍然安全
    const total = (
      this.db
        .prepare(`SELECT COUNT(*) AS c FROM reports ${whereSql}`)
        .get(params) as { c: number }
    ).c;

    const rows = this.db
      .prepare(
        `SELECT * FROM reports ${whereSql}
         ORDER BY uploaded_at DESC
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

  /** 项目/迭代聚合，用于前端侧栏树 */
  projectTree(): { project: string; iterations: string[] }[] {
    const rows = this.stmts.projectTree.all() as {
      project: string;
      iteration: string;
      cnt: number;
    }[];

    const map = new Map<string, Set<string>>();
    for (const r of rows) {
      if (!map.has(r.project)) map.set(r.project, new Set());
      map.get(r.project)!.add(r.iteration);
    }
    return Array.from(map.entries()).map(([project, set]) => ({
      project,
      iterations: Array.from(set),
    }));
  }

  // --------------------- 变更 ---------------------

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
    const fromDir = this.finalDirOf(row.project, row.iteration, row.id);
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

    const finalDir = this.finalDirOf(row.project, row.iteration, row.id);
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
      const origin = this.finalDirOf(row.project, row.iteration, row.id);
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
    const dir = this.finalDirOf(page.project, page.iteration, page.id);
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

    const where: string[] = ['deleted_at IS NOT NULL', 'purged_at IS NULL'];
    const params: Record<string, any> = {};

    if (query.q) {
      where.push('(title LIKE @q OR summary LIKE @q OR tags LIKE @q)');
      params.q = `%${query.q}%`;
    }

    const whereSql = `WHERE ${where.join(' AND ')}`;

    const total = (
      this.db
        .prepare(`SELECT COUNT(*) AS c FROM reports ${whereSql}`)
        .get(params) as { c: number }
    ).c;

    const rows = this.db
      .prepare(
        `SELECT * FROM reports ${whereSql}
         ORDER BY deleted_at DESC
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
    const finalDir = this.finalDirOf(
      manifest.project,
      manifest.iteration,
      manifest.id,
    );
    let moved = false;

    try {
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

  private finalDirOf(project: string, iteration: string, id: string): string {
    return path.join(config.reportsDir, project, iteration, id);
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
