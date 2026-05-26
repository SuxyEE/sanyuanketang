# 三元课堂 · 部署手册（金麟湾 47.107.53.201）

> 公网部署 + HTTPS，给客户演示用。后端 + 大屏 + 管理后台 + MySQL 全部容器化，**不影响**服务器上现有 BT-Panel / 其他 docker 项目。

---

## 0. 服务器现状（已确认）

| 项 | 值 |
|---|---|
| 厂商 / 地域 | 阿里云 杭州 |
| 系统 | Ubuntu 24.04 |
| 配置 | 8C30G / 77G 可用 |
| 公网 IP | `47.107.53.201`（金麟湾） |
| 已部署 | BT-Panel + 一票别人的 docker 容器 |

**已占用端口（不能动）：** `80 / 443 / 3000 / 3033 / 3034 / 3306 / 6379 / 8181 / 27017` 等

**本项目使用端口：**

| 端口 | 用途 | 暴露范围 |
|---|---|---|
| `3100` | web 容器 nginx（对外入口） | `127.0.0.1` 回环，宿主 nginx 反代到这里 |
| `3101` | server 容器 API 直连（备用） | `127.0.0.1` 回环，本机排查用 |
| `3307` | MySQL 容器 | `127.0.0.1` 回环，外网访问不到 |

---

## 1. 整体架构（一眼看完）

```
                 ┌── 互联网 ──┐
                 │  域名/HTTPS │
                 └─────┬───────┘
                       │ snyuan.example.com:443
              ┌────────▼──────────┐
              │  宿主 nginx        │  ← BT-Panel 管的，加一条 server 块
              │  (已存在)          │     reverse proxy 到 127.0.0.1:3100
              └────────┬──────────┘
                       │ 127.0.0.1:3100
        ┌──────────────▼───────────────────┐
        │  docker network: snyuan-net      │
        │                                  │
        │  ┌──────────┐    ┌────────────┐  │
        │  │   web    │───▶│   server   │  │
        │  │ (nginx)  │    │ (NestJS)   │  │
        │  │  :80     │    │  :3000     │  │
        │  └──────────┘    └────┬───────┘  │
        │                       │ DATABASE_URL
        │                  ┌────▼───────┐  │
        │                  │   mysql    │  │
        │                  │  :3306     │  │
        │                  └────────────┘  │
        └──────────────────────────────────┘
```

- **大屏端**（教师投屏机）：浏览器全屏访问 `https://snyuan.example.com/screen`
- **管理后台**：`https://snyuan.example.com/admin`
- **教师/学生 App**：HBuilderX 打包 apk，`VITE_API_BASE=https://snyuan.example.com/api/v1`、`VITE_WS_URL=https://snyuan.example.com`

---

## 2. 第一次部署（约 20-30 min）

### 2.1 服务器装 docker（如果没装）

> BT-Panel 自带 docker 管理面板，先去面板「软件商店 → docker 管理器」看一眼；装好了就跳过这步。

```bash
# 装 docker + compose（官方脚本，国内有点慢）
curl -fsSL https://get.docker.com | sh
sudo systemctl enable --now docker

# 验证
docker --version
docker compose version
```

### 2.2 拉代码

```bash
sudo mkdir -p /opt
cd /opt
sudo git clone https://github.com/<你的账号>/sanyuanketang.git
sudo chown -R $USER:$USER sanyuanketang
cd sanyuanketang
```

> 如果你用的是阿里云 Codeup / 私有仓库，把 URL 换掉，必要时 `git clone https://用户名:个人token@codeup.aliyun.com/.../sanyuanketang.git`。

### 2.3 准备 .env

```bash
cp deploy/.env.example deploy/.env
vim deploy/.env
```

**必须改的：**
1. `MYSQL_ROOT_PASSWORD` / `MYSQL_PASSWORD`：换成两段强随机字符串
2. `DATABASE_URL` 里的密码与上面 `MYSQL_PASSWORD` 对齐
3. `JWT_SECRET`：`openssl rand -hex 32` 生成一段，贴进去
4. `AI_API_KEY`：你的 Qwen / 百炼 key（没填的话 AI 板书走 mock 占位，演示不太好看）

