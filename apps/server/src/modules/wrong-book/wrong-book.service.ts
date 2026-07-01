import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { WrongQuestionEntity } from './wrong-question.entity'

export interface WrongQuestionInput {
  studentId: string
  studentName?: string
  lessonId: string
  taskId: string
  questionId: string
  subject?: string
  questionContent: string
  questionType?: string
  options?: any
  correctAnswer?: string
  analysis?: string
  wrongAnswer?: string
  knowledgePoints?: string[]
  score?: number
}

@Injectable()
export class WrongBookService {
  constructor(
    @InjectRepository(WrongQuestionEntity)
    private readonly repo: Repository<WrongQuestionEntity>,
  ) {}

  /**
   * 课堂测验批改完成后由 ClassroomGateway 调用：
   * 按 (studentId, taskId, questionId) upsert 错题；重复批改仅更新答案/分数，保留 mastered。
   */
  async recordWrongQuestions(entries: WrongQuestionInput[]): Promise<void> {
    if (!entries || entries.length === 0) return
    for (const e of entries) {
      if (!e.studentId || !e.taskId || !e.questionId) continue
      const existing = await this.repo.findOne({
        where: { studentId: e.studentId, taskId: e.taskId, questionId: e.questionId },
      })
      if (existing) {
        await this.repo.update(existing.id, {
          studentName: e.studentName,
          subject: e.subject,
          questionContent: e.questionContent,
          questionType: e.questionType,
          options: e.options,
          correctAnswer: e.correctAnswer,
          analysis: e.analysis,
          wrongAnswer: e.wrongAnswer,
          knowledgePoints: e.knowledgePoints,
          score: e.score,
        })
      } else {
        const row = this.repo.create({
          studentId: e.studentId,
          studentName: e.studentName,
          lessonId: e.lessonId,
          taskId: e.taskId,
          questionId: e.questionId,
          subject: e.subject,
          questionContent: e.questionContent,
          questionType: e.questionType,
          options: e.options,
          correctAnswer: e.correctAnswer,
          analysis: e.analysis,
          wrongAnswer: e.wrongAnswer,
          knowledgePoints: e.knowledgePoints,
          score: e.score,
          mastered: false,
        })
        await this.repo.save(row)
      }
    }
  }

  /** 学生错题列表 + 统计（stats 基于该生全部错题，不受 subject/mastered 过滤影响） */
  async listByStudent(studentId: string, filter: { subject?: string; mastered?: boolean }) {
    if (!studentId) {
      return { items: [], stats: { total: 0, mastered: 0, unmastered: 0, subjects: [] as Array<{ subject: string; count: number }> } }
    }
    const where: Record<string, unknown> = { studentId }
    if (filter.subject) where.subject = filter.subject
    if (filter.mastered !== undefined) where.mastered = filter.mastered
    const items = await this.repo.find({ where, order: { createdAt: 'DESC' } })

    const all = await this.repo.find({ where: { studentId } })
    const subjectsMap = new Map<string, number>()
    let mastered = 0
    for (const w of all) {
      if (w.mastered) mastered++
      const s = w.subject || '未分类'
      subjectsMap.set(s, (subjectsMap.get(s) || 0) + 1)
    }
    return {
      items,
      stats: {
        total: all.length,
        mastered,
        unmastered: all.length - mastered,
        subjects: Array.from(subjectsMap.entries()).map(([subject, count]) => ({ subject, count })),
      },
    }
  }

  async setMastered(id: string, mastered: boolean) {
    const row = await this.repo.findOneBy({ id })
    if (!row) throw new NotFoundException('错题不存在')
    row.mastered = mastered
    await this.repo.save(row)
    return { id, mastered }
  }

  /** 本堂错题学情聚合（教师端看板 / 大屏展示用） */
  async lessonStats(lessonId: string) {
    const empty = { lessonId, totalWrong: 0, uniqueStudents: 0, questions: [], topKnowledgePoints: [] }
    if (!lessonId) return empty
    const rows = await this.repo.find({ where: { lessonId } })
    const qMap = new Map<string, { questionId: string; questionContent: string; questionType: string; wrongCount: number; wrongStudents: Array<{ id: string; name: string }> }>()
    const kpMap = new Map<string, number>()
    const studentSet = new Set<string>()
    for (const w of rows) {
      studentSet.add(w.studentId)
      let q = qMap.get(w.questionId)
      if (!q) {
        q = {
          questionId: w.questionId,
          questionContent: w.questionContent,
          questionType: w.questionType,
          wrongCount: 0,
          wrongStudents: [],
        }
        qMap.set(w.questionId, q)
      }
      q.wrongCount++
      q.wrongStudents.push({ id: w.studentId, name: w.studentName || w.studentId })
      for (const kp of w.knowledgePoints || []) {
        kpMap.set(kp, (kpMap.get(kp) || 0) + 1)
      }
    }
    return {
      lessonId,
      totalWrong: rows.length,
      uniqueStudents: studentSet.size,
      questions: Array.from(qMap.values()).sort((a, b) => b.wrongCount - a.wrongCount),
      topKnowledgePoints: Array.from(kpMap.entries())
        .map(([name, wrongCount]) => ({ name, wrongCount }))
        .sort((a, b) => b.wrongCount - a.wrongCount),
    }
  }
}
