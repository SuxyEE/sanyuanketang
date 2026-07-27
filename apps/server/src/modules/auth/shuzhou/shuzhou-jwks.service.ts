import { Injectable, Logger } from '@nestjs/common'
import { createPublicKey, KeyObject } from 'node:crypto'
import { ShuzhouAuthConfig } from './shuzhou-auth.config'

const CACHE_TTL_MS = 5 * 60 * 1000
const FETCH_TIMEOUT_MS = 5000
const MAX_BODY_BYTES = 1024 * 1024

interface JwkEntry {
  kty?: string
  use?: string
  alg?: string
  kid?: string
  n?: string
  e?: string
}

@Injectable()
export class ShuzhouJwksService {
  private readonly logger = new Logger('ShuzhouJwksService')
  private keys = new Map<string, KeyObject>()
  private expiresAt = 0
  private refreshing: Promise<Map<string, KeyObject>> | null = null

  constructor(private readonly config: ShuzhouAuthConfig) {}

  /** 缓存内命中直接返回；未命中一律回源，认证中心轮换私钥后最迟 5 分钟自愈 */
  async getSigningKey(kid: string): Promise<KeyObject> {
    if (Date.now() < this.expiresAt) {
      const cached = this.keys.get(kid)
      if (cached) return cached
    }
    const keys = await this.refresh()
    const key = keys.get(kid)
    if (!key) throw new Error(`认证中心 JWKS 中没有 kid=${kid} 对应的公钥`)
    return key
  }

  private refresh(): Promise<Map<string, KeyObject>> {
    if (this.refreshing) return this.refreshing
    this.refreshing = this.fetchKeys()
      .then(keys => {
        this.keys = keys
        this.expiresAt = Date.now() + CACHE_TTL_MS
        return keys
      })
      .finally(() => {
        this.refreshing = null
      })
    return this.refreshing
  }

  private async fetchKeys(): Promise<Map<string, KeyObject>> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
    try {
      const res = await fetch(this.config.jwksEndpoint, { signal: controller.signal })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const body = await res.text()
      if (body.length > MAX_BODY_BYTES) throw new Error('响应体超出大小上限')

      const document = JSON.parse(body) as { keys?: JwkEntry[] }
      const keys = new Map<string, KeyObject>()
      for (const jwk of document.keys || []) {
        if (jwk.kty !== 'RSA' || jwk.alg !== 'RS256' || jwk.use !== 'sig') continue
        if (!jwk.kid || !jwk.n || !jwk.e) continue
        try {
          keys.set(jwk.kid, createPublicKey({ key: jwk as any, format: 'jwk' }))
        } catch (err: any) {
          this.logger.warn(`跳过无法解析的 JWK kid=${jwk.kid}：${err?.message || err}`)
        }
      }
      if (keys.size === 0) throw new Error('没有可用的 RS256 签名公钥')
      return keys
    } catch (err: any) {
      throw new Error(`拉取认证中心 JWKS 失败：${err?.message || err}`)
    } finally {
      clearTimeout(timer)
    }
  }
}
