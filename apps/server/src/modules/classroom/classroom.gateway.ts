import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets'
import { Logger, Inject } from '@nestjs/common'
import { Server, Socket } from 'socket.io'
import { AiService } from '../ai/ai.service'

interface RoomMember {
  socketId: string
  userId: string
  userName: string
  role: 'teacher' | 'student' | 'admin'
  clientType: string
  joinedAt: Date
}

interface SlideData {
  index: number
  dataUrl: string
}

interface QuizQuestionOption {
  key: string
  content: string
}

interface QuizQuestion {
  id: string
  type: 'single_choice' | 'multiple_choice' | 'true_false' | 'short_answer' | string
  content: string
  options?: QuizQuestionOption[]
  answer?: string
  analysis?: string
  referenceAnswer?: string
  /** 题目分值（1-20，默认 10）。最终总分按 sum(points) 归一化到 100 */
  points?: number
  /** 简答题评分细则；为空时由 AI 服务用默认 rubric 兜底 */
  commentPrompt?: string
  difficulty?: 'easy' | 'medium' | 'hard'
  /** 知识点标签数组（字符串），用于报告聚合掌握度 */
  knowledgePoints?: string[]
}

interface StudentSubmission {
  studentId: string
  studentName: string
  answers: Record<string, string>
  submittedAt: string
  /** 0-100 总分（按题目分值加权后归一化） */
  score?: number
  perQuestion?: Record<string, {
    /** 0-100 单题得分率 */
    score: number
    /** 折算后实际得分（=score × points / 100） */
    earned?: number
    /** 题目满分（=points） */
    points?: number
    correct?: boolean
    comment?: string
    aiGraded?: boolean
  }>
}

interface ActiveQuiz {
  taskId: string
  title: string
  questions: QuizQuestion[]
  timeLimit?: number
  startedAt: string
  endedAt?: string
  status: 'in_progress' | 'completed'
  submissions: Map<string, StudentSubmission>
  expectedStudentIds: Set<string>
  generation: number
}

interface CompeteResponder {
  studentId: string
  studentName: string
  responseTime: number
  rank: number
}

interface ActiveCompete {
  question: string
  timeLimit: number
  startTime: number
  active: boolean
  taskId: string
  responders: CompeteResponder[]
  responderIds: Set<string>
}

interface AttendanceSigned {
  studentId: string
  studentName: string
  time: string
}

interface ActiveAttendance {
  mode: string
  duration: number
  startedAt: number
  active: boolean
  signed: AttendanceSigned[]
  signedIds: Set<string>
}

interface RoomState {
  lessonId: string
  members: Map<string, RoomMember>
  currentSlide: number
  totalSlides: number
  isLocked: boolean
  activeTaskId: string | null
  handRaisedStudents: Set<string>
  slides: SlideData[]
  activeQuiz: ActiveQuiz | null
  activeCompete: ActiveCompete | null
  activeAttendance: ActiveAttendance | null
  aiPractice: { topic: string; prompt?: string; startedAt: string } | null
}

const TRUE_TOKENS = new Set(['TRUE', 'T', 'YES', 'Y', '1', 'A', '对', '正确', '是'])
const FALSE_TOKENS = new Set(['FALSE', 'F', 'NO', 'N', '0', 'B', '错', '错误', '否'])

function unifyToken(t: string): string {
  return t.normalize('NFKC').trim().toUpperCase()
}

function normalizeToken(t: string, treatAsBoolean: boolean): string {
  const upper = unifyToken(t)
  if (treatAsBoolean) {
    if (TRUE_TOKENS.has(upper)) return 'TRUE'
    if (FALSE_TOKENS.has(upper)) return 'FALSE'
  }
  return upper
}

function normalizeAnswer(s: string, asBoolean = false): string {
  if (s == null) return ''
  const cleaned = String(s)
    .normalize('NFKC')
    .trim()
    .replace(/\s+/g, '')
    .replace(/[，、；;]/g, ',')

  if (asBoolean) {
    return normalizeToken(cleaned, true)
  }

  let parts: string[] = []
  if (cleaned.includes(',')) {
    parts = cleaned.split(',').filter(Boolean)
  } else if (/^[A-Za-z]{2,}$/.test(cleaned)) {
    parts = cleaned.split('')
  } else {
    parts = cleaned ? [cleaned] : []
  }

  return parts
    .map(t => normalizeToken(t, false))
    .filter(Boolean)
    .sort()
    .join(',')
}

const ADMIN_OBSERVERS_ROOM = 'admin:observers'
const ADMIN_OBSERVED_EVENTS = new Set([
  'slide:goto',
  'task:push',
  'quiz:start',
  'quiz:progress',
  'quiz:grading',
  'quiz:report',
  'quiz:stop',
  'answer:submitted',
  'hand:raise',
  'hand:lower',
  'screen:lock',
  'screen:unlock',
  'broadcast:msg',
  'group:create',
  'group:dissolve',
  'roll:call',
  'question:new',
  'attendance:start',
  'attendance:end',
  'attendance:signed',
  'compete:start',
  'compete:stop',
  'compete:answer',
  'group:msg',
  'lesson:end',
  'slides:loaded',
  'ai:practice:start',
  'member:update',
  'homework:publish',
])

