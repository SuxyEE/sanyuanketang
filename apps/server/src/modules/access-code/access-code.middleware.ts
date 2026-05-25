import { Injectable, NestMiddleware } from '@nestjs/common'
import type { Request, Response, NextFunction } from 'express'
import { AccessCodeService } from './access-code.service'

/**
 * 拦截需要保护的 API：
 *   - 总是放行 /api/v1/access-code/*（要不然没法登录）
 *   - 总是放行 /api/v1/health（健康检查通常需要无密码）
 *   - 其余 API 路径 → 校验 cookie 的 HMAC token
 *
 * Socket.IO 鉴权另有机制（暂不挂载），本中间件只覆盖 HTTP REST 路径。
 *
 * 若 ACCESS_CODE 未配置 → svc.isEnabled() === false → 直接放行
 */
@Injectable()
export class AccessCodeMiddleware implements NestMiddleware {
  constructor(private readonly svc: AccessCodeService) {}

  use(req: Request, res: Response, next: NextFunction) {
    if (!this.svc.isEnabled()) return next()

    const url = (req.originalUrl || req.url || '').split('?')[0]

    if (
      url.startsWith('/api/v1/access-code/') ||
      url === '/api/v1/health' ||
      url === '/api/v1/access-code/status'
    ) {
      return next()
    }

    const cookieToken = (req as any).cookies?.[this.svc.cookieName] as string | undefined

    // Authorization: AccessCode <token>  （跨域开发兜底）
    const authHeader = (req.headers['authorization'] || req.headers['Authorization']) as
      | string
      | undefined
    const headerToken =
      authHeader && authHeader.startsWith('AccessCode ') ? authHeader.slice(11).trim() : undefined

    if (
      (cookieToken && this.svc.verifyToken(cookieToken)) ||
      (headerToken && this.svc.verifyToken(headerToken))
    ) {
      return next()
    }

    return res.status(401).json({
      success: false,
      errorCode: 'ACCESS_CODE_REQUIRED',
      error: '需要先在登录浮层输入站点访问密码',
    })
  }
}
