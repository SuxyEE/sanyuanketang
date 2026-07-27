import { Body, Controller, Get, Logger, Post, Query, Req, Res, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import type { Request, Response } from 'express'
import { RedeemTicketDto } from './dto/redeem-ticket.dto'
import { ShuzhouAppKey, ShuzhouAuthConfig } from './shuzhou-auth.config'
import { ShuzhouIdentityService } from './shuzhou-identity.service'
import { ShuzhouOidcService } from './shuzhou-oidc.service'
import { ShuzhouSsoService } from './shuzhou-sso.service'

const DEFAULT_APP: ShuzhouAppKey = 'admin'
const DEFAULT_RETURN_TO = '/dashboard'

@ApiTags('书舟统一登录')
@Controller('auth/shuzhou')
export class ShuzhouController {
  private readonly logger = new Logger('ShuzhouController')

  constructor(
    private readonly config: ShuzhouAuthConfig,
    private readonly sso: ShuzhouSsoService,
    private readonly oidc: ShuzhouOidcService,
    private readonly identity: ShuzhouIdentityService,
    private readonly jwt: JwtService,
  ) {}

  @Get('status')
  @ApiOperation({ summary: '统一登录是否可用（前端据此决定是否展示入口）' })
  status() {
    return {
      enabled: this.config.enabled,
      issuer: this.config.issuer,
      clientId: this.config.clientId,
    }
  }

  @Get('start')
  @ApiOperation({ summary: '发起统一登录，重定向到书舟认证中心' })
  start(
    @Req() req: Request,
    @Res() res: Response,
    @Query('app') app?: string,
    @Query('return_to') returnTo?: string,
  ) {
    const target = this.resolveApp(app)
    if (!this.config.enabled) {
      return res.redirect(302, this.appUrl(req, target, '/login', { sso_error: '统一登录未启用' }))
    }
    const { url } = this.sso.createAuthorizationRequest(target, this.safeReturnPath(returnTo))
    return res.redirect(302, url)
  }

  @Get('callback')
  @ApiOperation({ summary: '接收认证中心授权码，换取令牌并签发课堂会话票据' })
  async callback(
    @Req() req: Request,
    @Res() res: Response,
    @Query('code') code?: string,
    @Query('state') state?: string,
    @Query('error') error?: string,
    @Query('error_description') errorDescription?: string,
  ) {
    const transaction = state ? this.sso.consumeTransaction(state) : null
    const app = transaction?.app ?? DEFAULT_APP

    if (error) {
      return res.redirect(302, this.appUrl(req, app, '/login', { sso_error: this.describeOAuthError(error, errorDescription) }))
    }
    if (!transaction) {
      return res.redirect(302, this.appUrl(req, app, '/login', { sso_error: '登录请求已过期，请重新发起' }))
    }
    if (!code) {
      return res.redirect(302, this.appUrl(req, app, '/login', { sso_error: '认证中心未返回授权码' }))
    }

    try {
      const tokens = await this.sso.exchangeCode(code, transaction.verifier)
      await this.oidc.verifyIdToken(tokens.id_token, transaction.nonce)
      const claims = await this.oidc.verifyAccessToken(tokens.access_token)
      const user = await this.identity.resolveLocalUser(claims)

      const ticket = this.sso.issueTicket({
        accessToken: this.jwt.sign({
          sub: user.id,
          username: user.username,
          role: user.role,
          tenantId: user.tenantId,
          schoolId: user.schoolId,
          authSource: 'shuzhou',
        }),
        user: {
          id: user.id,
          name: user.name,
          role: user.role,
          avatar: user.avatar,
          tenantId: user.tenantId,
          schoolId: user.schoolId,
        },
      })

      return res.redirect(302, this.appUrl(req, app, '/oidc/callback', { ticket, return_to: transaction.returnTo }))
    } catch (err: any) {
      this.logger.warn(`统一登录换码失败：${err?.message || err}`)
      return res.redirect(302, this.appUrl(req, app, '/login', { sso_error: '统一登录失败，请重试或改用账号密码登录' }))
    }
  }

  @Post('ticket')
  @ApiOperation({ summary: '用一次性票据换取课堂会话令牌' })
  redeem(@Body() dto: RedeemTicketDto) {
    const session = this.sso.redeemTicket(dto.ticket)
    if (!session) throw new UnauthorizedException('登录票据无效或已过期')
    return session
  }

  private resolveApp(app?: string): ShuzhouAppKey {
    const normalized = String(app || '').trim()
    if (!normalized) return DEFAULT_APP
    if (!this.config.isKnownApp(normalized)) {
      throw new ServiceUnavailableException(`应用 "${normalized}" 尚未接入统一登录`)
    }
    return normalized
  }

  /** 与前端同款白名单：只允许应用内部路径，且不能落回 OIDC 自身路由造成回环 */
  private safeReturnPath(value?: string): string {
    const path = String(value || '').trim()
    if (!path.startsWith('/') || path.startsWith('//') || path.startsWith('/oidc/')) {
      return DEFAULT_RETURN_TO
    }
    return path
  }

  private appUrl(req: Request, app: ShuzhouAppKey, path: string, query: Record<string, string>): string {
    const base = this.config.appBase(app)
    const prefix = /^https?:\/\//i.test(base) ? base : `${this.publicOrigin(req)}${base}`
    const parameters = new URLSearchParams(query)
    return `${prefix}${path}?${parameters.toString()}`
  }

  private publicOrigin(req: Request): string {
    const configured = this.config.publicBaseUrl
    if (configured) return configured

    const proto = this.firstHeaderValue(req.headers['x-forwarded-proto']) || req.protocol || 'http'
    const host = this.firstHeaderValue(req.headers['x-forwarded-host']) || req.headers.host || ''
    return `${proto}://${host}`
  }

  private firstHeaderValue(value: string | string[] | undefined): string {
    const raw = Array.isArray(value) ? value[0] : value
    return String(raw || '').split(',')[0].trim()
  }

  private describeOAuthError(error: string, description?: string): string {
    if (error === 'login_required') return '统一登录状态已失效，请从智慧校园重新进入'
    if (error === 'access_denied') return '该学校尚未开通本产品或授权已到期，请联系管理员'
    return description || `授权失败：${error}`
  }
}