@WebSocketGateway({
  namespace: '/classroom',
  cors: { origin: '*' },
  maxHttpBufferSize: 20 * 1024 * 1024,
})
export class ClassroomGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server

  private logger = new Logger('ClassroomGateway')
  private rooms = new Map<string, RoomState>()
  private socketToRoom = new Map<string, string>()
  private autoCompleteTimers = new Map<string, ReturnType<typeof setTimeout>>()
  private quizGenCounter = 0

  constructor(private readonly aiService: AiService) {}

  handleConnection(client: Socket) {
    this.logger.log(`Connected: ${client.id}`)
  }

  handleDisconnect(client: Socket) {
    const roomId = this.socketToRoom.get(client.id)
    if (roomId) {
      const room = this.rooms.get(roomId)
      if (room) {
        const member = room.members.get(client.id)
        room.members.delete(client.id)
        this.socketToRoom.delete(client.id)
        if (member?.userId) {
          const stillHasOtherSocket = Array.from(room.members.values()).some(m => m.userId === member.userId)
          if (!stillHasOtherSocket) {
            room.handRaisedStudents.delete(member.userId)
            if (
              room.activeQuiz &&
              room.activeQuiz.status === 'in_progress' &&
              member.role === 'student' &&
              !room.activeQuiz.submissions.has(member.userId)
            ) {
              room.activeQuiz.expectedStudentIds.delete(member.userId)
              this.maybeAutoCompleteQuiz(roomId)
            }
          }
        }
        client.leave(roomId)
        this.broadcastMemberUpdate(roomId)
        if (member) this.logger.log(`${member.userName}(${member.clientType}) left ${roomId}`)
        if (room.members.size === 0 && (!room.activeQuiz || room.activeQuiz.status === 'completed')) {
          this.rooms.delete(roomId)
          const t = this.autoCompleteTimers.get(roomId)
          if (t) { clearTimeout(t); this.autoCompleteTimers.delete(roomId) }
        }
      }
    }
  }

  private getTeacher(client: Socket): { roomId: string; room: RoomState; member: RoomMember } | null {
    const roomId = this.socketToRoom.get(client.id)
    if (!roomId) return null
    const room = this.rooms.get(roomId)
    if (!room) return null
    const member = room.members.get(client.id)
    if (!member) return null
    if (member.role !== 'teacher') {
      client.emit('error:permission', { message: '此操作仅教师可执行', op: client.id })
      return null
    }
    return { roomId, room, member }
  }

  private emitToRoom(roomId: string, event: string, data?: any) {
    this.server.to(roomId).emit(event, data)
    if (ADMIN_OBSERVED_EVENTS.has(event)) {
      this.server.to(ADMIN_OBSERVERS_ROOM).emit('admin:event', {
        roomId,
        lessonId: roomId.startsWith('lesson:') ? roomId.slice('lesson:'.length) : roomId,
        event,
        data,
        time: new Date().toISOString(),
      })
    }
  }

  private maybeAutoCompleteQuiz(roomId: string) {
    const room = this.rooms.get(roomId)
    if (!room || !room.activeQuiz || room.activeQuiz.status !== 'in_progress') return
    const expected = room.activeQuiz.expectedStudentIds
    if (expected.size === 0) return
    const allSubmitted = Array.from(expected).every(id => room.activeQuiz!.submissions.has(id))
    if (!allSubmitted) return
    if (this.autoCompleteTimers.has(roomId)) return
    const t = setTimeout(() => {
      this.autoCompleteTimers.delete(roomId)
      this.completeQuiz(roomId).catch(err => this.logger.error(`Auto-complete failed: ${err}`))
    }, 800)
    this.autoCompleteTimers.set(roomId, t)
  }

  @SubscribeMessage('room:join')
  handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { lessonId: string; userId: string; userName: string; role: string; clientType: string },
  ) {
    const roomId = `lesson:${data.lessonId}`

    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, {
        lessonId: data.lessonId,
        members: new Map(),
        currentSlide: 1,
        totalSlides: 0,
        isLocked: false,
        activeTaskId: null,
        handRaisedStudents: new Set(),
        slides: [],
        activeQuiz: null,
        activeCompete: null,
        activeAttendance: null,
        aiPractice: null,
      })
    }

    const room = this.rooms.get(roomId)!

    const prevRoomId = this.socketToRoom.get(client.id)
    if (prevRoomId && prevRoomId !== roomId) {
      const prevRoom = this.rooms.get(prevRoomId)
      if (prevRoom) {
        prevRoom.members.delete(client.id)
        client.leave(prevRoomId)
        this.broadcastMemberUpdate(prevRoomId)
        if (prevRoom.members.size === 0 && (!prevRoom.activeQuiz || prevRoom.activeQuiz.status === 'completed')) {
          this.rooms.delete(prevRoomId)
        }
      }
      this.logger.log(`Socket ${client.id} switched ${prevRoomId} → ${roomId}`)
    }

    if (data.userId) {
      for (const [sid, m] of room.members.entries()) {
        if (sid !== client.id && m.userId === data.userId && m.role === data.role) {
          room.members.delete(sid)
          this.socketToRoom.delete(sid)
          this.logger.log(`Cleaned up ghost ${data.role} socket for ${data.userId}: ${sid}`)
        }
      }
    }

    room.members.set(client.id, {
      socketId: client.id,
      userId: data.userId,
      userName: data.userName,
      role: data.role as RoomMember['role'],
      clientType: data.clientType,
      joinedAt: new Date(),
    })

    this.socketToRoom.set(client.id, roomId)
    client.join(roomId)

    if (
      data.role === 'student' &&
      room.activeQuiz &&
      room.activeQuiz.status === 'in_progress' &&
      !room.activeQuiz.expectedStudentIds.has(data.userId) &&
      !room.activeQuiz.submissions.has(data.userId)
    ) {
      room.activeQuiz.expectedStudentIds.add(data.userId)
    }

    const members = Array.from(room.members.values()).map(m => ({
      userId: m.userId,
      userName: m.userName,
      role: m.role,
      clientType: m.clientType,
      onlineAt: m.joinedAt.toISOString(),
    }))

    const activeQuizSnapshot = room.activeQuiz && room.activeQuiz.status === 'in_progress'
      ? {
          taskId: room.activeQuiz.taskId,
          title: room.activeQuiz.title,
          questions: room.activeQuiz.questions,
          timeLimit: room.activeQuiz.timeLimit,
          status: room.activeQuiz.status,
          submittedCount: room.activeQuiz.submissions.size,
          totalStudents: room.activeQuiz.expectedStudentIds.size,
          remainingTime: room.activeQuiz.timeLimit
            ? Math.max(0, room.activeQuiz.timeLimit - Math.floor((Date.now() - new Date(room.activeQuiz.startedAt).getTime()) / 1000))
            : undefined,
        }
      : null

    const activeCompeteSnapshot = room.activeCompete && room.activeCompete.active
      ? {
          taskId: room.activeCompete.taskId,
          question: room.activeCompete.question,
          timeLimit: room.activeCompete.timeLimit,
          startTime: room.activeCompete.startTime,
          active: room.activeCompete.active,
          responders: [...room.activeCompete.responders],
          hasGrabbed: data.role === 'student' ? room.activeCompete.responderIds.has(data.userId) : false,
        }
      : null

    const activeAttendanceSnapshot = room.activeAttendance && room.activeAttendance.active
      ? {
          mode: room.activeAttendance.mode,
          duration: room.activeAttendance.duration,
          startedAt: room.activeAttendance.startedAt,
          active: room.activeAttendance.active,
          signed: [...room.activeAttendance.signed],
          alreadySigned: data.role === 'student' ? room.activeAttendance.signedIds.has(data.userId) : false,
        }
      : null

    client.emit('room:joined', {
      roomId,
      currentSlide: room.currentSlide,
      totalSlides: room.totalSlides,
      isLocked: room.isLocked,
      memberCount: room.members.size,
      members,
      studentCount: members.filter(m => m.role === 'student').length,
      activeTaskId: room.activeTaskId,
      handRaisedStudents: Array.from(room.handRaisedStudents),
      hasSlides: room.slides.length > 0,
      slideCount: room.slides.length,
      activeQuiz: activeQuizSnapshot,
      activeCompete: activeCompeteSnapshot,
      activeAttendance: activeAttendanceSnapshot,
      aiPractice: room.aiPractice,
    })

    if (room.slides.length > 0) {
      client.emit('slides:loaded', { slides: room.slides, total: room.slides.length })
    }

    this.broadcastMemberUpdate(roomId)
    this.logger.log(`${data.userName}(${data.clientType}) joined ${roomId}, total: ${room.members.size}`)
  }

  @SubscribeMessage('slide:goto')
  handleSlide(@ConnectedSocket() client: Socket, @MessageBody() data: { index: number; total: number }) {
    const ctx = this.getTeacher(client)
    if (!ctx) return
    ctx.room.currentSlide = data.index
    ctx.room.totalSlides = data.total
    client.to(ctx.roomId).emit('slide:goto', data)
    this.server.to(ADMIN_OBSERVERS_ROOM).emit('admin:event', {
      roomId: ctx.roomId,
      lessonId: ctx.room.lessonId,
      event: 'slide:goto',
      data,
      time: new Date().toISOString(),
    })
    this.logger.log(`Slide: ${data.index}/${data.total}`)
  }

  @SubscribeMessage('task:push')
  handleTaskPush(@ConnectedSocket() client: Socket, @MessageBody() data: any) {
    const ctx = this.getTeacher(client)
    if (!ctx) return
    const taskId = `task-${Date.now()}`
    const task = { ...data, id: taskId, createdAt: new Date().toISOString() }
    ctx.room.activeTaskId = taskId
    this.emitToRoom(ctx.roomId, 'task:push', task)
    this.logger.log(`Task pushed: ${data.title || data.type}`)
  }

  @SubscribeMessage('quiz:start')
  handleQuizStart(@ConnectedSocket() client: Socket, @MessageBody() data: any) {
    const ctx = this.getTeacher(client)
    if (!ctx) return
    const { roomId, room } = ctx

    if (room.activeQuiz && room.activeQuiz.status === 'in_progress') {
      client.emit('quiz:start:error', {
        message: '已有测验进行中，请先结束当前测验',
      })
      this.logger.warn(`Quiz start rejected: already in progress in ${roomId}`)
      return
    }

    const taskId = `quiz-${Date.now()}`
    const rawQuestions: any[] = Array.isArray(data.questions) ? data.questions : []
    const questions: QuizQuestion[] = rawQuestions.map((q, i) => {
      const rawPts = Number(q?.points)
      const points = Number.isFinite(rawPts) && rawPts > 0
        ? Math.max(1, Math.min(20, Math.round(rawPts)))
        : 10
      const difficulty = ['easy', 'medium', 'hard'].includes(String(q?.difficulty)) ? q.difficulty : undefined
      const rawKps = Array.isArray(q?.knowledgePoints)
        ? q.knowledgePoints
            .map((x: any) => (typeof x === 'string' ? x.trim() : ''))
            .filter((x: string) => x.length > 0 && x.length <= 40)
            .slice(0, 5)
        : undefined
      return {
        id: q.id || `q-${i + 1}`,
        type: q.type || 'single_choice',
        content: q.content || '',
        options: q.options,
        answer: q.answer,
        analysis: q.analysis,
        referenceAnswer: q.referenceAnswer,
        points,
        commentPrompt: q.commentPrompt || undefined,
        difficulty,
        knowledgePoints: rawKps && rawKps.length > 0 ? rawKps : undefined,
      }
    })

    const expectedStudentIds = new Set(
      Array.from(room.members.values())
        .filter(m => m.role === 'student')
        .map(m => m.userId),
    )

    room.activeQuiz = {
      taskId,
      title: data.title || '随堂测验',
      questions,
      timeLimit: data.timeLimit,
      startedAt: new Date().toISOString(),
      status: 'in_progress',
      submissions: new Map(),
      expectedStudentIds,
      generation: ++this.quizGenCounter,
    }
    room.activeTaskId = taskId
    if (room.activeCompete?.active) {
      room.activeCompete.active = false
      const stale = room.activeCompete
      this.emitToRoom(roomId, 'compete:stop', { winner: null, ranking: stale.responders.slice(0, 5) })
      setTimeout(() => { if (room.activeCompete === stale && !stale.active) room.activeCompete = null }, 4000)
    }
    if (room.activeAttendance?.active) {
      room.activeAttendance.active = false
      const stale = room.activeAttendance
      this.emitToRoom(roomId, 'attendance:end')
      setTimeout(() => { if (room.activeAttendance === stale && !stale.active) room.activeAttendance = null }, 4000)
    }
    if (room.aiPractice) {
      room.aiPractice = null
    }

    const task = {
      ...data,
      id: taskId,
      questions,
      type: 'quiz',
      status: 'in_progress',
      createdAt: room.activeQuiz.startedAt,
      totalStudents: expectedStudentIds.size,
    }
    this.emitToRoom(roomId, 'quiz:start', task)
    this.logger.log(`Quiz started: ${data.title} (${questions.length} questions, ${expectedStudentIds.size} students)`)
  }

  @SubscribeMessage('quiz:stop')
  async handleQuizStop(@ConnectedSocket() client: Socket, @MessageBody() data: { taskId: string }) {
    const ctx = this.getTeacher(client)
    if (!ctx) return
    this.emitToRoom(ctx.roomId, 'quiz:stop', data)
    await this.completeQuiz(ctx.roomId)
  }

  @SubscribeMessage('quiz:complete')
  async handleQuizComplete(@ConnectedSocket() client: Socket) {
    const ctx = this.getTeacher(client)
    if (!ctx) return
    await this.completeQuiz(ctx.roomId)
  }

  @SubscribeMessage('answer:submit')
  async handleAnswer(@ConnectedSocket() client: Socket, @MessageBody() data: any) {
    const roomId = this.socketToRoom.get(client.id)
    if (!roomId) return
    const room = this.rooms.get(roomId)
    if (!room) return
    const member = room.members.get(client.id)
    if (!member) return

    const submission: StudentSubmission = {
      studentId: member.userId,
      studentName: member.userName,
      answers: data.answers || {},
      submittedAt: new Date().toISOString(),
    }

    if (room.activeQuiz && room.activeQuiz.status === 'in_progress') {
      if (room.activeQuiz.submissions.has(submission.studentId)) {
        this.logger.log(`Duplicate submit ignored: ${member.userName}`)
        client.emit('quiz:submit:ack', { duplicate: true })
        return
      }

      this.gradeObjectiveSubmission(room.activeQuiz, submission)
      room.activeQuiz.submissions.set(submission.studentId, submission)

      const expected = room.activeQuiz.expectedStudentIds
      const submittedCount = room.activeQuiz.submissions.size
      const totalStudents = expected.size

      this.emitToRoom(roomId, 'quiz:progress', {
        taskId: room.activeQuiz.taskId,
        submittedCount,
        totalStudents,
        latestStudent: submission.studentName,
      })

      this.maybeAutoCompleteQuiz(roomId)
    }

    this.emitToRoom(roomId, 'answer:submitted', {
      studentId: submission.studentId,
      studentName: submission.studentName,
      ...data,
    })
    this.logger.log(`Answer from ${member.userName}`)
  }

  private gradeObjectiveSubmission(quiz: ActiveQuiz, submission: StudentSubmission) {
    const perQuestion: NonNullable<StudentSubmission['perQuestion']> = {}
    let totalEarned = 0
    let totalPoints = 0

    for (const q of quiz.questions) {
      const studentAnswer = submission.answers[q.id] || ''
      const isObjective = q.type === 'single_choice' || q.type === 'multiple_choice' || q.type === 'true_false'
      const pts = q.points ?? 10

      if (isObjective) {
        const asBool = q.type === 'true_false'
        const correct = normalizeAnswer(studentAnswer, asBool) === normalizeAnswer(q.answer || '', asBool)
        const score = correct ? 100 : 0
        const earned = correct ? pts : 0
        perQuestion[q.id] = { score, correct, points: pts, earned }
        totalEarned += earned
        totalPoints += pts
      } else {
        // short_answer scoring happens later in completeQuiz; only contribute its points to the denominator
        totalPoints += pts
      }
    }

    submission.perQuestion = perQuestion
    submission.score = totalPoints > 0 ? Math.round((totalEarned / totalPoints) * 100) : 0
  }

  private async completeQuiz(roomId: string) {
    const room = this.rooms.get(roomId)
    if (!room || !room.activeQuiz || room.activeQuiz.status === 'completed') return

    const quiz = room.activeQuiz
    const generation = quiz.generation
    quiz.status = 'completed'
    quiz.endedAt = new Date().toISOString()

    const existingTimer = this.autoCompleteTimers.get(roomId)
    if (existingTimer) {
      clearTimeout(existingTimer)
      this.autoCompleteTimers.delete(roomId)
    }

    this.emitToRoom(roomId, 'quiz:grading', {
      taskId: quiz.taskId,
      submittedCount: quiz.submissions.size,
    })

    const shortAnswerQuestions = quiz.questions.filter(q => q.type === 'short_answer')
    const gradingPromises: Array<Promise<void>> = []

    for (const submission of quiz.submissions.values()) {
      for (const q of shortAnswerQuestions) {
        const studentAnswer = submission.answers[q.id] || ''
        if (!studentAnswer.trim()) {
          submission.perQuestion = submission.perQuestion || {}
          submission.perQuestion[q.id] = { score: 0, comment: '未作答', aiGraded: true }
          continue
        }
        const pts = q.points ?? 10
        gradingPromises.push(
          this.aiService.gradeAnswer({
            question: q.content,
            studentAnswer,
            referenceAnswer: q.referenceAnswer || q.answer || q.analysis,
            commentPrompt: q.commentPrompt,
            maxScore: 100,
          }).then(result => {
            submission.perQuestion = submission.perQuestion || {}
            const safeScore = Math.max(0, Math.min(100, Math.round(Number(result.score) || 0)))
            submission.perQuestion[q.id] = {
              score: safeScore,
              earned: Math.round((safeScore / 100) * pts),
              points: pts,
              comment: result.comment,
              aiGraded: true,
            }
          }).catch(() => {
            submission.perQuestion = submission.perQuestion || {}
            submission.perQuestion[q.id] = {
              score: 60,
              earned: Math.round((60 / 100) * pts),
              points: pts,
              comment: 'AI 批改失败，已给基础分',
              aiGraded: true,
            }
          }),
        )
      }
    }

    if (gradingPromises.length > 0) {
      this.logger.log(`AI grading ${gradingPromises.length} short answers for quiz ${quiz.taskId}...`)
      await Promise.all(gradingPromises)
    }

    const currentRoom = this.rooms.get(roomId)
    if (!currentRoom || currentRoom.activeQuiz?.generation !== generation) {
      this.logger.warn(`Quiz ${quiz.taskId} superseded; suppressing report`)
      return
    }

    for (const submission of quiz.submissions.values()) {
      let totalEarned = 0
      let totalPoints = 0
      for (const q of quiz.questions) {
        const pts = q.points ?? 10
        totalPoints += pts
        const pq = submission.perQuestion?.[q.id]
        if (pq) {
          // For records lacking earned (e.g. unanswered short_answer), derive from score
          const earned = pq.earned != null ? pq.earned : Math.round((pq.score / 100) * pts)
          totalEarned += earned
          if (pq.points == null) pq.points = pts
          if (pq.earned == null) pq.earned = earned
        }
      }
      submission.score = totalPoints > 0 ? Math.round((totalEarned / totalPoints) * 100) : 0
    }

    const report = this.buildQuizReport(currentRoom, quiz)
    this.emitToRoom(roomId, 'quiz:report', report)
    this.logger.log(`Quiz report sent: ${quiz.title}, ${quiz.submissions.size} submissions`)

    setTimeout(() => {
      const r = this.rooms.get(roomId)
      if (r && r.activeQuiz?.taskId === quiz.taskId) {
        r.activeQuiz = null
        r.activeTaskId = null
      }
    }, 1500)
  }

  private buildQuizReport(room: RoomState, quiz: ActiveQuiz) {
    const submissions = Array.from(quiz.submissions.values())
    const totalStudents = quiz.expectedStudentIds.size || submissions.length
    const liveStudentCount = Array.from(room.members.values()).filter(m => m.role === 'student').length

    const scores = submissions.map(s => s.score || 0)
    const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0
    const maxScore = scores.length > 0 ? Math.max(...scores) : 0
    const minScore = scores.length > 0 ? Math.min(...scores) : 0

    const questionStats = quiz.questions.map(q => {
      const isBoolean = q.type === 'true_false'
      const isMulti = q.type === 'multiple_choice'
      const isShort = q.type === 'short_answer'
      const answerCount: Record<string, number> = {}
      const answers: Array<{ studentId: string; studentName: string; answer: string; score?: number; comment?: string; correct?: boolean }> = []
      let correctCount = 0
      let totalScoreSum = 0
      let scoredCount = 0

      for (const sub of submissions) {
        const ans = sub.answers[q.id] || ''
        const pq = sub.perQuestion?.[q.id]
        if (ans && !isShort) {
          const normalized = normalizeAnswer(ans, isBoolean)
          if (normalized) {
            if (isMulti) {
              for (const single of normalized.split(',').filter(Boolean)) {
                answerCount[single] = (answerCount[single] || 0) + 1
              }
            } else {
              answerCount[normalized] = (answerCount[normalized] || 0) + 1
            }
          }
        }
        if (pq) {
          if (pq.correct) correctCount++
          totalScoreSum += pq.score
          scoredCount++
        }
        answers.push({
          studentId: sub.studentId,
          studentName: sub.studentName,
          answer: ans,
          score: pq?.score,
          comment: pq?.comment,
          correct: pq?.correct,
        })
      }

      return {
        question: q,
        answerCount,
        correctCount,
        correctRate: submissions.length > 0 ? Math.round((correctCount / submissions.length) * 100) : 0,
        avgScore: scoredCount > 0 ? Math.round(totalScoreSum / scoredCount) : 0,
        answers,
      }
    })

    // 知识点掌握度聚合：把每道题的（正确率 或 AI 评分）按权重平均到它绑定的知识点
    // 设计思路：客观题用 correctRate（0-100），主观题用 avgScore（0-100），未绑定知识点的题忽略
    const kpAcc = new Map<string, { totalScore: number; questionCount: number; weight: number }>()
    questionStats.forEach(qs => {
      const kps = qs.question.knowledgePoints || []
      if (kps.length === 0) return
      const isObjective = ['single_choice', 'multiple_choice', 'true_false'].includes(qs.question.type)
      const score = isObjective ? qs.correctRate : qs.avgScore
      const weight = qs.question.points || 10
      kps.forEach(kp => {
        const entry = kpAcc.get(kp) || { totalScore: 0, questionCount: 0, weight: 0 }
        entry.totalScore += score * weight
        entry.weight += weight
        entry.questionCount += 1
        kpAcc.set(kp, entry)
      })
    })
    const knowledgeMastery = Array.from(kpAcc.entries())
      .map(([kp, e]) => {
        const masteryPercent = e.weight > 0 ? Math.round(e.totalScore / e.weight) : 0
        let status: 'mastered' | 'practicing' | 'needs_improvement'
        if (masteryPercent >= 80) status = 'mastered'
        else if (masteryPercent >= 60) status = 'practicing'
        else status = 'needs_improvement'
        return { knowledgePointName: kp, masteryPercent, questionCount: e.questionCount, status }
      })
      .sort((a, b) => a.masteryPercent - b.masteryPercent)

    return {
      taskId: quiz.taskId,
      title: quiz.title,
      startedAt: quiz.startedAt,
      endedAt: quiz.endedAt,
      totalStudents,
      liveStudentCount,
      submittedCount: submissions.length,
      avgScore,
      maxScore,
      minScore,
      questions: quiz.questions,
      questionStats,
      knowledgeMastery,
      submissions: submissions.map(s => ({
        studentId: s.studentId,
        studentName: s.studentName,
        score: s.score,
        submittedAt: s.submittedAt,
        perQuestion: s.perQuestion,
      })),
    }
  }

  @SubscribeMessage('hand:raise')
  handleHandRaise(@ConnectedSocket() client: Socket) {
    const roomId = this.socketToRoom.get(client.id)
    if (!roomId) return
    const room = this.rooms.get(roomId)
    const member = room?.members.get(client.id)
    if (!room || !member || member.role !== 'student') return
    room.handRaisedStudents.add(member.userId)
    this.emitToRoom(roomId, 'hand:raise', { studentId: member.userId, studentName: member.userName })
  }

  @SubscribeMessage('hand:lower')
  handleHandLower(@ConnectedSocket() client: Socket) {
    const roomId = this.socketToRoom.get(client.id)
    if (!roomId) return
    const room = this.rooms.get(roomId)
    const member = room?.members.get(client.id)
    if (!room || !member) return
    room.handRaisedStudents.delete(member.userId)
    this.emitToRoom(roomId, 'hand:lower', { studentId: member.userId })
  }

  @SubscribeMessage('screen:lock')
  handleLock(@ConnectedSocket() client: Socket) {
    const ctx = this.getTeacher(client)
    if (!ctx) return
    ctx.room.isLocked = true
    this.emitToRoom(ctx.roomId, 'screen:lock')
    this.logger.log('Screen locked')
  }

  @SubscribeMessage('screen:unlock')
  handleUnlock(@ConnectedSocket() client: Socket) {
    const ctx = this.getTeacher(client)
    if (!ctx) return
    ctx.room.isLocked = false
    this.emitToRoom(ctx.roomId, 'screen:unlock')
    this.logger.log('Screen unlocked')
  }

  @SubscribeMessage('broadcast:msg')
  handleBroadcast(@ConnectedSocket() client: Socket, @MessageBody() data: { message: string; type: string }) {
    const roomId = this.socketToRoom.get(client.id)
    if (!roomId) return
    const member = this.rooms.get(roomId)?.members.get(client.id)
    if (member?.role !== 'teacher' && member?.role !== 'admin') {
      client.emit('error:permission', { message: '只有教师/管理员可广播' })
      return
    }
    const payload = { ...data, from: member?.userName }
    client.to(roomId).emit('broadcast:msg', payload)
    this.server.to(ADMIN_OBSERVERS_ROOM).emit('admin:event', {
      roomId,
      lessonId: roomId.startsWith('lesson:') ? roomId.slice('lesson:'.length) : roomId,
      event: 'broadcast:msg',
      data: payload,
      time: new Date().toISOString(),
    })
    this.logger.log(`Broadcast: ${data.message}`)
  }

  @SubscribeMessage('group:create')
  handleGroupCreate(@ConnectedSocket() client: Socket, @MessageBody() data: { strategy: string; groupCount: number; topic?: string }) {
    const ctx = this.getTeacher(client)
    if (!ctx) return
    const { roomId, room } = ctx

    const students = Array.from(room.members.values()).filter(m => m.role === 'student')
    const shuffled = [...students].sort(() => Math.random() - 0.5)
    const groupCount = Math.max(1, Math.floor(data.groupCount || 1))
    const groupSize = Math.ceil(shuffled.length / groupCount) || 1
    const groups: any[] = []

    for (let i = 0; i < groupCount; i++) {
      const members = shuffled.slice(i * groupSize, (i + 1) * groupSize)
      groups.push({
        id: `group-${i + 1}`,
        name: `第${i + 1}组`,
        members: members.map(m => ({ id: m.userId, name: m.userName })),
        topic: data.topic,
      })
    }

    this.emitToRoom(roomId, 'group:create', groups)
    this.logger.log(`Groups created: ${data.groupCount}`)
  }

  @SubscribeMessage('group:dissolve')
  handleGroupDissolve(@ConnectedSocket() client: Socket) {
    const ctx = this.getTeacher(client)
    if (!ctx) return
    this.emitToRoom(ctx.roomId, 'group:dissolve')
  }

  @SubscribeMessage('group:msg')
  handleGroupMsg(@ConnectedSocket() client: Socket, @MessageBody() data: { groupId: string; text: string }) {
    const roomId = this.socketToRoom.get(client.id)
    if (!roomId) return
    const room = this.rooms.get(roomId)
    const member = room?.members.get(client.id)
    if (!room || !member || !data?.groupId || !data?.text) return
    this.emitToRoom(roomId, 'group:msg', {
      groupId: String(data.groupId),
      studentId: member.userId,
      studentName: member.userName,
      text: String(data.text).slice(0, 600),
      time: new Date().toISOString(),
    })
  }

  @SubscribeMessage('roll:call')
  handleRollCall(@ConnectedSocket() client: Socket, @MessageBody() data: { mode: string; studentId?: string }) {
    const ctx = this.getTeacher(client)
    if (!ctx) return
    const { roomId, room } = ctx

    let selected: RoomMember | undefined
    const students = Array.from(room.members.values()).filter(m => m.role === 'student')

    if (data.mode === 'random' && students.length > 0) {
      selected = students[Math.floor(Math.random() * students.length)]
    } else if (data.studentId) {
      selected = students.find(m => m.userId === data.studentId)
    }

    if (selected) {
      this.emitToRoom(roomId, 'roll:call', { studentId: selected.userId, studentName: selected.userName })
    }
  }

  @SubscribeMessage('question:ask')
  handleQuestion(@ConnectedSocket() client: Socket, @MessageBody() data: { text: string; slideIndex: number }) {
    const roomId = this.socketToRoom.get(client.id)
    if (!roomId) return
    const member = this.rooms.get(roomId)?.members.get(client.id)
    if (!member || member.role !== 'student') return
    this.emitToRoom(roomId, 'question:new', {
      studentId: member.userId,
      studentName: member.userName,
      text: data.text,
      slideIndex: data.slideIndex,
      time: new Date().toISOString(),
    })
    this.logger.log(`Question from ${member.userName}: ${data.text}`)
  }

  @SubscribeMessage('attendance:start')
  handleAttendanceStart(@ConnectedSocket() client: Socket, @MessageBody() data: { mode: string; duration: number }) {
    const ctx = this.getTeacher(client)
    if (!ctx) return
    if (ctx.room.activeAttendance?.active) {
      client.emit('attendance:start:error', { message: '已有签到进行中，请先结束' })
      return
    }
    ctx.room.activeAttendance = {
      mode: data.mode,
      duration: data.duration,
      startedAt: Date.now(),
      active: true,
      signed: [],
      signedIds: new Set<string>(),
    }
    this.emitToRoom(ctx.roomId, 'attendance:start', { ...data, startedAt: ctx.room.activeAttendance.startedAt })
    this.logger.log(`Attendance started: ${data.mode}, ${data.duration}min`)
  }

  @SubscribeMessage('attendance:sign')
  handleAttendanceSign(@ConnectedSocket() client: Socket) {
    const roomId = this.socketToRoom.get(client.id)
    if (!roomId) return
    const room = this.rooms.get(roomId)
    if (!room) return
    const member = room.members.get(client.id)
    if (!member || member.role !== 'student') return
    const att = room.activeAttendance
    if (!att || !att.active) {
      client.emit('attendance:signed:ack', { error: '当前没有进行中的签到' })
      return
    }
    if (att.signedIds.has(member.userId)) {
      client.emit('attendance:signed:ack', { duplicate: true })
      return
    }
    att.signedIds.add(member.userId)
    const record: AttendanceSigned = {
      studentId: member.userId,
      studentName: member.userName,
      time: new Date().toISOString(),
    }
    att.signed.push(record)
    this.emitToRoom(roomId, 'attendance:signed', record)
  }

  @SubscribeMessage('slides:upload')
  handleSlidesUpload(@ConnectedSocket() client: Socket, @MessageBody() data: { slides: SlideData[] }) {
    const ctx = this.getTeacher(client)
    if (!ctx) return
    const { roomId, room } = ctx
    if (!Array.isArray(data?.slides) || data.slides.length === 0) {
      client.emit('error:input', { message: '课件为空' })
      return
    }

    room.slides = data.slides
    room.totalSlides = data.slides.length
    room.currentSlide = 1

    this.emitToRoom(roomId, 'slides:loaded', { slides: data.slides, total: data.slides.length })
    this.emitToRoom(roomId, 'slide:goto', { index: 1, total: data.slides.length })
    this.logger.log(`Slides uploaded: ${data.slides.length} pages`)
  }

  @SubscribeMessage('compete:start')
  handleCompeteStart(@ConnectedSocket() client: Socket, @MessageBody() data: { question: string; timeLimit: number }) {
    const ctx = this.getTeacher(client)
    if (!ctx) return
    const { roomId, room } = ctx
    if (room.activeQuiz && room.activeQuiz.status === 'in_progress') {
      client.emit('error:permission', { message: '请先结束当前测验再发起抢答' })
      return
    }
    const startTime = Date.now()
    room.activeCompete = {
      taskId: `compete-${startTime}`,
      question: data.question,
      timeLimit: data.timeLimit,
      startTime,
      active: true,
      responders: [],
      responderIds: new Set<string>(),
    }
    if (room.activeAttendance?.active) {
      room.activeAttendance.active = false
      const stale = room.activeAttendance
      this.emitToRoom(roomId, 'attendance:end')
      setTimeout(() => { if (room.activeAttendance === stale && !stale.active) room.activeAttendance = null }, 4000)
    }
    room.aiPractice = null
    this.emitToRoom(roomId, 'compete:start', { ...data, startTime, taskId: room.activeCompete.taskId })
    this.logger.log(`Compete started: ${data.question}`)
  }

  @SubscribeMessage('compete:answer')
  handleCompeteAnswer(@ConnectedSocket() client: Socket) {
    const roomId = this.socketToRoom.get(client.id)
    if (!roomId) return
    const room = this.rooms.get(roomId)
    if (!room || !room.activeCompete || !room.activeCompete.active) return
    const member = room.members.get(client.id)
    if (!member || member.role !== 'student') return
    const compete = room.activeCompete
    if (compete.responderIds.has(member.userId)) {
      client.emit('compete:answer:ack', { duplicate: true })
      return
    }
    const responseTime = Math.max(0, Date.now() - compete.startTime)
    compete.responderIds.add(member.userId)
    const responder: CompeteResponder = {
      studentId: member.userId,
      studentName: member.userName,
      responseTime,
      rank: compete.responders.length + 1,
    }
    compete.responders.push(responder)
    this.emitToRoom(roomId, 'compete:answer', responder)
    this.logger.log(`Compete answer: ${member.userName} (${responseTime}ms, rank ${responder.rank})`)
  }

  @SubscribeMessage('compete:stop')
  handleCompeteStop(@ConnectedSocket() client: Socket, @MessageBody() data: { winner?: any; ranking?: any[] } = {}) {
    const ctx = this.getTeacher(client)
    if (!ctx) return
    const compete = ctx.room.activeCompete
    let winner = data?.winner ?? null
    let ranking = Array.isArray(data?.ranking) ? data.ranking : []
    if (compete) {
      compete.active = false
      const serverRanking = compete.responders.slice(0, 5)
      if (!winner && serverRanking.length > 0) winner = serverRanking[0]
      if (ranking.length === 0) ranking = serverRanking
      const cur = compete
      setTimeout(() => {
        if (ctx.room.activeCompete === cur && !cur.active) ctx.room.activeCompete = null
      }, 8000)
    }
    this.emitToRoom(ctx.roomId, 'compete:stop', { winner, ranking })
  }

  @SubscribeMessage('lesson:end')
  handleLessonEnd(@ConnectedSocket() client: Socket) {
    const ctx = this.getTeacher(client)
    if (!ctx) return
    const { roomId, room } = ctx
    room.activeQuiz = null
    room.activeTaskId = null
    room.activeCompete = null
    room.activeAttendance = null
    room.aiPractice = null
    room.handRaisedStudents.clear()
    const t = this.autoCompleteTimers.get(roomId)
    if (t) {
      clearTimeout(t)
      this.autoCompleteTimers.delete(roomId)
    }
    this.emitToRoom(roomId, 'lesson:end')
    this.logger.log(`Lesson ended in ${roomId}`)
  }

  @SubscribeMessage('ai:practice:start')
  handleAiPracticeStart(@ConnectedSocket() client: Socket, @MessageBody() data: { topic: string; prompt: string }) {
    const ctx = this.getTeacher(client)
    if (!ctx) return
    const payload = {
      topic: data.topic,
      prompt: data.prompt,
      startedAt: new Date().toISOString(),
    }
    ctx.room.aiPractice = payload
    this.emitToRoom(ctx.roomId, 'ai:practice:start', payload)
    this.logger.log(`AI practice started: ${data.topic}`)
  }

  @SubscribeMessage('homework:publish')
  handleHomeworkPublish(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { title: string; description?: string; questions?: any[]; deadline?: string; type?: string },
  ) {
    const ctx = this.getTeacher(client)
    if (!ctx) return
    const homework = {
      id: `hw-${Date.now()}`,
      title: data.title || '课后作业',
      description: data.description || '',
      questions: Array.isArray(data.questions) ? data.questions : [],
      deadline: data.deadline || null,
      type: data.type || 'manual',
      publishedAt: new Date().toISOString(),
    }
    this.emitToRoom(ctx.roomId, 'homework:publish', homework)
    this.logger.log(`Homework published: ${homework.title} (${homework.questions.length} questions)`)
  }

  @SubscribeMessage('attendance:end')
  handleAttendanceEnd(@ConnectedSocket() client: Socket) {
    const ctx = this.getTeacher(client)
    if (!ctx) return
    if (ctx.room.activeAttendance) {
      ctx.room.activeAttendance.active = false
      const cur = ctx.room.activeAttendance
      setTimeout(() => {
        if (ctx.room.activeAttendance === cur && !cur.active) ctx.room.activeAttendance = null
      }, 6000)
    }
    this.emitToRoom(ctx.roomId, 'attendance:end')
    this.logger.log(`Attendance ended in ${ctx.roomId}`)
  }

  @SubscribeMessage('ai:chat')
  async handleAiChat(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: {
      message: string
      courseContext?: string
      slideIndex?: number
      history?: any[]
      imageBase64?: string
      stream?: boolean
      source?: string
      /** 客户端可选指定模型，例 "qwen:qwen-turbo" / "openai:gpt-4o" */
      model?: string
      /** 客户端自带 key 覆盖服务端默认 */
      apiKey?: string
      baseUrl?: string
    },
  ) {
    const roomId = this.socketToRoom.get(client.id)
    const member = roomId ? this.rooms.get(roomId)?.members.get(client.id) : null
    const source = data.source || 'unknown'
    this.logger.log(`AI chat from ${member?.userName} [${source}] [${data.model || 'default'}]: ${data.message?.slice(0, 30)}`)

    try {
      if (data.stream) {
        let fullContent = ''
        for await (const chunk of this.aiService.chatStream({
          message: data.message,
          courseContext: data.courseContext,
          slideIndex: data.slideIndex,
          history: data.history,
          model: data.model,
          apiKey: data.apiKey,
          baseUrl: data.baseUrl,
        })) {
          fullContent += chunk
          client.emit('ai:stream', { chunk, done: false, source })
        }
        client.emit('ai:stream', { chunk: '', done: true, fullContent, source })
      } else {
        const response = await this.aiService.chat({
          message: data.message,
          courseContext: data.courseContext,
          slideIndex: data.slideIndex,
          history: data.history,
          imageBase64: data.imageBase64,
          model: data.model,
          apiKey: data.apiKey,
          baseUrl: data.baseUrl,
        })

        client.emit('ai:response', {
          content: response.content,
          sources: response.sources,
          studentName: member?.userName,
          time: new Date().toISOString(),
          source,
        })
      }
    } catch (err) {
      this.logger.error(`AI chat error: ${err}`)
      const errorMsg = '抱歉，AI 服务暂时不可用，请稍后重试。'
      if (data.stream) {
        client.emit('ai:stream', { chunk: '', done: true, fullContent: errorMsg, source, error: true })
      } else {
        client.emit('ai:response', { content: errorMsg, source, error: true })
      }
    }
  }

  @SubscribeMessage('ai:quiz-gen')
  async handleAiQuizGen(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: {
      topic: string
      count?: number
      types?: string[]
      difficulty?: string
      courseContext?: string
      model?: string
      apiKey?: string
      baseUrl?: string
    },
  ) {
    this.logger.log(`AI quiz gen [${data.model || 'default'}]: ${data.topic}`)
    try {
      const result = await this.aiService.generateQuiz(data)
      client.emit('ai:quiz-gen', result)
    } catch (err) {
      this.logger.error(`AI quiz gen error: ${err}`)
      client.emit('ai:quiz-gen', { questions: [], error: 'AI 出题失败' })
    }
  }

  @SubscribeMessage('ai:grade')
  async handleAiGrade(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: {
      question: string
      studentAnswer: string
      referenceAnswer?: string
      commentPrompt?: string
      maxScore?: number
      model?: string
      apiKey?: string
      baseUrl?: string
    },
  ) {
    try {
      const result = await this.aiService.gradeAnswer(data)
      client.emit('ai:grade', result)
    } catch (err) {
      this.logger.error(`AI grade error: ${err}`)
      client.emit('ai:grade', { score: 0, comment: 'AI 批改失败', error: true })
    }
  }

  /**
   * 教师点"AI 板书"-> 服务端 AI 生成结构化 items -> 推给整教室所有 client（含大屏）
   * 也回给老师一份用于本地预览
   */
  @SubscribeMessage('ai:whiteboard:gen')
  async handleAiWhiteboardGen(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: {
      topic: string
      courseContext?: string
      extraHint?: string
      model?: string
      apiKey?: string
      baseUrl?: string
      /** broadcast=true 则同时推给整教室（含大屏） */
      broadcast?: boolean
    },
  ) {
    this.logger.log(`AI whiteboard gen [${data.model || 'default'}]: ${data.topic}`)
    try {
      const result = await this.aiService.generateWhiteboard(data)
      const payload = {
        topic: data.topic,
        title: result.title,
        subtitle: result.subtitle,
        items: result.items,
        error: result.error,
        generatedAt: new Date().toISOString(),
      }
      client.emit('ai:whiteboard:gen', payload)
      if (data.broadcast) {
        const roomId = this.socketToRoom.get(client.id)
        if (roomId) {
          this.emitToRoom(roomId, 'ai:whiteboard:show', payload)
        }
      }
    } catch (err: any) {
      this.logger.error(`AI whiteboard gen error: ${err?.message || err}`)
      client.emit('ai:whiteboard:gen', { error: 'AI 板书生成失败：' + (err?.message || String(err)) })
    }
  }

  /** 教师可以"关闭板书" → 通知大屏隐藏 */
  @SubscribeMessage('ai:whiteboard:hide')
  handleAiWhiteboardHide(@ConnectedSocket() client: Socket) {
    const roomId = this.socketToRoom.get(client.id)
    if (roomId) {
      this.emitToRoom(roomId, 'ai:whiteboard:hide')
    }
  }

  /**
   * 教师点"AI 生成 HTML 交互场景" -> 服务端调 AI 生成 + 清洗 -> 推给整教室学生平板
   * 也会回给老师一份用于本地预览
   */
  @SubscribeMessage('ai:interactive:gen')
  async handleAiInteractiveGen(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: {
      topic: string
      courseContext?: string
      extraHint?: string
      model?: string
      apiKey?: string
      baseUrl?: string
      /** broadcast=true 则同时推给整教室学生（默认 false：仅返回给请求方） */
      broadcast?: boolean
    },
  ) {
    this.logger.log(`AI interactive gen [${data.model || 'default'}]: ${data.topic}`)
    try {
      const result = await this.aiService.generateInteractive(data)
      const payload = {
        topic: data.topic,
        title: result.title,
        description: result.description,
        html: result.html,
        sanitizeStats: result.sanitizeStats,
        error: result.error,
        generatedAt: new Date().toISOString(),
      }
      client.emit('ai:interactive:gen', payload)
      if (data.broadcast) {
        const roomId = this.socketToRoom.get(client.id)
        if (roomId) {
          this.emitToRoom(roomId, 'ai:interactive:show', payload)
        }
      }
    } catch (err: any) {
      this.logger.error(`AI interactive gen error: ${err?.message || err}`)
      client.emit('ai:interactive:gen', { error: 'AI 生成失败：' + (err?.message || String(err)) })
    }
  }

  @SubscribeMessage('admin:subscribe')
  handleAdminSubscribe(@ConnectedSocket() client: Socket) {
    client.join(ADMIN_OBSERVERS_ROOM)
    this.handleAdminRooms(client)
    this.logger.log(`Admin observer subscribed: ${client.id}`)
  }

  @SubscribeMessage('admin:unsubscribe')
  handleAdminUnsubscribe(@ConnectedSocket() client: Socket) {
    client.leave(ADMIN_OBSERVERS_ROOM)
  }

  @SubscribeMessage('admin:broadcast')
  handleAdminBroadcast(@ConnectedSocket() client: Socket, @MessageBody() data: { message: string; type?: string }) {
    const roomId = this.socketToRoom.get(client.id)
    const member = roomId ? this.rooms.get(roomId)?.members.get(client.id) : null
    if (!member || member.role !== 'admin') {
      client.emit('error:permission', { message: '此操作仅管理员可执行' })
      return
    }
    const message = String(data?.message || '').trim()
    if (!message) return
    const payload = { message, type: data?.type || 'text', from: `管理员·${member.userName || ''}` }
    let count = 0
    for (const [rid, room] of this.rooms.entries()) {
      if (room.lessonId === 'admin-monitor') continue
      this.server.to(rid).emit('broadcast:msg', payload)
      count++
    }
    this.server.to(ADMIN_OBSERVERS_ROOM).emit('admin:event', {
      roomId: 'admin',
      lessonId: 'admin',
      event: 'broadcast:msg',
      data: { ...payload, _global: true, lessonsReached: count },
      time: new Date().toISOString(),
    })
    client.emit('admin:broadcast:ack', { lessonsReached: count })
    this.logger.log(`Admin global broadcast → ${count} lessons: ${message}`)
  }

  @SubscribeMessage('rooms:list')
  handleRoomsList(@ConnectedSocket() client: Socket) {
    const rooms = Array.from(this.rooms.entries())
      .filter(([, room]) => room.lessonId !== 'admin-monitor' && room.members.size > 0)
      .map(([roomId, room]) => {
        const teacher = Array.from(room.members.values()).find(m => m.role === 'teacher' && m.clientType === 'teacher-tablet')
        return {
          roomId,
          lessonId: room.lessonId,
          teacherName: teacher?.userName || '',
          memberCount: room.members.size,
          studentCount: Array.from(room.members.values()).filter(m => m.role === 'student').length,
          hasScreen: Array.from(room.members.values()).some(m => m.clientType === 'teacher-screen'),
          activeQuiz: !!(room.activeQuiz && room.activeQuiz.status === 'in_progress'),
          activeCompete: !!(room.activeCompete?.active),
          activeAttendance: !!(room.activeAttendance?.active),
          isLocked: room.isLocked,
        }
      })
      .sort((a, b) => b.memberCount - a.memberCount)
    client.emit('rooms:list', rooms)
  }

  @SubscribeMessage('admin:rooms')
  handleAdminRooms(@ConnectedSocket() client: Socket) {
    const rooms = Array.from(this.rooms.entries())
      .filter(([_, room]) => room.lessonId !== 'admin-monitor')
      .map(([roomId, room]) => ({
        roomId,
        lessonId: room.lessonId,
        memberCount: room.members.size,
        studentCount: Array.from(room.members.values()).filter(m => m.role === 'student').length,
        currentSlide: room.currentSlide,
        totalSlides: room.totalSlides,
        isLocked: room.isLocked,
        activeQuiz: room.activeQuiz
          ? {
              taskId: room.activeQuiz.taskId,
              title: room.activeQuiz.title,
              status: room.activeQuiz.status,
              submittedCount: room.activeQuiz.submissions.size,
              totalStudents: room.activeQuiz.expectedStudentIds.size,
            }
          : null,
        members: Array.from(room.members.values()).map(m => ({
          userId: m.userId,
          userName: m.userName,
          role: m.role,
          clientType: m.clientType,
        })),
      }))
    client.emit('admin:rooms', rooms)
  }

  @SubscribeMessage('heartbeat')
  handleHeartbeat(@ConnectedSocket() client: Socket) {
    client.emit('heartbeat', { timestamp: Date.now() })
  }

  private broadcastMemberUpdate(roomId: string) {
    const room = this.rooms.get(roomId)
    if (!room) return

    const members = Array.from(room.members.values()).map(m => ({
      userId: m.userId,
      userName: m.userName,
      role: m.role,
      clientType: m.clientType,
      onlineAt: m.joinedAt.toISOString(),
    }))

    const students = members.filter(m => m.role === 'student')

    this.emitToRoom(roomId, 'member:update', {
      members,
      onlineCount: members.length,
      studentCount: students.length,
    })
  }
}
