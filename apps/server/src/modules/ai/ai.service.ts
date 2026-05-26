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

/** AI 演示课件页数 clamp 到 [4, 8]，默认 6 */
function clampSlideCount(n: unknown): number {
  const v = Number(n)
  if (!Number.isFinite(v)) return 6
  return Math.max(4, Math.min(8, Math.round(v)))
}

/** 规范化 AI 返回的 slide 对象，缺字段/类型异常时返回 null */
const VALID_SLIDE_ACCENTS = new Set([
  '#2f6bff', '#20a546', '#f5a623', '#eb2f96', '#7c4dff', '#0f8b8d', '#e23d3d',
])
function pickAccent(raw: unknown, fallback: string): string {
  if (typeof raw !== 'string') return fallback
  const s = raw.trim().toLowerCase()
  if (/^#[0-9a-f]{6}$/.test(s)) return s
  return fallback
}
function normalizeSlideSpec(raw: any): CoursewareSlideSpec | null {
  if (!raw || typeof raw !== 'object') return null
  const title = String(raw.title || '').trim()
  if (!title) return null
  const kicker = String(raw.kicker || '本节').trim().slice(0, 12)
  const subtitle = raw.subtitle ? String(raw.subtitle).trim().slice(0, 60) : undefined
  const accent = pickAccent(raw.accent, '#2f6bff')
  const rawBlocks = Array.isArray(raw.blocks) ? raw.blocks : []
  const blocks = rawBlocks
    .map((b: any) => {
      if (!b || typeof b !== 'object') return null
      const bTitle = String(b.title || '').trim()
      const bBody = String(b.body || '').trim()
      if (!bTitle || !bBody) return null
      return {
        title: bTitle.slice(0, 20),
        body: bBody.slice(0, 120),
        accent: pickAccent(b.accent, accent),
      }
    })
    .filter((b: any): b is { title: string; body: string; accent: string } => !!b)
    .slice(0, 4)
  if (blocks.length === 0) return null
  return {
    kicker,
    title: title.slice(0, 22),
    subtitle,
    accent,
    blocks,
  }
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

/**
 * 当 LLM 漏填 knowledgePoints 时，按 topic 拆词兜底。
 * - 优先用 `topic` / `content` 中的中文段（按常见分隔符拆）
 * - 截断为 2-12 字的短词，最多 3 个
 * - 完全没素材则返回 `['通用知识点']`，至少让聚合报告能跑通
 */
function fallbackKnowledgePoints(topic: string | undefined, _content: string | undefined): string[] {
  const seeds = [topic].filter((s): s is string => !!s && typeof s === 'string')
  if (seeds.length === 0) return ['通用知识点']
  const candidates = new Set<string>()
  for (const seed of seeds) {
    seed
      .replace(/\s+/g, ' ')
      .split(/[，。、；;,.\/\\|()（）【】\[\]\s\-—_]+/)
      .map(s => s.trim())
      .filter(s => s.length >= 2 && s.length <= 12)
      .filter(s => /[\u4e00-\u9fa5]/.test(s)) // 至少含 1 个中文字
      .forEach(s => candidates.add(s))
    if (candidates.size >= 3) break
  }
  const list = Array.from(candidates).slice(0, 3)
  return list.length > 0 ? list : ['通用知识点']
}

export function normalizeQuizQuestion(q: any, topicHint?: string): any {
  const type = (q?.type || 'single_choice') as string
  const points = normalizePoints(q)
  const difficulty = ['easy', 'medium', 'hard'].includes(String(q?.difficulty)) ? q.difficulty : undefined
  const kpRaw = q?.knowledgePoints
  let knowledgePoints = Array.isArray(kpRaw)
    ? kpRaw.map((k: any) => String(k || '').trim()).filter(Boolean).slice(0, 5)
    : []
  if (knowledgePoints.length === 0) {
    knowledgePoints = fallbackKnowledgePoints(topicHint, q?.content)
  }
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

export interface CoursewareGenRequest extends PerRequestLlmConfig {
  courseContext: string
  lessonTitle: string
  /** 想生成几页（默认 6，clamp 到 4-8） */
  slideCount?: number
  /** 教师额外说明（例如希望偏重哪部分） */
  extraHint?: string
}

export interface CoursewareSlideSpec {
  kicker: string
  title: string
  subtitle?: string
  accent: string
  blocks: Array<{
    title: string
    body: string
    accent: string
  }>
}

export interface CoursewareGenResult {
  slides: CoursewareSlideSpec[]
  error?: string
}

export interface LessonReportInput extends PerRequestLlmConfig {
  courseName: string
  lessonTitle: string
  roomCode: string
  startedAt: string
  durationMinutes: number
  totalStudents: number
  onlineCount: number
  attendanceCount: number
  attendanceList: string
  unsignedList: string
  handRaiseCount: number
  aiChatCount: number
  questionsList: string
  competeRounds: number
  competeList: string
  quizCount: number
  quizSummary: string
  knowledgeMastery: string
  topErrorQuestions: string
  discussionCount: number
  discussionList: string
  whiteboardCount: number
  whiteboardTopics: string
  practiceCount: number
  practiceTopics: string
  coursewareCount: number
  slideTotalPages: number
  slideCurrentPage: number
  lockCount: number
  focusLostCount: number
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

  /**
   * 所有 AI 调用统一的输出 token 上限。
   *
   * 设计意图：
   * - 教师 / 学生 AI 对话希望"想答多长答多长"——长篇 markdown / 代码 / 表格不被截
   * - 大批量出题（5/10/20）一次出齐，不要中途被截
   * - 模型端会按其自身硬上限自动 clamp（Qwen3.5/3.7-Max 可到 32k，OpenAI gpt-4o 16k，Claude 8k）
   *   传 50000 不会报错，只会让模型尽情输出到它能给的最大
   */
  private static readonly MAX_OUTPUT_TOKENS = 50000

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
        { temperature: 0.7, maxTokens: AiService.MAX_OUTPUT_TOKENS, signal: AbortSignal.timeout(180_000) },
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
        ? AbortSignal.any([req.signal, AbortSignal.timeout(180_000)])
        : AbortSignal.timeout(180_000)
      for await (const chunk of this.llm.chatStream(
        this.toLlmMessages(messages),
        { model: req.model, apiKey: req.apiKey, baseUrl: req.baseUrl },
        { temperature: 0.7, maxTokens: AiService.MAX_OUTPUT_TOKENS, signal },
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

    const targetCount = Math.max(1, Math.min(20, req.count || 5))

    const { user: prompt = '' } = buildPrompt('quiz-gen', {
      count: targetCount,
      topic: req.topic,
      courseContext: req.courseContext || '',
      difficulty: req.difficulty || '中等',
      typesText: (req.types || ['single_choice', 'true_false']).join('、'),
    })

    try {
      const text = await this.llm.chat(
        [{ role: 'user', content: prompt }],
        { model: req.model, apiKey: req.apiKey, baseUrl: req.baseUrl },
        { temperature: 0.7, maxTokens: AiService.MAX_OUTPUT_TOKENS, signal: AbortSignal.timeout(180_000) },
      )
      const parsed = safeParseJSON<{ questions: any[] }>(text)

      if (parsed && Array.isArray(parsed.questions) && parsed.questions.length > 0) {
        // 过滤掉缺关键字段的占位题（content 空 / 选择题无 options 等）
        const valid = parsed.questions.filter((q: any) => {
          if (!q || typeof q !== 'object') return false
          const content = String(q.content || '').trim()
          if (!content) return false
          const type = q.type || 'single_choice'
          if (type === 'single_choice' || type === 'multiple_choice') {
            if (!Array.isArray(q.options) || q.options.length < 2) return false
          }
          return true
        })

        if (valid.length === 0) {
          this.logger.warn(`Quiz gen: all ${parsed.questions.length} questions filtered as invalid, fallback to mock`)
          return this.mockQuizGen(req)
        }

        // 数量校验：少于目标的 60% → 警告 + 尝试补齐（最多 1 次）
        if (valid.length < Math.ceil(targetCount * 0.6) && valid.length < targetCount) {
          this.logger.warn(
            `Quiz gen: got ${valid.length}/${targetCount} questions (text len=${text.length}). Retrying for the missing ${targetCount - valid.length}…`,
          )
          try {
            const missing = targetCount - valid.length
            const { user: retryPrompt = '' } = buildPrompt('quiz-gen', {
              count: missing,
              topic: req.topic,
              courseContext: req.courseContext || '',
              difficulty: req.difficulty || '中等',
              typesText: (req.types || ['single_choice', 'true_false']).join('、'),
            })
            const retryText = await this.llm.chat(
              [{ role: 'user', content: retryPrompt }],
              { model: req.model, apiKey: req.apiKey, baseUrl: req.baseUrl },
              { temperature: 0.7, maxTokens: AiService.MAX_OUTPUT_TOKENS, signal: AbortSignal.timeout(120_000) },
            )
            const retryParsed = safeParseJSON<{ questions: any[] }>(retryText)
            if (retryParsed?.questions?.length) {
              for (const q of retryParsed.questions) {
                if (valid.length >= targetCount) break
                if (q && typeof q === 'object' && String(q.content || '').trim()) {
                  valid.push(q)
                }
              }
            }
          } catch (retryErr: any) {
            this.logger.warn(`Quiz gen retry failed: ${retryErr?.message || retryErr}`)
          }
        }

        // 多了就裁剪
        const final = valid.slice(0, targetCount)
        this.logger.log(`Quiz gen: returning ${final.length}/${targetCount} questions`)

        return { questions: final.map((q: any) => normalizeQuizQuestion(q, req.topic)) }
      }

      this.logger.warn(`Quiz gen: parse failed or empty (raw len=${text?.length || 0}), fallback to mock`)
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
        { temperature: 0.6, maxTokens: AiService.MAX_OUTPUT_TOKENS, signal: AbortSignal.timeout(180_000) },
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

  /**
   * generateInteractive 的流式版本：边调 LLM 边 yield 文本增量，让 caller 能实时把
   * 进度（已收到多少字符）回传给前端，避免 30s+ 的"看起来卡住了"体验。
   *
   * yield 顺序：
   *   - 0..N 个 { type: 'delta', text, totalChars } —— LLM 返回的原始增量（含 JSON 包裹）
   *   - 最后 1 个     { type: 'done', result } —— 解析、清洗后的最终 InteractiveGenResult
   *
   * 错误或 mock 路径：直接 yield 单个 done 事件，没有 delta。
   */
  async *generateInteractiveStream(req: InteractiveGenRequest): AsyncGenerator<
    | { type: 'delta'; text: string; totalChars: number }
    | { type: 'done'; result: InteractiveGenResult }
  > {
    if (!this.shouldUseRealLlm(req)) {
      yield { type: 'done', result: this.mockInteractive(req) }
      return
    }

    const { system, user } = buildPrompt('interactive-gen', {
      topic: req.topic,
      courseContext: req.courseContext || '通识课程',
      extraHint: req.extraHint || '',
    })

    let fullText = ''
    try {
      const effectiveModel = req.model || this.coderModel
      for await (const chunk of this.llm.chatStream(
        [
          { role: 'system', content: system },
          { role: 'user', content: user || '' },
        ],
        { model: effectiveModel, apiKey: req.apiKey, baseUrl: req.baseUrl },
        { temperature: 0.6, maxTokens: AiService.MAX_OUTPUT_TOKENS, signal: AbortSignal.timeout(180_000) },
      )) {
        if (!chunk) continue
        fullText += chunk
        yield { type: 'delta', text: chunk, totalChars: fullText.length }
      }
      const parsed = safeParseJSON<{ title?: string; description?: string; html?: string }>(fullText)
      if (!parsed?.html) {
        this.logger.warn('Interactive gen stream: LLM returned no html field')
        yield { type: 'done', result: this.mockInteractive(req, 'AI 未返回 html 字段，已使用占位场景') }
        return
      }
      const { html, stats } = sanitizeInteractiveHtml(parsed.html)
      yield {
        type: 'done',
        result: {
          title: parsed.title || req.topic,
          description: parsed.description || `关于「${req.topic}」的交互探索`,
          html,
          sanitizeStats: stats,
        },
      }
    } catch (err: any) {
      this.logger.error(`Interactive gen stream error: ${err?.message || err}`)
      yield { type: 'done', result: this.mockInteractive(req, `AI 生成失败：${err?.message || err}`) }
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
        { temperature: 0.5, maxTokens: AiService.MAX_OUTPUT_TOKENS, signal: AbortSignal.timeout(180_000) },
      )
      const parsed = safeParseJSON<WhiteboardGenResult>(text)
      if (!parsed || !Array.isArray(parsed.items) || parsed.items.length === 0) {
        this.logger.warn('Whiteboard gen: LLM returned no usable items')
        return this.mockWhiteboard(req, 'AI 未返回有效 items，已使用占位板书')
      }
      // SVG 安全清洗（升级版）：
      //   - 移除 <script>/<foreignObject>（后者能塞任意 HTML，含 iframe/script）
      //   - 移除所有 on* inline 事件属性
      //   - 移除 href/xlink:href/src 中的 http(s):/javascript:/data:（仅保留相对/锚点链接）
      //   - 移除 <use href="javascript:..."> 等 use 注入
      //   - 移除 <style> 内的 @import url(...)（避免外网 CSS 注入）
      // 注意：当前仅做正则清洗，不替代 DOMPurify；客户端 v-html 时仍应自行二次校验。
      parsed.items = parsed.items.map(it => {
        if (it.type === 'image' && typeof it.svg === 'string') {
          let svg = it.svg
          svg = svg.replace(/<script\b[\s\S]*?<\/script>/gi, '')
          svg = svg.replace(/<foreignObject\b[\s\S]*?<\/foreignObject>/gi, '')
          svg = svg.replace(/<foreignObject\b[^>]*\/?>/gi, '')
          svg = svg.replace(/\s(on\w+)\s*=\s*("[^"]*"|'[^']*'|[^\s>]*)/gi, '')
          svg = svg.replace(
            /\s(href|xlink:href|src)\s*=\s*"\s*(https?:|\/\/|javascript:|data:)[^"]*"/gi,
            '',
          )
          svg = svg.replace(
            /\s(href|xlink:href|src)\s*=\s*'\s*(https?:|\/\/|javascript:|data:)[^']*'/gi,
            '',
          )
          svg = svg.replace(/@import\s+url\([^)]*\)/gi, '')
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

  /**
   * generateWhiteboard 的流式版本。语义同 generateInteractiveStream：
   *   - 边收边 yield { type:'delta', text, totalChars }
   *   - 末尾 yield { type:'done', result } 给最终 sanitize 完的 items[]
   *
   * 比 interactive 更适合做"边写边看"，因为 items 数组可以用 partial-json 增量解析；
   * 不过为了和 interactive 保持接口一致，这里只 yield 字符增量，items 增量解析交给上层（gateway / 前端）做。
   */
  async *generateWhiteboardStream(req: WhiteboardGenRequest): AsyncGenerator<
    | { type: 'delta'; text: string; totalChars: number }
    | { type: 'done'; result: WhiteboardGenResult }
  > {
    if (!this.shouldUseRealLlm(req)) {
      yield { type: 'done', result: this.mockWhiteboard(req) }
      return
    }

    const { system, user } = buildPrompt('whiteboard-gen', {
      topic: req.topic,
      courseContext: req.courseContext || '通识课程',
      extraHint: req.extraHint || '',
    })

    let fullText = ''
    try {
      const effectiveModel = req.model || this.reasoningModel
      for await (const chunk of this.llm.chatStream(
        [
          { role: 'system', content: system },
          { role: 'user', content: user || '' },
        ],
        { model: effectiveModel, apiKey: req.apiKey, baseUrl: req.baseUrl },
        { temperature: 0.5, maxTokens: AiService.MAX_OUTPUT_TOKENS, signal: AbortSignal.timeout(180_000) },
      )) {
        if (!chunk) continue
        fullText += chunk
        yield { type: 'delta', text: chunk, totalChars: fullText.length }
      }
      const parsed = safeParseJSON<WhiteboardGenResult>(fullText)
      if (!parsed || !Array.isArray(parsed.items) || parsed.items.length === 0) {
        this.logger.warn('Whiteboard gen stream: LLM returned no usable items')
        yield { type: 'done', result: this.mockWhiteboard(req, 'AI 未返回有效 items，已使用占位板书') }
        return
      }
      // 沿用 generateWhiteboard 同款 SVG 安全清洗
      parsed.items = parsed.items.map(it => {
        if (it.type === 'image' && typeof it.svg === 'string') {
          let svg = it.svg
          svg = svg.replace(/<script\b[\s\S]*?<\/script>/gi, '')
          svg = svg.replace(/<foreignObject\b[\s\S]*?<\/foreignObject>/gi, '')
          svg = svg.replace(/<foreignObject\b[^>]*\/?>/gi, '')
          svg = svg.replace(/\s(on\w+)\s*=\s*("[^"]*"|'[^']*'|[^\s>]*)/gi, '')
          svg = svg.replace(
            /\s(href|xlink:href|src)\s*=\s*"\s*(https?:|\/\/|javascript:|data:)[^"]*"/gi,
            '',
          )
          svg = svg.replace(
            /\s(href|xlink:href|src)\s*=\s*'\s*(https?:|\/\/|javascript:|data:)[^']*'/gi,
            '',
          )
          svg = svg.replace(/@import\s+url\([^)]*\)/gi, '')
          return { ...it, svg }
        }
        return it
      })
      yield {
        type: 'done',
        result: {
          title: String(parsed.title || req.topic),
          subtitle: parsed.subtitle ? String(parsed.subtitle) : undefined,
          items: parsed.items.slice(0, 15),
        },
      }
    } catch (err: any) {
      this.logger.error(`Whiteboard gen stream error: ${err?.message || err}`)
      yield { type: 'done', result: this.mockWhiteboard(req, `AI 生成失败：${err?.message || err}`) }
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
        { type: 'list', ordered: true, items: ['理解核心定义', '掌握关键公式', '完成 3 道练习'] },
        { type: 'callout', kind: 'tip', text: '提示：进入教师端 → 顶部「AI」按钮 → 配置模型与 API Key' },
      ],
      error,
    }
  }

  /**
   * 生成"AI 演示课件"结构化大纲（教师大屏播放）。
   * 客户端拿到 slides[] 后用 SVG 模板逐页渲染成图片。
   */
  async generateCourseware(req: CoursewareGenRequest): Promise<CoursewareGenResult> {
    const slideCount = clampSlideCount(req.slideCount)
    if (!this.shouldUseRealLlm(req)) {
      return this.mockCourseware(req, slideCount)
    }

    const { system, user } = buildPrompt('courseware-gen', {
      courseContext: req.courseContext || '通识课程',
      lessonTitle: req.lessonTitle || '本节课',
      slideCount,
      extraHint: req.extraHint || '',
    })

    try {
      // 课件大纲 = 结构化文本生成，不需要 coder 模型；走默认 reasoning 比较稳
      const effectiveModel = req.model || this.reasoningModel
      const text = await this.llm.chat(
        [
          { role: 'system', content: system },
          { role: 'user', content: user || '' },
        ],
        { model: effectiveModel, apiKey: req.apiKey, baseUrl: req.baseUrl },
        { temperature: 0.65, maxTokens: AiService.MAX_OUTPUT_TOKENS, signal: AbortSignal.timeout(180_000) },
      )
      const parsed = safeParseJSON<{ slides?: any[] }>(text)
      const rawSlides = Array.isArray(parsed?.slides) ? parsed!.slides : []
      const cleaned = rawSlides
        .map(s => normalizeSlideSpec(s))
        .filter((s): s is CoursewareSlideSpec => !!s)

      if (cleaned.length === 0) {
        this.logger.warn('Courseware gen: LLM returned no usable slides')
        return this.mockCourseware(req, slideCount, 'AI 未返回有效 slides，已使用占位课件')
      }

      // 严格按 slideCount clamp（多了截、少了补 mock 的最后几页）
      let finalSlides: CoursewareSlideSpec[]
      if (cleaned.length >= slideCount) {
        finalSlides = cleaned.slice(0, slideCount)
      } else {
        const fallback = this.mockCourseware(req, slideCount).slides
        finalSlides = [...cleaned, ...fallback.slice(cleaned.length)]
      }
      return { slides: finalSlides }
    } catch (err: any) {
      this.logger.error(`Courseware gen error: ${err?.message || err}`)
      return this.mockCourseware(req, slideCount, `AI 生成失败：${err?.message || err}`)
    }
  }

  /** 占位课件：AI 不可用 / 失败时的兜底（保持端侧渲染管线不报错） */
  private mockCourseware(
    req: CoursewareGenRequest,
    slideCount: number,
    error?: string,
  ): CoursewareGenResult {
    const course = req.courseContext || '三元课堂'
    const lesson = req.lessonTitle || '课堂教学'
    const palette = ['#2f6bff', '#20a546', '#f5a623', '#eb2f96', '#7c4dff', '#0f8b8d', '#e23d3d']
    const templates: CoursewareSlideSpec[] = [
      {
        kicker: '课堂目标',
        title: lesson,
        subtitle: `${course} · 课堂导入`,
        accent: palette[0],
        blocks: [
          { title: '学习目标', body: `理解「${lesson}」核心概念并掌握关键操作`, accent: palette[0] },
          { title: '能学到什么', body: '通过演示、练习、测验完成本节闭环', accent: palette[1] },
          { title: '课堂节奏', body: '讲解 → 示范 → 练习 → 反馈，全员同步推进', accent: palette[2] },
          { title: '互动提醒', body: '遇问题可在学生端举手或提交提问', accent: palette[3] },
        ],
      },
      {
        kicker: '核心概念',
        title: `${lesson} · 关键知识点`,
        subtitle: '先讲是什么、再说为什么这么做',
        accent: palette[1],
        blocks: [
          { title: '基本定义', body: `${lesson}的核心定义与边界条件`, accent: palette[1] },
          { title: '应用场景', body: '哪些真实任务里会用到这个概念', accent: palette[0] },
          { title: '常见误区', body: '学生最容易混淆的相邻概念与判别方法', accent: palette[2] },
          { title: '迁移能力', body: '与已学知识的衔接点与延伸方向', accent: palette[4] },
        ],
      },
      {
        kicker: '教学流程',
        title: '教学活动安排',
        subtitle: '教师端控制节奏，大屏与学生端实时同步',
        accent: palette[2],
        blocks: [
          { title: '01 情境导入', body: '结合真实岗位任务，说明为什么要学', accent: palette[0] },
          { title: '02 教师示范', body: '展示关键步骤，强调容易出错的位置', accent: palette[1] },
          { title: '03 学生练习', body: '学生端接收任务，完成并提交反馈', accent: palette[2] },
          { title: '04 即时评价', body: '测验、举手、提问定位薄弱点', accent: palette[3] },
        ],
      },
      {
        kicker: '实训任务',
        title: '动手练习与评分',
        subtitle: '把练习结果留在学生端便于课后复盘',
        accent: palette[5],
        blocks: [
          { title: '任务说明', body: `围绕「${lesson}」完成 5-10 分钟练习`, accent: palette[0] },
          { title: '过程记录', body: '保留关键步骤截图、参数或操作说明', accent: palette[5] },
          { title: '自查标准', body: '正确 · 完整 · 表达清楚 · 能说明原因', accent: palette[1] },
          { title: '教师反馈', body: '基于提交情况推送测验、讲评或分组', accent: palette[3] },
        ],
      },
      {
        kicker: '案例分析',
        title: '典型场景拆解',
        subtitle: '从一个真实案例反推方法论',
        accent: palette[4],
        blocks: [
          { title: '问题描述', body: '案例中的关键现象和约束条件', accent: palette[0] },
          { title: '分析路径', body: '从已知信息推导出未知量的步骤', accent: palette[4] },
          { title: '结果验证', body: '怎么知道答案是对的或哪里要修正', accent: palette[1] },
          { title: '可推广点', body: '哪些规律可以套用到下次类似题', accent: palette[2] },
        ],
      },
      {
        kicker: '课堂收束',
        title: '随堂检测与总结',
        subtitle: '用数据判断是否进入下一环节',
        accent: palette[3],
        blocks: [
          { title: '随堂测验', body: '下发 3-5 道题检查核心概念是否掌握', accent: palette[2] },
          { title: '集中答疑', body: '优先处理学生提问和共性问题', accent: palette[0] },
          { title: '作业延伸', body: '按表现布置分层练习或课后任务', accent: palette[4] },
          { title: '下节预告', body: '说明下一节课要准备的材料', accent: palette[1] },
        ],
      },
      {
        kicker: '能力地图',
        title: '本节在课程体系中的位置',
        subtitle: '帮助学生建立全局视野',
        accent: palette[6],
        blocks: [
          { title: '前置知识', body: '完成本节需要哪些已学知识', accent: palette[0] },
          { title: '本节定位', body: '在课程大纲中的承上启下作用', accent: palette[6] },
          { title: '后续衔接', body: '掌握后能解锁哪些进阶课题', accent: palette[1] },
          { title: '能力标签', body: '本节达成的核心能力关键词', accent: palette[3] },
        ],
      },
      {
        kicker: '资源拓展',
        title: '推荐学习资源',
        subtitle: '把课堂内容延伸到课后',
        accent: palette[4],
        blocks: [
          { title: '推荐阅读', body: '相关教材章节、行业文章', accent: palette[0] },
          { title: '视频教程', body: '优质演示视频或纪录片', accent: palette[1] },
          { title: '动手实验', body: '可以在家或实训室复现的小实验', accent: palette[2] },
          { title: '行业资讯', body: '相关岗位的新趋势与典型企业', accent: palette[4] },
        ],
      },
    ]
    return { slides: templates.slice(0, slideCount), error }
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
        { temperature: 0.3, maxTokens: AiService.MAX_OUTPUT_TOKENS, signal: AbortSignal.timeout(90_000) },
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

  /**
   * 课堂分析报告 · 流式生成。
   *
   * Caller（classroom.gateway）从 RoomState 汇总好所有原始数据填入 `LessonReportInput`，
   * 本方法只负责调 LLM + 流式 yield markdown chunk。
   *
   * 若服务端未配 AI key，走 mock fallback，返回一段静态文字。
   */
  async *generateLessonReportStream(input: LessonReportInput): AsyncGenerator<string> {
    if (!this.shouldUseRealLlm(input)) {
      yield this.mockLessonReport(input)
      return
    }
    const { system, user } = buildPrompt('lesson-report', input as any)
    try {
      const effectiveModel = input.model || this.reasoningModel
      for await (const chunk of this.llm.chatStream(
        [
          { role: 'system', content: system },
          { role: 'user', content: user || '' },
        ],
        { model: effectiveModel, apiKey: input.apiKey, baseUrl: input.baseUrl },
        { temperature: 0.6, maxTokens: AiService.MAX_OUTPUT_TOKENS, signal: AbortSignal.timeout(180_000) },
      )) {
        yield chunk
      }
    } catch (err: any) {
      this.logger.error(`Lesson report gen error: ${err?.message || err}`)
      yield '\n\n> ⚠️ AI 生成中断：' + (err?.message || String(err))
    }
  }

  private mockLessonReport(input: LessonReportInput): string {
    return `## 一、课堂概况

本节《${input.courseName}》主题为「${input.lessonTitle}」，共 ${input.totalStudents} 名学生应到，签到 ${input.attendanceCount} 人。课堂时长 ${input.durationMinutes} 分钟，互动较为平稳。

## 二、参与度与课堂氛围

- **出勤情况**：签到 ${input.attendanceCount} / ${input.totalStudents}
- **互动密度**：举手 ${input.handRaiseCount} 次、提问 ${input.aiChatCount} 次、抢答 ${input.competeRounds} 次
- **课堂氛围**：未配 AI key，使用 mock 报告，请配置 AI_API_KEY 后获取真实分析

## 三、知识掌握度

${input.quizCount > 0 ? '已进行 ' + input.quizCount + ' 场测验，详见原始数据' : '本节未进行测验，建议下节课加入 3-5 道知识点测验题以量化掌握度。'}

## 四、测验与作业表现

${input.quizSummary || '本节未发起测验。'}

## 五、AI 互动与教学辅助使用

- AI 板书 ${input.whiteboardCount} 次
- AI 实践 ${input.practiceCount} 次
- AI 课件 ${input.coursewareCount} 次

## 六、教师改进建议

1. **【中】配置 AI API Key** · 当前 mock 模式无法生成深度分析，请在 \`apps/server/.env\` 配置 \`AI_API_KEY\`
2. **【中】下节课加入测验** · 推荐 5 道单选 + 1 道简答
3. **【低】增加抢答互动** · 调动课堂氛围`
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
        }, req.topic)
      }
      if (t === 'short_answer') {
        return normalizeQuizQuestion({
          type: 'short_answer',
          content: `请简述「${req.topic}」的核心要点（第 ${i + 1} 题）。`,
          answer: `${req.topic}的核心要点包括基本概念、应用场景与典型流程。`,
          analysis: '占位题目（mock 模式）',
        }, req.topic)
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
      }, req.topic)
    })
    return { questions }
  }
}
