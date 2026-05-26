import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { generateText, streamText, type LanguageModel, type ModelMessage } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { PROVIDERS, parseModelString, isProviderKeyRequired, getProviderConfig } from './providers'
import type { ChatMessage, ChatOptions, LlmCallConfig, ProviderId, ProviderType } from './types'

/**
 * 移除模型输出中的"思考过程"标签 `<think>...</think>`、`<thinking>...</thinking>`、`<reasoning>...</reasoning>`。
 *
 * 来源：
 *   - DeepSeek-R1 / QwQ：把 chain-of-thought 直接放在 `<think>...</think>` 块里返回
 *   - Qwen3 思考模式：同上
 *   - Claude 3.5 Sonnet extended thinking：`<thinking>...</thinking>`
 *
 * 即便我们已在请求里关闭思考开关，部分模型仍会输出，需要前置兜底过滤。
 *
 * 设计说明：
 *   - 只剥标签**及其包裹的内容**，不影响普通 markdown
 *   - 兼容未闭合的标签：丢弃从 `<think>` 起到字符串末尾的全部内容
 *   - 多个块都剥
 */
export function stripThinkingTags(text: string): string {
  if (!text) return text
  let out = text
  // 1) 成对闭合：<think>...</think> 或 <thinking>...</thinking> 或 <reasoning>...</reasoning>
  out = out.replace(/<think>[\s\S]*?<\/think>/gi, '')
  out = out.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
  out = out.replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '')
  // 2) 未闭合的：把从 <think>/<thinking>/<reasoning> 起到末尾的内容全部砍掉
  out = out.replace(/<think>[\s\S]*$/i, '')
  out = out.replace(/<thinking>[\s\S]*$/i, '')
  out = out.replace(/<reasoning>[\s\S]*$/i, '')
  // 3) 清理多余空白行（连续 3+ 换行 → 2 换行）
  out = out.replace(/\n{3,}/g, '\n\n')
  return out.trim()
}

/**
 * 统一 LLM 调用门面：将 16+ provider × 60+ 模型收敛到一个接口。
 *
 * 用法：
 *   await llm.chat([{ role: 'user', content: 'hi' }], { model: 'qwen:qwen-turbo', apiKey: '...' })
 *   for await (const chunk of llm.chatStream(msgs, { model: 'openai:gpt-4o', apiKey: '...' })) { ... }
 *
 * 默认行为（未传 model/apiKey 时）：fallback 到 .env 中的 AI_PROVIDER / AI_MODEL / AI_API_KEY，
 * 与现有 AiService 行为兼容；这样老代码不需要改 caller。
 */
@Injectable()
export class LlmService {
  private readonly logger = new Logger('LlmService')
  private readonly defaultProvider: ProviderId
  private readonly defaultModel: string
  private readonly defaultApiKey: string
  private readonly defaultBaseUrl: string

  constructor(private config: ConfigService) {
    this.defaultProvider = (this.config.get<string>('AI_PROVIDER', 'qwen') as ProviderId)
    this.defaultModel = this.config.get<string>('AI_MODEL', 'qwen3.5-plus')
    this.defaultApiKey = this.config.get<string>('AI_API_KEY', '')
    this.defaultBaseUrl = this.config.get<string>('AI_BASE_URL', '')
    this.logger.log(
      `LlmService default: ${this.defaultProvider}:${this.defaultModel} (key=${this.defaultApiKey ? '✓' : '✗'})`,
    )
  }

  /** 解析 LlmCallConfig，落地为 (providerId, modelId, apiKey, baseUrl) */
  private resolve(config: LlmCallConfig): {
    providerId: ProviderId
    modelId: string
    apiKey: string
    baseUrl: string
    providerType: ProviderType
  } {
    let providerId: ProviderId
    let modelId: string
    if (config.providerId && config.modelId) {
      providerId = config.providerId
      modelId = config.modelId
    } else if (config.model) {
      const parsed = parseModelString(config.model)
      providerId = parsed.providerId
      modelId = parsed.modelId
    } else {
      providerId = this.defaultProvider
      modelId = this.defaultModel
    }

    const provider = getProviderConfig(providerId)
    if (!provider) {
      throw new Error(`[LlmService] unknown provider: ${providerId}`)
    }

    const apiKey = config.apiKey ?? this.defaultApiKey
    if (provider.requiresApiKey && !apiKey) {
      throw new Error(`[LlmService] API key required for provider: ${providerId}`)
    }

    const baseUrl = config.baseUrl || this.defaultBaseUrl || provider.defaultBaseUrl
    const providerType = config.providerType ?? provider.type
    return { providerId, modelId, apiKey, baseUrl, providerType }
  }

