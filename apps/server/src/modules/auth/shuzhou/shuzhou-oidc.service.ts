import { Injectable } from '@nestjs/common'
import { verify as verifySignature } from 'node:crypto'
import { ShuzhouAuthConfig } from './shuzhou-auth.config'
import { ShuzhouJwksService } from './shuzhou-jwks.service'

/** 与认证中心一致：nbf 容忍 30 秒时钟偏移，exp 不容忍 */
const CLOCK_SKEW_SEC = 30

export interface ShuzhouClaims {
  sub: string
  legacyUserId: number
  accountType: string
  membershipId?: string
  tenantId?: string
  schoolId?: string
  role?: string
  preferredUsername?: string
  name?: string
  phone?: string
  email?: string
}

@Injectable()
export class ShuzhouOidcService {
  constructor(
    private readonly config: ShuzhouAuthConfig,
    private readonly jwks: ShuzhouJwksService,
  ) {}

  /**
   * 只读 JWT header 里的 alg，用于双令牌分流。
   * 此时签名尚未校验，返回值只能用来选择校验路径，不能当作任何身份证据。
   */
  tokenAlgorithm(raw: string): string | null {
    const parts = String(raw || '').split('.')
    if (parts.length !== 3) return null
    try {
      const header = this.decodeSegment(parts[0])
      const alg = String(header.alg || '').trim()
      return alg || null
    } catch {
      return null
    }
  }

  async verifyAccessToken(raw: string): Promise<ShuzhouClaims> {
    const payload = await this.verifyAndDecode(raw)
    this.validateBaseClaims(payload, 'access')

    const legacyUserId = Number(payload.legacy_user_id)
    if (!Number.isFinite(legacyUserId) || legacyUserId <= 0) {
      throw new Error('令牌缺少旧系统用户映射')
    }
    const accountType = this.text(payload.account_type)
    if (!accountType) throw new Error('令牌缺少账号类型')

    return {
      sub: this.text(payload.sub),
      legacyUserId,
      accountType,
      membershipId: this.text(payload.membership_id) || undefined,
      tenantId: this.text(payload.tenant_id) || undefined,
      schoolId: this.text(payload.school_id) || undefined,
      role: this.text(payload.role) || undefined,
      preferredUsername: this.text(payload.preferred_username) || undefined,
      name: this.text(payload.name) || undefined,
      phone: this.text(payload.phone) || undefined,
      email: this.text(payload.email) || undefined,
    }
  }

  /** id_token 与 access_token 必须同源同受众，另外还要比对本次授权事务的 nonce */
  async verifyIdToken(raw: string, expectedNonce: string): Promise<Record<string, any>> {
    const payload = await this.verifyAndDecode(raw)
    this.validateBaseClaims(payload, 'id')
    if (this.text(payload.nonce) !== expectedNonce) {
      throw new Error('登录凭证 nonce 校验失败')
    }
    return payload
  }

  private async verifyAndDecode(raw: string): Promise<Record<string, any>> {
    const parts = String(raw || '').split('.')
    if (parts.length !== 3) throw new Error('令牌格式无效')

    const header = this.decodeSegment(parts[0])
    if (header.alg !== 'RS256') throw new Error('令牌签名算法不受支持')
    const kid = this.text(header.kid)
    if (!kid) throw new Error('令牌缺少签名密钥标识')

    const key = await this.jwks.getSigningKey(kid)
    const signed = Buffer.from(`${parts[0]}.${parts[1]}`, 'ascii')
    const signature = Buffer.from(parts[2], 'base64url')
    if (!verifySignature('RSA-SHA256', signed, key, signature)) {
      throw new Error('令牌签名校验失败')
    }
    return this.decodeSegment(parts[1])
  }

  private validateBaseClaims(payload: Record<string, any>, expectedTokenUse: 'access' | 'id') {
    const now = Math.floor(Date.now() / 1000)

    if (this.text(payload.iss).replace(/\/+$/, '') !== this.config.issuer) {
      throw new Error('令牌签发方无效')
    }
    if (!this.audienceContains(payload.aud, this.config.clientId)) {
      throw new Error('令牌受众无效')
    }
    if (this.text(payload.token_use) !== expectedTokenUse) {
      throw new Error('令牌用途无效')
    }
    if (!this.text(payload.sub)) {
      throw new Error('令牌缺少用户标识')
    }

    const exp = Number(payload.exp)
    if (!Number.isFinite(exp) || now >= exp) throw new Error('令牌已过期')

    const nbf = Number(payload.nbf)
    if (Number.isFinite(nbf) && now + CLOCK_SKEW_SEC < nbf) throw new Error('令牌尚未生效')
  }

  private audienceContains(value: unknown, expected: string): boolean {
    if (typeof value === 'string') return value === expected
    if (Array.isArray(value)) return value.some(item => this.text(item) === expected)
    return false
  }

  private decodeSegment(segment: string): Record<string, any> {
    const parsed = JSON.parse(Buffer.from(segment, 'base64url').toString('utf8'))
    if (!parsed || typeof parsed !== 'object') throw new Error('令牌内容无法解析')
    return parsed as Record<string, any>
  }

  private text(value: unknown): string {
    return typeof value === 'string' ? value.trim() : value == null ? '' : String(value).trim()
  }
}
