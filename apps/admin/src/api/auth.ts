/**
 * Admin 认证客户端：
 *   1) 优先请求后端 POST /api/v1/auth/login（NestJS AuthController + AuthService）
 *   2) 后端 401 → 用户名或密码错误
 *   3) 后端不可达 / 500（如未挂载 TypeORM）→ 本地 demo 兜底：admin/admin 通过
 *
 * 这样未来 B 类改动启用 TypeORM + auth 模块后，前端代码 0 改动即切到真鉴权。
 * 演示模式下 token 形如 `demo-<base64(JSON)>`，仅前端识别，**不要**当作安全凭证。
 */

const DEFAULT_API_BASE = 'http://localhost:3000/api/v1'

const API_BASE = ((import.meta as any).env?.VITE_API_BASE as string | undefined)?.trim() || DEFAULT_API_BASE

export interface LoginResult {
  ok: boolean
  token: string
  userName?: string
  message?: string
  /** 'real' = 真后端鉴权；'demo' = 本地兜底 */
  source: 'real' | 'demo'
}

function makeDemoToken(payload: Record<string, unknown>): string {
  const json = JSON.stringify({ ...payload, demo: true, iat: Date.now() })
  // 浏览器无 Buffer，用 btoa；中文需要先 encodeURIComponent
  const b64 = btoa(unescape(encodeURIComponent(json)))
  return `demo-${b64}`
}

function tryDemoLogin(username: string, password: string): LoginResult {
  if (username === 'admin' && password === 'admin') {
    return {
      ok: true,
      source: 'demo',
      token: makeDemoToken({ sub: 'admin', role: 'admin' }),
      userName: '管理员',
    }
  }
  return {
    ok: false,
    source: 'demo',
    token: '',
    message: '用户名或密码错误（演示账号：admin / admin）',
  }
}

/** 与 server `AccessCodeService.cookieName` 保持一致，方便后续接 access-code 联动 */
const ACCESS_HEADER_KEY = 'snyuan_access'

export async function login(username: string, password: string): Promise<LoginResult> {
  if (!username || !password) {
    return { ok: false, source: 'demo', token: '', message: '请输入完整账号信息' }
  }

  try {
    const resp = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // 站点访问码 token（若启用过）也带上，避免被 AccessCodeMiddleware 拦
        ...(localStorage.getItem(ACCESS_HEADER_KEY)
          ? { Authorization: `AccessCode ${localStorage.getItem(ACCESS_HEADER_KEY)}` }
          : {}),
      },
      credentials: 'include',
      body: JSON.stringify({ username, password }),
    })

    if (resp.status === 401) {
      return { ok: false, source: 'real', token: '', message: '用户名或密码错误' }
    }

    if (!resp.ok) {
      // 5xx / 400 校验失败 / DB 没连上等 → 退到 demo
      const fallback = tryDemoLogin(username, password)
      if (fallback.ok) {
        return { ...fallback, message: `后端鉴权未就绪（HTTP ${resp.status}），已用演示账号` }
      }
      return { ok: false, source: 'real', token: '', message: `登录失败（HTTP ${resp.status}）` }
    }

    const data = await resp.json().catch(() => null) as
      | { accessToken?: string; user?: { name?: string; role?: string } }
      | null
    if (!data?.accessToken) {
      return { ok: false, source: 'real', token: '', message: '后端未返回 token' }
    }
    if (data.user?.role && data.user.role !== 'admin') {
      return { ok: false, source: 'real', token: '', message: '该账号无管理后台权限' }
    }
    return {
      ok: true,
      source: 'real',
      token: data.accessToken,
      userName: data.user?.name || username,
    }
  } catch (err) {
    // network error → fall back to demo
    const fallback = tryDemoLogin(username, password)
    if (fallback.ok) {
      return { ...fallback, message: '后端未启动，已用演示账号登录' }
    }
    return fallback
  }
}
