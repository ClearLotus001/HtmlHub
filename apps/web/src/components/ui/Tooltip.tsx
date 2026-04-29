'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';

/* ==================== Tooltip ==================== */

interface TooltipProps {
  content: string;
  children: React.ReactElement;
  side?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
}

/** 间距（触发元素与浮层之间的距离） */
const GAP = 8;

export function Tooltip({ content, children, side = 'top', className }: TooltipProps) {
  const [visible, setVisible] = React.useState(false);
  const triggerRef = React.useRef<HTMLDivElement>(null);
  const tooltipRef = React.useRef<HTMLDivElement>(null);
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [pos, setPos] = React.useState<{ top: number; left: number }>({ top: 0, left: 0 });

  const show = () => {
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setVisible(true), 300);
  };

  const hide = () => {
    clearTimeout(timeoutRef.current);
    setVisible(false);
  };

  // 计算浮层位置
  React.useEffect(() => {
    if (!visible) return;

    const calcPos = () => {
      const trigger = triggerRef.current;
      const tip = tooltipRef.current;
      if (!trigger || !tip) return;

      const rect = trigger.getBoundingClientRect();
      const tipRect = tip.getBoundingClientRect();

      let top = 0;
      let left = 0;

      switch (side) {
        case 'top':
          top = rect.top - tipRect.height - GAP + window.scrollY;
          left = rect.left + rect.width / 2 - tipRect.width / 2 + window.scrollX;
          break;
        case 'bottom':
          top = rect.bottom + GAP + window.scrollY;
          left = rect.left + rect.width / 2 - tipRect.width / 2 + window.scrollX;
          break;
        case 'left':
          top = rect.top + rect.height / 2 - tipRect.height / 2 + window.scrollY;
          left = rect.left - tipRect.width - GAP + window.scrollX;
          break;
        case 'right':
          top = rect.top + rect.height / 2 - tipRect.height / 2 + window.scrollY;
          left = rect.right + GAP + window.scrollX;
          break;
      }

      setPos({ top, left });
    };

    // 首次渲染后立即计算
    requestAnimationFrame(calcPos);
  }, [visible, side]);

  return (
    <div
      ref={triggerRef}
      className={`relative inline-flex ${className || ''}`}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}

      {/* 通过 Portal 渲染到 body，不受父容器 overflow 裁剪 */}
      {visible &&
        createPortal(
          <div
            ref={tooltipRef}
            role="tooltip"
            style={{ position: 'absolute', top: pos.top, left: pos.left }}
            className="z-[9997] whitespace-nowrap animate-fade-in-up pointer-events-none rounded-lg border border-border bg-card px-3 py-1.5 text-[12px] font-medium leading-none text-card-foreground shadow-md backdrop-blur-xl"
          >
            {content}
          </div>,
          document.body,
        )}
    </div>
  );
}
