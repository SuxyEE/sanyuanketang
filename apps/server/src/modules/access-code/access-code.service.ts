import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as crypto from 'node:crypto'

/**
 * 站点级访问密码（HMAC-SHA256）服务。
 *
 * 设计参考 OpenMAIC `middleware.ts`（77 行版本）：
 *   - 不依赖数据库：env 配 ACCESS_CODE 即开启，留空 = 关闭
 *   - 客户端输入密码 → 服务端比对 → 颁发 HMAC token 写入 cookie
 *   - 后续请求带 cookie → 服务端 HMAC 验证 → 通过
 *   - Token 形如 `<payload-base64url>.<sig-base64url>`，payload = `{exp:number, iss:'snyuan'}`
 *
 * 安全性：
 *   - 服务端密钥 = ACCESS_CODE 本身（无需额外 secret），key 永不外泄
 *   - 用 `crypto.timingSafeEqual` 比对，防时序攻击
 *   - 有效期 7 天，可通过 ACCESS_CODE_TTL_DAYS 调整
 *
 * 关闭逻辑：ACCESS_CODE 为空（含未设）时 `isEnabled()` 返回 false，整套机制旁路。
 */
@Injectable()
export class AccessCodeService {
  private readonly logger = new Logger('AccessCodeService')
  private readonly accessCode: string
  private readonly ttlMs: number

  constructor(config: ConfigService) {
    this.accessCode = (config.get<string>('ACCESS_CODE', '') || '').trim()
    const days = Number(config.get<string>('ACCESS_CODE_TTL_DAYS', '7')) || 7
    this.ttlMs = days * 24 * 60 * 60 * 1000
    if (this.accessCode) {
      this.logger.log(`Access code protection ENABLED (ttl=${days}d)`)
    } else {
      this.logger.log('Access code protection DISABLED (set ACCESS_CODE env to enable)')
    }
  }

  isEnabled(): boolean {
    return this.accessCode.length > 0
  }

  /** 用 timingSafeEqual 比对客户输入的密码 */
  verifyPassword(input: string | null | undefined): boolean {
    if (!this.isEnabled()) return true
    if (!input) return false
    const a = Buffer.from(this.accessCode, 'utf8')
    const b = Buffer.from(input, 'utf8')
    if (a.length !== b.length) return false
    try {
      return crypto.timingSafeEqual(a, b)
    } catch {
      return false
    }
  }

  /** 颁发新 token */
  issueToken(): string {
    const payload = { exp: Date.now() + this.ttlMs, iss: 'snyuan' }
    const payloadB64 = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
    const sig = this.sign(payloadB64)
    return `${payloadB64}.${sig}`
  }

  /** 验证 token（签名 + 过期时间） */
  verifyToken(token: string | null | undefined): boolean {
    if (!this.isEnabled()) return true
    if (!token || typeof token !== 'string') return false
    const dot = token.indexOf('.')
    if (dot <= 0) return false
    const payloadB64 = token.slice(0, dot)
    const sig = token.slice(dot + 1)
    const expected = this.sign(payloadB64)
    if (
      sig.length !== expected.length ||
      !crypto.timingSafeEqual(Buffer.from(sig, 'utf8'), Buffer.from(expected, 'utf8'))
    ) {
      return false
    }
    try {
      const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as { exp?: number }
      if (typeof payload.exp !== 'number' || payload.exp < Date.now()) return false
      return true
    } catch {
      return false
    }
  }

  private sign(data: string): string {
    return crypto.createHmac('sha256', this.accessCode).update(data).digest('base64url')
  }

  /** Cookie 名（前后端约定） */
  readonly cookieName = 'snyuan_access'

  /** Cookie 推荐选项（前端写 cookie 时用） */
  cookieOptions(): { maxAge: number; sameSite: 'lax'; path: string; httpOnly: true } {
    return {
      maxAge: this.ttlMs,
      sameSite: 'lax',
      path: '/',
      httpOnly: true,
    }
  }
}
