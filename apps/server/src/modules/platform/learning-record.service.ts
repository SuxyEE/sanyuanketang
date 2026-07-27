import { Injectable, Logger, OnApplicationShutdown, OnModuleInit, Optional } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { InjectRepository } from '@nestjs/typeorm'
import { randomUUID } from 'node:crypto'
import { In, IsNull, LessThan, LessThanOrEqual, Repository } from 'typeorm'
import { LearningRecordOutboxEntity } from './learning-record-outbox.entity'
import { PlatformConfigService } from './platform-config.service'
import { ClassroomPlatformContext } from './platform.types'

/**
 * 第一批课堂标准事件。事件名带版本号，语义变更时新增 .v2，
 * 不在原字段上偷偷改含义，消费者才能按版本决定是否升级。
 */
export const CLASSROOM_EVENTS = {
  lessonStarted: 'classroom.lesson.started.v1',
  attendanceCompleted: 'classroom.attendance.completed.v1',
  activityPublished: 'classroom.activity.published.v1',
  activityCompleted: 'classroom.activity.completed.v1',
  studentMasteryUpdated: 'classroom.student.mastery.updated.v1',
  questionUsage: 'classroom.question.usage.v1',
  lessonEnded: 'classroom.lesson.ended.v1',
  reportReady: 'classroom.report.ready.v1',
} as const

export type ClassroomEventType = (typeof CLASSROOM_EVENTS)[keyof typeof CLASSROOM_EVENTS]

const SCHEMA_VERSION = 1
const DEFAULT_PRODUCER = 'sanyuan-classroom'
/** 仅在没有数据库的演示模式下生效：内存 outbox 的条数上限 */
const MEMORY_OUTBOX_LIMIT = 500
const PUSH_TIMEOUT_MS = 4000
const DEFAULT_MAX_ATTEMPTS = 8
const DEFAULT_RETRY_INTERVAL_MS = 60_000
const RETRY_BATCH_SIZE = 50
/** 退避上限 30 分钟，避免长时间故障后堆积的事件在恢复瞬间打爆下游 */
const MAX_BACKOFF_MS = 30 * 60 * 1000

export interface LearningRecordActor {
  issuer?: string
  membershipId?: string
  role?: string
}

/** 产品内部的调用入参，驼峰；对外发出的信封是 snake_case */
export interface LearningRecordInput {
  tenantId?: string
  schoolId?: string
  producer?: string
  eventType: ClassroomEventType | string
  occurredAt?: string
  traceId?: string
  lessonSessionId?: string
  classId?: string
  subject?: string
  actor?: LearningRecordActor
  payload: Record<string, any>
}

/**
 * 标准事件信封，字段名是跨产品的对外契约，保持 snake_case。
 * 消费者以 event_id 做幂等；trace_id 只用于链路排查，两者不能混用。
 */
export interface LearningRecordEnvelope {
  event_id: string
  event_type: string
  schema_version: number
  occurred_at: string
  producer: string
  trace_id?: string
  tenant_id: string
  school_id: string
  lesson_session_id?: string
  class_id?: string
  subject?: string
  actor?: {
    issuer?: string
    membership_id?: string
    role?: string
  }
  payload: Record<string, any>
}

export interface LearningRecordOutboxItem {
  id: string
  tenantId: string
  schoolId: string
  eventType: string
  occurredAt: string
  status: 'queued' | 'sent' | 'failed'
  attempts: number
  lastError?: string
  envelope: LearningRecordEnvelope
}

