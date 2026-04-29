'use client';

import * as React from 'react';
import { Tooltip } from '@/components/ui/Tooltip';

/* ==================== 主题 Context ==================== */

type Theme = 'light' | 'dark' | 'system';

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: 'light' | 'dark';
  setTheme: (t: Theme) => void;
}

const ThemeContext = React.createContext<ThemeContextValue>({
  theme: 'system',
  resolvedTheme: 'light',
  setTheme: () => {},
});

export function useTheme() {
  return React.useContext(ThemeContext);
}

/* ==================== 主题工具函数 ==================== */

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function getStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'system';
  const stored = localStorage.getItem('htmlreport-theme');
  if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  return 'system';
}

function applyTheme(resolved: 'light' | 'dark') {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.classList.remove('light', 'dark');
  root.classList.add(resolved);
  root.setAttribute('data-theme', resolved);
}

/* ==================== ThemeProvider ==================== */

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = React.useState<Theme>(() => getStoredTheme());
  const [systemTheme, setSystemTheme] = React.useState<'light' | 'dark'>(() => getSystemTheme());

  const resolvedTheme = theme === 'system' ? systemTheme : theme;

  // 同步主题到 DOM 和本地存储
  React.useEffect(() => {
    localStorage.setItem('htmlreport-theme', theme);
    applyTheme(resolvedTheme);
  }, [theme, resolvedTheme]);

  // 监听系统主题变化
  React.useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemChange = (e: MediaQueryListEvent) => {
      setSystemTheme(e.matches ? 'dark' : 'light');
    };
    mq.addEventListener('change', handleSystemChange);
    return () => mq.removeEventListener('change', handleSystemChange);
  }, []);

  const setTheme = React.useCallback((t: Theme) => {
    setThemeState(t);
  }, []);

  const value = React.useMemo(
    () => ({ theme, resolvedTheme, setTheme }),
    [theme, resolvedTheme, setTheme]
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

/* ==================== ThemeToggle 组件 ==================== */

export function ThemeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme();

  const isDark = resolvedTheme === 'dark';
  const isSystem = theme === 'system';

  const cycle = () => {
    if (isSystem) {
      setTheme('light');
    } else if (!isDark) {
      setTheme('dark');
    } else {
      setTheme('system');
    }
  };

  const tooltipText = isDark ? '深色模式' : isSystem ? '跟随系统' : '浅色模式';

  return (
    <Tooltip content={tooltipText} side="bottom">
    <button
      type="button"
      aria-label={isDark ? '当前为深色模式，点击切换主题' : isSystem ? '当前跟随系统，点击切换主题' : '当前为浅色模式，点击切换主题'}
      onClick={cycle}
      className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-all duration-200 hover:bg-foreground/5 hover:text-foreground active:scale-95"
    >
      {isDark ? (
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      ) : isSystem ? (
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ) : (
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      )}
    </button>
    </Tooltip>
  );
}
