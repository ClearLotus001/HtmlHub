import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import Database from 'better-sqlite3';
import * as crypto from 'node:crypto';
import { DB_TOKEN } from '../database.module';
import { config, RetentionRule } from '../config';
import { PagesService } from '../pages/pages.service';
import { PageRow } from '../pages/page.types';

// 单次清理运行汇总
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

// 清理日志行
export interface CleanupLogRow {
  id: number;
  run_id: string;
  action: 'soft_delete' | 'purge' | 'restore' | 'skip';
  report_id: string;
  reason: string | null;
  retain_days: number | null;
  bytes_freed: number;
  created_at: string;
}

@Injectable()
export class CleanupService {
  private readonly logger = new Logger(CleanupService.name);

  // 预编译语句缓存
  private readonly stmts: ReturnType<typeof this.prepareStatements>;

  constructor(
    @Inject(DB_TOKEN) private readonly db: Database.Database,
    private readonly pages: PagesService,
  ) {
    this.stmts = this.prepareStatements();
  }

  /** 集中预编译所有常用 SQL 语句 */
  private prepareStatements() {
    return {
      insertLog: this.db.prepare(`
        INSERT INTO cleanup_logs
          (run_id, action, report_id, reason, retain_days, bytes_freed, created_at)
        VALUES (@run_id, @action, @report_id, @reason, @retain_days, @bytes_freed, @created_at)
      `),
      logsByRunId: this.db.prepare<{ run_id: string; limit: number }>(
        'SELECT * FROM cleanup_logs WHERE run_id = @run_id ORDER BY id DESC LIMIT @limit',
      ),
      logsRecent: this.db.prepare<{ limit: number }>(
        'SELECT * FROM cleanup_logs ORDER BY id DESC LIMIT @limit',
      ),
      listRuns: this.db.prepare<{ limit: number }>(`
        SELECT run_id,
               MIN(created_at) AS started_at,
               SUM(CASE WHEN action='soft_delete' THEN 1 ELSE 0 END) AS soft_deleted,
               SUM(CASE WHEN action='purge'       THEN 1 ELSE 0 END) AS purged,
               SUM(bytes_freed) AS bytes_freed
        FROM cleanup_logs
        GROUP BY run_id
        ORDER BY started_at DESC
        LIMIT @limit
      `),
    };
  }

  // --------------------- 定时入口 ---------------------

  // cron 表达式从配置读，默认每天 02:00
  @Cron(config.cleanup.cron, { name: 'htmlhub-cleanup' })
  scheduledRun() {
    if (!config.cleanup.enabled) {
      this.logger.debug('清理任务已禁用，跳过');
      return;
    }
    this.runOnce('scheduled').catch((e) =>
      this.logger.error(`定时清理失败：${e?.message || e}`),
    );
  }

  // --------------------- 对外方法 ---------------------

