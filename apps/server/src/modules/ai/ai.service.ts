import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { jsonrepair } from 'jsonrepair'
import { parse as partialParse } from 'partial-json'
import { buildPrompt } from './prompts/loader'
import { LlmService } from './llm/llm.service'
import { sanitizeInteractiveHtml } from './interactive-sanitizer'
import type { ChatMessage as LlmChatMessage } from './llm/types'

export function clampScore(value: unknown): number {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(100, Math.round(n)))
}

/**
 * 三层 JSON 解析：直接 parse → jsonrepair 修复 → partial-json 容错。
 * 处理常见的 LLM 输出问题：截断、多余逗号、缺引号、混入 markdown 代码块。
 * 任何一层成功即返回；全部失败返回 null。
 */
export function safeParseJSON<T = any>(text: string | null | undefined): T | null {
  if (!text) return null

  const cleaned = String(text)
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim()
  if (!cleaned) return null

  // Layer 1: native parse
  try {
    return JSON.parse(cleaned) as T
  } catch {
    /* fall through */
  }

  // Layer 2: jsonrepair (fixes trailing commas, missing quotes, smart quotes, etc.)
  try {
    return JSON.parse(jsonrepair(cleaned)) as T
  } catch {
    /* fall through */
  }

  // Layer 3: substring between first { and last } then re-try jsonrepair
  const firstBrace = cleaned.indexOf('{')
  const lastBrace = cleaned.lastIndexOf('}')
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const slice = cleaned.slice(firstBrace, lastBrace + 1)
    try {
      return JSON.parse(jsonrepair(slice)) as T
    } catch {
      /* fall through */
    }
  }

  // Layer 4: partial-json (handles truncated streams)
  try {
    return partialParse(cleaned) as T
  } catch {
    /* give up */
  }

  return null
}

/** Clamp points to [1, 20] and default to 10 by difficulty (easy=5, medium=10, hard=15). */
function normalizePoints(q: any): number {
  const raw = Number(q?.points)
  if (Number.isFinite(raw) && raw > 0) return Math.max(1, Math.min(20, Math.round(raw)))
  const diff = String(q?.difficulty || '').toLowerCase()
  if (diff === 'easy') return 5
  if (diff === 'hard') return 15
  return 10
}

/** Default rubric for short_answer when LLM forgets to provide commentPrompt. */
function defaultCommentPrompt(reference: string): string {
  if (!reference) return '评分维度：(1) 是否抓住核心要点 50% (2) 表述清晰、逻辑完整 30% (3) 用语规范 20%'
  return `请按以下评分细则打分（满分 100 分）：\n(1) 是否覆盖参考答案的关键要点（约 ${Math.min(60, 40 + Math.floor(reference.length / 10))}%）\n(2) 表述是否清晰、逻辑是否完整（约 25%）\n(3) 用语是否规范、是否结合实际（约 15%）`
}

export function normalizeQuizQuestion(q: any): any {
  const type = (q?.type || 'single_choice') as string
  const points = normalizePoints(q)
  const difficulty = ['easy', 'medium', 'hard'].includes(String(q?.difficulty)) ? q.difficulty : undefined
  const kpRaw = q?.knowledgePoints
  const knowledgePoints = Array.isArray(kpRaw)
    ? kpRaw.map((k: any) => String(k || '').trim()).filter(Boolean).slice(0, 5)
    : undefined
  const out: any = {
    type,
    content: String(q?.content || '').trim(),
    answer: q?.answer != null ? String(q.answer).trim() : undefined,
    analysis: q?.analysis ? String(q.analysis).trim() : undefined,
    points,
    difficulty,
    knowledgePoints,
  }
  if (type === 'short_answer') {
    out.referenceAnswer = q?.referenceAnswer || q?.answer || q?.analysis || ''
    out.commentPrompt = q?.commentPrompt
      ? String(q.commentPrompt).trim()
      : defaultCommentPrompt(out.referenceAnswer)
    out.answer = undefined
    return out
  }
  if (type === 'true_false') {
    out.options = [
      { key: 'A', content: '对' },
      { key: 'B', content: '错' },
    ]
    if (out.answer) {
      const upper = out.answer.toUpperCase()
      if (upper === 'TRUE' || upper === '对' || upper === '正确' || upper === '是') out.answer = 'A'
      else if (upper === 'FALSE' || upper === '错' || upper === '错误' || upper === '否') out.answer = 'B'
    }
    return out
  }
  out.options = Array.isArray(q?.options)
    ? q.options.map((o: any, i: number) => ({
        key: o?.key || String.fromCharCode(65 + i),
        content: String(o?.content || '').trim(),
      }))
    : []
  return out
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>
}

