﻿import * as path from 'node:path';

// 单条保留策略：可按 project 或 tag 覆盖全局默认
export interface RetentionRule {
  // 匹配维度：按项目名或按标签
  match: { project?: string; tag?: string };
  // 保留天数（从 uploaded_at 起计算）
  retainDays: number;
}

// 运行时配置：通过环境变量可覆盖，默认值适合内网开发
export const config = {
  // 监听端口
  port: parseInt(process.env.PORT || '3001', 10),

  // 数据根目录（持久化挂载点）
  dataDir: process.env.DATA_DIR || path.resolve(__dirname, '../../../data'),

  // 报告文件存放子目录
  get reportsDir() {
    return path.join(this.dataDir, 'reports');
  },

  // 回收站目录：软删除后物理文件先移到这里，超过 trashRetainDays 再彻底删除
  get trashDir() {
    return path.join(this.dataDir, '_trash');
  },

  // SQLite 文件路径
  get dbPath() {
    return path.join(this.dataDir, 'htmlhub.db');
  },

  // 上传限制
  upload: {
    // zip 包最大体积
    maxZipBytes: 200 * 1024 * 1024, // 200MB
    // 解压后总体积
    maxExtractedBytes: 500 * 1024 * 1024, // 500MB
    // 解压后总文件数
    maxFileCount: 5000,
    // 单文件最大体积
    maxSingleFileBytes: 100 * 1024 * 1024, // 100MB
    // 单 HTML 上传最大体积（自动封装前）
    maxSingleHtmlBytes: 20 * 1024 * 1024, // 20MB
  },

  // 自动清理策略
  cleanup: {
    // 总开关：关闭则不做任何自动清理
    enabled: (process.env.CLEANUP_ENABLED ?? 'true') === 'true',

    // cron 表达式（秒级，NestJS 默认 6 段）：默认每天凌晨 2 点
    cron: process.env.CLEANUP_CRON || '0 0 2 * * *',

    // 全局默认保留天数（软删除触发线）
    defaultRetainDays: parseInt(process.env.CLEANUP_RETAIN_DAYS || '90', 10),

    // 回收站中物理文件保留天数（过后彻底删除，支持窗口期回滚）
    trashRetainDays: parseInt(process.env.TRASH_RETAIN_DAYS || '7', 10),

    // 单次扫描最大处理数量，防止一次性处理过多导致抖动
    batchLimit: 2000,

    // 差异化保留策略：优先级 tag > project > 默认
    // 示例：长期保留 release 项目；归档类标签保留更久
    rules: [
      { match: { project: 'release' }, retainDays: 365 },
      { match: { tag: 'archive' }, retainDays: 365 },
      // 可按需扩展
    ] as RetentionRule[],
  },

  // 宽松兼容模式
  compat: {
    // 允许无 manifest.json 的 zip 上传（自动生成）
    allowMissingManifest: true,
    // 允许直接上传单个 .html 文件（服务端自动封装）
    allowSingleHtmlUpload: true,
    // 自动识别入口候选文件名（按顺序匹配）
    entryCandidates: ['index.html', 'index.htm', 'main.html', 'report.html'],
    // 自动生成 manifest 时默认的 project
    fallbackProject: 'uncategorized',
  },
};