@Injectable()
export class LearningRecordService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger('LearningRecordService')
  /** 没配数据库的演示模式下的降级存储，重启即丢；生产走 repo */
  private readonly memoryOutbox: LearningRecordOutboxItem[] = []
  private retryTimer: NodeJS.Timeout | null = null
  private dispatching = false

  constructor(
    private readonly platformConfig: PlatformConfigService,
    private readonly config: ConfigService,
    @Optional()
    @InjectRepository(LearningRecordOutboxEntity)
    private readonly repo?: Repository<LearningRecordOutboxEntity>,
  ) {}

  onModuleInit() {
    if (!this.repo) {
      this.logger.warn('未配置数据库，学情 outbox 降级为进程内存，重启会丢失')
      return
    }
    if (!this.pushEnabled) return

    const interval = this.readNumber('LEARNING_RECORD_RETRY_INTERVAL_MS', DEFAULT_RETRY_INTERVAL_MS)
    this.retryTimer = setInterval(() => void this.dispatchPending(), interval)
    // 不要因为这个定时器把进程钉住不退出
    this.retryTimer.unref?.()
    this.logger.log(`学情回流重试任务已启动，间隔 ${interval}ms，最多重试 ${this.maxAttempts} 次`)
  }

  onApplicationShutdown() {
    if (!this.retryTimer) return
    clearInterval(this.retryTimer)
    this.retryTimer = null
  }

  async record(input: LearningRecordInput): Promise<LearningRecordOutboxItem> {
    const school = this.platformConfig.getSchoolConfig(input.schoolId, input.tenantId)
    const tenantId = String(input.tenantId || school.tenantId).trim()
    const schoolId = String(input.schoolId || school.schoolId).trim()

    const envelope: LearningRecordEnvelope = {
      event_id: randomUUID(),
      event_type: input.eventType,
      schema_version: SCHEMA_VERSION,
      occurred_at: input.occurredAt || new Date().toISOString(),
      producer: input.producer || DEFAULT_PRODUCER,
      tenant_id: tenantId,
      school_id: schoolId,
      payload: input.payload || {},
    }
    if (input.traceId) envelope.trace_id = input.traceId
    if (input.lessonSessionId) envelope.lesson_session_id = input.lessonSessionId
    if (input.classId) envelope.class_id = input.classId
    if (input.subject) envelope.subject = input.subject
    if (input.actor) {
      envelope.actor = {
        issuer: input.actor.issuer,
        membership_id: input.actor.membershipId,
        role: input.actor.role,
      }
    }

    const item: LearningRecordOutboxItem = {
      id: envelope.event_id,
      tenantId,
      schoolId,
      eventType: envelope.event_type,
      occurredAt: envelope.occurred_at,
      status: 'queued',
      attempts: 0,
      envelope,
    }

    if (this.repo) {
      await this.repo.save(
        this.repo.create({
          id: item.id,
          tenantId: item.tenantId,
          schoolId: item.schoolId,
          productCode: envelope.producer,
          eventType: item.eventType,
          occurredAt: new Date(item.occurredAt),
          status: 'queued',
          attempts: 0,
          nextAttemptAt: null,
          lastError: null,
          envelope,
        }),
      )
    } else {
      this.memoryOutbox.unshift(item)
      if (this.memoryOutbox.length > MEMORY_OUTBOX_LIMIT) this.memoryOutbox.pop()
    }

    // 先落库再投递：投递失败也不会丢事件，交给重试任务
    if (this.shouldPush(school)) await this.deliver(school, item)

    return item
  }

  async recordLessonEnded(context: ClassroomPlatformContext, snapshot: Record<string, any>) {
    return this.record({
      tenantId: context.tenantId,
      schoolId: context.schoolId,
      eventType: CLASSROOM_EVENTS.lessonEnded,
      occurredAt: new Date().toISOString(),
      lessonSessionId: snapshot.lessonId,
      classId: context.classId,
      subject: context.subject,
      payload: {
        context,
        snapshot,
      },
    })
  }

  async listOutbox(filter: { tenantId?: string; schoolId?: string } = {}): Promise<LearningRecordOutboxItem[]> {
    if (!this.repo) {
      return this.memoryOutbox.filter(item => {
        if (filter.tenantId && item.tenantId !== filter.tenantId) return false
        if (filter.schoolId && item.schoolId !== filter.schoolId) return false
        return true
      })
    }

    const where: Record<string, unknown> = {}
    if (filter.tenantId) where.tenantId = filter.tenantId
    if (filter.schoolId) where.schoolId = filter.schoolId
    const rows = await this.repo.find({ where, order: { occurredAt: 'DESC' }, take: 200 })
    return rows.map(row => this.toItem(row))
  }

  /** 捞出到点可重试的事件重新投递；重试次数用尽的不再捞，留在库里等人工排查 */
  private async dispatchPending(): Promise<void> {
    if (!this.repo || this.dispatching || !this.pushEnabled) return
    this.dispatching = true
    try {
      const pending: Array<'queued' | 'failed'> = ['queued', 'failed']
      const attempts = LessThan(this.maxAttempts)
      const rows = await this.repo.find({
        where: [
          { status: In(pending), attempts, nextAttemptAt: IsNull() },
          { status: In(pending), attempts, nextAttemptAt: LessThanOrEqual(new Date()) },
        ],
        order: { occurredAt: 'ASC' },
        take: RETRY_BATCH_SIZE,
      })
      if (rows.length === 0) return

      let sent = 0
      for (const row of rows) {
        const school = this.platformConfig.getSchoolConfig(row.schoolId, row.tenantId)
        if (!this.shouldPush(school)) continue
        const item = this.toItem(row)
        await this.deliver(school, item)
        if (item.status === 'sent') sent += 1
      }
      this.logger.log(`学情回流重试：处理 ${rows.length} 条，成功 ${sent} 条`)
    } catch (err: any) {
      this.logger.warn(`学情回流重试任务出错：${err?.message || err}`)
    } finally {
      this.dispatching = false
    }
  }

  private async deliver(
    school: ReturnType<PlatformConfigService['getSchoolConfig']>,
    item: LearningRecordOutboxItem,
  ): Promise<void> {
    const endpoint = school.learningRecordSink.endpoint
    if (!endpoint) return
    const tokenEnv = school.learningRecordSink.tokenEnv
    const token = tokenEnv ? this.config.get<string>(tokenEnv, '') : ''
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), PUSH_TIMEOUT_MS)

    item.attempts += 1
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-tenant-id': item.tenantId,
          'x-school-id': item.schoolId,
          'x-event-id': item.id,
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(item.envelope),
        signal: controller.signal,
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      item.status = 'sent'
      item.lastError = undefined
      await this.persistStatus(item, null)
    } catch (err: any) {
      item.status = 'failed'
      item.lastError = err?.message || String(err)
      await this.persistStatus(item, this.nextAttemptAt(item.attempts))
      const exhausted = item.attempts >= this.maxAttempts
      const suffix = exhausted ? '，重试次数已用尽，需人工排查' : ''
      this.logger.warn(`学情回流投递失败 ${item.id}（第 ${item.attempts} 次）：${item.lastError}${suffix}`)
    } finally {
      clearTimeout(timer)
    }
  }

  private async persistStatus(item: LearningRecordOutboxItem, nextAttemptAt: Date | null): Promise<void> {
    if (!this.repo) return
    await this.repo.update(item.id, {
      status: item.status,
      attempts: item.attempts,
      lastError: item.lastError ?? null,
      nextAttemptAt,
    })
  }

  private toItem(row: LearningRecordOutboxEntity): LearningRecordOutboxItem {
    return {
      id: row.id,
      tenantId: row.tenantId,
      schoolId: row.schoolId,
      eventType: row.eventType,
      occurredAt: row.occurredAt instanceof Date ? row.occurredAt.toISOString() : String(row.occurredAt),
      status: row.status,
      attempts: row.attempts,
      lastError: row.lastError ?? undefined,
      envelope: row.envelope as LearningRecordEnvelope,
    }
  }

  private shouldPush(school: ReturnType<PlatformConfigService['getSchoolConfig']>): boolean {
    return (
      school.features.learningRecordSync &&
      school.learningRecordSink.mode === 'external-api' &&
      this.pushEnabled
    )
  }

  /** 指数退避，上限 30 分钟 */
  private nextAttemptAt(attempts: number): Date {
    return new Date(Date.now() + Math.min(2 ** attempts * 30_000, MAX_BACKOFF_MS))
  }

  private get pushEnabled(): boolean {
    return this.config.get<string>('LEARNING_RECORD_PUSH_ENABLED', 'false') === 'true'
  }

  private get maxAttempts(): number {
    return this.readNumber('LEARNING_RECORD_MAX_ATTEMPTS', DEFAULT_MAX_ATTEMPTS)
  }

  private readNumber(key: string, fallback: number): number {
    const value = Number(this.config.get<string>(key, String(fallback)))
    return Number.isFinite(value) && value > 0 ? value : fallback
  }
}
