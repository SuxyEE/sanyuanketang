/**
 * 后端地址智能默认（适配 dev / 线上 / 子路径部署）。
 *
 * 优先级：
 *   1. .env 里的 VITE_API_BASE / VITE_WS_URL — 显式覆盖
 *   2. 智能默认：
 *      - dev 端口 (5173/3001-3004) → http://localhost:3000
 *      - 其他（线上部署同源） → window.location.origin
 *
 * 部署后大屏在 https://duoyuan.longdao.top/screen/，
 * API_BASE 自动 = https://duoyuan.longdao.top/api/v1，
 * WS_URL    自动 = https://duoyuan.longdao.top，
 * 容器内 nginx 会把 /api、/socket.io 反代到 server 容器。
 */

function smartOrigin(): string {
  if (typeof window !== 'undefined' && window.location) {
    const origin = window.location.origin
    if (/:(5173|3000|3001|3002|3003|3004)$/.test(origin)) {
      return 'http://localhost:3000'
    }
    return origin
  }
  return 'http://localhost:3000'
}

const envApiBase = ((import.meta as any).env?.VITE_API_BASE as string | undefined)?.trim()
const envWsUrl = ((import.meta as any).env?.VITE_WS_URL as string | undefined)?.trim()

export const API_BASE = envApiBase || `${smartOrigin()}/api/v1`
export const WS_URL = envWsUrl || smartOrigin()