  /**
   * 自定义 fetch：往 OpenAI-compatible 请求体里注入"关闭思考"参数。
   *
   * Qwen3+（百炼 DashScope）的非标准开关：`enable_thinking: false`
   *   - 若不显式传 false，部分 qwen3 模型默认 enable_thinking=true，会在响应里塞 reasoning_content / `<think>` 块
   *   - 兼容老 qwen2.5 模型：未识别字段会被服务端忽略，无副作用
   *
   * 也兼顾 OpenAI o-series（o1/o3）：从 modelId 嗅探，给 reasoning_effort=minimal
   *   - 但因为 reasoning_effort 已通过 providerOptions 传，这里不重复注入
   */
  private buildOpenAiFetch(): typeof fetch {
    return async (input: any, init?: any) => {
      if (init?.body && typeof init.body === 'string') {
        try {
          const body = JSON.parse(init.body)
          if (!('enable_thinking' in body)) {
            body.enable_thinking = false
          }
          init = { ...init, body: JSON.stringify(body) }
        } catch {
          /* body 不是 JSON，原样透传 */
        }
      }
      return fetch(input, init)
    }
  }

  /** Internal: build a Vercel AI SDK LanguageModel instance */
  private buildModel(resolved: ReturnType<LlmService['resolve']>): LanguageModel {
    const { providerType, modelId, apiKey, baseUrl } = resolved
    switch (providerType) {
      case 'openai': {
        const openai = createOpenAI({
          apiKey: apiKey || 'placeholder',
          baseURL: baseUrl,
          fetch: this.buildOpenAiFetch(),
        })
        return openai.chat(modelId)
      }
      case 'anthropic': {
        const anthropic = createAnthropic({ apiKey, baseURL: baseUrl })
        return anthropic(modelId)
      }
      case 'google': {
        const google = createGoogleGenerativeAI({ apiKey, baseURL: baseUrl })
        return google(modelId)
      }
      default:
        throw new Error(`[LlmService] unsupported provider type: ${providerType}`)
    }
  }

  /**
   * 按 provider 类型返回"关闭思考"的 providerOptions，附加在 generateText / streamText 调用上。
   *
   * - **google**: `thinkingConfig.thinkingBudget = 0` 关闭 Gemini 2.5+ Thinking 模式
   * - **openai** + 模型名以 "o" 开头（o1 / o3 / o4-mini ...）: `reasoningEffort: 'minimal'`
   *   非 reasoning 模型（gpt-4o 等）不传，避免被 API 拒绝
   * - **anthropic**: Claude extended thinking 默认就是关闭的，无需特别处理
   * - 其他 openai-compatible（qwen / deepseek / kimi / glm / doubao / minimax / ollama）：
   *   走 buildOpenAiFetch() 的 body 注入 `enable_thinking: false`，这里返回 undefined
   */
  private buildProviderOptions(resolved: ReturnType<LlmService['resolve']>): Record<string, any> | undefined {
    const { providerType, providerId, modelId } = resolved
    if (providerType === 'google') {
      return { google: { thinkingConfig: { thinkingBudget: 0 } } }
    }
    if (providerType === 'openai' && providerId === 'openai') {
      // 只对原生 OpenAI 的 o-series 推理模型加 reasoningEffort
      if (/^o\d/i.test(modelId)) {
        return { openai: { reasoningEffort: 'minimal' } }
      }
    }
    return undefined
  }

  /**
   * Convert our ChatMessage[] to { system?: string, messages: ModelMessage[] }.
   *
   * 致敬 Vercel AI SDK 的最佳实践：system 用单独参数，不要混在 messages 里
   * （SDK 会发警告：System messages in the prompt or messages fields can be a security risk）。
   *
   * 取 messages 中**第一条** role === 'system' 作为 system 入参，其余继续放 messages。
   * 多个 system 会被拼接成单个字符串。
   */
  private toModelInput(messages: ChatMessage[]): { system: string | undefined; messages: ModelMessage[] } {
    const systemParts: string[] = []
    const rest: ChatMessage[] = []
    for (const m of messages) {
      if (m.role === 'system') {
        const text = typeof m.content === 'string'
          ? m.content
          : m.content
              .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
              .map(p => p.text)
              .join('\n')
        if (text) systemParts.push(text)
      } else {
        rest.push(m)
      }
    }
    const mapped: ModelMessage[] = rest.map((m): ModelMessage => {
      if (typeof m.content === 'string') {
        if (m.role === 'assistant') return { role: 'assistant', content: m.content }
        return { role: 'user', content: m.content }
      }
      const textOnly = m.content
        .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
        .map(p => p.text)
        .join('\n')
      if (m.role === 'assistant') return { role: 'assistant', content: textOnly }
      const userParts = m.content.map(p => {
        if (p.type === 'text') return { type: 'text' as const, text: p.text }
        return { type: 'image' as const, image: p.image }
      })
      return { role: 'user', content: userParts }
    })
    return {
      system: systemParts.length > 0 ? systemParts.join('\n\n') : undefined,
      messages: mapped,
    }
  }

