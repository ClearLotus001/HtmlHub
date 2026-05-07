import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // standalone 模式：生产构建时只输出精简的独立运行包，大幅减小镜像体积
  output: 'standalone',
  // 开发环境下将 /api 与 /reports 代理到后端，避免跨域
  async rewrites() {
    const apiTarget = process.env.NEXT_PUBLIC_API_TARGET || 'http://localhost:3001';
    return [
      // API 接口代理
      { source: '/api/:path*', destination: `${apiTarget}/api/:path*` },
      // 报告静态文件代理（分类/项目/id/文件路径）
      // /reports/[id] 仍由 Next.js 页面处理，不匹配此规则
      {
        source: '/reports/:category/:project/:id/:path*',
        destination: `${apiTarget}/reports/:category/:project/:id/:path*`,
      },
    ];
  },
};

export default nextConfig;
