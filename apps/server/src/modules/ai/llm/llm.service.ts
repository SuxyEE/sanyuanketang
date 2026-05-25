import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { generateText, streamText, type LanguageModel, type ModelMessage } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { PROVIDERS, parseModelString, isProviderKeyRequired, getProviderConfig } from './providers'
import type { ChatMessage, ChatOptions, LlmCallConfig, ProviderId, ProviderType } from './types'

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

  /** Internal: build a Vercel AI SDK LanguageModel instance */
  private buildModel(resolved: ReturnType<LlmService['resolve']>): LanguageModel {
    const { providerType, modelId, apiKey, baseUrl } = resolved
    switch (providerType) {
      case 'openai': {
        const openai = createOpenAI({ apiKey: apiKey || 'placeholder', baseURL: baseUrl })
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

  /** 一次性 chat 调用（非流式），返回完整文本 */
  async chat(messages: ChatMessage[], config: LlmCallConfig = {}, opts: ChatOptions = {}): Promise<string> {
    const resolved = this.resolve(config)
    const model = this.buildModel(resolved)
    const { system, messages: modelMsgs } = this.toModelInput(messages)
    const start = Date.now()
    try {
      const { text } = await generateText({
        model,
        ...(system ? { system } : {}),
        messages: modelMsgs,
        temperature: opts.temperature ?? 0.7,
        ...(opts.maxTokens ? { maxOutputTokens: opts.maxTokens } : {}),
        ...(opts.signal ? { abortSignal: opts.signal } : {}),
      })
      this.logger.log(`chat ok: ${resolved.providerId}:${resolved.modelId} (${Date.now() - start}ms)`)
      return text
    } catch (err: any) {
      this.logger.error(
        `chat failed: ${resolved.providerId}:${resolved.modelId} (${Date.now() - start}ms) - ${err?.message || err}`,
      )
      throw err
    }
  }

  /** 流式 chat，逐 chunk yield 文本增量 */
  async *chatStream(
    messages: ChatMessage[],
    config: LlmCallConfig = {},
    opts: ChatOptions = {},
  ): AsyncGenerator<string> {
    const resolved = this.resolve(config)
    const model = this.buildModel(resolved)
    const { system, messages: modelMsgs } = this.toModelInput(messages)
    const start = Date.now()
    try {
      const result = streamText({
        model,
        ...(system ? { system } : {}),
        messages: modelMsgs,
        temperature: opts.temperature ?? 0.7,
        ...(opts.maxTokens ? { maxOutputTokens: opts.maxTokens } : {}),
        ...(opts.signal ? { abortSignal: opts.signal } : {}),
      })
      for await (const delta of result.textStream) {
        yield delta
      }
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
