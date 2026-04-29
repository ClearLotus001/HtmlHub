# HTML 内容上传规范 v1.1

> v1.1 变更：
> - 新增**宽松兼容模式**：允许无 `manifest.json` 的 zip 上传，允许直接上传单个 `.html` 文件
> - 新增**自动清理规则**与保留期说明

## 交付形态总览

系统同时接受三种上传形态（按推荐度排序）：

| 形态 | 标识（DB `source`） | 说明 |
|---|---|---|
| 🥇 标准 zip | `standard` | 含完整 `manifest.json`，字段严格校验 |
| 🥈 宽松 zip | `auto_manifest` | 缺 `manifest.json`，由系统自动推断元信息 |
| 🥉 单 HTML | `single_html` | 直接上传 `.html`，服务端自动封装为标准目录 |

上传时可通过 query 参数补全/覆盖任意字段：
```
POST /api/reports/upload?project=search&iteration=v1.0&title=xxx&author=xx&tags=a,b
```

---

## 1. 标准交付：带 `manifest.json` 的 zip

（与 v1.0 相同）

```
<任意根名>.zip
├── index.html          # 必选入口
├── manifest.json       # 必选元信息
├── assets/             # 可选资源
└── data/               # 可选数据
```

### manifest.json Schema

```json
{
  "schema_version": "1.0",
  "id": "page_20260427_abc123",
  "title": "搜索引擎 Q1 性能评测页面",
  "project": "search-engine",
  "iteration": "2026-Q1",
  "version": "1.0.0",
  "author": "ai-agent-v2",
  "tags": ["性能", "评测"],
  "summary": "本页面展示了……",
  "created_at": "2026-04-27T10:00:00+08:00",
  "entry": "index.html",
  "cover": "assets/img/cover.png"
}
```

### 字段约束

| 字段 | 类型 | 必选 | 约束 |
|---|---|---|---|
| schema_version | string | ✅ | 固定 `"1.0"` |
| id             | string | ✅ | 正则 `^[a-zA-Z0-9_-]{3,64}$`，全局唯一 |
| title          | string | ✅ | 1-200 字 |
| project        | string | ✅ | 正则 `^[a-z0-9-]{1,40}$` |
| iteration      | string | ✅ | 正则 `^[A-Za-z0-9._-]{1,40}$` |
| version        | string | ❌ | semver |
| author         | string | ❌ | |
| tags           | string[] | ❌ | 最多 10 个，每个 ≤ 20 字 |
| summary        | string | ❌ | ≤ 500 字 |
| created_at     | string | ✅ | ISO 8601 |
| entry          | string | ❌ | 默认 `index.html` |
| cover          | string | ❌ | 封面相对路径 |

---

## 2. 宽松模式：无 manifest 的 zip 🆕

若 zip 中**缺失**或 `manifest.json` 不合法，系统按以下顺序推断：

### 入口识别
1. 根目录查找：`index.html` → `index.htm` → `main.html` → `report.html`
2. 根目录第一个 `*.html`
3. 深度遍历（最多 3 层）查找 `*.html`，兼容 zip 内多套一层目录的情况

### 元数据自动填充
| 字段 | 来源 |
|---|---|
| `title` | HTML `<title>` 标签 → 文件名 → "未命名页面" |
| `project` | query 参数 → `uncategorized` |
| `iteration` | query 参数 → `YYYY-MM`（当前月份） |
| `created_at` | 入口 HTML 文件的 mtime → 当前时间 |
| `id` | 自动生成 `page_<时间戳>_<随机>` |
| `version/author/tags/summary` | 可通过 query 传入 |

> 无 manifest 的内容上传后，系统会**自动回写**一份合法的 `manifest.json` 到目录，保证后续下载的 zip 内容自洽。

---

## 3. 单 HTML 直传 🆕

直接上传 `.html` / `.htm` 文件（≤ 20MB），系统会：
1. 将文件重命名为 `index.html`
2. 推断 manifest（同宽松模式）
3. 封装为标准目录 `<project>/<iteration>/<id>/index.html`

适用场景：快速投递未整理的单页内容；调试阶段。

---

## 4. HTML 书写约定（所有模式通用）

### 禁止项
- ❌ 不得引用外部 CDN
- ❌ 不得使用 `top`/`parent`/`window.opener`
- ❌ 不得使用绝对路径引用资源

### 必选项
- ✅ `<meta charset="UTF-8">`
- ✅ `<meta name="viewport" content="width=device-width, initial-scale=1">`
- ✅ `<title>`（宽松模式下将被用作页面标题）

---

## 5. 体积限制

| 项 | 上限 |
|---|---|
| zip 文件 | 200 MB |
| 解压后总体积 | 500 MB |
| 文件数量 | 5000 |
| 单文件体积 | 100 MB |
| 单 HTML 直传 | 20 MB |

---

## 6. 自动清理规则 🆕

系统每天凌晨 02:00（默认 cron `0 0 2 * * *`）自动执行清理，分两阶段：

### 阶段 1：软删除
- 条件：`uploaded_at` 至今超过**保留天数**
- 动作：数据库标记 `deleted_at`，物理目录移动到 `_trash/<id>-<timestamp>/`
- 从列表页消失，**但仍可通过**`PUT /api/reports/:id/restore`**恢复**

### 阶段 2：物理清理
- 条件：在回收站中 `deleted_at` 至今超过 `trashRetainDays`（默认 7 天）
- 动作：彻底删除物理文件，置 `purged_at`，**不可恢复**

### 保留天数策略
- 全局默认：**90 天**（可通过环境变量 `CLEANUP_RETAIN_DAYS` 调整）
- 差异化规则（配置在 `config.cleanup.rules`）：
  - `project = release` → 保留 365 天
  - `tag = archive` → 保留 365 天
- 优先级：tag > project > 全局；多规则命中取**最大值**（偏安全）

### 日志与审计
- 所有清理动作写入 `cleanup_logs` 表，字段：`run_id / action / page_id / reason / retain_days / bytes_freed / created_at`
- 管理页 `/admin/cleanup` 可查看策略、最近运行、手动触发预演 / 执行

### 环境变量
| 变量 | 默认值 | 说明 |
|---|---|---|
| `CLEANUP_ENABLED` | `true` | 总开关 |
| `CLEANUP_CRON` | `0 0 2 * * *` | NestJS 6 段 cron |
| `CLEANUP_RETAIN_DAYS` | `90` | 默认保留天数 |
| `TRASH_RETAIN_DAYS` | `7` | 回收站缓冲天数 |

---

## 7. 最小示例

**index.html**
```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>搜索引擎 Q1 性能评测页面</title>
</head>
<body><h1>页面内容</h1></body>
</html>
```

**manifest.json**（标准模式必需）
```json
{
  "schema_version": "1.0",
  "id": "page_search_q1_20260427",
  "title": "搜索引擎 Q1 性能评测页面",
  "project": "search-engine",
  "iteration": "2026-Q1",
  "created_at": "2026-04-27T10:00:00+08:00",
  "tags": ["性能", "评测"]
}
```

打包：
```bash
zip -r content.zip index.html manifest.json assets/
```

宽松模式（仅 index.html）：
```bash
zip -r content.zip index.html assets/
# 上传时补充：?project=search-engine&iteration=2026-Q1
```
