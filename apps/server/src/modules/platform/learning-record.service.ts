import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { randomUUID } from 'node:crypto'
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
const OUTBOX_LIMIT = 500
const PUSH_TIMEOUT_MS = 4000

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
export class LearningRecordService {
  private readonly logger = new Logger('LearningRecordService')
  private readonly outbox: LearningRecordOutboxItem[] = []

  constructor(
    private readonly platformConfig: PlatformConfigService,
    private readonly config: ConfigService,
  ) {}

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

    this.outbox.unshift(item)
    if (this.outbox.length > OUTBOX_LIMIT) this.outbox.pop()

    if (
      school.features.learningRecordSync &&
      school.learningRecordSink.mode === 'external-api' &&
      this.config.get<string>('LEARNING_RECORD_PUSH_ENABLED', 'false') === 'true'
    ) {
      await this.pushExternal(school, item)
    }

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

  listOutbox(filter: { tenantId?: string; schoolId?: string } = {}) {
    return this.outbox.filter(item => {
      if (filter.tenantId && item.tenantId !== filter.tenantId) return false
      if (filter.schoolId && item.schoolId !== filter.schoolId) return false
      return true
    })
  }

  private async pushExternal(
    school: ReturnType<PlatformConfigService['getSchoolConfig']>,
    item: LearningRecordOutboxItem,
  ) {
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
    } catch (err: any) {
      item.status = 'failed'
      item.lastError = err?.message || String(err)
      this.logger.warn(`Learning record push failed: ${item.lastError}`)
    } finally {
      clearTimeout(timer)
    }
  }
}
