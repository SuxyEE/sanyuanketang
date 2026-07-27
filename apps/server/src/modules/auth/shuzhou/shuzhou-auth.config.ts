import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

/** 允许经统一登录进入的前端应用；新增一端时在此登记回跳地址即可 */
export const SHUZHOU_APPS = ['admin'] as const
export type ShuzhouAppKey = (typeof SHUZHOU_APPS)[number]

@Injectable()
export class ShuzhouAuthConfig {
  constructor(private readonly config: ConfigService) {}

  /** 未显式打开时，统一登录端点一律返回 503，避免半配置状态下把用户引到认证中心 */
  get enabled(): boolean {
    return this.read('SHUZHOU_AUTH_ENABLED', 'false') === 'true' && !!this.redirectUri
  }

  get issuer(): string {
    return this.read('SHUZHOU_AUTH_ISSUER', 'https://auth.longdao.top').replace(/\/+$/, '')
  }

  get clientId(): string {
    return this.read('SHUZHOU_AUTH_CLIENT_ID', 'shuzhou-classroom')
  }

  /** public client 留空即可；登记为 confidential 时用 client_secret_post 提交 */
  get clientSecret(): string {
    return this.read('SHUZHOU_AUTH_CLIENT_SECRET', '')
  }

  get scope(): string {
    return this.read('SHUZHOU_AUTH_SCOPE', 'openid profile campus')
  }

  /** 必须与认证中心 iam_client.redirect_uris 逐字符一致，认证中心是精确匹配 */
  get redirectUri(): string {
    return this.read('SHUZHOU_AUTH_REDIRECT_URI', '')
  }

  get defaultRole(): 'teacher' | 'student' | 'admin' {
    const raw = this.read('SHUZHOU_AUTH_DEFAULT_ROLE', 'teacher')
    return raw === 'admin' || raw === 'student' ? raw : 'teacher'
  }

  /**
   * 中央 role claim 到课堂本地角色的映射白名单。
   * 只有显式登记的取值才会拿到对应角色，未登记的一律落到 defaultRole，
   * 避免认证中心新增一个名字里带 admin 的角色就白拿管理后台权限。
   */
  get adminRoles(): string[] {
    return this.readList('SHUZHOU_AUTH_ADMIN_ROLES', 'sys_admin,platform_admin,school_admin,admin')
  }

  get teacherRoles(): string[] {
    return this.readList('SHUZHOU_AUTH_TEACHER_ROLES', 'teacher,edu_teacher,school_teacher')
  }

  get studentRoles(): string[] {
    return this.readList('SHUZHOU_AUTH_STUDENT_ROLES', 'student,edu_student')
  }

  /** 反代场景下 X-Forwarded-* 不可靠时的兜底公网地址 */
  get publicBaseUrl(): string {
    return this.read('PUBLIC_BASE_URL', '').replace(/\/+$/, '')
  }

  get authorizeEndpoint(): string {
    return `${this.issuer}/oauth/authorize`
  }

  get tokenEndpoint(): string {
    return `${this.issuer}/oauth/token`
  }

  get jwksEndpoint(): string {
    return `${this.issuer}/oauth/jwks`
  }

  isKnownApp(app: string): app is ShuzhouAppKey {
    return (SHUZHOU_APPS as readonly string[]).includes(app)
  }

  /** 前端部署位置：绝对 URL（本地联调）或以 / 开头的同源子路径（线上 nginx 子路径部署） */
  appBase(app: ShuzhouAppKey): string {
    if (app === 'admin') return this.read('SHUZHOU_AUTH_ADMIN_BASE', '/admin').replace(/\/+$/, '')
    return ''
  }

  private read(key: string, fallback: string): string {
    const value = this.config.get<string>(key)
    const text = String(value ?? '').trim()
    return text || fallback
  }

  private readList(key: string, fallback: string): string[] {
    return this.read(key, fallback)
      .split(',')
      .map(item => item.trim().toLowerCase())
      .filter(Boolean)
  }
}
