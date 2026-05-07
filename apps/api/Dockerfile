# ---------- Builder ----------
FROM node:20-alpine AS builder
WORKDIR /app

# 先拷贝依赖清单，利用 Docker 层缓存（依赖不变时跳过 npm install）
COPY apps/api/package.json apps/api/package-lock.json* ./
RUN npm install --no-audit --no-fund && npm cache clean --force

COPY apps/api/tsconfig.json apps/api/nest-cli.json ./
COPY apps/api/src ./src
RUN npm run build

# 仅保留生产依赖，并清理缓存
RUN npm prune --omit=dev && npm cache clean --force

# ---------- Runtime ----------
FROM node:20-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001
ENV DATA_DIR=/data

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json

# 数据目录交给 compose 挂载
VOLUME ["/data"]

EXPOSE 3001
CMD ["node", "dist/main.js"]
