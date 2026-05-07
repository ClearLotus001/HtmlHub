/**
 * 从后端获取 OpenAPI 规范数据
 * 用于在前端页面中动态渲染 API 文档
 */

export interface OpenApiSpec {
  openapi: string;
  info: {
    title: string;
    description: string;
    version: string;
  };
  servers?: { url: string; description?: string }[];
  tags?: { name: string; description?: string }[];
  paths: Record<string, Record<string, any>>;
  components?: {
    schemas?: Record<string, any>;
    [key: string]: any;
  };
  [key: string]: any;
}

const API_BASE = process.env.NEXT_PUBLIC_API_TARGET || 'http://21.91.222.45:9090';

/**
 * 获取后端生成的 OpenAPI JSON 规范
 * 在 Server Component 中直接调用，无需通过代理
 */
export async function getApiDocsData(): Promise<OpenApiSpec> {
  try {
    // 服务端渲染时直接访问后端地址
    const baseUrl = process.env.NODE_ENV === 'development' 
      ? 'http://localhost:3001' 
      : (process.env.NEXT_PUBLIC_API_TARGET || 'http://21.91.222.45:9090');

    const res = await fetch(`${baseUrl}/api-docs-json`, {
      cache: 'no-store',
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      throw new Error(`获取 API 文档失败: ${res.status}`);
    }

    const spec = await res.json();
    return spec as OpenApiSpec;
  } catch (err: any) {
    console.error('获取 API 文档数据失败:', err.message);
    // 返回空结构，避免页面崩溃
    return {
      openapi: '3.0.0',
      info: { title: 'API 文档', description: '获取失败，请检查后端服务', version: '0.0' },
      tags: [],
      paths: {},
      components: { schemas: {} },
    };
  }
}
