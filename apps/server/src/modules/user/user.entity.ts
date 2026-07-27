import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm'

@Entity('users')
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

  /** 书舟认证中心的统一身份 ID（access_token 的 sub），也用于承接合作方用户 ID */
  @Column({ length: 128, nullable: true, unique: true })
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
