'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  api,
  type CleanupConfig,
  type CleanupRun,
  type CleanupSummary,
} from '@/lib/api';
import { formatBytes, formatTime } from '@/lib/utils';

import { alertDialog, confirmDialog } from '@/components/ui/Dialog';
import { Tooltip } from '@/components/ui/Tooltip';
import { Select } from '@/components/ui/Select';
import {
  ArrowLeft,
  Clock,
  HelpCircle,
  Loader2,
  PlayCircle,
  Eye,
  Trash2,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Pencil,
  Save,
  X,
  Plus,
  Infinity as InfinityIcon,
  AlertTriangle,
} from 'lucide-react';

// 管理页：查看清理策略、手动触发、查看历史
export default function CleanupAdminPage() {
  const [cfg, setCfg] = useState<CleanupConfig | null>(null);
  const [runs, setRuns] = useState<CleanupRun[]>([]);
  const [running, setRunning] = useState(false);
  const [lastResult, setLastResult] = useState<CleanupSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  // 编辑模式相关状态
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<CleanupConfig | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [c, r] = await Promise.all([api.cleanupConfig(), api.cleanupRuns(20)]);
      setCfg(c);
      setRuns(r);
    } catch (e: any) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  const trigger = async (dry: boolean) => {
    setRunning(true);
    setError(null);
    try {
      const summary = await api.cleanupRun(dry);
      setLastResult(summary);
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="container py-6 max-w-4xl">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        返回列表
      </Link>

      <h1 className="mt-3 text-xl font-semibold flex items-center gap-2 text-foreground">
        <ShieldCheck className="h-5 w-5 text-primary" />
        自动清理管理
      </h1>

      {/* 当前策略 - macOS 玻璃态 */}
      {cfg && !editing && (
        <div className="animate-macos-fade-in glass-card rounded-2xl p-5 mt-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-[15px] text-card-foreground">当前策略</h2>
            <button
              type="button"
              onClick={() => { setEditForm({ ...cfg, rules: cfg.rules.map(r => ({ ...r, match: { ...r.match } })) }); setEditing(true); }}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12px] font-medium text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors"
            >
              <Pencil className="h-3.5 w-3.5" />
              编辑
            </button>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-[14px]">
            <Info label="启用状态" value={cfg.enabled ? '已启用' : '已禁用'} icon={cfg.enabled ? CheckCircle2 : XCircle} iconColor={cfg.enabled ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'} />
            <Info label="调度 Cron" value={<code className="text-[12px] bg-secondary px-1.5 py-0.5 rounded text-secondary-foreground">{cfg.cron}</code>} />
            <Info label="默认保留天数" value={`${cfg.defaultRetainDays} 天`} />
            <Info
              label="回收站保留天数"
              value={`${cfg.trashRetainDays} 天（窗口期内可恢复）`}
            />
            <Info label="单次扫描上限" value={cfg.batchLimit === 0 ? '不限制（全部扫描）' : `${cfg.batchLimit} 条`} />
          </div>

          {cfg.rules.length > 0 && (
            <div className="mt-4">
              <div className="flex items-center gap-1.5 text-xs font-medium mb-1.5 text-muted-foreground">
                差异化规则（按 project / tag 覆盖默认保留天数）
                <Tooltip content="匹配到差异化规则的报告将使用规则中指定的保留天数，而非默认保留天数。优先级：精确匹配 > 默认规则。" side="right">
                  <span className="cursor-help"><HelpCircle className="h-3 w-3" /></span>
                </Tooltip>
              </div>
              <div className="space-y-1">
                {cfg.rules.map((r, i) => (
                  <div
                    key={i}
                    className="text-xs px-2 py-1 rounded bg-muted/50 inline-flex items-center gap-2 mr-2 text-muted-foreground"
                  >
                    <span>
                      {r.match.project && <>project=<b className="text-foreground">{r.match.project}</b></>}
                      {r.match.tag && <>tag=<b className="text-foreground">{r.match.tag}</b></>}
                    </span>
                    <span>→</span>
                    <span>保留 {r.retainDays} 天</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 编辑策略表单 */}
      {editing && editForm && (
        <div className="animate-macos-slide-down glass-card rounded-2xl p-5 mt-5">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-semibold text-[15px] text-card-foreground">编辑策略</h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => { setEditing(false); setEditForm(null); }}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border text-[12px] font-medium text-muted-foreground hover:text-foreground hover:bg-foreground/5 disabled:opacity-50 transition-colors"
              >
                <X className="h-3.5 w-3.5" />
                取消
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={async () => {
                  setSaving(true);
                  setError(null);
                  try {
                    const updated = await api.updateCleanupConfig(editForm);
                    setCfg(updated);
                    setEditing(false);
                    setEditForm(null);
                    await alertDialog('策略已更新', { type: 'success' });
                  } catch (e: any) {
                    setError(e.message);
                  } finally {
                    setSaving(false);
                  }
                }}
                className="inline-flex items-center gap-1.5 h-8 px-4 rounded-lg bg-primary text-[12px] font-semibold text-primary-foreground shadow-sm shadow-primary/25 hover:brightness-110 disabled:opacity-50 transition-all duration-200 active:scale-[0.98]"
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                保存
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {/* 启用状态 */}
            <div className="flex items-center gap-3">
              <label className="text-[13px] text-muted-foreground w-28 shrink-0">启用状态</label>
              <button
                type="button"
                onClick={() => setEditForm({ ...editForm, enabled: !editForm.enabled })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  editForm.enabled ? 'bg-primary' : 'bg-muted-foreground/30'
                }`}
              >
                <span className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                  editForm.enabled ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
              <span className="text-[13px] text-foreground">{editForm.enabled ? '已启用' : '已禁用'}</span>
            </div>

            {/* Cron 表达式 */}
            <div className="flex items-center gap-3">
              <label className="text-[13px] text-muted-foreground w-28 shrink-0">调度 Cron</label>
              <input
                value={editForm.cron}
                onChange={(e) => setEditForm({ ...editForm, cron: e.target.value })}
                className="h-9 flex-1 px-3 rounded-xl border border-border bg-card text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground focus:border-primary/50 focus:ring-2 focus:ring-primary/20 font-mono"
                placeholder="0 0 2 * * *"
              />
            </div>

            {/* 默认保留天数 */}
            <div className="flex items-center gap-3">
              <label className="text-[13px] text-muted-foreground w-28 shrink-0">默认保留天数</label>
              <input
                type="number"
                min={1}
                value={editForm.defaultRetainDays}
                onChange={(e) => setEditForm({ ...editForm, defaultRetainDays: Math.max(1, parseInt(e.target.value) || 1) })}
                className="h-9 w-32 px-3 rounded-xl border border-border bg-card text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
              />
              <span className="text-[13px] text-muted-foreground">天</span>
            </div>

            {/* 回收站保留天数 */}
            <div className="flex items-center gap-3">
              <label className="text-[13px] text-muted-foreground w-28 shrink-0">回收站保留天数</label>
              <input
                type="number"
                min={1}
                value={editForm.trashRetainDays}
                onChange={(e) => setEditForm({ ...editForm, trashRetainDays: Math.max(1, parseInt(e.target.value) || 1) })}
                className="h-9 w-32 px-3 rounded-xl border border-border bg-card text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
              />
              <span className="text-[13px] text-muted-foreground">天</span>
            </div>

            {/* 单次扫描上限 */}
            <div className="flex items-center gap-3">
              <label className="text-[13px] text-muted-foreground w-28 shrink-0">单次扫描上限</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  value={editForm.batchLimit}
                  onChange={(e) => setEditForm({ ...editForm, batchLimit: Math.max(0, parseInt(e.target.value) || 0) })}
                  className="h-9 w-32 px-3 rounded-xl border border-border bg-card text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                />
                <span className="text-[13px] text-muted-foreground">条</span>
                <button
                  type="button"
                  onClick={() => setEditForm({ ...editForm, batchLimit: 0 })}
                  className={`inline-flex items-center gap-1 h-9 px-3 rounded-xl border text-[12px] font-medium transition-all ${
                    editForm.batchLimit === 0
                      ? 'border-primary/50 bg-primary/10 text-primary'
                      : 'border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground'
                  }`}
                >
                  <InfinityIcon className="h-3 w-3" />
                  全部扫描
                </button>
              </div>
              <Tooltip content="设为 0 表示不限制扫描数量，每次清理将扫描全部报告" side="right">
                <span className="cursor-help text-muted-foreground"><HelpCircle className="h-3.5 w-3.5" /></span>
              </Tooltip>
            </div>

            {/* 差异化规则 */}
            <div className="pt-2">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-1.5">
                  <label className="text-[13px] font-medium text-foreground">差异化规则</label>
                  <Tooltip content="为特定 project 或 tag 设置独立的保留天数，覆盖默认值。例如：重要项目可设置更长的保留期。" side="right">
                    <span className="cursor-help text-muted-foreground"><HelpCircle className="h-3.5 w-3.5" /></span>
                  </Tooltip>
                </div>
                <button
                  type="button"
                  onClick={() => setEditForm({
                    ...editForm,
                    rules: [...editForm.rules, { match: { project: '' }, retainDays: 365 }],
                  })}
                  className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg text-[11px] font-medium text-primary hover:bg-primary/10 transition-colors"
                >
                  <Plus className="h-3 w-3" />
                  添加规则
                </button>
              </div>
              {editForm.rules.length === 0 && (
                <div className="text-[12px] text-muted-foreground py-3 text-center border border-dashed border-border rounded-xl">
                  暂无差异化规则，所有报告使用默认保留天数
                </div>
              )}
              <div className="space-y-2">
                {editForm.rules.map((rule, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-3 rounded-xl bg-muted/40 border border-border/50">
                    <Select
                      value={rule.match.project !== undefined ? 'project' : 'tag'}
                      options={[
                        { value: 'project', label: 'project' },
                        { value: 'tag', label: 'tag' },
                      ]}
                      onChange={(val) => {
                        const newRules = [...editForm.rules];
                        if (val === 'project') {
                          newRules[idx] = { ...rule, match: { project: rule.match.project || rule.match.tag || '' } };
                        } else {
                          newRules[idx] = { ...rule, match: { tag: rule.match.tag || rule.match.project || '' } };
                        }
                        setEditForm({ ...editForm, rules: newRules });
                      }}
                    />
                    <span className="text-[12px] text-muted-foreground">=</span>
                    <input
                      value={rule.match.project ?? rule.match.tag ?? ''}
                      onChange={(e) => {
                        const newRules = [...editForm.rules];
                        if (rule.match.project !== undefined) {
                          newRules[idx] = { ...rule, match: { project: e.target.value } };
                        } else {
                          newRules[idx] = { ...rule, match: { tag: e.target.value } };
                        }
                        setEditForm({ ...editForm, rules: newRules });
                      }}
                      placeholder="匹配值"
                      className="h-8 flex-1 min-w-0 px-2.5 rounded-lg border border-border bg-card text-[12px] text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/50"
                    />
                    <span className="text-[12px] text-muted-foreground">→ 保留</span>
                    <input
                      type="number"
                      min={1}
                      value={rule.retainDays}
                      onChange={(e) => {
                        const newRules = [...editForm.rules];
                        newRules[idx] = { ...rule, retainDays: Math.max(1, parseInt(e.target.value) || 1) };
                        setEditForm({ ...editForm, rules: newRules });
                      }}
                      className="h-8 w-20 px-2.5 rounded-lg border border-border bg-card text-[12px] text-foreground outline-none text-center focus:border-primary/50"
                    />
                    <span className="text-[12px] text-muted-foreground">天</span>
                    <button
                      type="button"
                      onClick={() => {
                        const newRules = editForm.rules.filter((_, i) => i !== idx);
                        setEditForm({ ...editForm, rules: newRules });
                      }}
                      className="shrink-0 p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                      aria-label="删除规则"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 手动触发 - macOS 玻璃态 */}
      <div className="animate-macos-fade-in glass-card rounded-2xl p-5 mt-5">
        <h2 className="font-semibold text-[15px] mb-4 text-card-foreground">手动触发</h2>
        <div className="flex gap-3">
          <button
            type="button"
            disabled={running}
            onClick={() => trigger(true)}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-secondary text-[13px] font-medium text-secondary-foreground hover:bg-secondary/80 disabled:opacity-50 transition-colors"
          >
            {running ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Eye className="h-3.5 w-3.5" />
            )}
            预演
          </button>
          <button
            type="button"
            disabled={running}
            onClick={async () => {
              const ok = await confirmDialog('确定立即执行一次清理吗？超期报告将被软删除或物理清理。');
              if (!ok) return;
              trigger(false);
            }}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-primary text-[13px] font-semibold text-primary-foreground shadow-sm shadow-primary/25 hover:brightness-110 disabled:opacity-50 transition-all duration-200 active:scale-[0.98]"
          >
            {running ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <PlayCircle className="h-3.5 w-3.5" />
            )}
            立即执行
          </button>
        </div>

        {lastResult && (
          <div className="mt-4 text-[12px] bg-muted/50 rounded-lg p-3.5 space-y-1.5 ring-1 ring-border">
            <div>
              <span className="text-muted-foreground">run_id：</span>
              <code className="text-[11px] bg-secondary px-1 py-0.5 rounded text-secondary-foreground">{lastResult.run_id}</code>
            </div>
            <div className="text-muted-foreground">
              扫描 <b className="text-foreground">{lastResult.scanned}</b> 条 · 软删除{' '}
              <b className="text-foreground">{lastResult.soft_deleted}</b> 条 · 物理清理{' '}
              <b className="text-foreground">{lastResult.purged}</b> 条 · 释放{' '}
              <b className="text-foreground">{formatBytes(lastResult.bytes_freed)}</b>
            </div>
            {lastResult.errors.length > 0 && (
              <div className="text-destructive">
                {lastResult.errors.length} 条失败：
                {lastResult.errors.slice(0, 3).map((e) => e.id).join(', ')}
                {lastResult.errors.length > 3 && ' ...'}
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="mt-3 text-[13px] text-destructive">{error}</div>
        )}
      </div>

      {/* 历史运行 - macOS 玻璃态 */}
      <div className="animate-macos-fade-in glass-card rounded-2xl p-5 mt-5">
        <h2 className="font-semibold text-[15px] mb-4 text-card-foreground flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          最近运行记录
        </h2>
        {runs.length === 0 && (
          <div className="text-[13px] text-muted-foreground">暂无记录</div>
        )}
        {runs.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead className="text-muted-foreground border-b border-border">
                <tr>
                  <th className="text-left py-2 pr-4 font-medium">开始时间</th>
                  <th className="text-left py-2 pr-4 font-medium">run_id</th>
                  <th className="text-right py-2 pr-4 font-medium">软删除</th>
                  <th className="text-right py-2 pr-4 font-medium">物理清理</th>
                  <th className="text-right py-2 pr-4 font-medium">释放体积</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => (
                  <tr key={r.run_id} className="border-b border-border/60 last:border-0 hover:bg-muted/40 transition-colors">
                    <td className="py-2 pr-4 text-muted-foreground">{formatTime(r.started_at)}</td>
                    <td className="py-2 pr-4">
                      <code className="text-[11px] bg-secondary px-1 py-0.5 rounded text-secondary-foreground">{r.run_id.slice(0, 8)}</code>
                    </td>
                    <td className="py-2 pr-4 text-right text-muted-foreground">{r.soft_deleted}</td>
                    <td className="py-2 pr-4 text-right text-muted-foreground">{r.purged}</td>
                    <td className="py-2 pr-4 text-right text-muted-foreground">
                      {formatBytes(r.bytes_freed || 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 清理机制说明 */}
      <div className="mt-6 rounded-xl border border-border/60 bg-card/50 px-4 py-3 backdrop-blur-sm">
        <div className="flex items-start gap-2.5 text-[12px] leading-relaxed text-muted-foreground">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
          <p>
            清理分两阶段：超过保留天数的报告会先移入
            <strong className="text-foreground">回收站</strong>，再保留{' '}
            <strong className="text-foreground">{cfg?.trashRetainDays ?? 7}</strong>{' '}
            天后自动永久删除。在此期间可前往
            <Link href="/admin/trash" className="mx-0.5 font-medium text-primary hover:underline">
              回收站
            </Link>
            恢复。
          </p>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value, icon: Icon, iconColor }: { label: string; value: React.ReactNode; icon?: React.ComponentType<any>; iconColor?: string }) {
  return (
    <div className="flex items-center gap-2.5">
      {Icon && <Icon className={`h-4 w-4 ${iconColor || 'text-muted-foreground'}`} />}
      <span className="text-muted-foreground w-24 shrink-0 text-[13px]">{label}</span>
      <span className="text-foreground text-[14px]">{value}</span>
    </div>
  );
}
