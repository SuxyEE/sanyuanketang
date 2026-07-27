import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common'
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
    const patch = this.profilePatch(claims)

    const bound = await this.users.findByExternalUserId(claims.sub)
    if (bound) return this.applyPatch(bound, patch)

    // 首次登录：只在同租户/同学校内手机号唯一且该账号未绑定其他中央身份时才归并
    if (claims.phone) {
      const candidate = await this.users.findBindableByPhone(claims.phone, claims.tenantId, claims.schoolId)
      if (candidate) {
        this.logger.log(`统一登录按手机号归并到已有账号：${candidate.username}`)
        return this.applyPatch(candidate, { ...patch, externalUserId: claims.sub })
      }
    }

    const created = await this.users.create({
      ...patch,
      externalUserId: claims.sub,
      username: await this.allocateUsername(claims),
      // SSO 账号不参与本地密码登录：这里存的不是 bcrypt hash，比对必然失败
      password: `sso:${randomBytes(24).toString('hex')}`,
      isActive: true,
    })
    this.logger.log(`统一登录首次建档：${created.username}（sub=${claims.sub}）`)
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
   * 因此固定由 sub 派生，保证同一个中央身份始终得到同一个用户名。
   */
  private async allocateUsername(claims: ShuzhouClaims): Promise<string> {
    const digest = createHash('sha256').update(claims.sub).digest('hex').slice(0, 16)
    const preferred = `sso_${digest}`
    if (!(await this.users.existsByUsername(preferred))) return preferred

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const candidate = `sso_${randomBytes(8).toString('hex')}`
      if (!(await this.users.existsByUsername(candidate))) return candidate
    }
    throw new InternalServerErrorException('无法为统一登录用户分配用户名')
  }
}
