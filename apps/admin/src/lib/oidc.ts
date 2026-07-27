/**
 * 书舟统一登录（后端换码模式）客户端。
 *
 * 浏览器不接触认证中心的 access_token：
 *   1. 跳到课堂后端 /auth/shuzhou/start，由后端持有 PKCE 事务并跳认证中心
 *   2. 认证中心回调课堂后端，后端换码、验签、建档，签发课堂会话令牌
 *   3. 后端带一次性票据跳回本页面的 /oidc/callback，前端拿票据换课堂令牌
 */

import { API_BASE } from '@/shared/backend'

const ISSUER_CACHE_KEY = 'shuzhou_issuer'

export interface ShuzhouStatus {
  enabled: boolean
  issuer: string
  clientId: string
}

export interface ShuzhouSession {
  accessToken: string
  user: {
    id: string
    name: string
    role: string
    avatar?: string
    tenantId?: string
    schoolId?: string
  }
}

/** 与后端同款白名单：只允许应用内部路径，且不能落回 OIDC 自身路由造成回环 */
export function safeReturnPath(value: unknown): string {
  const path = typeof value === 'string' ? value.trim() : ''
  if (!path.startsWith('/') || path.startsWith('//') || path.startsWith('/oidc/')) {
    return '/dashboard'
  }
  return path
}

export async function fetchShuzhouStatus(): Promise<ShuzhouStatus> {
  const res = await fetch(`${API_BASE}/auth/shuzhou/status`, { credentials: 'include' })
  if (!res.ok) throw new Error(`统一登录状态读取失败：HTTP ${res.status}`)
  const status = (await res.json()) as ShuzhouStatus
  if (status.issuer) localStorage.setItem(ISSUER_CACHE_KEY, status.issuer)
  return status
}

export function startShuzhouLogin(returnTo: unknown): void {
  const parameters = new URLSearchParams({ app: 'admin', return_to: safeReturnPath(returnTo) })
  window.location.replace(`${API_BASE}/auth/shuzhou/start?${parameters.toString()}`)
}

export async function redeemShuzhouTicket(ticket: string): Promise<ShuzhouSession> {
  const res = await fetch(`${API_BASE}/auth/shuzhou/ticket`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ ticket }),
  })
  const payload = (await res.json().catch(() => ({}))) as Partial<ShuzhouSession> & { message?: string }
  if (!res.ok || !payload.accessToken || !payload.user) {
    throw new Error(payload.message || '登录票据无效或已过期，请重新登录')
  }
  return payload as ShuzhouSession
}

/**
 * 主动登出时联动注销认证中心的中央会话。
 * 被动失效（401 拦截等）不应调用：中央会话 8 小时内仍有效，用户可无感重进，
 * 一次瞬时故障不该把用户在所有产品的统一登录态都清掉。
 */
export async function logoutShuzhouCenter(): Promise<void> {
  const issuer = localStorage.getItem(ISSUER_CACHE_KEY)
  if (!issuer) return
  try {
    await fetch(`${issuer.replace(/\/+$/, '')}/oauth/logout`, {
      method: 'POST',
      credentials: 'include',
    })
  } catch {
    // 注销中央会话失败不阻断本地登出
  }
}
