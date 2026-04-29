﻿import { Global, Module, OnModuleDestroy, Logger } from '@nestjs/common';
import Database from 'better-sqlite3';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { config } from './config';

// 数据库实例 Token
export const DB_TOKEN = 'SQLITE_DB';

// 导出 Database 类型，方便其他模块引用
export type AppDatabase = Database.Database;

// 建表 SQL（幂等）
const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS reports (
  id            TEXT PRIMARY KEY,
  title         TEXT NOT NULL,
  project       TEXT NOT NULL,
  iteration     TEXT NOT NULL,
  version       TEXT,
  author        TEXT,
  tags          TEXT,                -- JSON 数组字符串
  summary       TEXT,
  cover         TEXT,
  entry         TEXT NOT NULL DEFAULT 'index.html',
  size_bytes    INTEGER NOT NULL DEFAULT 0,
  file_count    INTEGER NOT NULL DEFAULT 0,
  source        TEXT NOT NULL DEFAULT 'standard', -- 来源：standard | auto_manifest | single_html
  created_at    TEXT NOT NULL,       -- manifest 中的创建时间
  uploaded_at   TEXT NOT NULL,       -- 上传到系统的时间
  deleted_at    TEXT,                -- 软删除时间
  trashed_path  TEXT,                -- 回收站中的物理目录绝对路径（彻底删除后置 NULL）
  purged_at     TEXT                 -- 物理清理时间
);

CREATE INDEX IF NOT EXISTS idx_reports_project   ON reports(project);
CREATE INDEX IF NOT EXISTS idx_reports_iteration ON reports(iteration);
CREATE INDEX IF NOT EXISTS idx_reports_deleted   ON reports(deleted_at);
CREATE INDEX IF NOT EXISTS idx_reports_uploaded  ON reports(uploaded_at DESC);

-- 清理日志：审计与回滚依据
CREATE TABLE IF NOT EXISTS cleanup_logs (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id        TEXT NOT NULL,              -- 单次清理运行的 UUID
  action        TEXT NOT NULL,              -- soft_delete | purge | restore | skip
  report_id     TEXT NOT NULL,
  reason        TEXT,                       -- 触发原因（如 retention_90d）
  retain_days   INTEGER,                    -- 本次命中的保留天数
  bytes_freed   INTEGER DEFAULT 0,          -- 释放字节数（purge 时填写）
  created_at    TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cleanup_run  ON cleanup_logs(run_id);
CREATE INDEX IF NOT EXISTS idx_cleanup_time ON cleanup_logs(created_at DESC);
`;

// 版本化迁移：旧版 reports 表升级（新增 source/trashed_path/purged_at 列）
const MIGRATIONS: Array<{ check: string; apply: string[] }> = [
  {
    check: "SELECT 1 FROM pragma_table_info('reports') WHERE name='source'",
    apply: ["ALTER TABLE reports ADD COLUMN source TEXT NOT NULL DEFAULT 'standard'"],
  },
  {
    check: "SELECT 1 FROM pragma_table_info('reports') WHERE name='trashed_path'",
    apply: ['ALTER TABLE reports ADD COLUMN trashed_path TEXT'],
  },
  {
    check: "SELECT 1 FROM pragma_table_info('reports') WHERE name='purged_at'",
    apply: ['ALTER TABLE reports ADD COLUMN purged_at TEXT'],
  },
];

// 存储数据库实例引用，用于模块销毁时关闭
let dbInstance: Database.Database | null = null;

@Global()
@Module({
  providers: [
    {
      provide: DB_TOKEN,
      useFactory: (): Database.Database => {
        const logger = new Logger('Database');

        // 确保数据目录存在
        fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });
        fs.mkdirSync(config.reportsDir, { recursive: true });
        fs.mkdirSync(config.trashDir, { recursive: true });

        // 直接使用 better-sqlite3 打开/创建数据库文件
        const db = new Database(config.dbPath);

        // 启用 WAL 模式（提升并发读写性能）
        db.pragma('journal_mode = WAL');
        db.pragma('foreign_keys = ON');

        // 初始化表结构
        db.exec(SCHEMA_SQL);

        // 执行增量迁移（幂等）
        for (const m of MIGRATIONS) {
          const exists = db.prepare(m.check).get();
          if (!exists) {
            for (const sql of m.apply) db.exec(sql);
            logger.log(`迁移完成: ${m.apply.join('; ')}`);
          }
        }

        dbInstance = db;
        logger.log(`SQLite 就绪: ${config.dbPath}`);
        return db;
      },
    },
  ],
  exports: [DB_TOKEN],
})
export class DatabaseModule implements OnModuleDestroy {
  onModuleDestroy() {
    if (dbInstance) {
      dbInstance.close();
      dbInstance = null;
    }
  }
}
