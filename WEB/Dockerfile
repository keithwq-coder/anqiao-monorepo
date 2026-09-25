# 多阶段构建：deps → build → runtime（Next.js standalone）
# Node 24-alpine，对应服务器既有部署方式

# ---- deps ----
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- build ----
FROM node:24-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---- runtime ----
FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# 仅拷贝 standalone 运行所需文件
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public

# 线索落地目录（由 docker-compose 挂载卷持久化）
RUN mkdir -p data && chmod 700 data

EXPOSE 3000
CMD ["node", "server.js"]