**演示场景建议：**
- `ACCESS_CODE=` 留空（不开站点访问码，方便客户直接访问）
- `WS_AUTH_MODE=off`（UniApp 端还没接 JWT，必须 off）
- `DB_SYNCHRONIZE=true`（首次部署让 TypeORM 自动建表；稳定后改 false）

### 2.4 构建 + 启动

```bash
# 在仓库根目录跑（不要 cd 进 deploy/）
docker compose -f deploy/docker-compose.yml --env-file deploy/.env build
docker compose -f deploy/docker-compose.yml --env-file deploy/.env up -d
```

> 第一次 build：pnpm install + 4 个包编译，约 10-15 min；之后增量 build 1-3 min。

### 2.5 看状态

```bash
docker compose -f deploy/docker-compose.yml ps
# 三个服务都应该是 healthy / running

docker compose -f deploy/docker-compose.yml logs -f server
# 看到 `Server running on http://0.0.0.0:3000` 即 OK
```

### 2.6 本机自检（不走域名）

```bash
# Web 入口（含静态资源 + 反代）
curl -I http://127.0.0.1:3100/
curl -I http://127.0.0.1:3100/screen/
curl -I http://127.0.0.1:3100/admin/

# API 反代
curl http://127.0.0.1:3100/api/v1/ai/providers
curl http://127.0.0.1:3100/api/docs -I

# API 直连（备用）
curl http://127.0.0.1:3101/api/v1/ai/providers
```

期待：`200 OK`，`/api/v1/ai/providers` 返回 provider JSON。

### 2.7 接域名 + HTTPS

1. 域名解析：在你域名注册商那里把 `snyuan.example.com` 的 A 记录指向 `47.107.53.201`
2. BT-Panel 申请证书：「网站 → 添加站点 → 域名填 `snyuan.example.com` → 不要勾 PHP/数据库（纯静态占位即可） → SSL 申请 Let's Encrypt」
3. 把 `deploy/host-nginx.conf.example` 里的「证书路径」「域名」改成实际值，整段贴到这个站点的「配置文件」覆盖原内容，保存
4. BT-Panel 顶部「重载配置」，或 SSH 跑 `sudo nginx -t && sudo nginx -s reload`

### 2.8 公网自检

```bash
curl -I https://snyuan.example.com/healthz
curl -I https://snyuan.example.com/screen/
curl    https://snyuan.example.com/api/v1/ai/providers
```

浏览器打开 `https://snyuan.example.com/`，能看到「三元课堂 · Demo」导航页就基本成了。

---

## 3. 平时维护

### 拉新代码 + 重启

```bash
cd /opt/sanyuanketang
git pull
docker compose -f deploy/docker-compose.yml --env-file deploy/.env build server web
docker compose -f deploy/docker-compose.yml --env-file deploy/.env up -d
```

> 只改后端代码：只 build `server`。只改前端代码（含 .env 里 VITE_*）：只 build `web`。

### 改 .env

改完任何环境变量都要重启对应服务：

```bash
docker compose -f deploy/docker-compose.yml --env-file deploy/.env up -d --force-recreate server
```

VITE_* 是**构建期**注入的，改了之后必须重新 build web。

### 看日志

```bash
docker compose -f deploy/docker-compose.yml logs -f --tail=200 server
docker compose -f deploy/docker-compose.yml logs -f --tail=200 web
docker compose -f deploy/docker-compose.yml logs -f --tail=200 mysql
```

### 进容器

```bash
docker compose -f deploy/docker-compose.yml exec server sh
docker compose -f deploy/docker-compose.yml exec mysql mysql -u root -p
```

### 备份 / 恢复 MySQL

```bash
# 备份
docker compose -f deploy/docker-compose.yml exec mysql \
  sh -c 'exec mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" snyuan' \
  > backup-$(date +%Y%m%d-%H%M).sql

# 恢复
docker compose -f deploy/docker-compose.yml exec -T mysql \
  sh -c 'exec mysql -uroot -p"$MYSQL_ROOT_PASSWORD" snyuan' \
  < backup-20260601-1030.sql
```

---

