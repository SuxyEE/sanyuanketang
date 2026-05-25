# OpenMAIC × 师渊课堂 · 参考档案

> **目的**：把对 [THU-MAIC/OpenMAIC](https://github.com/THU-MAIC/OpenMAIC) 一次性彻底浏览的结果沉淀下来，作为我们「师渊课堂」项目的长期参考。
>
> **作者**：AI 调研（Claude · 2026-05-24）
> **OpenMAIC 版本**：v0.2.1（main 分支，commit head 截至 2026-04-26）
> **OpenMAIC 仓库定位**：开源 AI 互动课堂平台，17.8k stars，THU 出品，AGPL-3.0

---

## 目录

1. [项目本质差异（一图看懂）](#1-项目本质差异一图看懂)
2. [技术栈速查表](#2-技术栈速查表)
3. [架构对比](#3-架构对比)
4. [OpenMAIC 子系统深扫](#4-openmaic-子系统深扫)
   - 4.1 LLM Provider 抽象
   - 4.2 文件化 Prompt 系统
   - 4.3 SSE 流式 Chat
   - 4.4 PlaybackEngine 状态机
   - 4.5 Action 执行引擎（28+ 动作）
   - 4.6 两阶段生成流水线
   - 4.7 LangGraph 多智能体导演图
   - 4.8 多媒体抽象（TTS / ASR / Image / Video）
   - 4.9 站点级 ACCESS_CODE 鉴权
   - 4.10 Quiz 数据模型与评分
5. [18 个 API 端点全清单](#5-18-个-api-端点全清单)
6. [数据模型对比](#6-数据模型对比)
7. [可借鉴清单（按工作量分级）](#7-可借鉴清单按工作量分级)
8. [不建议借鉴的部分](#8-不建议借鉴的部分)
9. [关键文件路径索引](#9-关键文件路径索引)
10. [进一步探索方向](#10-进一步探索方向)
11. [附录：OpenMAIC 全仓目录树](#附录openmaic-全仓目录树)

---

## 1. 项目本质差异（一图看懂）

| 维度 | **OpenMAIC**（THU-MAIC） | **师渊课堂**（我们） |
|---|---|---|
| **目标人群** | 一个人 + 一台电脑的自学者 | 真实教室里的真人老师 + 真学生 |
| **课堂构成** | 全 AI 智能体（teacher / assistant / student 角色） | 真人为主 + AI 副驾 |
| **生成 vs 实时** | **生成式**：AI 一次性产出整堂课 → 回放 | **实时控场式**：教师边讲边推送活动 |
| **数据流主轴** | 用户提示 → 大纲 → 场景 → 回放（state machine） | 教师 emit → Socket.IO → 学生/大屏 |
| **后端形态** | 单 Next.js Route Handler（无独立服务） | NestJS + Socket.IO（独立 server app） |
| **多端** | 单 SPA + 响应式适配 PC/Pad/手机 | 5 个独立 Vite app（teacher / student / screen / admin / server） |
| **持久化** | IndexedDB（Dexie）客户端为主 | 现状内存 Map；TypeORM 写好但未挂载 |
| **多语言** | 中/英/日/俄（i18next） | 仅中文 |
| **部署** | Vercel 一键 / Docker / 站点级 ACCESS_CODE | 暂无打包 |
| **开源协议** | AGPL-3.0（商用需付费） | 内部项目 |

**结论**：OpenMAIC 不是我们的直接对标产品，**但它沉淀了大量极有价值的"AI × 教育"组件**，可以模块化地挪用到我们的"真实课堂 + AI 副驾"场景里。

---

## 2. 技术栈速查表

| 类别 | OpenMAIC | 师渊课堂 | 差异点 |
|---|---|---|---|
| 框架 | Next.js 16 + React 19 + App Router | Vue 3.5 + Vite 6（多 SPA）+ NestJS 10 | 完全不同生态 |
| TypeScript | 5（strict） | 5（strict） | 一致 |
| UI 库 | shadcn/ui + Radix + Tailwind 4 + lucide-react | Element Plus（admin）/ 自定义 SCSS（其他端） | OpenMAIC 是 headless 设计风 |
| 状态管理 | **Zustand**（11 个 slice） | Pinia | 都很轻 |
| 客户端存储 | **Dexie（IndexedDB）** | localStorage + 内存 | 量级差异大 |
| AI SDK | **Vercel AI SDK** + `@ai-sdk/openai/anthropic/google` + LangGraph 1.1 + LangChain | 原生 fetch + DashScope（Qwen） | 抽象层级差 1-2 个数量级 |
| 流式 | Server-Sent Events（`streamText`） | Socket.IO event-by-event | 都可行 |
| 多模型 | **16 个 provider × 60+ 模型** | 仅 Qwen | OpenMAIC 完胜 |
| TTS | OpenAI / Azure / GLM / Qwen / MiniMax / ElevenLabs / Lemonade / **VoxCPM2（声音克隆）** | 无 | 我们目前完全无 TTS |
| ASR | OpenAI / Qwen / Lemonade | 无 | |
| 图片生成 | OpenAI / Seedream / Qwen / NanoBanana / MiniMax / Grok / Lemonade（7 家） | 无 | |
| 视频生成 | Seedance / Kling / Veo / Sora / MiniMax / Grok / HappyHorse（7 家） | 无 | |
| Web 搜索 | Tavily / Bocha / Brave / Baidu / Grok | 无 | |
| PDF 解析 | unpdf / **MinerU**（强 OCR/公式） | pdfjs-dist（仅渲染） | |
| Markdown | streamdown + katex + shiki | marked + DOMPurify | OpenMAIC 是流式 markdown |
| 富文本 | ProseMirror | 无 | |
| 富图表 | echarts + @xyflow/react（流程图）+ 自研 Canvas slide-renderer | echarts（仅 admin） | |
| 单测/E2E | Vitest + Playwright + **自建 eval 体系**（whiteboard / outline） | 无 | |
| 鉴权 | **HMAC-SHA256 站点级密码** + middleware | JWT Guard 已实现但**未挂载**到 WS | 思路不同 |
| 国际化 | i18next（zh/en/ja/ru） | 无 | |

---

## 3. 架构对比

### OpenMAIC

```
┌─────────────────────────────────────────────────────────────┐
│                  Single Next.js App                         │
│                                                             │
│  app/page.tsx (生成入口)                                    │
│  app/classroom/[id]/page.tsx (课堂回放)                     │
│       │                                                     │
│       ├─ React UI（slide-renderer / scene-renderers /       │
│       │   whiteboard / chat / settings / agent / ui …）     │
│       │                                                     │
│       ├─ Zustand stores（settings/canvas/stage/snapshot/    │
│       │   whiteboard-history/media-generation/…）           │
│       │                                                     │
│       ├─ IndexedDB（Dexie）— 课堂/历史/quiz 提交持久化      │
│       │                                                     │
│       └─ app/api/*（18 endpoints, 部分 SSE）                │
│              │                                              │
│              ├─ lib/orchestration/director-graph.ts         │
│              │     (LangGraph: director ↔ agent_generate)   │
│              │                                              │
│              ├─ lib/ai/providers.ts                         │
│              │     (统一 16 provider × 60+ 模型)            │
│              │                                              │
│              ├─ lib/generation/*                            │
│              │     (大纲生成 → 场景生成 → 动作生成)         │
│              │                                              │
│              ├─ lib/playback/engine.ts (5-mode 状态机)      │
│              ├─ lib/action/engine.ts (28+ actions)          │
│              ├─ lib/prompts/* (22 模板 + 11 snippets)       │
│              └─ lib/audio/* + lib/media/* + lib/web-search/*│
└─────────────────────────────────────────────────────────────┘
```

### 师渊课堂

```
┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
│ teacher-tablet  │   │ student-tablet  │   │ teacher-screen  │
│   Vue 3 + Vite  │   │   Vue 3 + Vite  │   │   Vue 3 + Vite  │
│   :3002         │   │   :3003         │   │   :3001         │
└────────┬────────┘   └────────┬────────┘   └────────┬────────┘
         │                     │                     │
         │   Socket.IO /classroom namespace          │
         └──────────────┬──────┴──────────────┬──────┘
                        │                     │
                ┌───────▼─────────────────────▼────────┐
                │      apps/server (NestJS 10)         │
                │                                      │
                │   ClassroomGateway (1335 行)         │
                │     - 房间 lesson:{id}，成员 Map     │
                │     - quiz / lock / broadcast /      │
                │       compete / attendance / group   │
                │                                      │
                │   AiService (Qwen via DashScope)     │
                │     - chat / quiz-gen / grade        │
                │                                      │
                │   TypeORM modules (auth/user/course/ │
                │     lesson/task) — 写好但未挂载       │
                │                                      │
                │   端口 :3000                          │
                └──────────────────────────────────────┘
                                │
                ┌───────────────▼───────────────┐
                │ apps/admin (Element Plus)     │
                │   Vue 3 + Vite :3004          │
                │   - WS 监控 + 全校广播         │
                └───────────────────────────────┘
```

---

## 4. OpenMAIC 子系统深扫

### 4.1 LLM Provider 抽象 ⭐⭐⭐⭐⭐

> **位置**：`lib/ai/providers.ts`（1500 行）+ `llm.ts` + `thinking-config.ts` + `thinking-context.ts` + `model-metadata.ts`

#### 注册表结构

```typescript
PROVIDERS: Record<ProviderId, {
  id: string;
  name: string;
  type: 'openai' | 'anthropic' | 'google';
  defaultBaseUrl: string;
  alternateBaseUrls?: { label: string; url: string }[];  // 中国/国际站
  requiresApiKey: boolean;
  icon: string;
  models: ModelInfo[];
}>
```

每个模型 `ModelInfo`：

```typescript
{
  id: 'gpt-5.5',
  name: 'GPT-5.5',
  contextWindow: 1050000,
  outputWindow: 128000,
  capabilities: {
    streaming: true,
    tools: true,
    vision: true,
    thinking?: {
      toggleable: boolean,
      budgetAdjustable: boolean,
      defaultEnabled: boolean,
    }
  }
}
```

#### 16 个 provider

| Provider | 类型 | 模型数 |
|---|---|---|
| openai | native openai | 5 |
| anthropic | native anthropic | 5 |
| google (gemini) | native google | 6 |
| glm | openai-compat | 9 |
| qwen | openai-compat | 10 |
| deepseek | openai-compat | 2 |
| kimi | openai-compat | 3 |
| minimax | anthropic-compat | 1 |
| siliconflow | openai-compat | 7 |
| doubao | openai-compat | 4 |
| openrouter | openai-compat | 2+ |
| grok | openai-compat | 6 |
| tencent-hunyuan | openai-compat | 1+ |
| xiaomi (mimo) | openai-compat | 5 |
| ollama | openai-compat（本地） | 3+ |
| lemonade | openai-compat（本地） | 1+ |

#### 模型字符串：`"provider:modelId"`

```typescript
parseModelString('google:gemini-3-flash-preview')
// → { providerId: 'google', modelId: 'gemini-3-flash-preview' }
```

#### 思考参数适配（真正的护城河）

每家厂商对"启用思考 / 思考预算"的 HTTP 字段都不一样。OpenMAIC 抽象成统一的 `ThinkingConfig`，再用 `getCompatThinkingBodyParams` 翻译：

| Provider | HTTP 字段格式 |
|---|---|
| Kimi / GLM / 小米 | `{ thinking: { type: 'enabled' \| 'disabled' } }` |
| DeepSeek | `{ thinking: { type }, reasoning_effort: 'high' \| 'max' }` |
| Qwen | `{ enable_thinking: bool, thinking_budget: number }` |
| SiliconFlow | `{ enable_thinking, thinking_budget }` |
| Doubao | `{ reasoning_effort: 'minimal' \| ... }` 或 `{ thinking: { type } }` |
| OpenRouter | `{ reasoning: { enabled, effort, max_tokens, exclude } }` |
| Hunyuan（混元） | `{ chat_template_kwargs: { reasoning_effort: 'no_think' \| 'low' \| 'high' } }` |
| Lemonade | `{ chat_template_kwargs: { enable_thinking, thinking_budget } }` |

**AsyncLocalStorage 黑魔法**：调用 LLM 时不必显式传 thinking config，而是在调用入口设到 `AsyncLocalStorage`（`thinking-context.ts`），`compatFetch` 拦截 HTTP body 时从 `globalThis.__thinkingContext` 读出来注入。

```ts
// lib/ai/providers.ts 第 1320 行附近
const compatFetch = async (url, init) => {
  const thinkingCtx = globalThis.__thinkingContext;
  const thinking = thinkingCtx?.getStore?.();
  if (thinking && init?.body && typeof init.body === 'string') {
    const extra = getCompatThinkingBodyParams(providerId, modelId, thinking);
    if (extra) {
      const body = JSON.parse(init.body);
      Object.assign(body, extra);
      init = { ...init, body: JSON.stringify(body) };
    }
  }
  return globalThis.fetch(url, init);
};
```

---

### 4.2 文件化 Prompt 系统 ⭐⭐⭐⭐⭐

> **位置**：`lib/prompts/{loader.ts, index.ts, types.ts, README.md, templates/*, snippets/*}`

#### 目录结构

```
lib/prompts/
├── loader.ts             ← 文件 I/O，不缓存
├── index.ts              ← buildPrompt() + PROMPT_IDS
├── types.ts              ← PromptId / SnippetId 字面量联合类型
├── templates/
│   └── <prompt-id>/
│       ├── system.md     ← 必需
│       └── user.md       ← 可选
└── snippets/
    └── <snippet-id>.md   ← 通过 {{snippet:xxx}} 引入
```

#### 三种占位符

| 语法 | 含义 | 处理时机 |
|---|---|---|
| `{{variableName}}` | 调用方变量注入 | 加载时 |
| `{{snippet:snippet-name}}` | 加载 `snippets/<name>.md` 拼接 | **最先**（snippet 内仍可有 `{{}}` 和 `{{#if}}`） |
| `{{#if conditionName}}...{{/if}}` | 条件块（变量真值时保留） | 中间 |

**处理顺序**：snippet → if → variable

#### 22 个模板清单

| 类别 | 模板 ID |
|---|---|
| 智能体系统 | `agent-system` / `agent-system-wb-teacher` / `agent-system-wb-assistant` / `agent-system-wb-student` |
| 多智能体导演 | `director` |
| 大纲生成 | `requirements-to-outlines` |
| Slide | `slide-content` / `slide-actions` |
| Quiz | `quiz-content` / `quiz-actions` |
| Interactive 总入口 | `interactive-outlines` / `interactive-actions` |
| Interactive 子类型 | `simulation-content` / `game-content` / `visualization3d-content` / `diagram-content` / `code-content` |
| PBL（项目制学习） | `pbl-design` / `pbl-actions` |
| Web 搜索 | `web-search-query-rewrite` |
| Widget 教师动作 | `widget-teacher-actions` |

#### 11 个共享 snippets

| Snippet ID | 用途 |
|---|---|
| `action-types` | 所有可用 action 的 JSON 示例 |
| `element-types` | 所有 slide 元素类型 |
| `image-instructions` | 图片插入规则 |
| `slide-image-instructions` | 幻灯片专属图片规则 |
| `slide-generated-image-instructions` | AI 生成图专用规则 |
| `slide-video-instructions` | 视频规则 |
| `video-instructions` | 视频通用规则 |
| `speech-guidelines` | 说话风格指南 |
| `whiteboard-reference` | 白板使用说明 |
| `json-output-rules` | "只输出 JSON 不要 markdown 代码块"等通用约束 |
| `media-safety-guidelines` | 媒体安全（NSFW / 版权等） |

#### 关键设计原则

- **`{{snippet:xxx}}` 找不到文件就抛错** — 防止把 `{{snippet:speach-guidelines}}` 拼错送到 LLM
- **`{{variableName}}` 缺失静默通过** — 允许"部分渲染"场景
- **测试 `tests/prompts/templates.test.ts` 强校验最终无残留 `{{...}}`** — 上线前防线
- **markdown 改完即生效**（不缓存） — 调试体验极佳

#### Director Prompt 精华（多智能体路由）

`director/system.md` 的 ROLE DIVERSITY / CONTENT DEDUP / DISCUSSION PROGRESSION / GREETING RULE 约束极具借鉴价值：

> - **ROLE DIVERSITY**: 不要连续派两个相同角色（teacher 之后必须是 student/assistant）
> - **CONTENT DEDUP**: 同一个概念不重复讲，要换 ASK / CHALLENGE / CONNECT / NOTES
> - **DISCUSSION PROGRESSION**: explain → question → deeper explanation → different perspective → summary
> - **GREETING RULE**: 第一个 agent 打过招呼后，后续不允许再打

#### Agent System Prompt 精华（让 LLM 输出 JSON 数组控制 UI）

```text
[
  {"type":"action","name":"wb_open","params":{}},
  {"type":"action","name":"wb_draw_latex","params":{"latex":"\\frac{-b ± √(b²-4ac)}{2a}","x":100,"y":80}},
  {"type":"text","content":"This is the quadratic formula..."}
]
```

并教 LLM 不要做这些事：
- ❌ `[{"type":"text","content":"Let me open the whiteboard"},{"type":"action",...}]`（不要预告动作）
- ❌ `[{"type":"text","content":"I'm going to draw a diagram..."}]`（不要描述自己在做什么）
- ❌ `[{"type":"text","content":"Action complete, shape has been added"}]`（不要事后汇报）

---

### 4.3 SSE 流式 Chat ⭐⭐⭐⭐

> **位置**：`app/api/chat/route.ts`（200 行就实现了生产级）

#### 关键特性

| 特性 | 实现要点 |
|---|---|
| **TransformStream + writer** | `new TransformStream()` + `writable.getWriter()` |
| **15s 心跳防代理超时** | `setInterval(() => writer.write(':heartbeat\n\n'), 15000)` |
| **abort 双向传播** | `req.signal` 直接传 `statelessGenerate()` → LangGraph |
| **maxDuration = 60** | Vercel 边缘函数限制 |
| **错误事件优雅写入** | 失败时发 `{ type: 'error', data: { message } }` 事件 |
| **客户端断连 = 服务端取消** | Next.js 把 `req.signal` 自动绑到 fetch 的 AbortController |

#### 请求体结构

```typescript
StatelessChatRequest = {
  messages: UIMessage[],
  storeState: {
    stage, scenes, currentSceneId, mode, whiteboardOpen
  },
  config: { agentIds: string[], sessionType?, agentConfigs? },
  apiKey: string,           // ← 前端把 key 一起发过来
  baseUrl?: string,
  model?: string,           // 格式 "provider:modelId"
  providerType?: string,
  thinkingConfig?: ThinkingConfig,
  directorState?: { turnCount, agentResponses, whiteboardLedger },
  userProfile?: { nickname, bio },
  triggerAgentId?: string,
  discussionTopic?: string,
}
```

#### SSE 事件类型

```typescript
StatelessEvent =
  | { type: 'thinking', data: { stage: 'director' | 'agent_loading', agentId? } }
  | { type: 'agent_start', data: { messageId, agentId, agentName, agentAvatar, agentColor } }
  | { type: 'text_delta', data: { content, messageId } }
  | { type: 'action', data: { actionId, actionName, params, agentId, messageId } }
  | { type: 'agent_end', data: { messageId, agentId } }
  | { type: 'cue_user', data: { fromAgentId } }
  | { type: 'error', data: { message } }
```

---

### 4.4 PlaybackEngine 状态机 ⭐⭐⭐⭐

> **位置**：`lib/playback/engine.ts`（746 行）

#### 5 模式状态机

```
                  start()                  pause()
   idle ──────────────────→ playing ──────────────→ paused
     ▲                        ▲                       │
     │                        │  resume()             │
     │                        └───────────────────────┘
     │
     │  handleEndDiscussion()
     │                       confirmDiscussion()
     │                       / handleUserInterrupt()
     │                            │
     │                            ▼         pause()
     └─────────────────── live ──────────────→ paused (topicState='pending')
                            ▲                    │
                            │ resume / user msg  │
                            └────────────────────┘
```

#### 9 个公开 API

| 方法 | 用途 |
|---|---|
| `start()` | idle → playing |
| `continuePlayback()` | idle → playing（从当前位置继续，如讨论结束后） |
| `pause()` | playing/live → paused |
| `resume()` | paused → playing/live |
| `stop()` | → idle |
| `confirmDiscussion()` | 用户点"加入"，进入 live |
| `skipDiscussion()` | 用户点"跳过"，继续 playing |
| `handleEndDiscussion()` | 讨论结束 → idle |
| `handleUserInterrupt(text)` | 用户在播放时插话 → live |
| `getSnapshot()` / `restoreFromSnapshot()` | 快照导出/导入 |

#### 难点 & 妙手

1. **暂停时保存剩余阅读时间**（无 TTS 的兜底定时器）
2. **Browser-native TTS 兼容性**：
   - Chrome 长文本 15s 截断 → 按句切分 + 顺序播放
   - Firefox `pause/resume` 坏掉 → 用 `cancel + 保存剩余 chunks + 重新 speak`
   - voiceschanged 事件兼容（Chrome 异步加载 voices）
3. **CJK 自动检测**：`/[\u4e00-\u9fff...]/g` 计数，>30% 当中文，否则按西文（150ms/字 vs 240ms/词）
4. **快照恢复**：`getSnapshot/restoreFromSnapshot` 让"刷新页面继续上次进度"成立
5. **`queueMicrotask(processNext)`** 防止连续 spotlight/laser 同步递归爆栈
6. **`onSpeechEnd` 在 mode 设置后再触发**，防止 `speechSynthesis.cancel()` 同步 `onend` 导致 race condition

---

### 4.5 Action 执行引擎（28+ 动作）⭐⭐⭐⭐

> **位置**：`lib/action/engine.ts`（单文件） + `lib/prompts/snippets/action-types.md`

#### 动作类型分类

| 类别 | Actions | 同步性 |
|---|---|---|
| **语音** | `speech` | async（TTS） |
| **强调** | `spotlight`（聚焦元素+暗化背景）/ `laser`（激光笔） | fire-and-forget |
| **互动** | `discussion`（弹主动卡） | 阻塞，等用户响应 |
| **媒体** | `play_video` | async |
| **白板基础** | `wb_open` / `wb_close` / `wb_clear` / `wb_delete` | sync await |
| **白板绘图** | `wb_draw_text` / `wb_draw_shape` / `wb_draw_chart` / `wb_draw_latex` / `wb_draw_table` / `wb_draw_line` / `wb_draw_code` | sync await |
| **白板代码编辑** | `wb_edit_code`（insert_after / insert_before / delete_lines / replace_lines） | sync await |
| **Widget**（HTML 交互场景） | `widget_highlight` / `widget_setState` / `widget_annotation` / `widget_reveal` | sync await |

#### 动作示例

```jsonc
// 1. 语音
{ "type": "text", "content": "Narration content" }

// 2. 聚光灯
{ "type": "action", "name": "spotlight", "params": { "elementId": "element_id" } }

// 3. 激光笔
{ "type": "action", "name": "laser", "params": { "elementId": "element_id" } }

// 4. 讨论
{
  "type": "action",
  "name": "discussion",
  "params": { "topic": "Discussion topic", "prompt": "Guiding prompt" }
}

// 5. 白板画公式
{
  "type": "action",
  "name": "wb_draw_latex",
  "params": { "latex": "\\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}", "x": 100, "y": 80, "width": 500 }
}

// 6. 白板画表格
{
  "type": "action",
  "name": "wb_draw_table",
  "params": {
    "x": 100, "y": 250, "width": 500, "height": 150,
    "data": [["Variable","Meaning"],["a","Coefficient of x²"],["b","Coefficient of x"],["c","Constant term"]]
  }
}
```

#### 设计哲学

- **同步动作 await 完才下一个**（绘图必须完成才能讲"看这个公式"）
- **fire-and-forget 视觉特效**（聚光灯/激光笔不阻塞 TTS）
- **`wb_edit_code` 优先于"删除+重画"**（保留行级动画连续性）

---

### 4.6 两阶段生成流水线 ⭐⭐⭐⭐

> **位置**：`lib/generation/`（10 文件）

```
用户需求 + PDF +（可选图片）
    │
    ▼
┌────────────────────────────────────────┐
│ Stage 1: outline-generator.ts          │  ← requirements-to-outlines prompt
│  - 推断教学语言 (languageDirective)    │
│  - 输出 SceneOutline[]                 │  ← scene.type ∈ slide/quiz/interactive/pbl
└────────────────────────────────────────┘
    │
    ▼ (per scene, 并发)
┌────────────────────────────────────────┐
│ Stage 2: scene-generator.ts            │  ← 按 type 路由
│  - slide-content                       │
│  - quiz-content                        │
│  - interactive-outlines / actions      │
│  - pbl-design                          │
│  - simulation/game/3d/diagram/code     │
└────────────────────────────────────────┘
    │
    ▼
┌────────────────────────────────────────┐
│ scene-actions.ts                       │  ← 给每个 scene 生成"讲解动作"
│  speech / spotlight / wb_*             │  ← AI 直接产出动作 JSON
└────────────────────────────────────────┘
```

#### 关键文件

| 文件 | 职责 |
|---|---|
| `outline-generator.ts` | Stage 1 大纲生成 |
| `scene-generator.ts` | Stage 2 单 scene 内容生成 |
| `scene-builder.ts` | scene 装配（含 media ID 唯一化） |
| `pipeline-runner.ts` | 流水线总调度 |
| `pipeline-types.ts` | 类型定义（含 `GenerationCallbacks` 进度回调） |
| `prompt-formatters.ts` | 图片描述等格式化 |
| `json-repair.ts` | **LLM JSON 输出修复**（用 `jsonrepair` + `partial-json`） |
| `action-parser.ts` | 解析 LLM 输出的 action 数组 |
| `interactive-post-processor.ts` | HTML 交互场景的安全清洗 |
| `generation-pipeline.ts` | 入口 |

#### 异步任务模式

- `POST /api/generate-classroom` → 提交，返回 `jobId`
- `GET /api/generate-classroom/[jobId]` → 轮询进度
- 客户端用 `setInterval` 轮询直至完成

#### JSON 修复必备

```typescript
import { jsonrepair } from 'jsonrepair';
import { parse as partialParse } from 'partial-json';

function safeParseJSON<T>(text: string): T | null {
  try { return JSON.parse(text); } catch {}
  try { return JSON.parse(jsonrepair(text)); } catch {}
  try { return partialParse(text); } catch {}
  return null;
}
```

任何认真做 AI 应用都必须做这件事，**我们目前没有**。

---

### 4.7 LangGraph 多智能体导演图 ⭐⭐⭐⭐⭐

> **位置**：`lib/orchestration/`（15 文件，核心 `director-graph.ts` 548 行）

#### 图结构（极简）

```
START → director ──(end)──→ END
           │
           └─(next)→ agent_generate ──→ director (loop)
```

只有 **2 个节点**：
- `director`：决定下一个智能体（或 END / USER）
- `agent_generate`：执行单个智能体的回合

#### 状态定义（typed）

```typescript
OrchestratorState = Annotation.Root({
  messages, storeState, availableAgentIds, maxTurns,
  languageModel, thinkingConfig, discussionContext,
  triggerAgentId, userProfile, agentConfigOverrides,
  currentAgentId, turnCount,
  agentResponses: Annotation({ reducer: (prev, update) => [...prev, ...update] }),
  whiteboardLedger: Annotation({ reducer: (prev, update) => [...prev, ...update] }),
  shouldEnd, totalActions,
});
```

#### 3 个 LLM 快速路径（省调用）

1. turn 0 + 单智能体 → 直接 dispatch
2. turn 0 + `triggerAgentId` → 直接 dispatch（学生举手让某 AI 说话）
3. 单 agent 第二轮 → 直接 cue user

#### 多智能体 LLM 决策

```typescript
// director 给 LLM：
// system: <director/system.md>
// user: "Decide which agent should speak next."
// 输出 JSON: { "next_agent": "<id>" | "USER" | "END" }
```

#### Agent generation 流式解析

`agent_generate` 节点：
1. 构建 `buildStructuredPrompt(agentConfig, storeState, discussion, whiteboardLedger, userProfile, agentResponses)` 系统提示
2. 调用 `adapter.streamGenerate(lcMessages, { signal })` 流式
3. **流式解析器** `parseStructuredChunk` 把 LLM 增量 JSON 分成 `text` / `action` 类型 chunk
4. 每个 chunk 通过 `config.writer()` 推送给前端
5. 过滤"非法 action"（基于 `effectiveActions` 白名单 + scene type 二次过滤）
6. 记录白板账本

#### Request-scoped agent overrides

智能体配置随请求体过来（无需服务端持久化），生成的 ephemeral agent 不污染全局 registry。

---

### 4.8 多媒体抽象（TTS / ASR / Image / Video）

#### TTS（`lib/audio/`）

| 文件 | 职责 |
|---|---|
| `tts-providers.ts` | TTS provider 注册表（OpenAI/Azure/GLM/Qwen/MiniMax/ElevenLabs/Lemonade/browser-native） |
| `voxcpm.ts` + `voxcpm-voices.ts` | **VoxCPM2 声音克隆**（vLLM-Omni / Python API / Nano-vLLM 三种后端） |
| `voice-resolver.ts` | 根据 agent 人设动态选音色 |
| `browser-tts-preview.ts` | Web Speech API 试听 |
| `tts-utils.ts` / `wav-utils.ts` | 工具 |
| `asr-providers.ts` | ASR provider 注册表（OpenAI/Qwen/Lemonade） |
| `use-tts-preview.ts` | React Hook |

#### Image / Video（`lib/media/adapters/`）

13 个适配器统一接口：

| 类型 | 适配器 |
|---|---|
| 图片 | openai-image / qwen-image / seedream / nano-banana / minimax-image / grok-image / lemonade-image |
| 视频 | seedance / kling / veo / minimax-video / grok-video / happyhorse |

#### Web 搜索（`lib/web-search/`）

| 文件 | Provider |
|---|---|
| `tavily.ts` | Tavily |
| `bocha.ts` | 博查 |
| `brave.ts` | Brave |
| `baidu.ts` | 百度 |
| `format.ts` | 统一格式化 |
| `index.ts` | 路由 + 入口 |

---

### 4.9 站点级 ACCESS_CODE 鉴权 ⭐⭐⭐⭐

> **位置**：`middleware.ts`（77 行）

#### 核心思路

- 部署时设 `ACCESS_CODE=xxx` 环境变量
- 用户访问时，前端弹密码框，发到 `/api/access-code/verify`
- 服务端用 `crypto.subtle.sign('HMAC-SHA256', ...)` 生成签名 token
- token 以 cookie `openmaic_access=<timestamp>.<hex>` 形式存
- 后续每次请求 middleware 校验：
  - 白名单路径（`/api/access-code/*`、`/api/health`）直放
  - 有 cookie 且 HMAC 校验通过 → next()
  - API 路由无 cookie → 401
  - 页面路由无 cookie → 放过，让前端弹 modal

#### 完整代码（77 行可直接套用）

```ts
import { NextRequest, NextResponse } from 'next/server';

async function verifyToken(token: string, accessCode: string): Promise<boolean> {
  const dotIndex = token.indexOf('.');
  if (dotIndex === -1) return false;
  const timestamp = token.substring(0, dotIndex);
  const signature = token.substring(dotIndex + 1);

  const keyData = new TextEncoder().encode(accessCode);
  const key = await crypto.subtle.importKey(
    'raw', keyData.buffer, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const data = new TextEncoder().encode(timestamp);
  const expected = bufToHex(await crypto.subtle.sign('HMAC', key, data.buffer));

  // 常长度比对（防 timing attack）
  if (signature.length !== expected.length) return false;
  let mismatch = 0;
  for (let i = 0; i < signature.length; i++) {
    mismatch |= signature.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return mismatch === 0;
}

export async function middleware(request: NextRequest) {
  const accessCode = process.env.ACCESS_CODE;
  if (!accessCode) return NextResponse.next();

  const { pathname } = request.nextUrl;
  if (pathname.startsWith('/api/access-code/') || pathname === '/api/health') {
    return NextResponse.next();
  }

  const cookie = request.cookies.get('openmaic_access');
  if (cookie?.value && (await verifyToken(cookie.value, accessCode))) {
    return NextResponse.next();
  }

  if (pathname.startsWith('/api/')) {
    return NextResponse.json(
      { success: false, errorCode: 'INVALID_REQUEST', error: 'Access code required' },
      { status: 401 }
    );
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|logos/).*)'],
};
```

#### 适用场景

- 内测、单租户、小团队部署的**轻量级保护**
- 无需用户系统、无需数据库
- HMAC 防伪造、防 timing attack

---

### 4.10 Quiz 数据模型与评分

> **位置**：`lib/prompts/templates/quiz-content/system.md` + `lib/quiz/grading.ts` + `lib/quiz/persistence.ts`

#### Quiz 数据 Schema（值得直接抄）

```jsonc
{
  "id": "q1",
  "type": "single" | "multiple" | "short_answer",
  "question": "Question text",
  "options": [
    { "label": "Option A content", "value": "A" }
  ],   // choice 题才需要
  "answer": ["A"],                                  // choice 题才需要
  "commentPrompt": "Rubric: (1) Key A 40% (2) Key B 30% (3) Clarity 30%",  // short_answer 必填
  "analysis": "为什么 A 是对的...",
  "points": 10
}
```

#### 客观题本地评分

```typescript
// lib/quiz/grading.ts
export function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort(), sb = [...b].sort();
  return sa.every((v, i) => v === sb[i]);
}

export function gradeChoiceQuestions(
  questions: QuizQuestion[],
  answers: Record<string, string | string[]>
): QuestionResult[] {
  return questions
    .filter((q) => !isShortAnswer(q))
    .map((q) => {
      const pts = q.points ?? 1;
      const userAnswer = toArray(answers[q.id]);
      const correctAnswer = toArray(q.answer);
      const correct = arraysEqual(userAnswer, correctAnswer);
      return {
        questionId: q.id,
        correct,
        status: correct ? 'correct' : 'incorrect',
        earned: correct ? pts : 0,
      };
    });
}
```

简答题评分由 `/api/quiz-grade` 调用 LLM，使用 `commentPrompt` 作为评分细则。

#### IndexedDB 持久化

`lib/quiz/persistence.ts` 把答题历史/状态持久化到客户端，刷新页面/重新进入课堂还能恢复进度。

---

## 5. 18 个 API 端点全清单

| 路径 | 用途 | 流式 |
|---|---|---|
| `POST /access-code/verify` | 站点密码校验，发 HMAC cookie | 否 |
| `GET  /access-code/status` | 当前站点是否启用 ACCESS_CODE | 否 |
| `GET  /azure-voices` | Azure TTS 音色列表 | 否 |
| `POST /chat` | **多智能体讨论 SSE**（核心） | **SSE** |
| `GET  /classroom` | 课堂元数据 | 否 |
| `GET  /classroom-media/[id]/[...path]` | 课堂媒体反代 | 否 |
| `POST /generate/agent-profiles` | 一键生成智能体人设 | 否 |
| `POST /generate/image` | 图片生成（统一入口） | 否 |
| `POST /generate/scene-actions` | 场景 actions 生成 | 否 |
| `POST /generate/scene-content` | 场景内容生成（按 type 路由） | 否 |
| `POST /generate/scene-outlines-stream` | **大纲流式生成** | **SSE** |
| `POST /generate/tts` | TTS（动态选 provider/音色） | 否 |
| `POST /generate/video` | 视频生成 | 否 |
| `POST /generate-classroom` | **异步课堂生成任务**（jobId） | 否 |
| `GET  /generate-classroom/[jobId]` | **轮询任务进度** | 否 |
| `GET  /health` | 健康检查 | 否 |
| `POST /parse-pdf` | PDF → 结构化文本 | 否 |
| `POST /pbl/chat` | PBL 模式对话（带 MCP 工具调用） | SSE |
| `POST /proxy-media` | 通用媒体反代（解决跨域） | 否 |
| `POST /quiz-grade` | 简答题 AI 评分 | 否 |
| `GET  /server-providers` | 服务端预配置 provider 清单 | 否 |
| `POST /transcription` | ASR 语音转写 | 否 |
| `POST /verify-image-provider` | 验证图片 provider 连通性 | 否 |
| `POST /verify-model` | 验证 LLM 模型连通性 | 否 |
| `POST /verify-pdf-provider` | 验证 PDF provider | 否 |
| `POST /verify-video-provider` | 验证视频 provider | 否 |
| `POST /web-search` | 网络搜索（统一入口） | 否 |

---

## 6. 数据模型对比

### Quiz 题目

| 字段 | OpenMAIC | 我们 | 差距 |
|---|---|---|---|
| id | ✅ | ✅ | — |
| type | single/multiple/short_answer | 基本一致 | — |
| question | ✅ | ✅ | — |
| options | ✅ | ✅ | — |
| answer | ✅ | ✅ | — |
| **analysis** | ✅（解析） | ❌ | **应补** |
| **points** | ✅（分值） | ❌ | **应补** |
| **commentPrompt** | ✅（评分细则） | ❌ | **应补**（简答题 AI 评分用） |

### Scene / Lesson

| 概念 | OpenMAIC | 我们 |
|---|---|---|
| 课堂单位 | "Scene"（slide/quiz/interactive/pbl 之一） | "Lesson"（一节课）+ "Activity"（活动） |
| 持久化 | Dexie IndexedDB（客户端） | 内存 Map（服务端） |
| 历史回放 | snapshot 序列化恢复 | 无 |

---

## 7. 可借鉴清单（按工作量分级）

### 7.1 立即可做（< 1 天）

#### 改动 1：quiz 数据加 `commentPrompt` + `analysis` + `points`

**文件**：`packages/shared/src/types.ts`

```typescript
export interface Question {
  id: string;
  type: 'single' | 'multiple' | 'short_answer' | 'true_false';
  question: string;
  options?: QuestionOption[];
  answer?: string[];
  analysis?: string;        // ⬅️ 新增（解析）
  points?: number;          // ⬅️ 新增（分值）
  commentPrompt?: string;   // ⬅️ 新增（short_answer 评分细则）
}
```

并在 `apps/server/src/modules/ai/ai.service.ts` 的 `mockQuizGen` 与真实 quiz prompt 里要求 LLM 输出这些字段。

#### 改动 2：把 chat / quiz / grade 三段提示词搬到 .md

新建 `apps/server/src/modules/ai/prompts/{chat,quiz-gen,grade}/system.md`，AiService 用 `fs.readFileSync` 读取（开发期不缓存）。

参考 OpenMAIC 的 `lib/prompts/loader.ts` 写一个 mini 版（不到 100 行）。

#### 改动 3：AI 输出 JSON 加 jsonrepair 兜底

```bash
pnpm --filter @snyuan/server add jsonrepair partial-json
```

```typescript
import { jsonrepair } from 'jsonrepair';
import { parse as partialParse } from 'partial-json';

function safeParseJSON<T>(text: string): T | null {
  try { return JSON.parse(text); } catch {}
  try { return JSON.parse(jsonrepair(text)); } catch {}
  try { return partialParse(text); } catch {}
  return null;
}
```

#### 改动 4：教师端"读题"按钮（Web Speech API）

参考 `playback/engine.ts` 的 browser-TTS 实现（cancel+re-speak、CJK 检测、Chrome 15s 切句）。零依赖，纯前端。

#### 改动 5：站点级密码 HMAC 中间件（admin 端 + 教师端）

把 OpenMAIC 的 77 行 `middleware.ts` 思路搬到 NestJS：

```typescript
@Injectable()
export class AccessCodeMiddleware implements NestMiddleware {
  async use(req: Request, res: Response, next: NextFunction) {
    const code = process.env.ACCESS_CODE;
    if (!code) return next();
    if (req.path.startsWith('/api/access-code/') || req.path === '/api/health') return next();

    const token = req.cookies?.snyuan_access;
    if (token && await this.verifyHMAC(token, code)) return next();

    if (req.path.startsWith('/api/')) {
      return res.status(401).json({ errorCode: 'INVALID_REQUEST', error: 'Access code required' });
    }
    next(); // 页面继续，由前端 modal 弹密码框
  }
}
```

### 7.2 中期项目（1-2 周）

#### 中期 1：完整 LLM Provider 抽象层

**收益**：教师能在 UI 里选 GPT / Claude / Gemini / Kimi / DeepSeek / 通义 / 智谱…

**步骤**：

1. **后端**：`apps/server/src/modules/ai/providers/` 仿照 `lib/ai/providers.ts` 写注册表
2. 引入 **Vercel AI SDK**（NestJS 完全可以用）：

```bash
pnpm --filter @snyuan/server add ai @ai-sdk/openai @ai-sdk/anthropic @ai-sdk/google
```

3. **前端**：admin/教师端加"AI 设置"页面，存 IndexedDB / localStorage
4. **请求时**由前端把 `{ provider, model, apiKey, baseUrl }` 一起发给后端
5. 注意：**key 经前端 → 后端中转有泄漏风险**，需要：
   - 前端 key 用 IndexedDB 存储（参考 OpenMAIC `lib/store/settings.ts`）
   - 服务端可选支持 `.env` 预配置的"管理员 key"，覆盖前端传入的

#### 中期 2：SSE 流式 chat（替代 WS `ai:stream`）

NestJS 11 已有 `@Sse()` 装饰器：

```typescript
@Controller('api/v1/ai')
export class AiSseController {
  @Sse('chat-stream')
  chat(@Body() body: ChatRequest, @Req() req: Request): Observable<MessageEvent> {
    return new Observable(subscriber => {
      const abort = new AbortController();
      req.on('close', () => abort.abort());
      this.ai.streamChat(body.messages, body.model, abort.signal)
        .then(async stream => {
          for await (const chunk of stream) {
            subscriber.next({ data: JSON.stringify({ type: 'text_delta', content: chunk }) });
          }
          subscriber.complete();
        });
      // 15s 心跳
      const hb = setInterval(() => subscriber.next({ data: '' } as MessageEvent), 15000);
      return () => clearInterval(hb);
    });
  }
}
```

学生端 `AiChatDrawer.vue` 用 `EventSource` 接收。Socket.IO 现有的 `ai:chat` 也能继续用，新 SSE 作为备选（移动端有些代理对 WS 不友好）。

#### 中期 3：知识点 + 报告体系

**复用 OpenMAIC**：quiz schema（`points` + `analysis`）+ `lib/quiz/persistence.ts` IndexedDB 思路 + 报告 markdown 模板。

**我们要补**：

- 每道题绑定 1+ knowledgePointId
- AI 批改时返回 `{ score, mastery: { [kpId]: 0-1 } }`
- 教师端 `LessonRecord.vue`、`teacher-report*` 改为从真实数据渲染（替代当前的 mock）

### 7.3 长期规划（1-2 月）

#### 长期 1：AI 实践面板生成"HTML 交互场景"

OpenMAIC `interactive` 场景：AI 一次性生成一份独立 HTML（物理模拟/小游戏/3D），扔到 iframe 里给学生玩。

**100% 适合**我们的"AI 实践"按钮：

- 教师按按钮 → 描述需求（"做一个二次函数图像可视化"）
- AI 生成 HTML（参考 `lib/prompts/templates/interactive-outlines/system.md`）
- 服务端存到课件目录 → 推给学生平板 iframe

`lib/generation/interactive-post-processor.ts` 还做了**安全清洗**（去掉外链 script、危险 API 等），必抄。

#### 长期 2：教师端"AI 板书"按钮

参考 OpenMAIC `wb_*` actions + `whiteboard` 组件：

- 教师按按钮 → 描述要画的内容
- AI 输出 `[{wb_open}, {wb_draw_latex}, {wb_draw_table}, {speech}]` 数组
- 服务端推给大屏 → 大屏按顺序执行
- 公式用 KaTeX/Temml，流程图用 @xyflow/react

#### 长期 3：PPTX / HTML 导出

OpenMAIC 自带 `packages/pptxgenjs`（定制版）+ `packages/mathml2omml`（MathML → Office Math）。

我们的"课堂报告"如果要导出可分享文件：

- PPTX 给老师存档/打印
- HTML 给学生回顾

直接复用 OpenMAIC 的两个内部包（AGPL-3.0 注意合规）。

---

## 8. 不建议借鉴的部分

| 项 | 原因 |
|---|---|
| 单 Next.js Route Handler 后端架构 | 我们已经有 NestJS + Socket.IO，是真实课堂的正确选型 |
| 全部 AI 智能体替代真人 | 我们的产品本质是给老师用的工具，不是 AI 自学产品 |
| LangGraph 多智能体导演图 | 真实课堂里"老师就是导演"，不需要 AI 替老师做决策 |
| Canvas 幻灯片编辑器（slide-renderer） | 我们用 PDF 课件就够了，自研编辑器投入产出比低 |
| ProseMirror 富文本 | 暂无对应需求 |
| OpenClaw skill / 飞书集成 | 不是我们的分发渠道 |
| Eval 体系（whiteboard-layout / outline-language） | 提示词稳定后再考虑，不是 MVP 重点 |
| 视频生成（Seedance/Kling/Veo/Sora） | 教育场景实用性低、成本极高 |

---

## 9. 关键文件路径索引

> 所有路径基于 `https://github.com/THU-MAIC/OpenMAIC`（v0.2.1 / main 分支）

| 用途 | OpenMAIC 路径 |
|---|---|
| LLM provider 注册 | `lib/ai/providers.ts` |
| LLM thinking config | `lib/ai/thinking-config.ts` |
| LLM 统一调用入口 | `lib/ai/llm.ts` |
| 文件化 prompt loader | `lib/prompts/loader.ts` |
| Prompt 系统 README | `lib/prompts/README.md` |
| 多智能体导演 prompt | `lib/prompts/templates/director/system.md` |
| 智能体系统 prompt | `lib/prompts/templates/agent-system/system.md` |
| 大纲生成 prompt | `lib/prompts/templates/requirements-to-outlines/system.md` |
| Quiz 生成 prompt | `lib/prompts/templates/quiz-content/system.md` |
| LangGraph 导演图 | `lib/orchestration/director-graph.ts` |
| Prompt builder | `lib/orchestration/prompt-builder.ts` |
| AI SDK ↔ LangGraph 桥接 | `lib/orchestration/ai-sdk-adapter.ts` |
| 回放状态机 | `lib/playback/engine.ts` |
| Action 引擎 | `lib/action/engine.ts` |
| 大纲生成 | `lib/generation/outline-generator.ts` |
| 场景生成 | `lib/generation/scene-generator.ts` |
| JSON 修复 | `lib/generation/json-repair.ts` |
| 站点 HMAC 中间件 | `middleware.ts` |
| Next.js 配置 | `next.config.ts` |
| Quiz 客观题评分 | `lib/quiz/grading.ts` |
| Quiz IndexedDB 持久化 | `lib/quiz/persistence.ts` |
| TTS provider 注册 | `lib/audio/tts-providers.ts` |
| ASR provider 注册 | `lib/audio/asr-providers.ts` |
| VoxCPM2 声音克隆 | `lib/audio/voxcpm.ts` |
| 图片/视频适配器 | `lib/media/adapters/*` |
| Web 搜索路由 | `lib/web-search/index.ts` |
| Zustand stores | `lib/store/*` |
| SSE chat 入口 | `app/api/chat/route.ts` |
| 异步课堂生成 | `app/api/generate-classroom/route.ts` |
| 大纲流式生成 | `app/api/generate/scene-outlines-stream/route.ts` |
| 提供商验证 | `app/api/verify-model/route.ts` |
| Slide Canvas 渲染器 | `components/slide-renderer/Editor/Canvas/` |
| 场景渲染器 | `components/scene-renderers/` |
| 白板组件 | `components/whiteboard/` |
| 设置面板 | `components/settings/` |
| Dockerfile | `Dockerfile`（多阶段构建，cairo/pango/jpeg/giflib/librsvg 原生依赖） |
| PPTX 包 | `packages/pptxgenjs/` |
| MathML → OOXML | `packages/mathml2omml/` |
| OpenClaw skill | `skills/openmaic/SKILL.md` |
| 单测 | `tests/{ai,api,audio,classroom,export,generation,i18n,media,orchestration,prompts,quiz,server,settings,store,web-search}` |
| E2E | `e2e/{tests,fixtures,pages}` |
| Eval | `eval/{whiteboard-layout,outline-language}` |

---

## 10. 进一步探索方向

如果未来要做更深的调研，重点关注：

1. **`components/slide-renderer/`** — Canvas-based 幻灯片编辑器内部结构（12 种元素：text/image/shape/table/chart/code/latex/line/video/...），可借鉴元素模型即使我们用 PDF
2. **`packages/pptxgenjs`** — 定制版 PowerPoint 生成（标准开源版不支持 MathML/EMF）
3. **`lib/pbl/mcp/`** — PBL 项目制学习的 MCP 工具集成
4. **`lib/orchestration/summarizers/`** — 会话上下文压缩、白板冲突检测、状态摘要器
5. **`lib/export/html-parser/`** — HTML 课堂导出
6. **`scripts/check-i18n-keys.mjs`** — i18n 一致性检查脚本
7. **`eval/whiteboard-layout/`** — 白板布局自动评测（如何让 LLM 不画乱）

---

## 附录：OpenMAIC 全仓目录树

```
OpenMAIC/
├── app/                          18 个 API 路由 + 3 个页面路由
│   ├── api/
│   │   ├── access-code/{verify,status}/route.ts
│   │   ├── chat/route.ts                  ← SSE
│   │   ├── classroom/route.ts
│   │   ├── classroom-media/[id]/[...path]/route.ts
│   │   ├── generate/{agent-profiles,image,scene-actions,scene-content,scene-outlines-stream,tts,video}/route.ts
│   │   ├── generate-classroom/route.ts          ← 提交任务
│   │   ├── generate-classroom/[jobId]/route.ts  ← 轮询
│   │   ├── health/route.ts
│   │   ├── parse-pdf/route.ts
│   │   ├── pbl/chat/route.ts
│   │   ├── proxy-media/route.ts
│   │   ├── quiz-grade/route.ts
│   │   ├── server-providers/route.ts
│   │   ├── transcription/route.ts
│   │   ├── verify-{image,model,pdf,video}-provider/route.ts
│   │   ├── web-search/route.ts
│   │   └── azure-voices/route.ts
│   ├── classroom/[id]/page.tsx
│   ├── eval/whiteboard/...
│   ├── generation-preview/...
│   └── page.tsx (首页)
├── lib/                          ★ 全部"业务领域库"
│   ├── ai/         {providers, llm, model-metadata, thinking-config, thinking-context}.ts
│   ├── audio/      {asr-providers, browser-tts-preview, constants, tts-providers, tts-utils, types, use-tts-preview, voice-resolver, voxcpm, voxcpm-voices, wav-utils}.ts
│   ├── media/adapters/  {grok,happyhorse,kling,lemonade-image,minimax-image,minimax-video,nano-banana,openai-image,qwen-image,seedance,seedream,veo}-adapter.ts (13 个)
│   ├── pdf/        unpdf + MinerU 适配
│   ├── web-search/ {baidu,bocha,brave,tavily,index,format,types,utils,constants}.ts
│   ├── prompts/
│   │   ├── loader.ts / index.ts / types.ts / README.md
│   │   ├── templates/  agent-system / agent-system-wb-{teacher,assistant,student} / director / requirements-to-outlines / slide-{content,actions} / quiz-{content,actions} / interactive-{outlines,actions} / pbl-{design,actions} / simulation-content / game-content / visualization3d-content / diagram-content / code-content / widget-teacher-actions / web-search-query-rewrite  (22 个)
│   │   └── snippets/  action-types / element-types / image-instructions / json-output-rules / media-safety-guidelines / slide-{image,generated-image,video}-instructions / speech-guidelines / video-instructions / whiteboard-reference  (11 个)
│   ├── generation/  {outline,scene}-generator.ts / scene-builder.ts / pipeline-{runner,types}.ts / json-repair.ts / action-parser.ts / interactive-post-processor.ts / prompt-formatters.ts / generation-pipeline.ts (10 个)
│   ├── orchestration/  director-graph.ts / director-prompt.ts / prompt-builder.ts / stateless-generate.ts / ai-sdk-adapter.ts / tool-schemas.ts / types.ts / registry/{store,types}.ts / summarizers/{conversation-summary,message-converter,peer-context,state-context,whiteboard-conflicts,whiteboard-ledger}.ts (15 个)
│   ├── playback/   engine.ts (746行) / types.ts / derived-state.ts / index.ts
│   ├── action/     engine.ts
│   ├── store/      11 个 Zustand slice
│   ├── types/      集中 13 个 .d.ts
│   ├── hooks/      13 个 React Hook
│   ├── quiz/       grading.ts + persistence.ts
│   ├── pbl/        含 mcp/ MCP 工具
│   ├── export/     PPTX / HTML 导出 (8 文件 + html-parser/)
│   ├── api/        Stage API 门面 (9 文件)
│   ├── server/     服务端共享 (12 文件)
│   ├── i18n/       国际化 (5 文件 + locales/)
│   ├── prosemirror/ commands/ plugins/ schema/
│   ├── storage/providers/
│   ├── classroom/ chat/ contexts/ utils/ pdf/ buffer/ import/ constants/
│   └── …
├── components/                   200+ React 组件
│   ├── slide-renderer/  Editor/Canvas/ + 12 元素类型 (text/image/shape/table/chart/code/latex/line/video + Thumbnail*)
│   ├── scene-renderers/ quiz/ interactive/ pbl/
│   ├── whiteboard/      SVG 白板 (3 文件)
│   ├── chat/            会话 + AI elements (7 文件)
│   ├── agent/           头像/配置/信息栏 (4 文件)
│   ├── settings/        16 个设置面板
│   ├── ai-elements/     30 个 AI 元素
│   ├── generation/      生成工具栏 + 进度 (4 文件)
│   ├── roundtable/      圆桌辩论 (4 文件)
│   ├── audio/canvas/stage/  各种小组件
│   └── ui/              32 个 shadcn 基础组件
├── configs/                      13 个共享常量
│   ├── animation.ts / chart.ts / element.ts / font.ts / hotkey.ts / image-clip.ts / latex.ts / lines.ts / mime.ts / shapes.ts / storage.ts / symbol.ts / theme.ts
├── packages/                     工作区子包
│   ├── pptxgenjs/   定制 PowerPoint 生成
│   └── mathml2omml/ MathML → Office Math 转换
├── skills/openmaic/              OpenClaw / ClawHub skill
│   ├── SKILL.md     轻量路由层 + 确认规则
│   └── references/  按需加载的 SOP 分段 (5 文件)
├── eval/                         模型评测
│   ├── whiteboard-layout/  白板布局自动评测
│   ├── outline-language/   大纲语言推断评测
│   └── shared/             共享工具
├── tests/                        Vitest 单测
│   ├── ai/api/audio/classroom/export/generation/i18n/media/orchestration/prompts/quiz/server/settings/store/web-search/  按 lib 子模块拆分
├── e2e/                          Playwright 端到端
│   ├── fixtures/test-data/  pages/  tests/
├── community/                    社区文档
├── scripts/                      工具脚本（check-i18n-keys.mjs 等）
├── middleware.ts                 站点 HMAC 鉴权 (77 行)
├── next.config.ts                Next.js 配置 (含 frame-ancestors CSP)
├── Dockerfile                    多阶段构建（cairo/pango/jpeg/giflib/librsvg 原生依赖）
├── docker-compose.yml
├── vercel.json
├── .env.example                  ★ 200 行环境变量样例（所有 provider）
├── CHANGELOG.md                  详细版本历史
├── README.md / README-zh.md      中英文 README（各 27KB）
└── package.json                  Next.js 16 / React 19 / 80+ 依赖
```

---

## 维护说明

- 本档案对应 OpenMAIC v0.2.1（commit head 2026-04-26）
- 如要重新调研，clone 仓库到 `$TEMP/OpenMAIC`，然后按 [关键文件路径索引](#9-关键文件路径索引) 逐个查阅
- 重大版本更新（如 v0.3.x）时建议重新走一遍"两阶段生成流水线"、"LangGraph 编排"、"action types"三处，因为这些是变化频率最高的核心
