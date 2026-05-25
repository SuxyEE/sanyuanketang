/**
 * 多厂商 LLM 注册表（致敬 OpenMAIC `lib/ai/providers.ts`，按我们需求精简）。
 *
 * 新增厂商步骤：
 *   1. 把 ProviderId 加到 types.ts
 *   2. 在 PROVIDERS 增加一项 ProviderConfig
 *   3. 模型即时可用（无需改 LlmService）
 */

import type { ProviderConfig, ProviderId } from './types'

export const PROVIDERS: Record<ProviderId, ProviderConfig> = {
  openai: {
    id: 'openai',
    name: 'OpenAI',
    type: 'openai',
    defaultBaseUrl: 'https://api.openai.com/v1',
    requiresApiKey: true,
    models: [
      { id: 'gpt-4o', name: 'GPT-4o', contextWindow: 128000, outputWindow: 16384, capabilities: { streaming: true, tools: true, vision: true } },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', contextWindow: 128000, outputWindow: 16384, capabilities: { streaming: true, tools: true, vision: true } },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', contextWindow: 128000, outputWindow: 4096, capabilities: { streaming: true, tools: true, vision: true } },
    ],
  },

  anthropic: {
    id: 'anthropic',
    name: 'Anthropic Claude',
    type: 'anthropic',
    defaultBaseUrl: 'https://api.anthropic.com/v1',
    requiresApiKey: true,
    models: [
      { id: 'claude-3-5-sonnet-latest', name: 'Claude 3.5 Sonnet', contextWindow: 200000, outputWindow: 8192, capabilities: { streaming: true, tools: true, vision: true } },
      { id: 'claude-3-5-haiku-latest', name: 'Claude 3.5 Haiku', contextWindow: 200000, outputWindow: 8192, capabilities: { streaming: true, tools: true, vision: false } },
    ],
  },

  google: {
    id: 'google',
    name: 'Google Gemini',
    type: 'google',
    defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    requiresApiKey: true,
    models: [
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', contextWindow: 1048576, outputWindow: 65536, capabilities: { streaming: true, tools: true, vision: true } },
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', contextWindow: 1048576, outputWindow: 65536, capabilities: { streaming: true, tools: true, vision: true } },
    ],
  },

  qwen: {
    id: 'qwen',
    name: '通义千问 Qwen',
    type: 'openai',
    defaultBaseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    requiresApiKey: true,
    alternateBaseUrls: [
      { label: '国内 (DashScope)', url: 'https://dashscope.aliyuncs.com/compatible-mode/v1' },
      { label: '国际 (DashScope Intl)', url: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1' },
    ],
    models: [
      // ⭐ 2026 旗舰系列（推荐默认）
      { id: 'qwen3.5-plus', name: 'Qwen 3.5 Plus（平衡 · 推荐默认）', contextWindow: 1000000, outputWindow: 32768, capabilities: { streaming: true, tools: true, vision: true } },
      { id: 'qwen3.7-max', name: 'Qwen 3.7 Max（旗舰 · 推理强）', contextWindow: 1000000, outputWindow: 32768, capabilities: { streaming: true, tools: true, vision: false } },
      { id: 'qwen3-coder-plus', name: 'Qwen 3 Coder Plus（编码专用 · HTML/代码必选）', contextWindow: 1000000, outputWindow: 65536, capabilities: { streaming: true, tools: true, vision: false } },
      { id: 'qwen3-max', name: 'Qwen 3 Max', contextWindow: 131072, outputWindow: 32768, capabilities: { streaming: true, tools: true, vision: false } },
      { id: 'qwen3.5-flash', name: 'Qwen 3.5 Flash（快 · 便宜）', contextWindow: 1000000, outputWindow: 32768, capabilities: { streaming: true, tools: true, vision: false } },
      { id: 'qwen3-vl-plus-latest', name: 'Qwen 3 VL Plus Latest（视觉理解 · 最新）', contextWindow: 131072, outputWindow: 8192, capabilities: { streaming: true, tools: true, vision: true } },
      { id: 'qwen3.5-omni-plus', name: 'Qwen 3.5 Omni Plus（全模态 · 文+图+视频+语音）', contextWindow: 131072, outputWindow: 8192, capabilities: { streaming: true, tools: true, vision: true } },
      // 老模型（保留兼容，不推荐新代码用）
      { id: 'qwen-max', name: 'Qwen Max（老 · 不推荐）', contextWindow: 32000, outputWindow: 8192, capabilities: { streaming: true, tools: true, vision: false } },
      { id: 'qwen-plus', name: 'Qwen Plus（老 · 不推荐）', contextWindow: 131072, outputWindow: 8192, capabilities: { streaming: true, tools: true, vision: false } },
      { id: 'qwen-turbo', name: 'Qwen Turbo（老 · 不推荐）', contextWindow: 1000000, outputWindow: 8192, capabilities: { streaming: true, tools: true, vision: false } },
      { id: 'qwen-vl-max', name: 'Qwen VL Max（老）', contextWindow: 32000, outputWindow: 8192, capabilities: { streaming: true, tools: true, vision: true } },
      { id: 'qwen-vl-plus', name: 'Qwen VL Plus（老）', contextWindow: 32000, outputWindow: 8192, capabilities: { streaming: true, tools: true, vision: true } },
    ],
  },

  deepseek: {
    id: 'deepseek',
    name: 'DeepSeek',
    type: 'openai',
    defaultBaseUrl: 'https://api.deepseek.com/v1',
    requiresApiKey: true,
    models: [
      { id: 'deepseek-chat', name: 'DeepSeek Chat (V3)', contextWindow: 65536, outputWindow: 8192, capabilities: { streaming: true, tools: true, vision: false } },
      { id: 'deepseek-reasoner', name: 'DeepSeek Reasoner (R1)', contextWindow: 65536, outputWindow: 8192, capabilities: { streaming: true, tools: false, vision: false } },
    ],
  },

  kimi: {
    id: 'kimi',
    name: 'Kimi (Moonshot)',
    type: 'openai',
    defaultBaseUrl: 'https://api.moonshot.cn/v1',
    requiresApiKey: true,
    alternateBaseUrls: [
      { label: '国内站', url: 'https://api.moonshot.cn/v1' },
      { label: '国际站', url: 'https://api.moonshot.ai/v1' },
    ],
    models: [
      { id: 'moonshot-v1-8k', name: 'Moonshot v1 8K', contextWindow: 8192, outputWindow: 4096, capabilities: { streaming: true, tools: true, vision: false } },
      { id: 'moonshot-v1-32k', name: 'Moonshot v1 32K', contextWindow: 32768, outputWindow: 8192, capabilities: { streaming: true, tools: true, vision: false } },
      { id: 'moonshot-v1-128k', name: 'Moonshot v1 128K', contextWindow: 131072, outputWindow: 8192, capabilities: { streaming: true, tools: true, vision: false } },
    ],
  },

  glm: {
    id: 'glm',
    name: '智谱 GLM',
    type: 'openai',
    defaultBaseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    requiresApiKey: true,
    alternateBaseUrls: [
      { label: '国内站', url: 'https://open.bigmodel.cn/api/paas/v4' },
      { label: '国际站 (z.ai)', url: 'https://api.z.ai/api/paas/v4' },
    ],
    models: [
      { id: 'glm-4-plus', name: 'GLM-4 Plus', contextWindow: 128000, outputWindow: 8192, capabilities: { streaming: true, tools: true, vision: false } },
      { id: 'glm-4-flash', name: 'GLM-4 Flash', contextWindow: 128000, outputWindow: 8192, capabilities: { streaming: true, tools: true, vision: false } },
      { id: 'glm-4v-plus', name: 'GLM-4V Plus', contextWindow: 8000, outputWindow: 4096, capabilities: { streaming: true, tools: true, vision: true } },
    ],
  },

  doubao: {
    id: 'doubao',
    name: '豆包 Doubao',
    type: 'openai',
    defaultBaseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    requiresApiKey: true,
    models: [
      { id: 'doubao-pro-32k', name: 'Doubao Pro 32K', contextWindow: 32768, outputWindow: 4096, capabilities: { streaming: true, tools: true, vision: false } },
      { id: 'doubao-lite-32k', name: 'Doubao Lite 32K', contextWindow: 32768, outputWindow: 4096, capabilities: { streaming: true, tools: true, vision: false } },
    ],
  },

  minimax: {
    id: 'minimax',
    name: 'MiniMax',
    type: 'openai',
    defaultBaseUrl: 'https://api.minimaxi.com/v1',
    requiresApiKey: true,
    models: [
      { id: 'abab6.5s-chat', name: 'abab6.5s', contextWindow: 245760, outputWindow: 8192, capabilities: { streaming: true, tools: true, vision: false } },
    ],
  },

  ollama: {
    id: 'ollama',
    name: 'Ollama (本地)',
    type: 'openai',
    defaultBaseUrl: 'http://localhost:11434/v1',
    requiresApiKey: false,
    models: [
      { id: 'llama3.2', name: 'Llama 3.2', contextWindow: 131072, outputWindow: 4096, capabilities: { streaming: true, tools: true, vision: false } },
      { id: 'qwen2.5', name: 'Qwen 2.5', contextWindow: 131072, outputWindow: 8192, capabilities: { streaming: true, tools: true, vision: false } },
      { id: 'gemma3', name: 'Gemma 3', contextWindow: 131072, outputWindow: 8192, capabilities: { streaming: true, tools: true, vision: true } },
    ],
  },
}

/** 解析 "provider:modelId"，无前缀默认 openai */
export function parseModelString(modelString: string): { providerId: ProviderId; modelId: string } {
  const colonIndex = modelString.indexOf(':')
  if (colonIndex > 0) {
    return {
      providerId: modelString.slice(0, colonIndex) as ProviderId,
      modelId: modelString.slice(colonIndex + 1),
    }
  }
  return { providerId: 'openai', modelId: modelString }
}

export function getProviderConfig(providerId: ProviderId): ProviderConfig | undefined {
  return PROVIDERS[providerId]
}

export function isProviderKeyRequired(providerId: ProviderId): boolean {
  return PROVIDERS[providerId]?.requiresApiKey ?? true
}

export function listAllProviders(): ProviderConfig[] {
  return Object.values(PROVIDERS)
}
