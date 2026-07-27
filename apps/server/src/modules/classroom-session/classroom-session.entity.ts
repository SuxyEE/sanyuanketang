import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm'

/**
 * 一次开课的运行实例。
 *
 * 与 `lessons` 的区别：`lessons` 是排好的课次（计划），一个课次可以被开多次；
 * 本表记的是「真实跑起来的那一场」，到课率、时长、进出记录都挂在这上面。
 */
@Entity('classroom_sessions')
@Index('idx_session_room_status', ['roomId', 'status'])
@Index('idx_session_school_time', ['tenantId', 'schoolId', 'startedAt'])
export class ClassroomSessionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string

  /** 网关的房间码（6 位），不是 lessons.id */
  @Column({ length: 64 })
  roomId: string

  @Column({ length: 64, nullable: true })
  tenantId: string

  @Column({ length: 64, nullable: true })
  schoolId: string

  @Column({ length: 64, nullable: true })
  classId: string

  @Column({ length: 100, nullable: true })
  className: string

  @Column({ length: 100, nullable: true })
  subject: string

  @Column({ length: 200, nullable: true })
  courseName: string

  @Column({ length: 200, nullable: true })
  lessonTitle: string

  @Column({ type: 'datetime' })
  startedAt: Date

  @Column({ type: 'datetime', nullable: true })
  endedAt: Date | null

  @Column({ length: 32, default: 'ongoing' })
  status: 'ongoing' | 'ended'

  /** 全场在线人数峰值，用于到课率的分母参考 */
  @Column({ default: 0 })
  memberPeak: number

  @Column({ default: 0 })
  studentPeak: number

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
