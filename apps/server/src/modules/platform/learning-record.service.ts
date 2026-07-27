import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PlatformConfigService } from './platform-config.service'
import { ClassroomPlatformContext } from './platform.types'

export interface LearningRecordPayload {
  tenantId?: string
  schoolId?: string
  productCode?: 'sanyuan-classroom' | string
  eventType: 'lesson_started' | 'lesson_ended' | 'quiz_report' | 'attendance_report' | 'student_activity' | string
  occurredAt?: string
  traceId?: string
  lessonId?: string
  classId?: string
  subject?: string
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
  payload: LearningRecordPayload
}

@Injectable()
export class LearningRecordService {
  private readonly logger = new Logger('LearningRecordService')
  private readonly outbox: LearningRecordOutboxItem[] = []

  constructor(
    private readonly platformConfig: PlatformConfigService,
    private readonly config: ConfigService,
  ) {}

  async record(payload: LearningRecordPayload): Promise<LearningRecordOutboxItem> {
    const school = this.platformConfig.getSchoolConfig(payload.schoolId, payload.tenantId)
    const item: LearningRecordOutboxItem = {
      id: payload.traceId || this.newId(),
      tenantId: school.tenantId,
      schoolId: school.schoolId,
      eventType: payload.eventType,
      occurredAt: payload.occurredAt || new Date().toISOString(),
      status: 'queued',
      attempts: 0,
      payload: {
        ...payload,
        tenantId: school.tenantId,
        schoolId: school.schoolId,
        productCode: payload.productCode || 'sanyuan-classroom',
      },
    }

    this.outbox.unshift(item)
    if (this.outbox.length > 500) this.outbox.pop()

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
      eventType: 'lesson_ended',
      occurredAt: new Date().toISOString(),
      lessonId: snapshot.lessonId,
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
    const timer = setTimeout(() => controller.abort(), 4000)

    item.attempts += 1
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-tenant-id': school.tenantId,
          'x-school-id': school.schoolId,
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(item.payload),
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

  private newId() {
    return `lr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
  }
}
