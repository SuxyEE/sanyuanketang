# sanyuanketang：改代码 → 推送 → 服务器拉取 → 重新部署

> 依据 2026-05-26 一次性部署完成后的实际状态整理。
>
> ⚠️ **本文件含数据库、JWT、AI 等线上口令**。当前仓库为**内部演示仓库**所以入仓自用。
> **如果以后这个仓库变 public、转交他人或团队扩张**，按下面顺序立即操作：
>   1. 把本文件第「零」章所有口令**全部轮换**（重新生成 MySQL/JWT 随机串、申请新 Qwen Key）
>   2. 改完后 `/opt/sanyuanketang/deploy/.env` 同步更新，`docker compose up -d --force-recreate server`
>   3. 把本文件「零」章替换为占位符（或整文件搬出仓库改为本机桌面自用）

---

## 零、连接与凭据（必须知道的所有口令）

### Git / GitHub

| 项 | 值 |
|---|---|
| **HTTPS 仓库** | `https://github.com/SuxyEE/sanyuanketang.git` |
| **分支** | `master` |
| **本地工作目录** | `E:\project\sanyuanketang` |

> 仓库当前是 public 不需要 token；如果以后改 private，把 GitHub PAT 加到这里。

### 服务器与路径

| 项 | 值 |
|---|---|
| **公网 IP** | `47.107.53.201`（阿里云杭州 · 金麟湾） |
| **系统** | Ubuntu 24.04 / 8C30G / 77G 可用 |
| **SSH** | `ssh root@47.107.53.201`（已配置免密；或用 `sshjinlinwan` MCP） |
| **代码目录** | `/opt/sanyuanketang` |
| **.env 配置** | `/opt/sanyuanketang/deploy/.env`（`chmod 600`，不入仓） |
| **本机已装** | Docker 27.4.1 / Docker Compose v2.32.1 / BT-Panel |

### 端口规划（避开 BT-Panel 已占的 80/443/3306/3000 等）

| 端口 | 服务 | 绑定 |
|---|---|---|
| `3100` | 容器 nginx（对外入口） | `127.0.0.1:3100`，宿主 nginx 反代到这 |
| `3101` | server API 直连（排查备用） | `127.0.0.1:3101` |
| `3307` | MySQL 容器 | `127.0.0.1:3307` 仅本机 |

### 域名 / HTTPS

| 项 | 值 |
|---|---|
| **域名** | `duoyuan.longdao.top`（A 记录已指向 47.107.53.201） |
| **证书** | Let's Encrypt（BT-Panel 申请，自动续签） |
| **证书路径** | `/www/server/panel/vhost/cert/duoyuan.longdao.top/` |
| **宿主 nginx 站点配置** | `/www/server/panel/vhost/nginx/duoyuan.longdao.top.conf` |
| **宿主反向代理配置** | `/www/server/panel/vhost/nginx/proxy/duoyuan.longdao.top/cc3d69ed781b16bce06687822ae56e6d_duoyuan.longdao.top.conf` |

> 反代配置已手工 patch：`Host $host`、`X-Forwarded-Host $host`、`X-Forwarded-Proto $scheme`。  
> ⚠️ 在 BT-Panel 面板里**点击编辑/保存这个反向代理**会被覆盖回默认模板，需要重新 patch。

### 访问地址（HTTPS）

| 用途 | URL |
|---|---|
| 教室大屏 | `https://duoyuan.longdao.top/screen/` |
| 管理后台 | `https://duoyuan.longdao.top/admin/` |
| 入口导航 | `https://duoyuan.longdao.top/` |
| 入口导航（备用） | `https://duoyuan.longdao.top/index.html` |
| API 文档 | `https://duoyuan.longdao.top/api/docs` |
| 健康检查 | `https://duoyuan.longdao.top/healthz` |
| AI providers 检测 | `https://duoyuan.longdao.top/api/v1/ai/providers` |

### 管理后台账号（首次启动自动建）

| 项 | 值 |
|---|---|
| 账号 | `admin` |
| 密码 | `admin` |

> ⚠️ 演示用。**正式给客户前在 admin 界面或 SQL 改掉**，server 日志启动时会 WARN 提醒。

### MySQL（容器内）

| 项 | 值 |
|---|---|
| 主机 / 端口 | `mysql:3306`（容器网络）/ `127.0.0.1:3307`（宿主回环） |
| 数据库 | `snyuan` |
| root 密码 | `8f2920829c1f9a547c6f64d10a252a5b` |
| 业务账号 | `snyuan` |
| 业务密码 | `3fa48294ea8a60ebbbc4fc888877ab5d` |

### JWT 密钥