  /** 一次性 chat 调用（非流式），返回完整文本（已剥离 <think> 块） */
  async chat(messages: ChatMessage[], config: LlmCallConfig = {}, opts: ChatOptions = {}): Promise<string> {
    const resolved = this.resolve(config)
    const model = this.buildModel(resolved)
    const { system, messages: modelMsgs } = this.toModelInput(messages)
    const providerOpts = this.buildProviderOptions(resolved)
    const start = Date.now()
    try {
      const { text } = await generateText({
        model,
        ...(system ? { system } : {}),
        messages: modelMsgs,
        temperature: opts.temperature ?? 0.7,
        ...(opts.maxTokens ? { maxOutputTokens: opts.maxTokens } : {}),
        ...(opts.signal ? { abortSignal: opts.signal } : {}),
        ...(providerOpts ? { providerOptions: providerOpts } : {}),
      })
      this.logger.log(`chat ok: ${resolved.providerId}:${resolved.modelId} (${Date.now() - start}ms)`)
      return stripThinkingTags(text)
    } catch (err: any) {
      this.logger.error(
        `chat failed: ${resolved.providerId}:${resolved.modelId} (${Date.now() - start}ms) - ${err?.message || err}`,
      )
      throw err
    }
  }

  /**
   * 流式 chat，逐 chunk yield 文本增量（已过滤 <think> 块）。
   *
   * 思考块过滤策略：
   *   - 维护一个跨 chunk 的滑动缓冲 `pending`，识别尚未闭合的 `<think>` / `<thinking>` 标签
   *   - "thinking 开关"切换：见到 `<think>` 进入静默态，见到 `</think>` 退出
   *   - 静默期间所有 chunk 丢弃，不 yield 给客户端
   *   - 普通文本 chunk 直接透传 yield
   *
   * 这样即便模型 ignore 了 enable_thinking 开关，前端也看不到思考过程，体验干净。
   */
  async *chatStream(
    messages: ChatMessage[],
    config: LlmCallConfig = {},
    opts: ChatOptions = {},
  ): AsyncGenerator<string> {
    const resolved = this.resolve(config)
    const model = this.buildModel(resolved)
    const { system, messages: modelMsgs } = this.toModelInput(messages)
    const providerOpts = this.buildProviderOptions(resolved)
    const start = Date.now()
    try {
      const result = streamText({
        model,
        ...(system ? { system } : {}),
        messages: modelMsgs,
        temperature: opts.temperature ?? 0.7,
        ...(opts.maxTokens ? { maxOutputTokens: opts.maxTokens } : {}),
        ...(opts.signal ? { abortSignal: opts.signal } : {}),
        ...(providerOpts ? { providerOptions: providerOpts } : {}),
      })

      let inThinking = false
      let pending = ''
      // 最长标签 `<thinking>` / `</thinking>` 长 11 字符，保留 14 字节缓冲足够安全
      const TAG_LOOK_AHEAD = 14
      const OPEN_RE = /<(?:think|thinking|reasoning)>/i
      const CLOSE_RE = /<\/(?:think|thinking|reasoning)>/i

      for await (const delta of result.textStream) {
        pending += delta
        // 反复处理 pending，直到不再找到标签 / 缓冲见底
        while (pending.length > 0) {
          if (inThinking) {
            const closeMatch = CLOSE_RE.exec(pending)
            if (closeMatch) {
              pending = pending.slice(closeMatch.index + closeMatch[0].length)
              inThinking = false
              continue
            }
            // 没找到闭标签：保留可能跨 chunk 的尾巴，其余丢弃
            if (pending.length > TAG_LOOK_AHEAD) pending = pending.slice(-TAG_LOOK_AHEAD)
            break
          }
          // 正常态：找开标签
          const openMatch = OPEN_RE.exec(pending)
          if (openMatch) {
            const head = pending.slice(0, openMatch.index)
            if (head) yield head
            pending = pending.slice(openMatch.index + openMatch[0].length)
            inThinking = true
            continue
          }
          // 没找到开标签：yield 安全前缀（保留末尾可能是半截标签的缓冲）
          if (pending.length > TAG_LOOK_AHEAD) {
            yield pending.slice(0, pending.length - TAG_LOOK_AHEAD)
            pending = pending.slice(-TAG_LOOK_AHEAD)
          }
          break
        }
      }
      // 流结束后 flush 残余
      if (!inThinking && pending) yield pending
      this.logger.log(`stream ok: ${resolved.providerId}:${resolved.modelId} (${Date.now() - start}ms)`)
    } catch (err: any) {
      this.logger.error(
        `stream failed: ${resolved.providerId}:${resolved.modelId} (${Date.now() - start}ms) - ${err?.message || err}`,
      )
      throw err
    }
  }

  /** 暴露 providers 注册表（给 controller / settings 用） */
  listProviders() {
    return Object.values(PROVIDERS)
  }

  /** 是否需要 key（前端 settings 校验用） */
  static isProviderKeyRequired(providerId: ProviderId): boolean {
    return isProviderKeyRequired(providerId)
  }
}
