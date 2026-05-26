export type UserRole = 'teacher' | 'student' | 'admin'

export type DeviceType = 'screen' | 'tablet' | 'pc' | 'phone'

export type ClientType = 'teacher-screen' | 'teacher-tablet' | 'teacher-uniapp' | 'student-tablet' | 'admin'

export type LessonStatus = 'pending' | 'ongoing' | 'paused' | 'ended'

export type TaskType = 'quiz' | 'discussion' | 'practice' | 'ai_practice' | 'survey' | 'homework'

export type TaskStatus = 'draft' | 'published' | 'in_progress' | 'collecting' | 'ended'

export type QuestionType = 'single_choice' | 'multiple_choice' | 'true_false' | 'fill_blank' | 'short_answer' | 'practical'

export type GroupStrategy = 'random' | 'fixed' | 'ability_based' | 'manual'

export type StudentState = 'idle' | 'listening' | 'working' | 'submitted' | 'locked'

export interface User {
  id: string
  name: string
  avatar?: string
  role: UserRole
  studentNo?: string
  classId?: string
}

export interface Course {
  id: string
  name: string
  subjectTemplateId: string
  teacherId: string
  semester: string
  classIds: string[]
  coverImage?: string
}

export interface Lesson {
  id: string
  courseId: string
  title: string
  sectionTitle?: string
  startTime: string
  endTime: string
  status: LessonStatus
  roomCode: string
  slideUrl?: string
  totalSlides: number
  currentSlide: number
}

export interface Question {
  id: string
  type: QuestionType
  content: string
  options?: QuestionOption[]
  answer?: string | string[]
  analysis?: string
  points: number
  knowledgePointIds: string[]
  referenceAnswer?: string
  commentPrompt?: string
  difficulty?: 'easy' | 'medium' | 'hard'
}

export interface QuestionOption {
  key: string
  content: string
}

export interface Task {
  id: string
  lessonId: string
  type: TaskType
  title: string
  description?: string
  questions?: Question[]
  timeLimit?: number
  status: TaskStatus
  targetStudentIds?: string[]
  createdAt: string
}

export interface TaskSubmission {
  id: string
  taskId: string
  studentId: string
  answers: Record<string, string | string[]>
  score?: number
  aiComment?: string
  submittedAt: string
}

export interface GroupInfo {
  id: string
  lessonId: string
  name: string
  members: string[]
  leaderId?: string
  channelId: string
}

export interface StudentProgress {
  studentId: string
  studentName: string
  avatar?: string
  state: StudentState
  taskProgress?: number
  score?: number
  onlineAt?: string
}

export interface KnowledgePoint {
  id: string
  name: string
  subjectId: string
  parentId?: string
}

export interface KnowledgeMastery {
  knowledgePointId: string
  knowledgePointName: string
  masteryPercent: number
  status: 'mastered' | 'practicing' | 'needs_improvement'
}

export interface ClassroomStats {
  totalStudents: number
  onlineCount: number
  submittedCount: number
  averageScore?: number
  knowledgeMastery: KnowledgeMastery[]
  taskCompletionRate: number
}

export interface SubjectTemplate {
  id: string
  name: string
  icon: string
  description: string
  ai: {
    systemPrompt: string
    knowledgeBaseId: string
    tools: string[]
  }
  activities: TaskType[]
  widgets: WidgetConfig[]
  evaluationDimensions: string[]
}

export interface WidgetConfig {
  id: string
  name: string
  component: string
  icon: string
  props?: Record<string, unknown>
}

export interface AiMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: string
}

export interface AiConversation {
  id: string
  lessonId: string
  studentId: string
  messages: AiMessage[]
  knowledgePoints: string[]
}

export interface SlideInfo {
  index: number
  total: number
  url: string
  sectionTitle?: string
}

export interface JoinRoomPayload {
  token: string
  lessonId: string
  clientType: ClientType
  deviceType: DeviceType
}
