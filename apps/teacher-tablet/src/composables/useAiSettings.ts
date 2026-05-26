/**
 * AI 设置（前端持久化）。
 *
 * 思路参考 OpenMAIC `lib/store/settings.ts` 的"客户端配置 + 自带 key"模式：
 *   - 教师在 AI 设置面板选 provider + model + api key + base url
 *   - 配置只保存在 **本机 localStorage**（不会同步给其他教师）
 *   - 每次 AI 调用 → 把 { model, apiKey, baseUrl } 一起发给服务端
 *   - 服务端把这套配置覆盖 .env 默认值，调用对应厂商
 *
 * 用法：
 *   const { settings, getRequestConfig, save, isConfigured } = useAiSettings()
 *   socket.emit('ai:chat', { message, ...getRequestConfig() })
 */

import { reactive, computed, readonly } from 'vue'

export interface AiSettings {
  /** "provider:modelId"，如 "qwen:qwen-turbo"。空 = 使用服务端默认 */
  model: string
  /** 用户自带的 API key。空 = 使用服务端 .env 默认 */
  apiKey: string
  /** 自定义 baseUrl。空 = 使用 provider 默认 */
  baseUrl: string
  /** 用户是否手动配置过（区分"未配置"和"刻意留空") */
  configured: boolean
  /** 上次修改时间 */
  updatedAt: number
  /**
   * 配置时记录的"教师标识"。
   * 同一台平板被换人登录后，UI 会高亮警告：当前生效的 API key 来自上一位教师，
   * 防止误用他人 key 计费。空字符串 = 老数据 / 匿名教师。
   */
  ownerName: string
}

const STORAGE_KEY = 'snyuan_ai_settings_v1'

function loadFromStorage(): AiSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultSettings()
    const parsed = JSON.parse(raw)
    return {
      model: String(parsed.model || ''),
      apiKey: String(parsed.apiKey || ''),
      baseUrl: String(parsed.baseUrl || ''),
      configured: !!parsed.configured,
      updatedAt: Number(parsed.updatedAt) || 0,
      ownerName: String(parsed.ownerName || ''),
    }
  } catch {
    return defaultSettings()
  }
}

function defaultSettings(): AiSettings {
  return { model: '', apiKey: '', baseUrl: '', configured: false, updatedAt: 0, ownerName: '' }
}

// 进程内单例（同一 Composer 中所有 useAiSettings() 共享同一份状态）
const state = reactive<AiSettings>(loadFromStorage())

export function useAiSettings() {
  function save(patch: Partial<AiSettings>) {
    if ('model' in patch) state.model = patch.model || ''
    if ('apiKey' in patch) state.apiKey = patch.apiKey || ''
    if ('baseUrl' in patch) state.baseUrl = patch.baseUrl || ''
    if ('ownerName' in patch) state.ownerName = patch.ownerName || ''
    state.configured = true
    state.updatedAt = Date.now()
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }

  function reset() {
    Object.assign(state, defaultSettings())
    localStorage.removeItem(STORAGE_KEY)
  }

  /** 返回 AI 请求时要附加的字段（自动跳过空值） */
  function getRequestConfig(): { model?: string; apiKey?: string; baseUrl?: string } {
    const out: Record<string, string> = {}
    if (state.model) out.model = state.model
    if (state.apiKey) out.apiKey = state.apiKey
    if (state.baseUrl) out.baseUrl = state.baseUrl
    return out
  }

  const isConfigured = computed(() => state.configured)
  const hasCustomModel = computed(() => !!state.model)
  const hasCustomKey = computed(() => !!state.apiKey)

  /**
   * 给定当前教师名（来自 store），判定当前持有的 AI 设置是否属于"上一位教师残留"。
   * - 未配置或 ownerName 为空（老数据兼容）→ 不告警
   * - ownerName 与当前不一致 → 告警
   * 调用方（AiSettings.vue）据此显示一条高亮 banner。
   */
  function isOwnedByOther(currentName: string): boolean {
    if (!state.configured) return false
    if (!state.ownerName) return false
    return state.ownerName.trim() !== (currentName || '').trim()
  }

  return {
    settings: readonly(state),
    isConfigured,
    hasCustomModel,
    hasCustomKey,
    save,
    reset,
    getRequestConfig,
    isOwnedByOther,
  }
}
