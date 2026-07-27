import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { IsNull, Repository } from 'typeorm'
import { ClassroomSessionMemberEntity } from './classroom-session-member.entity'
import { ClassroomSessionEntity } from './classroom-session.entity'

export interface SessionContextInput {
  tenantId?: string
  schoolId?: string
  classId?: string
  className?: string
  subject?: string
}

export interface SessionMemberInput {
  userId: string
  userName?: string
  role: string
  clientType?: string
  tenantId?: string
  schoolId?: string
  classId?: string
  externalUserId?: string
}

/**
 * 课堂会话与名单的持久化。
 *
 * 这一层是「只加写入」：网关调用全部 fire-and-forget，任何失败只记日志，
 * 绝不能因为写库出错影响正在上的课。
 */
@Injectable()
export class ClassroomSessionService {
  private readonly logger = new Logger('ClassroomSessionService')

  constructor(
    @InjectRepository(ClassroomSessionEntity)
    private readonly sessions: Repository<ClassroomSessionEntity>,
    @InjectRepository(ClassroomSessionMemberEntity)
    private readonly members: Repository<ClassroomSessionMemberEntity>,
  ) {}

  /**
   * 开课。`reset` 为真表示这是全新一场，先把上一场收尾再开新的，
   * 否则同一个房间反复开课会把数据混在一起。
   */
  async startSession(
    roomId: string,
    context: SessionContextInput,
    meta: { courseName?: string; lessonTitle?: string; startedAt?: string },
    options: { reset: boolean },
  ): Promise<ClassroomSessionEntity | null> {
    const current = await this.findOngoing(roomId)

    if (current && options.reset) {
      await this.sessions.update(current.id, { status: 'ended', endedAt: new Date() })
    } else if (current) {
      await this.sessions.update(current.id, {
        ...this.contextPatch(context),
        courseName: meta.courseName || current.courseName,
        lessonTitle: meta.lessonTitle || current.lessonTitle,
      })
      return this.sessions.findOneBy({ id: current.id })
    }

    return this.sessions.save(
      this.sessions.create({
        roomId,
        ...this.contextPatch(context),
        courseName: meta.courseName,
        lessonTitle: meta.lessonTitle,
        startedAt: meta.startedAt ? new Date(meta.startedAt) : new Date(),
        status: 'ongoing',
      }),
    )
  }

  /** 大屏和教师会在 lesson:start 之前就 join，所以这里要能自己把会话建起来 */
  async recordJoin(roomId: string, context: SessionContextInput, member: SessionMemberInput): Promise<void> {
    if (!member.userId) return
    const session = (await this.findOngoing(roomId)) ?? (await this.createBareSession(roomId, context))
    if (!session) return

    const now = new Date()
    const existing = await this.members.findOneBy({ sessionId: session.id, userId: member.userId })
    if (existing) {
      await this.members.update(existing.id, {
        userName: member.userName || existing.userName,
        role: member.role || existing.role,
        clientType: member.clientType || existing.clientType,
        lastJoinedAt: now,
        joinCount: existing.joinCount + 1,
      })
    } else {
      await this.members.save(
        this.members.create({
          sessionId: session.id,
          userId: member.userId,
          userName: member.userName,
          role: member.role,
          clientType: member.clientType,
          tenantId: member.tenantId,
          schoolId: member.schoolId,
          classId: member.classId,
          externalUserId: member.externalUserId,
          firstJoinedAt: now,
          lastJoinedAt: now,
          joinCount: 1,
        }),
      )
    }

    await this.refreshPeaks(session.id)
  }

  async recordLeave(roomId: string, userId: string): Promise<void> {
    if (!userId) return
    const session = await this.findOngoing(roomId)
    if (!session) return
    await this.members.update({ sessionId: session.id, userId }, { lastLeftAt: new Date() })
  }

  async closeSession(roomId: string, endedAt = new Date()): Promise<void> {
    const session = await this.findOngoing(roomId)
    if (!session) return
    // 还挂在线上的人按结课时间统一收尾，否则他们的 lastLeftAt 永远为空
    await this.members.update({ sessionId: session.id, lastLeftAt: IsNull() }, { lastLeftAt: endedAt })
    await this.sessions.update(session.id, { status: 'ended', endedAt })
  }

  private async findOngoing(roomId: string): Promise<ClassroomSessionEntity | null> {
    return this.sessions.findOne({
      where: { roomId, status: 'ongoing' },
      order: { startedAt: 'DESC' },
    })
  }

  private async createBareSession(
    roomId: string,
    context: SessionContextInput,
  ): Promise<ClassroomSessionEntity | null> {
    return this.sessions.save(
      this.sessions.create({
        roomId,
        ...this.contextPatch(context),
        startedAt: new Date(),
        status: 'ongoing',
      }),
    )
  }

  /** 峰值只增不减：中途掉线不应该把已经到过课的人数抹掉 */
  private async refreshPeaks(sessionId: string): Promise<void> {
    const total = await this.members.count({ where: { sessionId } })
    const students = await this.members.count({ where: { sessionId, role: 'student' } })
    const session = await this.sessions.findOneBy({ id: sessionId })
    if (!session) return
    const patch: Partial<ClassroomSessionEntity> = {}
    if (total > session.memberPeak) patch.memberPeak = total
    if (students > session.studentPeak) patch.studentPeak = students
    if (Object.keys(patch).length > 0) await this.sessions.update(sessionId, patch)
  }

  private contextPatch(context: SessionContextInput): Partial<ClassroomSessionEntity> {
    return {
      tenantId: context.tenantId,
      schoolId: context.schoolId,
      classId: context.classId,
      className: context.className,
      subject: context.subject,
    }
  }
}