/** 可选的 per-request 模型选项 — 让教师能在 UI 里临时切换 provider/model */
export interface PerRequestLlmConfig {
  /** "provider:modelId" 例 "google:gemini-2.5-flash" / "qwen:qwen-turbo" */
  model?: string
  apiKey?: string
  baseUrl?: string
}

export interface ChatRequest extends PerRequestLlmConfig {
  message: string
  courseContext?: string
  slideIndex?: number
  history?: ChatMessage[]
  imageBase64?: string
  /** 上游传入的 AbortSignal（如 SSE 客户端断开 → 中断 LLM 调用）。仅服务端内部使用，前端无需关心。 */
  signal?: AbortSignal
}

export interface ChatResponse {
  content: string
  sources?: string[]
}

export interface QuizGenRequest extends PerRequestLlmConfig {
  topic: string
  count?: number
  types?: string[]
  difficulty?: string
  courseContext?: string
}

export interface GradeRequest extends PerRequestLlmConfig {
  question: string
  studentAnswer: string
  referenceAnswer?: string
  /** 评分细则（rubric），出题时由教师/AI 写好，批改时作为强约束 */
  commentPrompt?: string
  /** 题目满分（默认 100），返回的 score 会按该上限 clamp */
  maxScore?: number
  courseContext?: string
}

export interface InteractiveGenRequest extends PerRequestLlmConfig {
  topic: string
  courseContext?: string
  extraHint?: string
}

export interface InteractiveGenResult {
  title: string
  description: string
  html: string
  sanitizeStats?: ReturnType<typeof sanitizeInteractiveHtml>['stats']
  error?: string
}

export type WhiteboardItem =
  | { type: 'heading'; level?: number; text: string }
  | { type: 'text'; text: string }
  | { type: 'latex'; tex: string; display?: boolean }
  | { type: 'list'; ordered?: boolean; items: string[] }
  | { type: 'table'; headers: string[]; rows: string[][] }
  | { type: 'callout'; kind?: 'tip' | 'warning' | 'info' | 'note'; text: string }
  | { type: 'image'; svg: string }

export interface WhiteboardGenRequest extends PerRequestLlmConfig {
  topic: string
  courseContext?: string
  extraHint?: string
}

export interface WhiteboardGenResult {
  title: string
  subtitle?: string
  items: WhiteboardItem[]
  error?: string
}

@Injectable()
export class AiService {
  private readonly logger = new Logger('AiService')
  private readonly provider: string
  private readonly apiKey: string
  private readonly baseUrl: string
  private readonly model: string
  private readonly visionModel: string
  /** 编码专用默认模型（用于 generateInteractive HTML 沙盘） */
  private readonly coderModel: string
  /** 推理 / 强结构化默认模型（用于 generateWhiteboard 含 LaTeX 公式） */
  private readonly reasoningModel: string

  constructor(
    private config: ConfigService,
    private llm: LlmService,
  ) {
    this.provider = this.config.get('AI_PROVIDER', 'mock')
    this.apiKey = this.config.get('AI_API_KEY', '')
    this.baseUrl = this.config.get('AI_BASE_URL', 'https://dashscope.aliyuncs.com/compatible-mode/v1')
    this.model = this.config.get('AI_MODEL', 'qwen3.5-plus')
    this.visionModel = this.config.get('AI_VISION_MODEL', 'qwen3-vl-plus-latest')
    // 场景化默认模型（caller 未显式指定时使用）
    this.coderModel = this.config.get('AI_CODER_MODEL', 'qwen3-coder-plus')
    this.reasoningModel = this.config.get('AI_REASONING_MODEL', 'qwen3.7-max')
    this.logger.log(`AI provider: ${this.provider}, model: ${this.model}`)
  }

