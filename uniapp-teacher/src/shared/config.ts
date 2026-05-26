/**
 * 后端地址配置。
 * - 优先用 build-time env：VITE_API_BASE / VITE_WS_URL
 * - 否则按 platform 给默认值（H5 dev: localhost; App: 必须改为内网 IP 或域名）
 */

const fromEnv = {
  apiBase: (import.meta as any).env?.VITE_API_BASE as string | undefined,
  wsUrl: (import.meta as any).env?.VITE_WS_URL as string | undefined,
}

/**
 * 默认地址：
 *   - H5 跑在 localhost:5173 → 后端 http://localhost:3000
 *   - App / 真机 →  必须改为电脑内网 IP（如 http://192.168.1.20:3000）
 *     建议你 `cp .env.example .env`，按需修改
 */
function pickDefault(): { apiBase: string; wsUrl: string } {
  // #ifdef H5
  return { apiBase: 'http://localhost:3000/api/v1', wsUrl: 'http://localhost:3000' }
  // #endif
  // #ifdef APP-PLUS
  return { apiBase: 'http://192.168.1.12:3000/api/v1', wsUrl: 'http://192.168.1.12:3000' }
  // #endif
  // #ifdef MP-WEIXIN
  return { apiBase: 'https://snyuan.example.com/api/v1', wsUrl: 'https://snyuan.example.com' }
  // #endif
}

const fallback = pickDefault()

export const API_BASE = fromEnv.apiBase || fallback.apiBase
export const WS_URL = fromEnv.wsUrl || fallback.wsUrl
export const WS_NAMESPACE = '/classroom'
