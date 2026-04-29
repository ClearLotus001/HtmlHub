'use client';

import * as React from 'react';
import { ChevronDown, Check } from 'lucide-react';

/* ==================== 自定义 Select 下拉框 ==================== */

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  /** 下拉框最小宽度 */
  minWidth?: number;
}

export function Select({
  value,
  options,
  onChange,
  placeholder = '请选择',
  className = '',
  minWidth,
}: SelectProps) {
  const [open, setOpen] = React.useState(false);
  const [highlightIdx, setHighlightIdx] = React.useState(-1);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);

  const selectedOption = options.find((o) => o.value === value);

  // 点击外部关闭
  React.useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // 打开时重置高亮到当前选中项
  React.useEffect(() => {
    if (open) {
      const idx = options.findIndex((o) => o.value === value);
      setHighlightIdx(idx >= 0 ? idx : 0);
    }
  }, [open, options, value]);

  // 键盘导航
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightIdx((prev) => Math.min(prev + 1, options.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightIdx((prev) => Math.max(prev - 1, 0));
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (highlightIdx >= 0 && highlightIdx < options.length) {
          onChange(options[highlightIdx].value);
          setOpen(false);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setOpen(false);
        break;
    }
  };

  // 滚动高亮项到可见区域
  React.useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.children[highlightIdx] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [highlightIdx, open]);

  return (
    <div
      ref={containerRef}
      className={`relative inline-flex ${className}`}
      onKeyDown={handleKeyDown}
      style={minWidth ? { minWidth } : undefined}
    >
      {/* 触发按钮 */}
      <button
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((prev) => !prev)}
        className={`
          inline-flex h-8 w-full items-center justify-between gap-1.5 rounded-lg border
          px-2.5 text-[12px] font-medium outline-none transition-all duration-200
          ${open
            ? 'border-primary/50 bg-card shadow-sm ring-2 ring-primary/20'
            : 'border-border bg-card hover:border-primary/30 hover:bg-card/80'
          }
          text-foreground
        `}
      >
        <span className={selectedOption ? 'text-foreground' : 'text-muted-foreground'}>
          {selectedOption?.label ?? placeholder}
        </span>
        <ChevronDown
          className={`h-3 w-3 shrink-0 text-muted-foreground transition-transform duration-200 ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* 下拉面板 */}
      {open && (
        <div
          ref={listRef}
          role="listbox"
          className="
            absolute left-0 top-full z-[9998] mt-1 max-h-48 w-full min-w-[120px] overflow-auto
            rounded-xl border border-border bg-popover p-1 shadow-lg backdrop-blur-xl
            animate-macos-scale-in
          "
        >
          {options.map((opt, idx) => {
            const isSelected = opt.value === value;
            const isHighlighted = idx === highlightIdx;
            return (
              <div
                key={opt.value}
                role="option"
                aria-selected={isSelected}
                onMouseEnter={() => setHighlightIdx(idx)}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={`
                  flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5
                  text-[12px] font-medium transition-colors duration-100
                  ${isHighlighted ? 'bg-primary/10 text-foreground' : 'text-muted-foreground'}
                  ${isSelected ? 'text-primary' : ''}
                `}
              >
                <span className="flex-1">{opt.label}</span>
                {isSelected && <Check className="h-3 w-3 shrink-0 text-primary" />}
              </div>
            );
          })}
          {options.length === 0 && (
            <div className="px-2.5 py-3 text-center text-[12px] text-muted-foreground">
              暂无选项
            </div>
          )}
        </div>
      )}
    </div>
  );
}