  /**
   * 执行一次清理。可手动触发（例如通过控制器）。
   * 两阶段：
   *   阶段1：uploaded_at 超过策略保留天数 → 软删除到回收站
   *   阶段2：回收站中 deleted_at 超过 trashRetainDays → 物理清理
   */
  async runOnce(
    trigger: 'scheduled' | 'manual' = 'manual',
    dryRun = false,
  ): Promise<CleanupSummary> {
    const runId = crypto.randomUUID();
    const startedAt = new Date().toISOString();
    const summary: CleanupSummary = {
      run_id: runId,
      started_at: startedAt,
      finished_at: startedAt,
      scanned: 0,
      soft_deleted: 0,
      purged: 0,
      bytes_freed: 0,
      errors: [],
    };

    this.logger.log(
      `清理开始 run_id=${runId} trigger=${trigger} dryRun=${dryRun}`,
    );

    const now = Date.now();
    const rows = this.pages.listForCleanup();
    summary.scanned = rows.length;

    for (const row of rows) {
      try {
        const retainDays = this.resolveRetainDays(row);

        // --- 阶段1：超过保留期的活跃报告 ---
        if (!row.deleted_at) {
          const uploaded = Date.parse(row.uploaded_at);
          const ageDays = (now - uploaded) / (1000 * 86400);
          if (ageDays >= retainDays) {
            const reason = `${trigger}:retention_${retainDays}d`;
            if (!dryRun) {
              this.pages.softDelete(row.id, reason);
              this.writeLog(runId, 'soft_delete', row.id, reason, retainDays, 0);
            }
            summary.soft_deleted++;
          }
          continue;
        }

        // --- 阶段2：回收站中超过 trashRetainDays 的 → 物理清理 ---
        const deletedAt = Date.parse(row.deleted_at);
        const trashAgeDays = (now - deletedAt) / (1000 * 86400);
        if (
          trashAgeDays >= config.cleanup.trashRetainDays &&
          !row.purged_at
        ) {
          const reason = `${trigger}:trash_purge_${config.cleanup.trashRetainDays}d`;
          let freed = 0;
          if (!dryRun) {
            freed = this.pages.purge(row.id);
            this.writeLog(runId, 'purge', row.id, reason, retainDays, freed);
          }
          summary.purged++;
          summary.bytes_freed += freed;
        }
      } catch (e: any) {
        summary.errors.push({ id: row.id, message: e?.message || String(e) });
        this.logger.warn(`清理失败 id=${row.id}: ${e?.message}`);
      }
    }

    summary.finished_at = new Date().toISOString();
    this.logger.log(
      `清理完成 run_id=${runId} soft=${summary.soft_deleted} purge=${summary.purged} freed=${summary.bytes_freed}B errors=${summary.errors.length}`,
    );
    return summary;
  }

  /** 读取清理日志（支持按 run_id 过滤） */
  listLogs(runId?: string, limit = 200): CleanupLogRow[] {
    if (runId) {
      return this.stmts.logsByRunId.all({ run_id: runId, limit }) as CleanupLogRow[];
    }
    return this.stmts.logsRecent.all({ limit }) as CleanupLogRow[];
  }

  /** 聚合最近若干次 run */
  listRuns(limit = 20): Array<{
    run_id: string;
    started_at: string;
    soft_deleted: number;
    purged: number;
    bytes_freed: number;
  }> {
    return this.stmts.listRuns.all({ limit }) as any[];
  }

  // --------------------- 内部：策略解析 ---------------------

  /**
   * 根据报告命中的 tag / project 决定该条记录的保留天数。
   * 优先级：tag 规则 > project 规则 > 全局默认。
   * 规则列表若有多条命中，取最大保留天数（更保守，防止误删）。
   */
  private resolveRetainDays(row: PageRow): number {
    const tags: string[] = row.tags ? this.safeJsonParseArray(row.tags) : [];
    const candidates: number[] = [];

    for (const rule of config.cleanup.rules) {
      if (this.matchRule(rule, row.project, tags)) {
        candidates.push(rule.retainDays);
      }
    }

    if (candidates.length === 0) return config.cleanup.defaultRetainDays;
    return Math.max(...candidates);
  }

  private matchRule(
    rule: RetentionRule,
    project: string,
    tags: string[],
  ): boolean {
    if (rule.match.project && rule.match.project === project) return true;
    if (rule.match.tag && tags.includes(rule.match.tag)) return true;
    return false;
  }

  private safeJsonParseArray(raw: string): string[] {
    try {
      const v = JSON.parse(raw);
      return Array.isArray(v) ? v : [];
    } catch {
      return [];
    }
  }

  private writeLog(
    runId: string,
    action: CleanupLogRow['action'],
    reportId: string,
    reason: string,
    retainDays: number,
    bytesFreed: number,
  ) {
    this.stmts.insertLog.run({
      run_id: runId,
      action,
      report_id: reportId,
      reason,
      retain_days: retainDays,
      bytes_freed: bytesFreed,
      created_at: new Date().toISOString(),
    });
  }
}