| 项 | 值 |
|---|---|
| `JWT_SECRET` | `5e62ccac2beffbdc5c98ac8fb3d700bafadbae1864d2606e47d7995401a13074` |

### AI（Qwen / 百炼 · OpenAI 兼容协议）

| 项 | 值 |
|---|---|
| Base URL | `https://dashscope.aliyuncs.com/compatible-mode/v1` |
| API Key | `sk-403d7c319ebb457ba6616403d9edd16f` |
| 默认模型 | `qwen3.5-plus` |
| Vision 模型 | `qwen3-vl-plus-latest` |
| Coder 模型 | `qwen3-coder-plus` |
| Reasoning 模型 | `qwen3.7-max` |

> 换 Key：改 `/opt/sanyuanketang/deploy/.env` 的 `AI_API_KEY` → `docker compose up -d --force-recreate server`

---

## 一、本地改 → 推 GitHub

### 后端（apps/server）

```powershell
cd E:\project\sanyuanketang
# 改完代码
pnpm --filter @snyuan/server build       # 本地确认编译过
git add apps/server
git commit -m "fix(xxx): 简述改动"
git push origin master
```

### 前端（apps/teacher-screen 或 apps/admin）

```powershell
cd E:\project\sanyuanketang
# 改完代码
pnpm --filter @snyuan/teacher-screen build   # 或 @snyuan/admin
git add apps/teacher-screen apps/admin
git commit -m "feat(screen): 简述"
git push origin master
```

### 部署相关（Dockerfile / compose / nginx.conf）

```powershell
git add deploy/
git commit -m "ops: 简述"
git push origin master
```

---

## 二、服务器侧拉新代码 + 重启

### 标准 4 步

```bash
ssh root@47.107.53.201
cd /opt/sanyuanketang
git pull
docker compose -f deploy/docker-compose.yml --env-file deploy/.env build server   # 或 web，或 server web
docker compose -f deploy/docker-compose.yml --env-file deploy/.env up -d
docker compose -f deploy/docker-compose.yml ps                                     # 看三个全 healthy
```

### 一行版（本机 PowerShell 直接跑）

```powershell
ssh root@47.107.53.201 "cd /opt/sanyuanketang && git pull && docker compose -f deploy/docker-compose.yml --env-file deploy/.env build server && docker compose -f deploy/docker-compose.yml --env-file deploy/.env up -d server && docker compose -f deploy/docker-compose.yml ps"
```

### 各场景命令

| 场景 | 命令 |
|---|---|
| 只改后端 | `git pull && docker compose ... build server && docker compose ... up -d server` |
| 只改前端 | `git pull && docker compose ... build web && docker compose ... up -d web` |
| 前后端都改 | `git pull && docker compose ... build server web && docker compose ... up -d` |
| 只改 .env（如换 AI Key） | `vim deploy/.env && docker compose ... up -d --force-recreate server` |
| 改 Dockerfile / nginx.conf | `git pull && docker compose ... build && docker compose ... up -d` |

（命令里 `docker compose ...` 是 `docker compose -f deploy/docker-compose.yml --env-file deploy/.env` 的简写）

---

## 三、发布检查清单（每次上线对照）

1. [ ] 本地 `git push origin master` 成功
2. [ ] 服务器 `/opt/sanyuanketang` 下 `git pull` 无冲突
3. [ ] `docker compose ... build` 无 error（buildx 红色字）
4. [ ] `docker compose ... up -d` 后 `docker ps` 三个容器都 `(healthy)`
5. [ ] `docker logs snyuan-server --tail 30` 没有 `[Nest] ERROR` / `ECONNREFUSED`
6. [ ] `curl https://duoyuan.longdao.top/api/v1/ai/providers` 返回 JSON
7. [ ] 浏览器强刷 `https://duoyuan.longdao.top/screen/`，控制台无红色 404
8. [ ] 测一笔 AI 调用：`curl -X POST https://duoyuan.longdao.top/api/v1/ai/chat -H 'Content-Type: application/json' -d '{"message":"hi"}'` 返回 `sources:["AI大模型"]`（不是 `["本地知识库"]`）

---

## 四、看日志 / 进容器 / 看资源

```bash
# 实时看日志
docker compose -f deploy/docker-compose.yml logs -f --tail=200 server
docker compose -f deploy/docker-compose.yml logs -f --tail=200 web
docker compose -f deploy/docker-compose.yml logs -f --tail=200 mysql

# 进 server 容器（排查 node 进程、看文件）
docker compose -f deploy/docker-compose.yml exec server sh

# 进 mysql 容器（看表）
docker compose -f deploy/docker-compose.yml exec mysql \
  mysql -u snyuan -p3fa48294ea8a60ebbbc4fc888877ab5d snyuan

# 看磁盘 / 镜像占用
docker system df
```

