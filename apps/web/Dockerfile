# ---------- Builder ----------
FROM node:20-alpine AS builder
WORKDIR /app

COPY apps/web/package.json ./
RUN npm install --no-audit --no-fund

COPY apps/web/tsconfig.json apps/web/next.config.ts apps/web/postcss.config.ts apps/web/eslint.config.mjs apps/web/next-env.d.ts ./
COPY apps/web/src ./src

# 生产构建
RUN npm run build

# ---------- Runtime ----------
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/src ./src

EXPOSE 3000
CMD ["npm", "run", "start"]
