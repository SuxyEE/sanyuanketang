/**
 * 与 packages/shared/src/types.ts 保持一致的核心业务类型。
 *
 * 设计权衡：原本想 `import { ... } from '@snyuan/shared'`，但 UniApp 项目独立于 pnpm workspace、
 * 且 manifest 编译目标多端（小程序也限制了 npm 包），所以这里复制一份保持同步。
 * 变更时记得两边都改。
 */

export type UserRole = 'teacher' | 'student' | 'admin'
export type ClientType = 'teacher-screen' | 'teacher-tablet' | 'teacher-uniapp' | 'student-tablet' | 'admin'
export type LessonStatus = 'pending' | 'ongoing' | 'paused' | 'ended'
export type QuestionType = 'single_choice' | 'multiple_choice' | 'true_false' | 'short_answer'
export type StudentState = 'idle' | 'listening' | 'working' | 'submitted' | 'locked'

export interface QuestionOption {
  key: string
  content: string
}

export interface QuizQuestion {
  id: string
  type: QuestionType
  content: string
  options?: QuestionOption[]
  answer?: string
  analysis?: string
  referenceAnswer?: string
  points?: number
  knowledgePoints?: string[]
  difficulty?: 'easy' | 'medium' | 'hard'
}

export interface ActiveQuiz {
  taskId: string
  title: string
  questions: QuizQuestion[]
  timeLimit?: number
  startedAt: string
}

export interface CompeteResponder {
  studentId: string
  studentName: string
  responseTime: number
  rank?: number
}

export interface GroupMember {
  id: string
  name: string
}

export interface GroupData {
  id: string
  name: string
  members: GroupMember[]
  topic?: string
}

export interface AttendanceSignedRecord {
  studentId: string
  studentName: string
  time: string
}

export interface HomeworkItem {
  id: string
  title: string
  description?: string
  questions: QuizQuestion[]
  deadline?: string | null
  publishedAt: string
  type?: string
}

export interface AiMessage {
  role: 'user' | 'assistant'
  content: string
  time: string
}
