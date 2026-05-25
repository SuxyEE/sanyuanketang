/** 统一 LLM 抽象的类型定义。设计参考 OpenMAIC `lib/types/provider.ts`，仅保留我们用得到的子集。 */

export type ProviderType = 'openai' | 'anthropic' | 'google'

export type ProviderId =
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'qwen'
  | 'deepseek'
  | 'kimi'
  | 'glm'
  | 'doubao'
  | 'minimax'
  | 'ollama'

export interface ModelCapabilities {
  streaming: boolean
  tools: boolean
  vision: boolean
}

export interface ModelInfo {
  id: string
  name: string
  contextWindow?: number
  outputWindow?: number
  capabilities: ModelCapabilities
}

export interface ProviderConfig {
  id: ProviderId
  name: string
  /** Vercel AI SDK 适配器类型：原生 openai/anthropic/google + 其他兼容 openai 协议的厂商 */
  type: ProviderType
  defaultBaseUrl: string
  requiresApiKey: boolean
  /** 兼容多区域（如国内/国际站） */
  alternateBaseUrls?: { label: string; url: string }[]
  models: ModelInfo[]
}

/** 调用 LLM 时的入参（model 推荐使用 "providerId:modelId" 格式） */
export interface LlmCallConfig {
  /** "provider:modelId" 例 "google:gemini-3-flash-preview"，单 modelId 视为 openai */
  model?: string
  /** 显式 providerId（与 model 二选一） */
  providerId?: ProviderId
  /** 显式 modelId */
  modelId?: string
  apiKey?: string
  baseUrl?: string
  /** OpenAI 兼容厂商可选指定 providerType，默认从注册表查 */
  providerType?: ProviderType
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string | Array<{ type: 'text'; text: string } | { type: 'image'; image: string }>
}

export interface ChatOptions {
  temperature?: number
  maxTokens?: number
  /** AbortSignal 用于上游取消传播 */
  signal?: AbortSignal
}
