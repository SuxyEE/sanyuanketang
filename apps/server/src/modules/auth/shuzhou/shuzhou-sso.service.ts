import { Injectable, Logger } from '@nestjs/common'
import { createHash, randomBytes } from 'node:crypto'
import { ShuzhouAppKey, ShuzhouAuthConfig } from './shuzhou-auth.config'

const TRANSACTION_TTL_MS = 5 * 60 * 1000
const TICKET_TTL_MS = 60 * 1000
const TOKEN_TIMEOUT_MS = 8000
const MAX_PENDING = 2000

export interface SsoTransaction {
  state: string
  nonce: string
  verifier: string
  returnTo: string
  app: ShuzhouAppKey
  createdAt: number
}

export interface SsoSession {
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

export interface ShuzhouTokenResponse {
  access_token: string
  id_token: string
  token_type: string
  expires_in?: number
  scope?: string
}

/**
 * 授权码流程的服务端状态。
 *
 * 事务和一次性票据都放在进程内存里：课堂服务本身就是单实例（课堂房间状态同样在内存），
 * 且两者存活时间都以分钟计。若将来横向扩容，这两个 Map 需要换成 Redis。
 */
@Injectable()
export class ShuzhouSsoService {
  private readonly logger = new Logger('ShuzhouSsoService')
  private readonly transactions = new Map<string, SsoTransaction>()
  private readonly tickets = new Map<string, { session: SsoSession; createdAt: number }>()

  constructor(private readonly config: ShuzhouAuthConfig) {}

  /** 生成 PKCE 事务并返回认证中心授权地址；state 同时充当事务主键 */
  createAuthorizationRequest(app: ShuzhouAppKey, returnTo: string): { url: string; state: string } {
    this.prune()

    const transaction: SsoTransaction = {
      state: this.randomToken(32),
      nonce: this.randomToken(32),
      verifier: this.randomToken(48),
      returnTo,
      app,
      createdAt: Date.now(),
    }
    this.transactions.set(transaction.state, transaction)

    const parameters = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      scope: this.config.scope,
      state: transaction.state,
      nonce: transaction.nonce,
      code_challenge: this.codeChallenge(transaction.verifier),
      code_challenge_method: 'S256',
    })

    return {
      url: `${this.config.authorizeEndpoint}?${parameters.toString()}`,
      state: transaction.state,
    }
  }

  /** 事务只能被消费一次，避免回调页刷新导致重复换码 */
  consumeTransaction(state: string): SsoTransaction | null {
    const transaction = this.transactions.get(state)
    if (!transaction) return null
    this.transactions.delete(state)
    if (Date.now() - transaction.createdAt > TRANSACTION_TTL_MS) return null
    return transaction
  }

  async exchangeCode(code: string, verifier: string): Promise<ShuzhouTokenResponse> {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: this.config.clientId,
      code,
      redirect_uri: this.config.redirectUri,
      code_verifier: verifier,
    })
    if (this.config.clientSecret) body.set('client_secret', this.config.clientSecret)

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TOKEN_TIMEOUT_MS)
    try {
      const res = await fetch(this.config.tokenEndpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body,
        signal: controller.signal,
      })
      const payload = (await res.json().catch(() => ({}))) as Partial<ShuzhouTokenResponse> & {
        error?: string
        error_description?: string
      }
      if (!res.ok || payload.error) {
        throw new Error(payload.error_description || payload.error || `HTTP ${res.status}`)
      }
      if (
        !payload.access_token ||
        !payload.id_token ||
        String(payload.token_type || '').toLowerCase() !== 'bearer'
      ) {
        throw new Error('认证中心返回的令牌不完整')
      }
      return payload as ShuzhouTokenResponse
    } catch (err: any) {
      throw new Error(`换取登录令牌失败：${err?.message || err}`)
    } finally {
      clearTimeout(timer)
    }
  }

  /** 课堂会话不经浏览器地址栏传递，回调只带一张 60 秒内有效的一次性票据 */
  issueTicket(session: SsoSession): string {
    this.prune()
    const ticket = this.randomToken(32)
    this.tickets.set(ticket, { session, createdAt: Date.now() })
    return ticket
  }

  redeemTicket(ticket: string): SsoSession | null {
    const entry = this.tickets.get(ticket)
    if (!entry) return null
    this.tickets.delete(ticket)
    if (Date.now() - entry.createdAt > TICKET_TTL_MS) return null
    return entry.session
  }

  private codeChallenge(verifier: string): string {
    return createHash('sha256').update(verifier).digest('base64url')
  }

  private randomToken(bytes: number): string {
    return randomBytes(bytes).toString('base64url')
  }

  private prune() {
    const now = Date.now()
    for (const [key, value] of this.transactions) {
      if (now - value.createdAt > TRANSACTION_TTL_MS) this.transactions.delete(key)
    }
    for (const [key, value] of this.tickets) {
      if (now - value.createdAt > TICKET_TTL_MS) this.tickets.delete(key)
    }
    // 未完成的授权请求不应无限堆积（例如爬虫反复打 /start）
    this.evictOldest(this.transactions, MAX_PENDING)
    this.evictOldest(this.tickets, MAX_PENDING)
  }

  private evictOldest(store: Map<string, { createdAt: number }>, limit: number) {
    if (store.size <= limit) return
    const overflow = store.size - limit
    let removed = 0
    for (const key of store.keys()) {
      store.delete(key)
      if (++removed >= overflow) break
    }
    this.logger.warn(`统一登录待处理条目超过 ${limit}，已清理 ${removed} 条最早记录`)
  }
}
