/**
 * 后端地址配置（dev/线上双兼容，三层优先级）。
 *
 * 优先级（从高到低）：
 *   1. uni.getStorageSync('snyuan_api_base') — 运行时覆盖（无需重打包）
 *   2. .env 里的 VITE_API_BASE / VITE_WS_URL — 编译期注入（显式锁定时用）
 *   3. 平台智能默认值：
 *       - H5 dev (localhost 5173/3001-3004) → http://localhost:3000
 *       - H5 prod（部署后访问的域名） → window.location.origin 同源
 *       - App / 小程序 → https://duoyuan.longdao.top（线上）
 *
 * 设计目标：
 *   - 本地开发 `pnpm dev:h5`：什么都不配，自动走 localhost
 *   - HBuilderX 出 apk：什么都不配，自动走线上 duoyuan
 *   - 临时换后端：改 .env 即可（覆盖默认）
 *   - 现场技术员：调 setBackendOverride() 写 storage 临时切，下次启动生效
 */

const PROD_HOST = 'https://duoyuan.longdao.top'
const STORAGE_KEY_API = 'snyuan_api_base'
const STORAGE_KEY_WS = 'snyuan_ws_url'

/** 1. 运行时存储（uni.getStorageSync 平台无关） */
function fromStorage(): { apiBase?: string; wsUrl?: string } {
  try {
    return {
      apiBase: (uni.getStorageSync(STORAGE_KEY_API) as string) || undefined,
      wsUrl: (uni.getStorageSync(STORAGE_KEY_WS) as string) || undefined,
    }
  } catch {
    return {}
  }
}

/** 2. 编译期 env */
const fromEnv = {
  apiBase: (import.meta as any).env?.VITE_API_BASE as string | undefined,
  wsUrl: (import.meta as any).env?.VITE_WS_URL as string | undefined,
}

/** 3. 平台智能默认值 */
function pickDefault(): { apiBase: string; wsUrl: string } {
  // #ifdef H5
  if (typeof window !== 'undefined' && window.location) {
    const origin = window.location.origin
    // 常见 vite/uniapp dev 端口 → 走 localhost:3000 后端
    if (/:(5173|3000|3001|3002|3003|3004)$/.test(origin)) {
      return { apiBase: 'http://localhost:3000/api/v1', wsUrl: 'http://localhost:3000' }
    }
    // 部署后的 H5 同源（容器内 nginx 会代理 /api 和 /socket.io）
    return { apiBase: `${origin}/api/v1`, wsUrl: origin }
  }
  return { apiBase: 'http://localhost:3000/api/v1', wsUrl: 'http://localhost:3000' }
  // #endif

  // #ifdef APP-PLUS
  return { apiBase: `${PROD_HOST}/api/v1`, wsUrl: PROD_HOST }
  // #endif

  // #ifdef MP-WEIXIN
  return { apiBase: `${PROD_HOST}/api/v1`, wsUrl: PROD_HOST }
  // #endif
}

const storage = fromStorage()
const fallback = pickDefault()

export const API_BASE = storage.apiBase || fromEnv.apiBase || fallback.apiBase
export const WS_URL = storage.wsUrl || fromEnv.wsUrl || fallback.wsUrl
export const WS_NAMESPACE = '/classroom'

/**
 * 运行时切换后端地址（写入 storage，App 重启后生效）。
 * 现场技术员可在隐藏设置页或控制台调用：
 *   setBackendOverride('https://new.example.com/api/v1', 'https://new.example.com')
 */
export function setBackendOverride(apiBase: string, wsUrl: string): void {
  try {
    uni.setStorageSync(STORAGE_KEY_API, apiBase)
    uni.setStorageSync(STORAGE_KEY_WS, wsUrl)
  } catch (err) {
    console.warn('[config] setBackendOverride failed:', err)
  }
}

/** 清除运行时覆盖，恢复 .env / 默认值 */
export function clearBackendOverride(): void {
  try {
    uni.removeStorageSync(STORAGE_KEY_API)
    uni.removeStorageSync(STORAGE_KEY_WS)
  } catch (err) {
    console.warn('[config] clearBackendOverride failed:', err)
  }
}
