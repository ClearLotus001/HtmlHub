# ---------- Builder ----------
FROM node:20-alpine AS builder
WORKDIR /app

# 先拷贝依赖清单，利用 Docker 层缓存（依赖不变时跳过 npm install）
COPY apps/web/package.json apps/web/package-lock.json* ./
RUN npm install --no-audit --no-fund && npm cache clean --force

COPY apps/web/tsconfig.json apps/web/next.config.ts apps/web/postcss.config.ts apps/web/eslint.config.mjs apps/web/next-env.d.ts ./
COPY apps/web/src ./src

# 生产构建（standalone 模式会在 next.config.ts 中启用）
RUN npm run build

# ---------- Runtime ----------
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

# standalone 模式只需拷贝精简后的输出，无需完整 node_modules
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000
# standalone 模式直接用 node 启动，无需 npm
CMD ["node", "server.js"]
