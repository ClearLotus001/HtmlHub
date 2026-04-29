﻿# HtmlHub — HTML 展示中心

集中管理和展示 HTML 静态页面的通用平台。

## 技术栈

- **前端**：Next.js 14 (App Router) + TypeScript + Tailwind CSS + shadcn/ui
- **后端**：NestJS + TypeScript
- **数据库**：SQLite（`better-sqlite3`，单文件零依赖）
- **文件存储**：本地文件系统
- **反向代理**：Nginx
- **部署**：Docker Compose（内网单机）

## 目录结构

```
HtmlHub/
├── apps/
│   ├── api/                    # NestJS 后端
│   └── web/                    # Next.js 前端
├── data/                       # 运行时数据（挂载卷）
│   ├── reports/                # 报告文件存储
│   │   └── <project>/<iteration>/<report_id>/
│   │       ├── index.html
│   │       ├── manifest.json
│   │       └── assets/
│   └── htmlhub.db             # SQLite 数据库
├── deploy/
│   ├── nginx.conf              # Nginx 配置
│   └── docker-compose.yml      # 一键部署
├── docs/
│   └── upload-spec.md          # HTML 内容上传规范
└── README.md
```

## 快速开始

### 开发模式

```bash
# 后端
cd apps/api
npm install
npm run start:dev       # 监听 3001

# 前端
cd apps/web
npm install
npm run dev             # 监听 3000
```

### 生产部署（内网）

```bash
cd deploy
docker compose up -d
# 访问 http://<内网IP>
```

## 核心约定

每份 AI 产出的报告必须是一个 zip 包，内含：

- `index.html`     报告入口（强制命名）
- `manifest.json`  报告元信息（必选，schema 见 [docs/report-spec.md](docs/report-spec.md)）
- `assets/`        内嵌资源目录（图片、视频、字体等）

资源必须使用相对路径引用，不得依赖外部 CDN。

## API 简要

| 方法 | 路径 | 说明 |
|---|---|---|
| GET  | `/api/pages`                     | 列表（支持 project、iteration、q 查询） |
| GET  | `/api/pages/:id`                 | 详情 |
| POST | `/api/pages/upload`              | 上传 zip 或 html；支持 query 覆盖字段 |
| GET  | `/api/pages/:id/download`        | 下载 zip |
| DELETE | `/api/pages/:id`               | 软删除（移入回收站） |
| PUT  | `/api/pages/:id/restore`         | 从回收站恢复（未物理清理时有效） |
| GET  | `/api/projects`                   | 项目/迭代树 |
| GET  | `/api/cleanup/config`             | 查看清理策略 |
| POST | `/api/cleanup/run?dryRun=1`       | 手动触发清理（dryRun 仅预演） |
| GET  | `/api/cleanup/runs`               | 最近运行汇总 |
| GET  | `/api/cleanup/logs?runId=xxx`     | 清理日志明细 |

## 访问地址

- Web UI：`http://<host>/`
- API：   `http://<host>/api`
- 页面：  `http://<host>/reports/<project>/<iteration>/<page_id>/index.html`
- 清理管理：`http://<host>/admin/cleanup`

## 自动清理

系统默认每天 **02:00** 执行清理：
- 超过 **90 天**（全局默认）的页面软删除并移入回收站
- 回收站中超过 **7 天** 的页面物理清理
- 支持按 `project` / `tag` 差异化配置保留天数（见 `apps/api/src/config.ts`）
- 所有操作留痕至 `cleanup_logs` 表，管理页可查看

环境变量覆盖：

| 变量 | 默认 |
|---|---|
| `CLEANUP_ENABLED`     | `true` |
| `CLEANUP_CRON`        | `0 0 2 * * *` |
| `CLEANUP_RETAIN_DAYS` | `90` |
| `TRASH_RETAIN_DAYS`   | `7` |