  /** Whether this request should use the real LLM (has either request-level key OR env-level key, and not in mock mode). */
  private shouldUseRealLlm(req: PerRequestLlmConfig): boolean {
    if (this.provider === 'mock') return !!req.apiKey  // mock 模式下，前端显式带 key 才走真 LLM
    return !!(req.apiKey || this.apiKey)
  }

  /** Convert our (legacy) ChatMessage to llm/types ChatMessage (only string content needs no change). */
  private toLlmMessages(messages: ChatMessage[]): LlmChatMessage[] {
    return messages.map((m): LlmChatMessage => {
      if (typeof m.content === 'string') return { role: m.role, content: m.content }
      const parts = m.content.map(p => {
        if (p.type === 'text') return { type: 'text' as const, text: p.text || '' }
        const url = p.image_url?.url
        return { type: 'image' as const, image: url || '' }
      })
      return { role: m.role, content: parts }
    })
  }

  async chat(req: ChatRequest): Promise<ChatResponse> {
    if (!this.shouldUseRealLlm(req)) {
      return this.mockChat(req)
    }

    try {
      const { system: systemPrompt } = buildPrompt('chat', {
        courseContext: req.courseContext || '通识课程',
        slideIndex: req.slideIndex || 1,
        hasImage: !!req.imageBase64,
      })

      const messages: ChatMessage[] = [
        { role: 'system', content: systemPrompt },
        ...(req.history || []).slice(-8),
      ]

      if (req.imageBase64) {
        messages.push({
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: req.imageBase64 } },
            { type: 'text', text: req.message || '请分析这张图片的内容' },
          ],
        })
      } else {
        messages.push({ role: 'user', content: req.message })
      }

      // Vision 自动切换：若有 image，且 caller 没显式指定 model，使用 env 的 visionModel
      const effectiveModel = req.model
        ? req.model
        : req.imageBase64
          ? this.visionModel
          : undefined  // undefined → LlmService 用 env default

      const content = await this.llm.chat(
        this.toLlmMessages(messages),
        {
          model: effectiveModel,
          apiKey: req.apiKey,
          baseUrl: req.baseUrl,
        },
        { temperature: 0.7, maxTokens: 1500, signal: AbortSignal.timeout(45_000) },
      )
      return {
        content: content || '抱歉，暂时无法回答。',
        sources: ['AI大模型'],
      }
    } catch (err) {
      this.logger.error(`AI API exception: ${err}`)
      return this.mockChat(req)
    }
  }

  async *chatStream(req: ChatRequest): AsyncGenerator<string> {
    if (!this.shouldUseRealLlm(req)) {
      const resp = this.mockChat(req)
      for (const char of resp.content) {
        yield char
        await new Promise(r => setTimeout(r, 20))
      }
      return
    }

    try {
      const { system: systemPrompt } = buildPrompt('chat-stream', {
        courseContext: req.courseContext || '通识课程',
        slideIndex: req.slideIndex || 1,
      })

      const messages: ChatMessage[] = [
        { role: 'system', content: systemPrompt },
        ...(req.history || []).slice(-8),
        { role: 'user', content: req.message },
      ]

      const signal = req.signal
        ? AbortSignal.any([req.signal, AbortSignal.timeout(60_000)])
        : AbortSignal.timeout(60_000)
      for await (const chunk of this.llm.chatStream(
        this.toLlmMessages(messages),
        { model: req.model, apiKey: req.apiKey, baseUrl: req.baseUrl },
        { temperature: 0.7, maxTokens: 1500, signal },
      )) {
        yield chunk
      }
    } catch (err) {
      this.logger.error(`Stream error: ${err}`)
      yield '抱歉，AI助手暂时无法回复。'
    }
  }

  async generateQuiz(req: QuizGenRequest): Promise<any> {
    if (!this.shouldUseRealLlm(req)) {
      return this.mockQuizGen(req)
    }

    const { user: prompt = '' } = buildPrompt('quiz-gen', {
      count: req.count || 5,
      topic: req.topic,
      courseContext: req.courseContext || '',
      difficulty: req.difficulty || '中等',
      typesText: (req.types || ['single_choice', 'true_false']).join('、'),
    })

    try {
      const text = await this.llm.chat(
        [{ role: 'user', content: prompt }],
        { model: req.model, apiKey: req.apiKey, baseUrl: req.baseUrl },
        { temperature: 0.7, maxTokens: 4000, signal: AbortSignal.timeout(60_000) },
      )
      const parsed = safeParseJSON<{ questions: any[] }>(text)
      if (parsed && Array.isArray(parsed.questions) && parsed.questions.length > 0) {
        parsed.questions = parsed.questions.map((q: any) => normalizeQuizQuestion(q))
        return parsed
      }
      return this.mockQuizGen(req)
    } catch (err: any) {
      this.logger.error(`Quiz gen error: ${err?.message || err}`)
      return this.mockQuizGen(req)
    }
  }

  /**
   * 生成"AI 实践"HTML 交互场景（学生平板 iframe 中运行）。
   *
   * 流程：buildPrompt('interactive-gen') → LLM → safeParseJSON → sanitizeInteractiveHtml → 返回
   *
   * 失败兜底：返回一个静态占位 HTML（避免学生端白屏）
   */
  async generateInteractive(req: InteractiveGenRequest): Promise<InteractiveGenResult> {
    if (!this.shouldUseRealLlm(req)) {
      return this.mockInteractive(req)
    }

    const { system, user } = buildPrompt('interactive-gen', {
      topic: req.topic,
      courseContext: req.courseContext || '通识课程',
      extraHint: req.extraHint || '',
    })

    try {
      // HTML 沙盘 = 编码任务，caller 没指定 model 时默认走 coder 专用模型
      const effectiveModel = req.model || this.coderModel
      const text = await this.llm.chat(
        [
          { role: 'system', content: system },
          { role: 'user', content: user || '' },
        ],
        { model: effectiveModel, apiKey: req.apiKey, baseUrl: req.baseUrl },
        { temperature: 0.6, maxTokens: 6000, signal: AbortSignal.timeout(120_000) },
      )
      const parsed = safeParseJSON<{ title?: string; description?: string; html?: string }>(text)
      if (!parsed?.html) {
        this.logger.warn('Interactive gen: LLM returned no html field')
        return this.mockInteractive(req, 'AI 未返回 html 字段，已使用占位场景')
      }
      const { html, stats } = sanitizeInteractiveHtml(parsed.html)
      return {
        title: parsed.title || req.topic,
        description: parsed.description || `关于「${req.topic}」的交互探索`,
        html,
        sanitizeStats: stats,
      }
    } catch (err: any) {
      this.logger.error(`Interactive gen error: ${err?.message || err}`)
      return this.mockInteractive(req, `AI 生成失败：${err?.message || err}`)
    }
  }

  /** 占位 HTML：纯静态展示，让学生端不至于白屏 */
  private mockInteractive(req: InteractiveGenRequest, error?: string): InteractiveGenResult {
    const topic = req.topic || '本节知识点'
    const safeTopic = topic.replace(/[<>"'&]/g, '_')
    const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${safeTopic} · 占位实践</title>
<style>
  body { margin: 0; font-family: -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif;
    background: linear-gradient(135deg, #f0f5ff 0%, #f9f0ff 100%); min-height: 100vh;
    display: flex; align-items: center; justify-content: center; padding: 24px; }
  .card { max-width: 480px; padding: 32px 28px; background: #fff; border-radius: 20px;
    box-shadow: 0 12px 32px rgba(0,0,0,0.06); text-align: center; }
  h1 { font-size: 22px; color: #1677ff; margin: 0 0 12px; }
  p { font-size: 14px; color: #595959; line-height: 1.7; margin: 12px 0; }
  .badge { display: inline-block; padding: 4px 12px; background: #f9f0ff; color: #722ed1;
    border-radius: 12px; font-size: 12px; font-weight: 600; }
  .hint { color: #8c8c8c; font-size: 12px; margin-top: 20px; }
</style>
</head>
<body>
  <div class="card">
    <span class="badge">AI 实践 · 占位场景</span>
    <h1>关于「${safeTopic}」</h1>
    <p>当前没有真实的 LLM 接入，AI 实践场景以静态卡片占位。配置好 AI 设置后即可自动生成可交互的可视化场景。</p>
    ${error ? `<p style="color:#cf1322;font-size:12px;background:#fff1f0;padding:8px;border-radius:8px;">${error.replace(/[<>"'&]/g, '_')}</p>` : ''}
    <p class="hint">提示：进入教师端 → 顶部「AI」按钮 → 配置模型与 API Key</p>
  </div>
</body>
</html>`
    return {
      title: `${topic}（占位）`,
      description: `占位场景：尚未接入真实 AI`,
      html,
      error,
    }
  }

  /**
   * 生成"AI 板书"结构化内容（教师大屏展示）。
   * 客户端拿到 items[] 后逐项渲染：heading / text / latex / list / table / callout / image
   */
  async generateWhiteboard(req: WhiteboardGenRequest): Promise<WhiteboardGenResult> {
    if (!this.shouldUseRealLlm(req)) {
      return this.mockWhiteboard(req)
    }

    const { system, user } = buildPrompt('whiteboard-gen', {
      topic: req.topic,
      courseContext: req.courseContext || '通识课程',
      extraHint: req.extraHint || '',
    })

    try {
      // 板书 = 含 LaTeX 公式 + 结构化 items 输出，caller 没指定 model 时默认走推理强的旗舰
      const effectiveModel = req.model || this.reasoningModel
      const text = await this.llm.chat(
        [
          { role: 'system', content: system },
          { role: 'user', content: user || '' },
        ],
        { model: effectiveModel, apiKey: req.apiKey, baseUrl: req.baseUrl },
        { temperature: 0.5, maxTokens: 4000, signal: AbortSignal.timeout(90_000) },
      )
      const parsed = safeParseJSON<WhiteboardGenResult>(text)
      if (!parsed || !Array.isArray(parsed.items) || parsed.items.length === 0) {
        this.logger.warn('Whiteboard gen: LLM returned no usable items')
        return this.mockWhiteboard(req, 'AI 未返回有效 items，已使用占位板书')
      }
      // 简单的 SVG 安全清洗：移除 <script>、外网 src
      parsed.items = parsed.items.map(it => {
        if (it.type === 'image' && typeof it.svg === 'string') {
          let svg = it.svg
          svg = svg.replace(/<script\b[\s\S]*?<\/script>/gi, '')
          svg = svg.replace(/\s(on\w+)\s*=\s*("[^"]*"|'[^']*'|[^\s>]*)/gi, '')
          svg = svg.replace(/\s(href|xlink:href|src)\s*=\s*"(https?:|\/\/)[^"]*"/gi, '')
          return { ...it, svg }
        }
        return it
      })
      return {
        title: String(parsed.title || req.topic),
        subtitle: parsed.subtitle ? String(parsed.subtitle) : undefined,
        items: parsed.items.slice(0, 15),
      }
    } catch (err: any) {
      this.logger.error(`Whiteboard gen error: ${err?.message || err}`)
      return this.mockWhiteboard(req, `AI 生成失败：${err?.message || err}`)
    }
  }

  private mockWhiteboard(req: WhiteboardGenRequest, error?: string): WhiteboardGenResult {
    const topic = req.topic || '本节知识点'
    return {
      title: `${topic}（占位）`,
      subtitle: 'AI 板书 · Demo',
      items: [
        { type: 'heading', level: 1, text: topic },
        { type: 'text', text: '当前没有真实的 LLM 接入，AI 板书以占位内容展示。配置好 AI 设置后即可生成专业板书。' },
        { type: 'latex', tex: 'E = mc^2', display: true },
        { type: 'callout', kind: 'info', text: '提示：进入教师端 → 顶部「AI」按钮 → 配置模型与 API Key' },
      ],
      error,
    }
  }

  async gradeAnswer(req: GradeRequest): Promise<{ score: number; comment: string }> {
    if (!this.shouldUseRealLlm(req)) {
      return { score: 80, comment: 'AI批改功能需要配置API Key' }
    }

    const maxScore = req.maxScore && req.maxScore > 0 ? Math.round(req.maxScore) : 100
    const { user: prompt = '' } = buildPrompt('grade', {
      question: req.question,
      studentAnswer: req.studentAnswer,
      referenceAnswer: req.referenceAnswer || '',
      commentPrompt: req.commentPrompt || '',
      maxScore,
      hasReference: !!req.referenceAnswer,
      hasRubric: !!req.commentPrompt,
    })

    try {
      const text = await this.llm.chat(
        [{ role: 'user', content: prompt }],
        { model: req.model, apiKey: req.apiKey, baseUrl: req.baseUrl },
        { temperature: 0.3, maxTokens: 500, signal: AbortSignal.timeout(30_000) },
      )
      const result = safeParseJSON<{ score: any; comment: string }>(text)
      if (result) {
        const rawScore = Number(result.score)
        const score = Number.isFinite(rawScore)
          ? Math.max(0, Math.min(maxScore, Math.round(rawScore)))
          : Math.round(maxScore * 0.7)
        return { score, comment: String(result.comment || '').slice(0, 300) }
      }
      return { score: Math.round(maxScore * 0.75), comment: '回答基本正确，部分细节需要完善。' }
    } catch (err: any) {
      this.logger.warn(`Grade error: ${err?.message || err}`)
      return { score: 70, comment: '批改服务暂时不可用，已给基础分。' }
    }
  }

  /** @deprecated 已迁移到顶层 `safeParseJSON`，本方法仅做透传以保持向后兼容 */
  private parseJsonFromText<T = any>(text: string): T | null {
    return safeParseJSON<T>(text)
  }

  private mockChat(req: ChatRequest): ChatResponse {
    return {
      content: `关于"${req.message}"，这是一个很好的问题。建议结合课件内容深入理解，如有疑问可以向老师提问。`,
      sources: ['本地知识库'],
    }
  }

  private mockQuizGen(req: QuizGenRequest) {
    const count = Math.max(1, req.count || 3)
    const types = req.types && req.types.length > 0 ? req.types : ['single_choice', 'true_false']
    const questions = Array.from({ length: count }).map((_, i) => {
      const t = types[i % types.length]
      if (t === 'true_false') {
        return normalizeQuizQuestion({
          type: 'true_false',
          content: `关于「${req.topic}」的判断题 ${i + 1}：该主题是工业实践中的重要内容（对/错）。`,
          answer: 'A',
          analysis: '占位题目（mock 模式）',
        })
      }
      if (t === 'short_answer') {
        return normalizeQuizQuestion({
          type: 'short_answer',
          content: `请简述「${req.topic}」的核心要点（第 ${i + 1} 题）。`,
          answer: `${req.topic}的核心要点包括基本概念、应用场景与典型流程。`,
          analysis: '占位题目（mock 模式）',
        })
      }
      return normalizeQuizQuestion({
        type: 'single_choice',
        content: `关于「${req.topic}」的基本概念，以下哪个说法是正确的？（第 ${i + 1} 题）`,
        options: [
          { key: 'A', content: '选项A（占位）' },
          { key: 'B', content: '选项B（占位）' },
          { key: 'C', content: '选项C（占位）' },
          { key: 'D', content: '选项D（占位）' },
        ],
        answer: 'A',
        analysis: '占位题目（mock 模式）',
      })
    })
    return { questions }
  }
}
