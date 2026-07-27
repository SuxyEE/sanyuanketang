import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import * as bcrypt from 'bcryptjs'
import { UserEntity } from './user.entity'

@Injectable()
export class UserService implements OnModuleInit {
  private readonly logger = new Logger('UserService')

  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    private readonly config: ConfigService,
  ) {}

  /**
   * 首次启动引导：若 users 表完全没数据，自动创建一个默认管理员。
   * - 用户名 / 密码 来自 env `BOOTSTRAP_ADMIN_USERNAME` / `BOOTSTRAP_ADMIN_PASSWORD`，
   *   分别默认 `admin` / `admin`
   * - 关闭此行为：env `BOOTSTRAP_ADMIN=false`
   * 仅在 DB 真正连接时才会触发（DatabaseModule 没启用时 UserService 根本不会被实例化）。
   */
  async onModuleInit() {
    if (this.config.get<string>('BOOTSTRAP_ADMIN', 'true') !== 'true') return
    try {
      const total = await this.userRepo.count()
      if (total > 0) return
      const username = this.config.get<string>('BOOTSTRAP_ADMIN_USERNAME', 'admin')
      const rawPwd = this.config.get<string>('BOOTSTRAP_ADMIN_PASSWORD', 'admin')
      const hash = await bcrypt.hash(rawPwd, 10)
      const admin = this.userRepo.create({
        username,
        name: '系统管理员',
        password: hash,
        role: 'admin',
        isActive: true,
      })
      await this.userRepo.save(admin)
      this.logger.warn(
        `Bootstrapped default admin user: ${username} / ${rawPwd}  ← 生产环境务必修改！`,
      )
    } catch (err: any) {
      // DB 未就绪 / synchronize=false 还没建表等都会抛错，仅记录不阻断启动
      this.logger.warn(`Admin bootstrap skipped: ${err?.message || err}`)
    }
  }

  async findById(id: string) {
    return this.userRepo.findOneBy({ id })
  }

  async findByUsername(username: string) {
    return this.userRepo.findOne({
      where: { username },
      select: ['id', 'name', 'username', 'password', 'role', 'studentNo', 'classId', 'avatar'],
    })
  }

  /** 按书舟统一身份 ID 查已绑定用户 */
  async findByExternalUserId(externalUserId: string) {
    if (!externalUserId) return null
    return this.userRepo.findOneBy({ externalUserId })
  }

  /**
   * 首次统一登录时的手机号归并候选：
   * 只有在同一租户/学校范围内手机号唯一、且该账号尚未绑定其他中央身份时才可用，
   * 否则宁可新建账号，也不要把两个人并成一个。
   */
  async findBindableByPhone(phone: string, tenantId?: string, schoolId?: string) {
    if (!phone) return null
    const where: Record<string, unknown> = { phone }
    if (tenantId) where.tenantId = tenantId
    if (schoolId) where.schoolId = schoolId
    const matched = await this.userRepo.find({ where, take: 2 })
    if (matched.length !== 1) return null
    return matched[0].externalUserId ? null : matched[0]
  }

  async existsByUsername(username: string) {
    return (await this.userRepo.count({ where: { username } })) > 0
  }

  async findAll(role?: string) {
    const where: any = {}
    if (role) where.role = role
    return this.userRepo.find({ where, order: { createdAt: 'DESC' } })
  }

  async create(data: Partial<UserEntity>) {
    const user = this.userRepo.create(data)
    return this.userRepo.save(user)
  }

  async update(id: string, data: Partial<UserEntity>) {
    await this.userRepo.update(id, data)
    return this.findById(id)
  }

  async findStudentsByClassId(classId: string) {
    return this.userRepo.find({
      where: { classId, role: 'student' },
      order: { studentNo: 'ASC' },
    })
  }
}
