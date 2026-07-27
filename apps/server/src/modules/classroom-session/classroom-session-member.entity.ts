import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from 'typeorm'

/**
 * 课堂名单与进出记录。
 *
 * 以 (sessionId, userId) 唯一：断线重连、多端登录都只更新同一行，
 * 不会因为重复 join 产生多条记录，也就不会把到课率算高。
 */
@Entity('classroom_session_members')
// 唯一索引以 sessionId 打头，按会话查名单也走它，不再另建索引
@Unique('uq_session_member', ['sessionId', 'userId'])
export class ClassroomSessionMemberEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column()
  sessionId: string

  @Column({ length: 64 })
  userId: string

  @Column({ length: 100, nullable: true })
  userName: string

  @Column({ length: 20 })
  role: string

  @Column({ length: 40, nullable: true })
  clientType: string

  @Column({ length: 64, nullable: true })
  tenantId: string

  @Column({ length: 64, nullable: true })
  schoolId: string

  @Column({ length: 64, nullable: true })
  classId: string

  @Column({ length: 128, nullable: true })
  externalUserId: string

  @Column({ type: 'datetime' })
  firstJoinedAt: Date

  @Column({ type: 'datetime' })
  lastJoinedAt: Date

  @Column({ type: 'datetime', nullable: true })
  lastLeftAt: Date | null

  /** 进入次数，多次说明中途掉线过 */
  @Column({ default: 1 })
  joinCount: number

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
