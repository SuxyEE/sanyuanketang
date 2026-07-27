import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Unique } from 'typeorm'

/**
 * 一次作答。
 *
 * 以 (taskId, studentId) 唯一：断线重连或客户端重发都只更新同一行，
 * 否则同一个学生会被算成多次提交，提交率和平均分都会失真。
 */
@Entity('task_submissions')
// 唯一索引以 taskId 打头，按 taskId 查也走它，不再另建索引
@Unique('uq_task_submission', ['taskId', 'studentId'])
export class TaskSubmissionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column()
  taskId: string

  @Column()
  studentId: string

  @Column({ length: 100, nullable: true })
  studentName: string

  @Column({ length: 64, nullable: true })
  tenantId: string

  @Column({ length: 64, nullable: true })
  schoolId: string

  @Column({ type: 'json' })
  answers: Record<string, any>

  /** 单题得分明细，7.3 的正确率、区分度、选项分布都要靠它重算 */
  @Column({ type: 'json', nullable: true })
  perQuestion: Record<string, any>

  @Column({ type: 'float', nullable: true })
  score: number

  @Column({ type: 'text', nullable: true })
  aiComment: string

  @CreateDateColumn()
  submittedAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
