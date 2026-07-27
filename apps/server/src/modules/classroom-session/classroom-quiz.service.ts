import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { TaskSubmissionEntity } from '../task/task-submission.entity'
import { TaskEntity } from '../task/task.entity'
import { ClassroomSessionService, SessionContextInput } from './classroom-session.service'

export interface QuizPublishInput {
  taskId: string
  title: string
  questions: unknown[]
  timeLimit?: number
}

export interface QuizSubmissionInput {
  studentId: string
  studentName?: string
  answers: Record<string, unknown>
  score?: number
  perQuestion?: Record<string, unknown>
}

/**
 * 课堂测验与作答的持久化。
 *
 * 复用已有的 `tasks` / `task_submissions`，不另起一套表：`tasks.questions` 本身就是
 * 发题瞬间的 JSON 副本，题库后续改题不会影响它，快照语义已经满足。
 *
 * 与会话服务一样，这一层只加写入，调用方 fire-and-forget，失败只记日志。
 */
@Injectable()
export class ClassroomQuizService {
  private readonly logger = new Logger('ClassroomQuizService')

  constructor(
    @InjectRepository(TaskEntity)
    private readonly tasks: Repository<TaskEntity>,
    @InjectRepository(TaskSubmissionEntity)
    private readonly submissions: Repository<TaskSubmissionEntity>,
    private readonly sessions: ClassroomSessionService,
  ) {}

  /** 发题即落库。taskId 由网关生成，这里用它做主键，重复发布同一个 id 只会更新 */
  async recordQuizPublished(
    roomId: string,
    context: SessionContextInput,
    quiz: QuizPublishInput,
  ): Promise<void> {
    const sessionId = await this.sessions.getOngoingSessionId(roomId)
    await this.tasks.save(
      this.tasks.create({
        id: quiz.taskId,
        lessonId: roomId,
        sessionId: sessionId ?? undefined,
        tenantId: context.tenantId,
        schoolId: context.schoolId,
        type: 'quiz',
        title: quiz.title,
        questions: quiz.questions,
        timeLimit: quiz.timeLimit,
        status: 'in_progress',
      }),
    )
  }

  async recordSubmission(
    context: SessionContextInput,
    taskId: string,
    submission: QuizSubmissionInput,
  ): Promise<void> {
    const existing = await this.submissions.findOneBy({ taskId, studentId: submission.studentId })
    const patch = {
      taskId,
      studentId: submission.studentId,
      studentName: submission.studentName,
      tenantId: context.tenantId,
      schoolId: context.schoolId,
      answers: submission.answers as Record<string, any>,
      perQuestion: submission.perQuestion as Record<string, any>,
      score: submission.score,
    }
    if (existing) {
      await this.submissions.update(existing.id, patch)
    } else {
      await this.submissions.save(this.submissions.create(patch))
    }
  }

  /** 批改完成后回填最终分数，并把任务置为已结束 */
  async recordQuizCompleted(
    context: SessionContextInput,
    taskId: string,
    submissions: QuizSubmissionInput[],
  ): Promise<void> {
    for (const submission of submissions) {
      await this.recordSubmission(context, taskId, submission)
    }
    await this.tasks.update(taskId, { status: 'ended' })
    this.logger.log(`测验 ${taskId} 已落库，作答 ${submissions.length} 份`)
  }
}
