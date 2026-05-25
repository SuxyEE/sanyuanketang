# AI Prompts

文件化的 AI 提示词模板，结构参考 [OpenMAIC](https://github.com/THU-MAIC/OpenMAIC) 的 `lib/prompts/`。

## 目录约定

```
prompts/
├── loader.ts              ← 加载器 + 变量替换
├── README.md              ← 你正在看的文件
├── <prompt-id>/
│   ├── system.md          ← 系统提示（必需）
│   └── user.md            ← 用户消息模板（可选）
└── snippets/
    └── <snippet-id>.md    ← 通过 {{snippet:xxx}} 引入
```

## 占位符语法

| 语法 | 用途 | 处理时机 |
|---|---|---|
| `{{varName}}` | 变量插值 | 加载时 |
| `{{snippet:xxx}}` | 拼接 `snippets/xxx.md` | **最先** |
| `{{#if condName}}...{{/if}}` | 条件块（变量真值时保留） | 中间 |

**处理顺序**：snippet → if → variable

## 已有模板

| ID | 用途 | 必需变量 |
|---|---|---|
| `chat` | AI 答疑（普通模式 + 图片识别） | courseContext, slideIndex, hasImage? |
| `chat-stream` | AI 答疑（流式简版） | courseContext, slideIndex |
| `quiz-gen` | AI 出题 | count, topic, courseContext, difficulty, typesText |
| `grade` | AI 批改 | question, studentAnswer, maxScore, referenceAnswer?, commentPrompt? |

## 如何新增

1. 新建 `prompts/<new-id>/system.md`（可选 `user.md`）
2. 在调用处 `buildPrompt('<new-id>', { ... })`
3. 不需要重启服务，开发环境每次调用都重读磁盘

## 注意

- 必须把 .md 文件放在 `apps/server/src/modules/ai/prompts/` 下，构建时 `nest-cli.json` 的 `assets` 配置会自动复制到 dist
- `{{snippet:xxx}}` 找不到文件会抛错（防拼错）
- `{{varName}}` 缺失会**保留原文**（允许部分渲染，但需要测试保证发到 LLM 前已全部解析）