---

## 五、数据库备份 / 恢复

```bash
# 备份（生成 ~/snyuan-20260526-1500.sql）
docker compose -f deploy/docker-compose.yml exec mysql sh -c \
  'exec mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" snyuan' \
  > ~/snyuan-$(date +%Y%m%d-%H%M).sql

# 恢复
docker compose -f deploy/docker-compose.yml exec -T mysql sh -c \
  'exec mysql -uroot -p"$MYSQL_ROOT_PASSWORD" snyuan' \
  < ~/snyuan-20260526-1500.sql
```

---

## 六、常见故障速查

| 症状 | 一般原因 | 处理 |
|---|---|---|
| `git pull` 卡住超时 | 临时 GitHub 网络抖 | 等 1-2 分钟重试；多次失败用 tarball：`git archive` 本地 + scp 上传 |
| `docker compose build` 卡 `apk add` | Alpine repo 慢 | 已用 aliyun 镜像；check `deploy/.env` 里 `APK_MIRROR=https://mirrors.aliyun.com` |
| `docker compose build` 卡 `pnpm install` | npm 源慢 | 已用 npmmirror；check `deploy/.env` 里 `NPM_REGISTRY=https://registry.npmmirror.com/` |
| server `ECONNREFUSED mysql:3306` | mysql 还没 healthy | `docker compose restart server` |
| 浏览器 css/js 404 | 浏览器缓存或 SPA base 路径不对 | 强刷 Ctrl+Shift+R；如果 SPA 子路径改了重新 build web |
| 大屏 302 跳回 http:// | 宿主反代 patch 被宝塔覆盖 | 重新跑下方「重 patch 反向代理」命令 |
| WS 连不上 (502) | 宿主 nginx 没传 Upgrade 头 | 同上 |
| AI 返回 mock（`sources:["本地知识库"]`） | AI_API_KEY 没配 / 网络断 Qwen | check `.env` AI_API_KEY；`docker logs snyuan-server | grep -i qwen` |
| 手机扫课件二维码 URL 是 127.0.0.1 | 宿主反代没传 X-Forwarded-Host | 同上 patch |

### 重 patch 宝塔反向代理（如果在面板里被覆盖了）

```bash
F=/www/server/panel/vhost/nginx/proxy/duoyuan.longdao.top/cc3d69ed781b16bce06687822ae56e6d_duoyuan.longdao.top.conf
cp $F ${F}.bak
sed -i 's|proxy_set_header Host 127.0.0.1;|proxy_set_header Host $host;\n    proxy_set_header X-Forwarded-Host $host;\n    proxy_set_header X-Forwarded-Proto $scheme;|' $F
nginx -t && nginx -s reload
```

---

## 七、彻底重置（核选项）

```bash
cd /opt/sanyuanketang
docker compose -f deploy/docker-compose.yml down -v       # ⚠ -v 删数据卷，DB 数据没了
docker image rm snyuan-server:latest snyuan-web:latest    # 删本地镜像
# 重新来过
docker compose -f deploy/docker-compose.yml --env-file deploy/.env up -d --build
```

要彻底卸载（包括代码）：

```bash
cd /opt && rm -rf sanyuanketang
# 删宿主 nginx 站点：BT-Panel 删 duoyuan.longdao.top 即可
```

---

## 八、教师/学生 App（UniApp）打包

后端地址智能默认：**HBuilderX 出 apk 不需要改 .env**，apk 默认连 `https://duoyuan.longdao.top`。

```
HBuilderX 打开 uniapp-teacher（或 uniapp-student）
→ 发行 → 原生 App-云打包 → Android apk → 5-10 min
```

要换后端地址：改 `uniapp-teacher/src/shared/config.ts` 的 `PROD_HOST` 常量，重新打 apk。  
或现场技术员在 App 控制台跑 `setBackendOverride('https://new/api/v1', 'https://new')` 改 storage，**不用重打包**，App 重启生效。

---

## 九、一句话流程

**本地改完 → `git push origin master` → SSH 到 `47.107.53.201` → `cd /opt/sanyuanketang && git pull` → `docker compose -f deploy/docker-compose.yml --env-file deploy/.env build server` → `docker compose ... up -d server` → `docker ps` 确认 healthy。**

---

## 十、参考文档

- 完整部署 README：仓库内 `deploy/README.md`
- 所有环境变量含义：`deploy/.env.example`
- 宿主 nginx 反代模板：`deploy/host-nginx.conf.example`
- 容器内 nginx 配置：`deploy/nginx.conf`
- Dockerfile：`deploy/Dockerfile`
- docker-compose：`deploy/docker-compose.yml`
