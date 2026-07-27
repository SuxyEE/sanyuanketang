import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as crypto from 'node:crypto'

@Injectable()
export class InternalPlatformGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = String(this.config.get<string>('PLATFORM_INTERNAL_TOKEN', '') || '').trim()
    if (!expected) return true

    const request = context.switchToHttp().getRequest()
    const raw =
      request.headers['x-platform-token'] ||
      request.headers['X-Platform-Token'] ||
      request.headers['x-internal-token']
    const provided = Array.isArray(raw) ? raw[0] : String(raw || '')

    if (!this.safeEqual(provided, expected)) {
      throw new UnauthorizedException('平台内部令牌无效')
    }
    return true
  }

  private safeEqual(a: string, b: string): boolean {
    const left = Buffer.from(a, 'utf8')
    const right = Buffer.from(b, 'utf8')
    if (left.length !== right.length) return false
    return crypto.timingSafeEqual(left, right)
  }
}
