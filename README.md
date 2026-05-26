# 三元课堂 · 集美工业职业学院 智慧课堂系统

> 真实教室里 真人教师 + 真人学生 + AI 副驾，实时控场式互动课堂平台。

## 子项目

| 路径 | 形态 | 端口 | 说明 |
|---|---|---|---|
| `apps/server` | NestJS 10 + Socket.IO + AI Service | 3000 | 唯一后端 |
| `apps/teacher-tablet` | Vue 3 + Vite | 3002 | 教师手持平板（控场） |
| `apps/teacher-screen` | Vue 3 + Vite | 3001 | 教室大屏 |
| `apps/student-tablet` | Vue 3 + Vite | 3003 | 学生 Web 平板 |
| `apps/admin` | Vue 3 + Element Plus | 3004 | 校级管理后台 |
| `packages/shared` | 共享 TS 类型 + WS 事件 + 图标 | - | 给 apps/ 引用 |
| `uniapp-student` | UniApp Vue 3 + TypeScript | - | **学生端原生 App**（Android Kiosk 强控制） |
| `docs/` | 文档 | - | OpenMAIC 参考档案等 |

## 快速开始

```bash
pnpm install                 # 装根 + 所有 apps 子包（uniapp-student 独立）
pnpm dev:all                 # 五端 Web 并行起
# 或单独起
pnpm dev:server              # 后端 :3000 (Swagger: /api/docs)
pnpm dev:teacher             # 教师平板 :3002
pnpm dev:student             # 学生 Web 平板 :3003
pnpm dev:screen              # 大屏 :3001
pnpm dev:admin               # 管理后台 :3004
```

UniApp 学生端独立，使用 HBuilderX 或 CLI：

```bash
cd uniapp-student
pnpm install
pnpm dev:h5                  # 本地 H5 调试
# 真机 / 原生 App 见 uniapp-student/docs/DEV.md
```

## 部署模式

### 演示模式（零配置）
所有 env 留空 → 内存课堂 + admin/admin demo 登录 + WS 不校验。适合 demo / 本地测试。

### 生产模式（启用 DB + JWT）

`apps/server/.env`：
```bash
DATABASE_URL=mysql://user:pass@host:3306/snyuan
JWT_SECRET=请改成长随机字符串
WS_AUTH_MODE=required
ACCESS_CODE=可选的站点访问码
```

完整 env 列表见 `apps/server/src/database/database.module.ts` 与 `apps/server/src/modules/auth/auth.module.ts`。

## 学生端两种部署形态

| 场景 | 推荐 |
|---|---|
| 学生用浏览器 / iPad 网页 / PC | `apps/student-tablet`（Web） |
| **学生用安卓平板 + Kiosk 强控制（不能切走 / 不能卸载）** | `uniapp-student`（UniApp 原生 App） |

强控制配置见 [`uniapp-student/docs/KIOSK-SETUP.md`](./uniapp-student/docs/KIOSK-SETUP.md)。

## 关键文档

- [`docs/openmaic-reference.md`](./docs/openmaic-reference.md) - OpenMAIC（清华 AI 课堂）对标调研档案
- [`uniapp-student/docs/DEV.md`](./uniapp-student/docs/DEV.md) - UniApp 学生端开发指南
- [`uniapp-student/docs/KIOSK-SETUP.md`](./uniapp-student/docs/KIOSK-SETUP.md) - 红米 Pad Device Owner 配置

## 技术栈一览

- **后端**：NestJS 10 + Socket.IO 4 + TypeORM 0.3 + MySQL + Vercel AI SDK（10 provider 50+ model）
- **Web 前端**：Vue 3.5 + Vite 6 + Pinia + SCSS + socket.io-client
- **管理后台**：+ Element Plus + ECharts
- **大屏**：+ KaTeX（渲染 AI 板书公式）
- **学生 Web**：+ marked + DOMPurify（AI 答疑 Markdown）
- **教师平板**：+ pdfjs-dist（PDF 解析为图片）+ pptxgenjs
- **学生 App**：UniApp 3 + Vue 3 + TypeScript + UTS 原生插件（Android Device Owner）

## 项目命名约定

- 共享代码：`@snyuan/*`
- WS 命名空间：`/classroom`
- 房间 ID：`lesson:${lessonId}`
- 入口码：6 位数字

## License

内部项目。