## 4. 给客户的访问说明（演示用）

### 4.1 电脑投屏方式

> 任何能上网的电脑，浏览器（Chrome / Edge）打开下面这两个地址。

| 用途 | URL | 备注 |
|---|---|---|
| 教室大屏 | `https://snyuan.example.com/screen` | 进入后按 `F11` 全屏 |
| 管理后台 | `https://snyuan.example.com/admin` | 演示账号：`admin` / `admin` |
| 入口导航 | `https://snyuan.example.com/` | 一键跳到上面任一端 |

### 4.2 教师 / 学生平板

平板需要装我们打包的 apk（HBuilderX 出包），打包时把后端地址写成：

```env
VITE_API_BASE=https://snyuan.example.com/api/v1
VITE_WS_URL=https://snyuan.example.com
```

> 提前发给客户一份 apk + 6 位入口码，他们就能在自己的平板上加入课堂。

### 4.3 演示动线（建议）

1. 打开 `https://snyuan.example.com/screen` → F11 全屏 → 进入「开课模式」
2. 师生平板扫码加入（或输 6 位码）
3. 教师端：「AI 板书」→ 输入主题 → **流式生成进度条**滚到 100% → 大屏展示
4. 教师端：「AI 实践」→ 同上，体验流式生成
5. 学生端：参与互动 / 摄像头签到 / 抢答
6. 切回管理后台：看「课堂氛围分析」（如果 AI_API_KEY 已配，会是真分析；否则 mock）

---

## 5. 故障排查

### docker compose build 卡在 pnpm install

国内拉 npm 包慢。在 `deploy/Dockerfile` 的 `pnpm install` 前加一行：

```dockerfile
RUN pnpm config set registry https://registry.npmmirror.com
```

### server 启动报 `ECONNREFUSED mysql:3306`

mysql 容器还没起完。compose 已配 `depends_on: condition: service_healthy`，正常会等。如果还是抢跑：

```bash
docker compose -f deploy/docker-compose.yml restart server
```

### 网页能开但 WebSocket 连不上（学生加不进课堂）

- 浏览器 F12 看「Network → WS」连接 `wss://snyuan.example.com/socket.io/...` 是否 101
- 如果是 502：宿主 nginx 没把 `Upgrade` / `Connection` 透传 → 用 `deploy/host-nginx.conf.example` 整段覆盖
- 如果是 SSL 握手错：证书没绑对域名 → BT-Panel 重新申请

### AI 流式生成卡在 0%

- `docker logs snyuan-server | grep -i 'ai\|qwen'` 看是否有报错
- 99% 是 `AI_API_KEY` 没配 → 改 `deploy/.env` 后 `docker compose up -d --force-recreate server`

### 手机扫码上传课件，扫出来的 URL 是 `localhost`

- 宿主 nginx 没传 `X-Forwarded-Host` → 用 `deploy/host-nginx.conf.example` 覆盖即可
- 容器内 nginx 已经传了，但要靠宿主先传进来

---

## 6. 卸载（如果要彻底清掉）

```bash
cd /opt/sanyuanketang
docker compose -f deploy/docker-compose.yml down -v   # -v 连同 mysql 数据卷一起删
docker image rm snyuan-server:latest snyuan-web:latest

# 删宿主 nginx 那段 server 块（BT-Panel 站点删除即可）

# 删代码
cd /opt && sudo rm -rf sanyuanketang
```

---

## 7. 文件清单（仓库内 deploy/ 一览）

| 文件 | 干啥的 |
|---|---|
| `Dockerfile` | 多阶段构建，产出 `snyuan-server` + `snyuan-web` 两个镜像 |
| `docker-compose.yml` | 编排 mysql + server + web 三个容器，定义端口/网络/健康检查 |
| `nginx.conf` | **容器内** nginx 配置（SPA 托管 + /api、/socket.io 反代） |
| `host-nginx.conf.example` | **宿主 BT-Panel** nginx 反代域名→3100 的样例 |
| `web-index.html` | 入口导航页（根路径打开就是它） |
| `.env.example` | 全部环境变量样例 + 注释，拷成 `.env` 修改 |
| `README.md` | 本文件 |
