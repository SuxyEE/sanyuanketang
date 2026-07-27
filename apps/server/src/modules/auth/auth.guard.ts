import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'
import { ShuzhouOidcService } from './shuzhou/shuzhou-oidc.service'

/**
 * 双令牌分流：
 *   - RS256 → 书舟认证中心签发的中央令牌，走 JWKS 验签 + claims 校验
 *   - HS256 → 课堂自签的会话令牌（含账号密码登录和统一登录换票后签发的）
 *
 * 算法只从 JWT header 读取，签名尚未验证前不信任任何 claims。
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly shuzhou: ShuzhouOidcService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest()
    const token = this.extractToken(request)
    if (!token) throw new UnauthorizedException('未提供认证令牌')

    if (this.shuzhou.tokenAlgorithm(token) === 'RS256') {
      return this.authenticateCentral(request, token)
    }

    try {
      request.user = this.jwtService.verify(token, {
        secret: this.configService.get('JWT_SECRET'),
      })
      return true
    } catch {
      throw new UnauthorizedException('认证令牌无效或已过期')
    }
  }

  private async authenticateCentral(request: any, token: string): Promise<boolean> {
    try {
      const claims = await this.shuzhou.verifyAccessToken(token)
      request.user = {
        sub: claims.sub,
        username: claims.preferredUsername,
        role: claims.role,
        tenantId: claims.tenantId,
        schoolId: claims.schoolId,
        membershipId: claims.membershipId,
        authSource: 'shuzhou',
      }
      return true
    } catch {
      throw new UnauthorizedException('统一登录令牌无效或已过期')
    }
  }

  private extractToken(request: any): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? []
    return type === 'Bearer' ? token : undefined
  }
}
