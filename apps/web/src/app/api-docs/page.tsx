import type { Metadata } from 'next';
import { FileJson, BookOpen, Terminal, Code, ChevronRight } from 'lucide-react';
import { getApiDocsData } from './get-docs-data';

export const metadata: Metadata = {
  title: 'API 文档 - HtmlReport',
  description: 'AI HTML 报告管理系统 API 接口文档',
};

export const dynamic = 'force-dynamic';

export default async function ApiDocsPage() {
  const spec = await getApiDocsData();

  // 按 tag 分组
  const groups = spec.tags || [];
  const pathsByTag: Record<string, { path: string; method: string; data: any }[]> = {};

  for (const [path, methods] of Object.entries(spec.paths || {})) {
    for (const [method, data] of Object.entries(methods as any)) {
      const d = data as any;
      const tag = d.tags?.[0] || 'other';
      if (!pathsByTag[tag]) pathsByTag[tag] = [];
      pathsByTag[tag].push({ path, method: method.toUpperCase(), data: d });
    }
  }

  const methodColors: Record<string, string> = {
    GET: 'bg-emerald-500',
    POST: 'bg-blue-500',
    DELETE: 'bg-red-500',
    PUT: 'bg-amber-500',
    PATCH: 'bg-purple-500',
  };

  return (
    <div className="min-h-screen bg-background">
      {/* 页面标题区 */}
      <div className="border-b border-border bg-card/70">
        <div className="container mx-auto max-w-6xl px-6 py-12">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-purple-600 shadow-lg shadow-primary/20">
              <Code className="h-7 w-7 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">API 文档</h1>
              <p className="mt-1.5 text-base text-muted-foreground">
                {spec.info?.description || 'AI HTML 报告管理系统接口文档'} · v{spec.info?.version || '1.0'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto max-w-6xl px-6 py-10">
        {/* 快速上手 */}
        <div className="mb-10 rounded-2xl border border-border bg-card p-8 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <BookOpen className="h-5 w-5 text-indigo-500 dark:text-indigo-400" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">快速上手</h2>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-xl bg-slate-50 p-5 dark:bg-slate-800/50">
              <h3 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-300">Base URL</h3>
              <code className="block rounded-lg bg-slate-100 px-4 py-2.5 text-sm text-emerald-600 dark:bg-slate-700/50 dark:text-emerald-400">
                {spec.servers?.[0]?.url || 'http://localhost:3001'}
              </code>
            </div>
            <div className="rounded-xl bg-slate-50 p-5 dark:bg-slate-800">
              <h3 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-300">文档自动更新</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                本文档根据后端代码自动生成，修改接口后刷新即可看到更新
              </p>
            </div>
          </div>
        </div>

        {/* 接口列表 */}
        {groups.map((tag: any) => {
          const endpoints = pathsByTag[tag.name] || [];
          if (endpoints.length === 0) return null;

          const Icon = tag.name === 'cleanup' ? Terminal : FileJson;
          const color = tag.name === 'cleanup'
            ? 'from-orange-500 to-red-500'
            : 'from-blue-500 to-cyan-500';

          return (
            <div key={tag.name} className="mb-8">
              <div className="flex items-center gap-3 mb-5">
                <div className={`flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br ${color} shadow-lg`}>
                  <Icon className="h-4.5 w-4.5 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">{tag.description || tag.name}</h2>
                </div>
              </div>

              <div className="space-y-4">
                {endpoints.map((ep, idx) => (
                  <details
                    key={idx}
                    className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
                  >
                    <summary className="flex cursor-pointer items-center gap-4 px-6 py-4 hover:bg-muted/50 dark:hover:bg-slate-800/50">
                      <span
                        className={`shrink-0 rounded-lg px-3 py-1 text-xs font-bold text-white ${methodColors[ep.method] || 'bg-slate-500'}`}
                      >
                        {ep.method}
                      </span>
                      <code className="flex-1 break-all text-sm font-medium text-slate-700 dark:text-slate-300">
                        {ep.path}
                      </code>
                      <span className="shrink-0 text-sm font-medium text-slate-500 dark:text-slate-400">
                        {ep.data.summary || ''}
                      </span>
                      <ChevronRight className="h-4 w-4 text-slate-400 transition-transform group-open:rotate-90 dark:text-slate-500" />
                    </summary>

                    <div className="px-6 pb-5 pt-1">
                      {ep.data.description && (
                        <p className="mb-4 text-sm text-slate-600 dark:text-slate-400">{ep.data.description}</p>
                      )}

                      {/* 请求参数 */}
                      {ep.data.parameters && ep.data.parameters.length > 0 && (
                        <div className="mb-5">
                          <h4 className="mb-2.5 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                            请求参数
                          </h4>
                          <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="bg-slate-50 text-left text-xs text-slate-500 dark:bg-slate-700/50 dark:text-slate-400">
                                  <th className="px-4 py-2.5 font-medium">名称</th>
                                  <th className="px-4 py-2.5 font-medium">位置</th>
                                  <th className="px-4 py-2.5 font-medium">必填</th>
                                  <th className="px-4 py-2.5 font-medium">说明</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {ep.data.parameters.map((p: any, i: number) => (
                                  <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                                    <td className="px-4 py-2 font-mono text-xs text-indigo-600 dark:text-indigo-400">
                                      {p.name}
                                    </td>
                                    <td className="px-4 py-2 text-xs text-slate-500 dark:text-slate-400">{p.in}</td>
                                    <td className="px-4 py-2">
                                      {p.required ? (
                                        <span className="rounded bg-red-50 px-2 py-0.5 text-xs text-red-600 dark:bg-red-900/30 dark:text-red-400">是</span>
                                      ) : (
                                        <span className="rounded bg-slate-50 px-2 py-0.5 text-xs text-slate-400 dark:bg-slate-800 dark:text-slate-500">否</span>
                                      )}
                                    </td>
                                    <td className="px-4 py-2 text-xs text-slate-600 dark:text-slate-400">
                                      {p.description || ''}
                                      {p.schema?.example !== undefined && (
                                        <code className="ml-1 text-[10px] text-slate-400 dark:text-slate-500">
                                          eg: {JSON.stringify(p.schema.example).slice(0, 40)}
                                        </code>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* 请求体 */}
                      {ep.data.requestBody && (
                        <div className="mb-5">
                          <h4 className="mb-2.5 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                            请求体
                          </h4>
                          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
                            {Object.entries(ep.data.requestBody.content || {}).map(([ct, media]: [string, any]) => (
                              <div key={ct}>
                                <div className="mb-1 text-[10px] text-slate-400 dark:text-slate-500">{ct}</div>
                                {media.schema?.properties && (
                                  <table className="mb-3 w-full text-xs">
                                    <thead>
                                      <tr className="text-left text-slate-500 dark:text-slate-400">
                                        <th className="py-1 font-medium">字段</th>
                                        <th className="py-1 font-medium">类型</th>
                                        <th className="py-1 font-medium">必填</th>
                                        <th className="py-1 font-medium">说明</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                      {Object.entries(media.schema.properties).map(([name, prop]: [string, any]) => (
                                        <tr key={name} className="dark:hover:bg-slate-800/50">
                                          <td className="py-1 font-mono text-indigo-600 dark:text-indigo-400">{name}</td>
                                          <td className="py-1 text-slate-500 dark:text-slate-400">{prop.type || prop.schema?.type || ''}</td>
                                          <td className="py-1">
                                            {media.schema.required?.includes(name) ? (
                                              <span className="rounded bg-red-50 px-1.5 py-0.5 text-[10px] text-red-600 dark:bg-red-900/30 dark:text-red-400">是</span>
                                            ) : (
                                              <span className="text-[10px] text-slate-400 dark:text-slate-500">否</span>
                                            )}
                                          </td>
                                          <td className="py-1 text-slate-600 dark:text-slate-400">{prop.description || ''}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 返回示例 */}
                      {ep.data.responses && (
                        <div>
                          <h4 className="mb-2.5 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                            返回响应
                          </h4>
                          {Object.entries(ep.data.responses).map(([code, res]: [string, any]) => (
                            <div key={code} className="mb-3">
                              <div className="mb-1 flex items-center gap-2">
                                <span className={`text-xs font-bold ${code.startsWith('2') ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`}>
                                  {code}
                                </span>
                                <span className="text-xs text-slate-400 dark:text-slate-500">{res.description || ''}</span>
                              </div>
                              {res.content && (
                                <pre className="overflow-x-auto rounded-xl bg-slate-100 p-4 text-xs leading-relaxed text-slate-700 dark:bg-slate-700/50 dark:text-slate-300">
                                  <code>
                                    {res.content['application/json']?.example
                                      ? JSON.stringify(res.content['application/json'].example, null, 2)
                                      : res.content['application/json']?.schema
                                      ? JSON.stringify(res.content['application/json'].schema, null, 2).slice(0, 500)
                                      : '无示例'}
                                  </code>
                                </pre>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </details>
                ))}
              </div>
            </div>
          );
        })}

        {/* 数据模型 */}
        {spec.components?.schemas && (
          <div className="mt-10 rounded-2xl border border-border bg-card p-8 shadow-sm">
            <h2 className="mb-6 text-lg font-bold text-foreground">数据模型</h2>
            <div className="space-y-6">
              {Object.entries(spec.components.schemas).map(([name, schema]: [string, any]) => (
                <div key={name}>
                  <h3 className="mb-3 text-base font-semibold text-slate-700 dark:text-slate-300">{name}</h3>
                  <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50 text-left text-xs text-slate-500 dark:bg-slate-700/50 dark:text-slate-400">
                          <th className="px-4 py-2.5 font-medium">字段</th>
                          <th className="px-4 py-2.5 font-medium">类型</th>
                          <th className="px-4 py-2.5 font-medium">说明</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                        {schema.properties &&
                          Object.entries(schema.properties).map(([prop, def]: [string, any]) => (
                            <tr key={prop} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                              <td className="px-4 py-2 font-mono text-xs text-indigo-600 dark:text-indigo-400">
                                {prop}
                                {schema.required?.includes(prop) && (
                                  <span className="ml-1 text-[10px] text-red-400 dark:text-red-500">*</span>
                                )}
                              </td>
                              <td className="px-4 py-2 text-xs text-slate-500 dark:text-slate-400">
                                {def.type || def.$ref?.split('/').pop() || ''}
                              </td>
                              <td className="px-4 py-2 text-xs text-slate-600 dark:text-slate-400">
                                {def.description || ''}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 页脚 */}
        <div className="mt-10 text-center text-sm text-slate-400 dark:text-slate-500">
          HtmlReport API 文档 · 根据后端代码自动生成
        </div>
      </div>
    </div>
  );
}
