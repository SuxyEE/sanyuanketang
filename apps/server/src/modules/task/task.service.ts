import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { TaskEntity } from './task.entity'
import { TaskSubmissionEntity } from './task-submission.entity'

@Injectable()
export class TaskService {
  constructor(
    @InjectRepository(TaskEntity)
    private readonly taskRepo: Repository<TaskEntity>,
    @InjectRepository(TaskSubmissionEntity)
    private readonly submissionRepo: Repository<TaskSubmissionEntity>,
  ) {}

  findByLessonId(lessonId: string) {
    return this.taskRepo.find({ where: { lessonId }, order: { createdAt: 'DESC' } })
  }

  async findById(id: string) {
    const task = await this.taskRepo.findOneBy({ id })
    if (!task) throw new NotFoundException('任务不存在')
    return task
  }

  create(data: Partial<TaskEntity>) {
    const task = this.taskRepo.create(data)
    return this.taskRepo.save(task)
  }

  async updateStatus(id: string, status: string) {
    await this.taskRepo.update(id, { status })
    return this.findById(id)
  }

  submitAnswer(data: Partial<TaskSubmissionEntity>) {
    const submission = this.submissionRepo.create(data)
    return this.submissionRepo.save(submission)
  }

  findSubmissions(taskId: string) {
    return this.submissionRepo.find({ where: { taskId }, order: { submittedAt: 'ASC' } })
  }

  async getTaskStats(taskId: string) {
    const submissions = await this.findSubmissions(taskId)
    const totalScore = submissions.reduce((sum, s) => sum + (s.score || 0), 0)
    return {
      totalSubmissions: submissions.length,
      averageScore: submissions.length > 0 ? totalScore / submissions.length : 0,
      submissions,
    }
  }
}
