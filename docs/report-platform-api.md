# 报告平台 API 速查

本文档用于后续设计 AI Skills 时调用报告平台操作接口。

## 基础约定

- API 前缀：`/api`
- 报告访问路径：`/reports/{category}/{project}/{id}/{entry}`
- 系统保留目录：`default/default`
  - 不允许重命名、删除、移动该项目目录
  - 允许将报告移动到该目录，也允许从该目录移动具体报告
- `category`：小写字母、数字、短横线，长度 1-40
- `project`：小写字母、数字、短横线，长度 1-40
- `id`：字母、数字、下划线或短横线，长度 3-64

## 健康检查

### `GET /api/health`

返回服务状态。

```json
{ "ok": true, "ts": 1710000000000 }
```

## 报告查询

### `GET /api/pages`

分页查询报告列表。

Query：

| 参数 | 必填 | 说明 |
| --- | --- | --- |
| `category` | 否 | 分类 slug |
| `project` | 否 | 项目目录名 |
| `iteration` | 否 | 迭代元数据筛选，已不作为导航目录层级 |
| `q` | 否 | 搜索关键词 |
| `page` | 否 | 页码，默认 1 |
| `pageSize` | 否 | 每页数量，默认 20，最大 100 |

### `GET /api/pages/{id}`

获取单个报告详情。

## 项目导航树

### `GET /api/projects`

返回分类 / 项目 / 报告三层树，推荐 AI Skills 用它做目录感知。

响应结构：

```json
[
  {
    "slug": "default",
    "name": "默认分类",
    "report_count": 6,
    "projects": [
      {
        "project": "default",
        "report_count": 2,
        "reports": [
          {
            "id": "report-id",
            "title": "报告标题",
            "uploaded_at": "2026-05-07T00:00:00.000Z"
          }
        ]
      }
    ]
  }
]
```

## 分类操作

### `GET /api/categories`

返回分类列表及分类下报告数量。

### `POST /api/categories`

新建分类。

```json
{ "name": "性能测试" }
```

### `PUT /api/categories/{slug}`

重命名分类显示名。默认分类不可编辑。

```json
{ "name": "新的分类名称" }
```

### `DELETE /api/categories/{slug}`

删除分类。默认分类不可删除。分类下未删除报告会迁移到默认分类。

## 项目目录操作

### `PUT /api/categories/{slug}/projects/{project}`

重命名项目目录。`default/default` 不可重命名。

```json
{ "project": "new-project" }
```

### `DELETE /api/categories/{slug}/projects/{project}`

删除项目目录。目录下报告移入回收站。`default/default` 不可删除。

### `PUT /api/categories/{slug}/projects/{project}/location`

移动项目目录。`default/default` 不可移动。目标项目已存在时会合并。

```json
{
  "category": "target-category",
  "project": "target-project"
}
```

`project` 可省略，省略时使用源项目名。

## 报告移动

### `PUT /api/pages/{id}/location`

移动单个报告到目标分类/项目目录。

```json
{
  "category": "target-category",
  "project": "target-project"
}
```

## 报告上传

### `POST /api/pages/upload`

上传 `.zip` 或 `.html`。使用 `multipart/form-data`，字段名为 `file`。

可选 Query：

| 参数 | 说明 |
| --- | --- |
| `id` | 指定报告 ID |
| `category` | 目标分类 |
| `project` | 目标项目目录 |
| `iteration` | 迭代元数据 |
| `title` | 标题 |
| `author` | 作者 |
| `version` | 版本 |
| `tags` | 逗号分隔标签 |
| `summary` | 摘要 |

## 删除与回收站

### `DELETE /api/pages/{id}`

将单个报告移入回收站。

### `DELETE /api/pages/batch`

批量移入回收站。

```json
{ "ids": ["report-a", "report-b"] }
```

### `PUT /api/pages/{id}/restore`

从回收站恢复报告。

### `DELETE /api/pages/{id}/purge`

彻底清理报告文件。

## AI Skills 推荐操作流

1. 先调用 `GET /api/projects` 获取完整目录树。
2. 若目标分类不存在，调用 `POST /api/categories` 创建分类。
3. 移动单报告使用 `PUT /api/pages/{id}/location`。
4. 移动项目目录使用 `PUT /api/categories/{slug}/projects/{project}/location`。
5. 删除前先二次确认，删除项目目录会将目录下所有报告移入回收站。
