import { Injectable, InternalServerErrorException, Logger, UnauthorizedException } from '@nestjs/common'
import { createHash, randomBytes } from 'node:crypto'
import { UserEntity } from '../../user/user.entity'
import { UserService } from '../../user/user.service'
import { ShuzhouAuthConfig } from './shuzhou-auth.config'
import { ShuzhouClaims } from './shuzhou-oidc.service'

type LocalRole = 'teacher' | 'student' | 'admin'

/** 把书舟中央身份解析成课堂本地用户，必要时首次登录建档 */
@Injectable()
export class ShuzhouIdentityService {
  private readonly logger = new Logger('ShuzhouIdentityService')

  constructor(
    private readonly users: UserService,
    private readonly config: ShuzhouAuthConfig,
  ) {}

  async resolveLocalUser(claims: ShuzhouClaims): Promise<UserEntity> {
    const membershipId = claims.membershipId
    if (!membershipId) {
      // 没有 membership 就无法区分同一个人在不同学校下的身份，宁可拒绝登录也不要建错绑定
      throw new UnauthorizedException('中央令牌缺少 membership_id，无法建立稳定的身份绑定')
    }

    const issuer = this.config.issuer
    const binding = { authIssuer: issuer, membershipId, externalUserId: claims.sub }
    const patch = this.profilePatch(claims)

    const bound = await this.users.findByMembership(issuer, membershipId)
    if (bound) return this.applyPatch(bound, { ...patch, externalUserId: claims.sub })

    // 首次登录：只在同租户且同学校内手机号唯一、且该账号未绑定中央身份时才归并
    if (claims.phone) {
      const candidate = await this.users.findBindableByPhone(claims.phone, claims.tenantId, claims.schoolId)
      if (candidate) {
        this.logger.log(`统一登录按手机号归并到已有账号：${candidate.username}`)
        return this.applyPatch(candidate, { ...patch, ...binding })
      }
    }

    const created = await this.users.create({
      ...patch,
      ...binding,
      username: await this.allocateUsername(issuer, membershipId),
      // SSO 账号不参与本地密码登录：这里存的不是 bcrypt hash，比对必然失败
      password: `sso:${randomBytes(24).toString('hex')}`,
      isActive: true,
    })
    this.logger.log(`统一登录首次建档：${created.username}（membership=${membershipId}）`)
    return created
  }

  private async applyPatch(user: UserEntity, patch: Partial<UserEntity>): Promise<UserEntity> {
    const updated = await this.users.update(user.id, patch)
    if (!updated) throw new InternalServerErrorException('统一登录用户资料更新失败')
    return updated
  }

  private profilePatch(claims: ShuzhouClaims): Partial<UserEntity> {
    const patch: Partial<UserEntity> = {
      name: claims.name || claims.preferredUsername || '书舟用户',
      role: this.normalizeRole(claims.role),
      isActive: true,
    }
    if (claims.tenantId) patch.tenantId = claims.tenantId
    if (claims.schoolId) patch.schoolId = claims.schoolId
    if (claims.phone) patch.phone = claims.phone
    if (claims.email) patch.email = claims.email
    return patch
  }

  private normalizeRole(role?: string): LocalRole {
    const raw = String(role || '').trim().toLowerCase()
    if (!raw) return this.config.defaultRole
    if (this.config.adminRoles.includes(raw)) return 'admin'
    if (this.config.teacherRoles.includes(raw)) return 'teacher'
    if (this.config.studentRoles.includes(raw)) return 'student'
    this.logger.warn(`未登记的中央角色 "${role}"，按默认角色 ${this.config.defaultRole} 处理`)
    return this.config.defaultRole
  }

  /**
   * username 是 20 位唯一列，中央的 preferred_username 既可能超长也可能撞名，
   * 因此固定由永久登录身份派生，保证同一个 membership 始终得到同一个用户名。
   */
  private async allocateUsername(issuer: string, membershipId: string): Promise<string> {
    const digest = createHash('sha256').update(`${issuer}|${membershipId}`).digest('hex').slice(0, 16)
    const preferred = `sso_${digest}`
    if (!(await this.users.existsByUsername(preferred))) return preferred

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const candidate = `sso_${randomBytes(8).toString('hex')}`
      if (!(await this.users.existsByUsername(candidate))) return candidate
    }
    throw new InternalServerErrorException('无法为统一登录用户分配用户名')
  }
}
