# 三元课堂 UniApp 学生端 · 开发指南

## 目录

1. [整体架构](#1-整体架构)
2. [本地开发：H5 调试](#2-本地开发h5-调试)
3. [HBuilderX 真机调试（红米平板）](#3-hbuilderx-真机调试红米平板)
4. [打 Android 包](#4-打-android-包)
5. [接入后端](#5-接入后端)
6. [开发任务 Roadmap](#6-开发任务-roadmap)
7. [常见问题](#7-常见问题)

## 1. 整体架构

```
uniapp-student/
├── src/
│   ├── App.vue / main.ts / pages.json / manifest.json   ← UniApp 入口
│   ├── pages/
│   │   ├── join/index.vue            ← 加入课堂（六位码 + 姓名）
│   │   ├── classroom/index.vue       ← 课堂主界面（viewState 状态机）
│   │   └── after-class/index.vue     ← 课后作业列表
│   ├── components/
│   │   ├── AiChatDrawer.vue          ← AI 答疑抽屉
│   │   ├── AiInteractiveViewer.vue   ← AI 实践 HTML 沙盘渲染
│   │   ├── GroupDiscussionPanel.vue  ← 小组讨论
│   │   ├── NotesPanel.vue            ← 笔记 + 历史广播
│   │   ├── SignInPopup.vue           ← 签到弹窗
│   │   └── TtsButton.vue             ← 朗读按钮（H5 用 SpeechSynthesis）
│   ├── stores/student.ts             ← Pinia store（viewState 等）
│   ├── sockets/useSocket.ts          ← socket.io-client v4 单例封装
│   ├── kiosk/
│   │   ├── index.ts                  ← JS 门面（H5/iOS no-op，App 调 UTS）
│   │   └── snyuan-kiosk-uts-template.uts  ← Android UTS 插件模板
│   ├── shared/
│   │   ├── types.ts                  ← 与 packages/shared 同步的业务类型
│   │   ├── wsEvents.ts               ← WS 事件名注册表
│   │   └── config.ts                 ← API_BASE / WS_URL
│   └── styles/variables.scss         ← 主题色（与 Web 端同款）
├── docs/
│   ├── DEV.md                        ← 本文
│   └── KIOSK-SETUP.md                ← 红米 Pad Device Owner 配置
└── package.json / tsconfig.json / vite.config.ts / index.html
```

后端复用现有 `apps/server`（NestJS + Socket.IO），**无需任何后端改动**就能跑。

## 2. 本地开发：H5 调试

```bash
cd uniapp-student
pnpm install
pnpm dev:h5
# → 浏览器访问 http://localhost:5173
```

H5 模式下 kiosk 相关方法都是 no-op，所有业务逻辑都能跑（除了原生 lockTask）。

如果后端不在 localhost:3000，写一个 `.env` 文件覆盖：

```bash
VITE_API_BASE=http://192.168.1.20:3000/api/v1
VITE_WS_URL=http://192.168.1.20:3000
```

## 3. HBuilderX 真机调试（红米平板）

> UniApp 的 Android 真机调试目前只能在 HBuilderX 中跑（CLI 出 `dist/dev/app-plus` 后导入 HBuilderX）。

### 3.1 准备 HBuilderX

1. 下载安装 [HBuilderX 4.x](https://www.dcloud.io/hbuilderx.html)（**App 开发版**，不是标准版）
2. 装好 Android Studio 或 JDK 17（uni-app x 编译需要）

### 3.2 导入项目

1. HBuilderX → 文件 → 打开目录 → 选 `uniapp-student/`
2. 第一次会提示「该项目缺少 uni-app 项目配置」→ 工具 → 转换为 uni-app(Vue3) 项目
3. 等待依赖装好

### 3.3 真机标准基座调试

1. USB 连红米 Pad SE 9，开 USB 调试
2. HBuilderX 顶栏 → 运行 → 运行到手机或模拟器 → 标准基座（首次会下载基座 apk 约 50 MB）
3. 基座装好后，App 自动启动；后续每次改代码热刷新

### 3.4 真机自定义基座调试（含 UTS 原生）

如果用到了 `snyuan-kiosk` UTS 插件：
1. HBuilderX → 发行 → 原生 App 制作自定义调试基座
2. 选 Android → 仅本地打包 → 等待编译（首次 5-10 分钟）
3. 把 `unpackage/debug/android_debug.apk` 装到平板
4. 之后每次改 .uts / native 配置都要重新出基座

## 4. 打 Android 包

### 4.1 云打包（最快，推荐做 demo）

1. HBuilderX → 发行 → 原生 App-云打包
2. 选 Android → Apk 包 → 仅签名公证 → 开发
3. 等待 5-10 分钟，下载 apk

### 4.2 本地打包（自定义基座 / 原生插件必备）

1. HBuilderX → 发行 → 原生 App 制作本地打包资源
2. 把 `unpackage/resources/__UNI__SNYUAN_STUDENT/` 拷到 [uniapp 5+ SDK](https://nativesupport.dcloud.net.cn/AppDocs/usesdk/android.html) 的 Android Studio 工程
3. Build → Generate Signed APK

## 5. 接入后端

### 5.1 后端环境变量（推荐）

后端 `apps/server/.env`：

```bash
PORT=3000
AI_PROVIDER=qwen
AI_API_KEY=sk-your-qwen-key
WS_AUTH_MODE=off                 # UniApp 端暂未集成 JWT，先 off
ACCESS_CODE=                     # 也先留空
```

### 5.2 学生端 `.env`

```bash
VITE_API_BASE=http://<电脑内网IP>:3000/api/v1
VITE_WS_URL=http://<电脑内网IP>:3000
```

⚠️ **真机调试时务必用内网 IP 而非 localhost**，否则平板连不上电脑。
Windows 查 IP：`ipconfig` 看 IPv4。

### 5.3 跨端测试链路

1. `pnpm --filter @snyuan/server dev`（终端 1）
2. `pnpm --filter @snyuan/uniapp-teacher dev:h5`（终端 2，浏览器开 H5 端口模拟教师）
3. HBuilderX 跑 uniapp-student 到红米平板
4. 教师端选课 → 生成 6 位入口码 → 学生平板输入码加入

### 5.4 WS 链路自检

学生 App 启动后看后端日志，应有：

```
[ClassroomGateway] Connected: xxxx
[ClassroomGateway] xxx(student-tablet) joined lesson:xxx
```

## 6. 开发任务 Roadmap

| 优先 | 任务 | 状态 |
|---|---|---|
| P0 | 真机连后端跑通 join → quiz → submit | ⏳ 待你验证 |
| P0 | snyuan-kiosk UTS 插件 native 编译 + Device Owner 配置 | ⏳ 见 KIOSK-SETUP.md |
| P1 | AI 答疑 Markdown 渲染从字符串替换升级到 `mp-html` 组件 | ⏳ |
| P1 | 加 vue-tsc 类型检查到 build 流程 | ⏳ |
| P2 | 实现 App 端 TTS（plus.speech 或第三方 SDK） | ⏳ |
| P2 | UI 适配横屏 1280×800（红米 Pad SE 默认分辨率） | ⏳ |
| P3 | 接入 JWT 鉴权（与 WS_AUTH_MODE=required 配合） | ⏳ |

## 7. 常见问题

### Q1: `pnpm install` 报 `@dcloudio/xxx not found`

UniApp 的 `@dcloudio/*` 版本字符串带后缀（如 `3.0.0-4070420250804001`），是固定时间戳版本号。如果想升级到最新：

```bash
npm view @dcloudio/uni-app dist-tags
# 拿到 latest 字符串，再统一改 package.json
```

### Q2: web-view 渲染 AI 沙盘 HTML 在 App 上白屏

App 端 `web-view` 要求 `src` 为真实 URL 或 `_www/*` 路径。Data URL（我们当前实现）在某些 ROM 上不工作。
可改用 `plus.io.resolveLocalFileSystemURL` 写到本地临时文件再加载，或在后端起一个 `/api/v1/ai/interactive/:id` 静态返回 HTML。

### Q3: 真机连 localhost:3000 失败

平板和电脑同 WiFi，用电脑内网 IP。如果还失败，可能是 Windows 防火墙拦了 3000 端口：

```powershell
# 管理员 PowerShell
New-NetFirewallRule -DisplayName "Snyuan Dev" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow
```

### Q4: 教师端推 PDF 课件，学生端图不显示

教师 web 端上传 PDF → pdfjs 转 DataURL 数组 → WS `slides:upload` 发到 server → server 广播 `slides:loaded` → 学生端用 `<image src="data:image/png;base64,...">` 渲染。

平板渲染上百张大图（每张 200 KB）可能卡顿，建议教师上传时分批，或后端改为对象存储 URL。

### Q5: 想要"教师远程截屏学生"

需要 Android `MediaProjection` API + 原生插件。简化版：让学生端定时把 canvas 截屏 → 转 base64 → emit WS 给教师监控页。后端不存储仅转发。

---

如有问题，先把 HBuilderX 控制台日志 + 后端日志贴出来排查。
