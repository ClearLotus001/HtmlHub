import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // 开发环境下将 /api 与 /reports 代理到后端，避免跨域
  async rewrites() {
    const apiTarget = process.env.NEXT_PUBLIC_API_TARGET || 'http://localhost:3001';
    return [
      // API 接口代理
      { source: '/api/:path*', destination: `${apiTarget}/api/:path*` },
      // 报告静态文件代理（至少 3 级路径：project/iteration/id/file）
      // /reports/[id] 由 Next.js 页面处理，不匹配此规则
      { source: '/reports/:p1/:p2/:p3/:p4*', destination: `${apiTarget}/reports/:p1/:p2/:p3/:p4*` },
    ];
  },
};

export default nextConfig;
