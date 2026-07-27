import { Column, CreateDateColumn, Entity, Index, PrimaryColumn, UpdateDateColumn } from 'typeorm'

/**
 * 学情回流 outbox。
 *
 * 课堂事务提交成功后才写这里，再由后台任务推给下游；下游按 id（= 信封的 event_id）做幂等。
 * 列名沿用库内既有的驼峰风格，与 TypeORM 默认命名策略一致。
 */
@Entity('platform_learning_record_outbox')
@Index('idx_outbox_dispatch', ['status', 'nextAttemptAt'])
@Index('idx_outbox_school', ['tenantId', 'schoolId', 'occurredAt'])
export class LearningRecordOutboxEntity {
  /** 与信封的 event_id 同值 */
  @PrimaryColumn({ length: 64 })
  id: string

  @Column({ length: 64 })
  tenantId: string

  @Column({ length: 64 })
  schoolId: string

  @Column({ length: 64, default: 'sanyuan-classroom' })
  productCode: string

  @Column({ length: 64 })
  eventType: string

  @Column({ type: 'datetime' })
  occurredAt: Date

  @Column({ length: 32, default: 'queued' })
  status: 'queued' | 'sent' | 'failed'

  @Column({ default: 0 })
  attempts: number

  /** 下次可重试时间，退避用；为空表示可立即投递 */
  @Column({ type: 'datetime', nullable: true })
  nextAttemptAt: Date | null

  @Column({ length: 1000, nullable: true })
  lastError: string | null

  @Column({ type: 'json' })
  envelope: Record<string, any>

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
