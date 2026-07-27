import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm'

@Entity('users')
// 永久登录身份是 (issuer, membershipId)：同一自然人在不同学校是不同的 membership，
// 按 sub 绑定会把跨校任课的老师并成一个账号。
@Index('uk_users_membership', ['authIssuer', 'membershipId'], { unique: true })
export class UserEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ length: 50 })
  name: string

  @Column({ length: 20, unique: true })
  username: string

  @Column({ select: false })
  password: string

  @Column({ type: 'enum', enum: ['teacher', 'student', 'admin'] })
  role: 'teacher' | 'student' | 'admin'

  @Column({ length: 30, nullable: true })
  studentNo: string

  @Column({ nullable: true })
  classId: string

  @Column({ nullable: true })
  avatar: string

  @Column({ length: 50, nullable: true })
  department: string

  @Column({ length: 64, nullable: true })
  tenantId: string

  @Column({ length: 64, nullable: true })
  schoolId: string

  /** 签发中央身份的认证中心，与 membershipId 一起构成永久登录身份 */
  @Column({ length: 255, nullable: true })
  authIssuer: string

  /** iam_membership.membership_id：用户在某租户/学校下的身份，跨校任课会有多个 */
  @Column({ length: 128, nullable: true })
  membershipId: string

  /** 中央统一身份 ID（access_token 的 sub），同一自然人跨校时相同，只作追溯参考 */
  @Column({ length: 128, nullable: true })
  externalUserId: string

  @Column({ length: 32, nullable: true })
  phone: string

  @Column({ length: 128, nullable: true })
  email: string

  @Column({ default: true })
  isActive: boolean

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
