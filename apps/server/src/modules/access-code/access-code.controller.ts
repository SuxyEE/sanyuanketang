import { Body, Controller, Get, Post, Req, Res, HttpCode } from '@nestjs/common'
import { ApiTags, ApiOperation } from '@nestjs/swagger'
import type { Request, Response } from 'express'
import { AccessCodeService } from './access-code.service'

/**
 * 站点级访问密码控制器：
 *   GET  /api/v1/access-code/status     是否启用 + 当前 cookie 是否有效
 *   POST /api/v1/access-code/verify     提交密码 → 颁发 cookie
 *   POST /api/v1/access-code/logout     清除 cookie
 *
 * 前端流程：
 *   1) 进入页面，先打 status 接口
 *   2) enabled=true && authed=false → 弹窗让用户输入密码
 *   3) verify 成功 → 服务端 set-cookie → 后续 API 自动带上
 */
@ApiTags('AccessCode')
@Controller('access-code')
export class AccessCodeController {
  constructor(private readonly svc: AccessCodeService) {}

  @Get('status')
  @ApiOperation({ summary: '查询站点保护状态与当前 cookie/header 是否有效' })
  status(@Req() req: Request) {
    const enabled = this.svc.isEnabled()
    const cookieToken = (req as any).cookies?.[this.svc.cookieName] as string | undefined
    const authHeader = (req.headers['authorization'] || req.headers['Authorization']) as string | undefined
    const headerToken =
      authHeader && authHeader.startsWith('AccessCode ') ? authHeader.slice(11).trim() : undefined
    const authed = enabled
      ? this.svc.verifyToken(cookieToken) || this.svc.verifyToken(headerToken)
      : true
    return { success: true, data: { enabled, authed } }
  }

  @Post('verify')
  @HttpCode(200)
  @ApiOperation({ summary: '提交密码 → 颁发 HMAC cookie + 返回 token（header 备选）' })
  verify(@Body() body: { password?: string }, @Res({ passthrough: true }) res: Response) {
    if (!this.svc.isEnabled()) {
      return { success: true, data: { authed: true, token: null } }
    }
    const ok = this.svc.verifyPassword(body?.password)
    if (!ok) {
      return { success: false, errorCode: 'INVALID_ACCESS_CODE', error: '访问密码错误' }
    }
    const token = this.svc.issueToken()
    res.cookie(this.svc.cookieName, token, this.svc.cookieOptions())
    // 同时返回 token，前端可存 localStorage 后用 `Authorization: AccessCode <token>`
    // 跨域开发场景下 cookie 可能不被发送（同源限制），header 是兜底方案
    return { success: true, data: { authed: true, token } }
  }

  @Post('logout')
  @HttpCode(200)
  @ApiOperation({ summary: '清除访问 cookie' })
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(this.svc.cookieName, { path: '/' })
    return { success: true }
  }
}
