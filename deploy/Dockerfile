# syntax=docker/dockerfile:1.6
# 三元课堂 · 多阶段 Dockerfile
#
# 目标：一份 Dockerfile 同时产出两个最终镜像
#   - target=server  → NestJS API + WebSocket 服务（Node 20-alpine）
#   - target=web     → nginx 静态托管大屏 + 管理后台 + /api /socket.io 反代
#
# 不构建 uniapp-student / uniapp-teacher（apk 走 HBuilderX 云打包）。
#
# 用法（手动构建）：
#   docker build -f deploy/Dockerfile --target server -t snyuan-server .
#   docker build -f deploy/Dockerfile --target web    -t snyuan-web    .
# 常规走 deploy/docker-compose.yml，无需手动 build。

ARG NODE_VERSION=20
ARG PNPM_VERSION=9.15.9
ARG NGINX_VERSION=1.27-alpine

# ──────────────────────────────────────────────────────────────────────────────
# Stage: pnpm — 装上 pnpm，作为后续所有 Node 阶段的共同基底
# ──────────────────────────────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS pnpm
ARG PNPM_VERSION
# 可选：覆写 apk 仓库源（中国用 aliyun 镜像，避免 dl-cdn.alpinelinux.org 慢/卡）
ARG APK_MIRROR=
RUN if [ -n "$APK_MIRROR" ]; then \
      sed -i "s|https\\?://dl-cdn\\.alpinelinux\\.org|${APK_MIRROR}|g" /etc/apk/repositories; \
    fi
RUN apk add --no-cache git python3 make g++ libc6-compat
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate
WORKDIR /repo

# ──────────────────────────────────────────────────────────────────────────────
# Stage: deps — 只 copy workspace 清单 + lockfile，最大化利用 Docker 层缓存
#   - uniapp-* 的 package.json 也 copy（pnpm 解析 workspace 需要它存在）
#   - 用 --filter 把它们排除掉，不下载几百 MB 的 dcloudio 依赖
# ──────────────────────────────────────────────────────────────────────────────
FROM pnpm AS deps
# 可选：覆写 npm registry（中国环境用 https://registry.npmmirror.com/ 提速）
ARG NPM_REGISTRY=
RUN if [ -n "$NPM_REGISTRY" ]; then pnpm config set registry "$NPM_REGISTRY"; fi

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY packages/shared/package.json packages/shared/
COPY apps/server/package.json apps/server/
COPY apps/teacher-screen/package.json apps/teacher-screen/
COPY apps/admin/package.json apps/admin/
COPY uniapp-student/package.json uniapp-student/
COPY uniapp-teacher/package.json uniapp-teacher/

# 只装我们要构建的 4 个包及其传递依赖
RUN pnpm install --frozen-lockfile \
    --filter '@snyuan/shared...' \
    --filter '@snyuan/server...' \
    --filter '@snyuan/teacher-screen...' \
    --filter '@snyuan/admin...'

# ──────────────────────────────────────────────────────────────────────────────
# Stage: build — 编译 shared / server / teacher-screen / admin
# ──────────────────────────────────────────────────────────────────────────────
FROM deps AS build
COPY tsconfig.base.json ./
COPY packages packages
COPY apps/server apps/server
COPY apps/teacher-screen apps/teacher-screen
COPY apps/admin apps/admin

# Web 前端打包时的后端地址
#   - 默认走同源相对路径，宿主 nginx → web 容器 → server 容器
#   - 想覆盖：docker build --build-arg VITE_API_BASE=... --build-arg VITE_WS_URL=...
ARG VITE_API_BASE=/api/v1
ARG VITE_WS_URL=
ENV VITE_API_BASE=${VITE_API_BASE}
ENV VITE_WS_URL=${VITE_WS_URL}

RUN pnpm --filter @snyuan/shared build \
 && pnpm --filter @snyuan/server build \
 && pnpm --filter @snyuan/teacher-screen build \
 && pnpm --filter @snyuan/admin build

# ──────────────────────────────────────────────────────────────────────────────
# Stage: deploy-server — 把 server 抽成自包含目录（含 prod node_modules）
#   pnpm deploy 会把 workspace:* 依赖（@snyuan/shared）一起平铺进 node_modules
# ──────────────────────────────────────────────────────────────────────────────
FROM build AS deploy-server
RUN pnpm --filter @snyuan/server deploy --prod /out
# pnpm deploy 默认遵循 .gitignore（dist/ 被 ignored），需要手动把编译产物补回 /out/dist
RUN rm -rf /out/dist && cp -r apps/server/dist /out/dist

# ──────────────────────────────────────────────────────────────────────────────
# Stage: server (FINAL) — 运行时镜像，只含 dist + 生产依赖
# ──────────────────────────────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS server
ARG APK_MIRROR=
RUN if [ -n "$APK_MIRROR" ]; then \
      sed -i "s|https\\?://dl-cdn\\.alpinelinux\\.org|${APK_MIRROR}|g" /etc/apk/repositories; \
    fi
RUN apk add --no-cache tini \
 && addgroup -S app && adduser -S -G app app
WORKDIR /app
COPY --from=deploy-server --chown=app:app /out/dist ./dist
COPY --from=deploy-server --chown=app:app /out/node_modules ./node_modules
COPY --from=deploy-server --chown=app:app /out/package.json ./package.json

ENV NODE_ENV=production \
    PORT=3000
EXPOSE 3000
USER app

# tini 让 PID 1 行为正常（信号 + zombie reap）
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/main.js"]

# ──────────────────────────────────────────────────────────────────────────────
# Stage: web (FINAL) — nginx 托管静态资源 + 反代 /api /socket.io
# ──────────────────────────────────────────────────────────────────────────────
FROM nginx:${NGINX_VERSION} AS web
RUN rm -f /etc/nginx/conf.d/default.conf
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/teacher-screen/dist /usr/share/nginx/html/screen
COPY --from=build /repo/apps/admin/dist           /usr/share/nginx/html/admin
COPY deploy/web-index.html                        /usr/share/nginx/html/index.html
EXPOSE 80
