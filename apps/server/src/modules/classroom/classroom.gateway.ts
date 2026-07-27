import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets'
import { Logger, Optional, Inject } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import { Server, Socket } from 'socket.io'
import { RoomEvent } from '@snyuan/shared'
import { AiService, type WhiteboardGenResult, type InteractiveGenResult } from '../ai/ai.service'
import { AccessCodeService } from '../access-code/access-code.service'
import { WrongBookService, type WrongQuestionInput } from '../wrong-book/wrong-book.service'
import { ClassroomSessionService } from '../classroom-session/classroom-session.service'
import { LearningRecordService } from '../platform/learning-record.service'
import { PlatformConfigService } from '../platform/platform-config.service'
import type { ClassroomPlatformContext } from '../platform/platform.types'

interface RoomMember {
  socketId: string
  userId: string
  userName: string
  role: 'teacher' | 'student' | 'admin'
  clientType: string
  tenantId: string
  schoolId: string
  classId?: string
  className?: string
  gradeId?: string
  subject?: string
  externalUserId?: string
  phone?: string
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
  randomMode?: boolean
  perStudentCount?: number
  questionPool?: QuizQuestion[]
  studentQuestionMap?: Map<string, string[]>
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
  photo?: string
  location?: {
    latitude: number
    longitude: number
    accuracy?: number
  }
  distance?: number
  verified?: boolean
}

interface ActiveAttendance {
  mode: string
  duration: number
  startedAt: number
  active: boolean
  signed: AttendanceSigned[]
  signedIds: Set<string>
  requirePhoto?: boolean
  requireLocation?: boolean
  radius?: number
  teacherLocation?: {
    latitude: number
    longitude: number
  }
  autoEndTimer?: ReturnType<typeof setTimeout>
}

type PollKind = 'choice' | 'text' | 'rating'

/** P0 互动：统一的投票/问卷/词云/评分活动（kind 区分） */
interface ActivePoll {
  pollId: string
  kind: PollKind
  question: string
  /** choice 专用：选项文案 */
  options?: string[]
  /** choice 专用：最多可选几项（默认 1） */
  maxSelect?: number
  /** rating 专用：最高分（默认 5） */
  max?: number
  startedAt: number
  /** 可选限时（秒），到点自动结束 */
  durationSec?: number
  /** studentId → 提交值（choice: number[]；text: string；rating: number） */
  submissions: Map<string, number[] | string | number>
  autoStopTimer?: ReturnType<typeof setTimeout>
}

/** P0 互动：课堂计时器/倒计时（late-join 用 startedAt 算剩余） */
interface ClassTimer {
  timerId: string
  durationSec: number
  label?: string
  startedAt: number
}

/** P1 答案上墙 / 作品墙：单条提交 */
interface WallItem {
  id: string
  studentId: string
  studentName: string
  text?: string
  image?: string
  picked: boolean
  ts: number
}

/** P1 答案上墙 / 作品墙：当前墙 */
interface ActiveWall {
  wallId: string
  prompt: string
  allowImage: boolean
  items: Map<string, WallItem>
}

interface AnnotationPoint {
  x: number
  y: number
}

interface AnnotationStroke {
  id: string
  slideIndex: number
  color: string
  width: number
  points: AnnotationPoint[]
  createdBy: string
  createdAt: number
}

interface RoomState {
  lessonId: string
  context: ClassroomPlatformContext
  studentEntryOpen: boolean
  lessonMeta: {
    courseName: string
    lessonTitle: string
    roomCode: string
    startedAt: string
    resetState?: boolean
  } | null
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
  /** P0 互动：当前投票/问卷/词云/评分（内存态） */
  activePoll: ActivePoll | null
  /** P0 互动：弹幕是否开启（教师控制） */
  danmakuEnabled: boolean
  /** P0 互动：情绪反馈滚动窗口（近 60s），用于实时情绪热度 */
  reactions: { recent: Array<{ type: string; ts: number }> }
  /** P0 互动：随机点名已点过的学生（避免短期重复），点满一轮自动清空 */
  recentlyCalled: Set<string>
  /** P0 互动：课堂计时器/倒计时（内存态） */
  timer: ClassTimer | null
  /** P1 游戏化：学生积分（studentId → {name, points}） */
  points: Map<string, { name: string; points: number }>
  /** P1 游戏化：小组归属（studentId → {groupId, groupName}），用于小组 PK 聚合 */
  studentGroups: Map<string, { groupId: string; groupName: string }>
  /** P1 答案上墙 / 作品墙（内存态） */
  activeWall: ActiveWall | null
  /**
   * 每页的"已完成"笔画集合，按 slideIndex 索引；翻页或学生中途加入需要全量回放。
   * 上传新课件 / 结课会清空。
   */
  annotations: Map<number, AnnotationStroke[]>
  /**
   * 正在进行的笔（教师手指还按着没抬起）；用于 stroke:start → point → end 的拼装。
   * key = strokeId。
   */
  activeStrokes: Map<string, AnnotationStroke>

  /**
   * 课堂分析报告的全堂累计数据池。
   * - lesson:start 时初始化（或 resetLesson 时清零）
   * - 各业务 handler 在结束/触发时 push / increment
   * - lesson:report:gen 时由 buildLessonReportInput 读取
   */
  reportData: {
    /** 累计完成的测验快照（taskId / title / 题数 / 提交数 / 平均分 / 知识掌握度 / questionStats）*/
    quizHistory: Array<{
      taskId: string
      title: string
      questions: any[]
      questionStats: any[]
      submittedCount: number
      avgScore: number
      knowledgeMastery: Array<{ knowledgePointName: string; masteryPercent: number; status: string }>
      startedAt: string
      endedAt: string
    }>
    /** 累计的抢答历史 */
    competeHistory: Array<{ question: string; startedAt: number; winner: { studentId: string; studentName: string } | null; totalResponders: number }>
    /** 累计的分组讨论历史 */
    discussionHistory: Array<{ topic: string; groupCount: number; duration: number; startedAt: number }>
    /** 累计的 AI 实践推送 */
    practiceHistory: Array<{ topic: string; prompt?: string; startedAt: string }>
    /** 累计的 AI 板书推送 */
    whiteboardHistory: Array<{ topic: string; title?: string; itemCount: number; pushedAt: string }>
    /** 累计的 AI 课件生成（暂不细节，只计次数） */
    coursewareHistory: Array<{ topic?: string; slideCount: number; createdAt: string }>
    /** 累计的签到（含 attendance:end 后保留） */
    attendanceHistory: Array<{ mode: string; startedAt: number; endedAt?: number; signed: AttendanceSigned[] }>
    /** 学生 AI 对话计数（按 student id 聚合） */
    aiChatCount: number
    /** 累计举手次数 */
    handRaiseCount: number
    /** 累计学生提问（持久版本，与 in-memory questions 区分） */
    questions: Array<{ studentId: string; studentName: string; text: string; time: string }>
    /** 累计锁屏 / 解锁次数 */
    lockCount: number
    /** 学生焦点丢失次数（切后台 / 离开应用） */
    focusLostCount: number
  }
}

function createEmptyReportData(): RoomState['reportData'] {
  return {
    quizHistory: [],
    competeHistory: [],
    discussionHistory: [],
    practiceHistory: [],
    whiteboardHistory: [],
    coursewareHistory: [],
    attendanceHistory: [],
    aiChatCount: 0,
    handRaiseCount: 0,
    questions: [],
    lockCount: 0,
    focusLostCount: 0,
  }
}

const TRUE_TOKENS = new Set(['TRUE', 'T', 'YES', 'Y', '1', 'A', '对', '正确', '是'])
const FALSE_TOKENS = new Set(['FALSE', 'F', 'NO', 'N', '0', 'B', '错', '错误', '否'])

function unifyToken(t: string): string {
  return t.normalize('NFKC').trim().toUpperCase()
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0
  if (n < 0) return 0
  if (n > 1) return 1
  return n
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
// 引用 shared 中的事件常量，事件改名时编译器可同时检查 gateway 与前端
const ADMIN_OBSERVED_EVENTS = new Set<string>([
  RoomEvent.SlideGoto,
  RoomEvent.TaskPush,
  RoomEvent.QuizStart,
  RoomEvent.QuizProgress,
  RoomEvent.QuizGrading,
  RoomEvent.QuizReport,
  RoomEvent.QuizStop,
  RoomEvent.AnswerSubmitted,
  RoomEvent.HandRaise,
  RoomEvent.HandLower,
  RoomEvent.ScreenLock,
  RoomEvent.ScreenUnlock,
  RoomEvent.BroadcastMsg,
  RoomEvent.GroupCreate,
  RoomEvent.GroupDissolve,
  RoomEvent.RollCall,
  RoomEvent.QuestionNew,
  RoomEvent.AttendanceStart,
  RoomEvent.AttendanceEnd,
  RoomEvent.AttendanceSigned,
  RoomEvent.CompeteStart,
  RoomEvent.CompeteStop,
  RoomEvent.CompeteAnswer,
  RoomEvent.GroupMsg,
  RoomEvent.LessonStart,
  RoomEvent.LessonEnd,
  RoomEvent.SlidesLoaded,
  RoomEvent.AiPracticeStart,
  RoomEvent.AiPracticeEnd,
  RoomEvent.AiInteractiveShow,
  RoomEvent.AiInteractiveHide,
  RoomEvent.MemberUpdate,
  RoomEvent.HomeworkPublish,
  RoomEvent.AnnotationStrokeStart,
  RoomEvent.AnnotationStrokePoint,
  RoomEvent.AnnotationStrokeEnd,
  RoomEvent.AnnotationClear,
  RoomEvent.AnnotationUndo,
  RoomEvent.PollStart,
  RoomEvent.PollStop,
  RoomEvent.RollCallResult,
  RoomEvent.TimerStart,
  RoomEvent.TimerStop,
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
  /** 房间空置后的延迟销毁定时器，给短暂断网/切端的教师 90 秒回归窗口 */
  private roomCleanupTimers = new Map<string, ReturnType<typeof setTimeout>>()
  /** 课件 beam: sessionId → 等待接收的教师平板 socket.id（CoursewareUploadController 推时用）*/
  private coursewareUploadSubscribers = new Map<string, string>()
  private quizGenCounter = 0

  /** 房间空置宽限期：成员归零后多久才真正销毁房间（毫秒） */
  private static readonly ROOM_GRACE_MS = 90_000

  /** P0 互动：合法的情绪反馈类型 */
  private static readonly REACTION_TYPES = new Set(['got', 'confused', 'tooFast', 'like', 'applause'])
  /** P0 互动：情绪热度聚合窗口（毫秒） */
  private static readonly REACTION_WINDOW_MS = 60_000

  /** WS 鉴权策略：required = 必须 JWT，optional = 有 JWT 就用，off = 完全不校验（默认，向后兼容） */
  private readonly wsAuthMode: 'required' | 'optional' | 'off'

  constructor(
    private readonly aiService: AiService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly accessCode: AccessCodeService,
    private readonly platformConfig: PlatformConfigService,
    private readonly learningRecords: LearningRecordService,
    // 错题本服务：仅 DB 启用时存在（WrongBookModule @Global）；内存模式下为 undefined，落库钩子自动跳过
    @Optional() @Inject(WrongBookService) private readonly wrongBook?: WrongBookService,
    // 同款可选注入：DB 未配置时为 undefined，会话落库自动 no-op
    @Optional() @Inject(ClassroomSessionService) private readonly sessions?: ClassroomSessionService,
  ) {
    const raw = (this.config.get<string>('WS_AUTH_MODE', 'off') || 'off').toLowerCase()
    this.wsAuthMode = raw === 'required' || raw === 'optional' ? raw : 'off'
    this.logger.log(`WS auth mode: ${this.wsAuthMode}`)
  }

  /**
   * 取出 socket handshake 里携带的 token。
   * 客户端有三种传法（兼容已有前端）：
   *   - socket.io 客户端 `auth: { token: '...' }` （推荐）
   *   - socket.io 客户端 `extraHeaders: { Authorization: 'Bearer xxx' }`
   *   - cookie `snyuan_access`（站点访问码 token，用于免 JWT 场景）
   */
  private extractAuthToken(client: Socket): { jwtToken?: string; accessToken?: string } {
    const auth = (client.handshake.auth as Record<string, any> | undefined) || {}
    const headers = client.handshake.headers || {}
    const authHeader = (headers['authorization'] || headers['Authorization']) as string | undefined
    const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : undefined
    const accessHeader = authHeader?.startsWith('AccessCode ') ? authHeader.slice(11).trim() : undefined

    // cookie 解析（socket.io handshake 自带原始 cookie 字符串）
    const cookieStr = (headers['cookie'] as string | undefined) || ''
    const cookieMap = new Map<string, string>()
    cookieStr.split(/;\s*/).forEach(kv => {
      const i = kv.indexOf('=')
      if (i > 0) cookieMap.set(kv.slice(0, i).trim(), decodeURIComponent(kv.slice(i + 1)))
    })

    return {
      jwtToken: (auth.token as string) || bearer,
      accessToken:
        (auth.accessCode as string) || accessHeader || cookieMap.get(this.accessCode.cookieName),
    }
  }

  /** 校验 JWT 并返回 payload；失败返回 null */
  private verifyJwt(token: string | undefined): { sub?: string; role?: string; username?: string } | null {
    if (!token) return null
    try {
      return this.jwt.verify(token, { secret: this.config.get<string>('JWT_SECRET', 'snyuan-default-secret') })
    } catch {
      return null
    }
  }

  private isRoomCode(lessonId: string): boolean {
    return /^\d{6}$/.test(lessonId)
  }

  private isValidRole(role: string): role is RoomMember['role'] {
    return role === 'teacher' || role === 'student' || role === 'admin'
  }

  private isValidClientType(clientType: string): boolean {
    return [
      'teacher-screen',
      'teacher-tablet',
      'teacher-uniapp',
      'student-tablet',
      'admin',
    ].includes(clientType)
  }

  private isScreenJoin(data: { role: string; clientType: string }): boolean {
    return data.role === 'teacher' && data.clientType === 'teacher-screen'
  }

  private isTeacherControllerJoin(data: { role: string; clientType: string }): boolean {
    return data.role === 'teacher' && (data.clientType === 'teacher-tablet' || data.clientType === 'teacher-uniapp')
  }

  private isTeacherControllerMember(member: RoomMember): boolean {
    return this.isTeacherControllerJoin(member)
  }

  private roomHasScreen(room: RoomState): boolean {
    return Array.from(room.members.values()).some(m => m.clientType === 'teacher-screen')
  }

  private normalizeQuestionType(type: any): string {
    const value = String(type || '').trim()
    if (value === 'single') return 'single_choice'
    if (value === 'multiple') return 'multiple_choice'
    if (value === 'judge' || value === 'boolean') return 'true_false'
    if (value === 'short' || value === 'essay') return 'short_answer'
    return value || 'single_choice'
  }

  private normalizeQuestionOptions(options: any): QuizQuestionOption[] | undefined {
    if (!Array.isArray(options)) return undefined
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    const normalized = options
      .map((opt: any, idx: number) => {
        if (typeof opt === 'string') {
          const raw = opt.trim()
          const matched = raw.match(/^([A-Z])[\.\、\s]+(.+)$/i)
          return {
            key: (matched?.[1] || letters[idx] || String(idx + 1)).toUpperCase(),
            content: (matched?.[2] || raw).trim(),
          }
        }
        const key = String(opt?.key || opt?.label || letters[idx] || idx + 1).trim().toUpperCase()
        const content = String(opt?.content || opt?.text || opt?.value || '').trim()
        return { key, content }
      })
      .filter((opt: QuizQuestionOption) => opt.key && opt.content)
    return normalized.length > 0 ? normalized : undefined
  }

  private normalizeQuestionAnswer(answer: any, options?: QuizQuestionOption[]): string | undefined {
    if (answer == null) return undefined
    const letters = options?.map(o => o.key) || []
    const toToken = (value: any) => {
      if (typeof value === 'number' && letters[value]) return letters[value]
      return String(value).trim()
    }
    return Array.isArray(answer)
      ? answer.map(toToken).filter(Boolean).join(',')
      : toToken(answer)
  }

  private rejectJoin(client: Socket, code: string, message: string) {
    const payload = { code, message }
    client.emit('room:join:error', payload)
    client.emit('error:permission', payload)
  }

  handleConnection(client: Socket) {
    this.logger.log(`Connected: ${client.id}`)

    // 站点访问码（若启用）：WS 也必须带 token，否则立即断开
    if (this.accessCode.isEnabled()) {
      const { accessToken } = this.extractAuthToken(client)
      if (!this.accessCode.verifyToken(accessToken)) {
        client.emit('error:auth', { code: 'ACCESS_CODE_REQUIRED', message: '需要站点访问码' })
        client.disconnect(true)
        this.logger.warn(`WS rejected: missing/invalid access code (${client.id})`)
        return
      }
    }

    // JWT 鉴权（required 模式下不通过即断开；optional 模式仅在 join 时校对身份；off 模式跳过）
    if (this.wsAuthMode === 'required') {
      const { jwtToken } = this.extractAuthToken(client)
      const payload = this.verifyJwt(jwtToken)
      if (!payload) {
        client.emit('error:auth', { code: 'JWT_REQUIRED', message: '需要登录令牌' })
        client.disconnect(true)
        this.logger.warn(`WS rejected: missing/invalid JWT (${client.id})`)
        return
      }
      ;(client.data as Record<string, unknown>).authPayload = payload
    }
  }

  handleDisconnect(client: Socket) {
    // 清理课件 beam 订阅，避免 stale socketId 泄漏
    for (const [sid, sockId] of this.coursewareUploadSubscribers.entries()) {
      if (sockId === client.id) this.coursewareUploadSubscribers.delete(sid)
    }
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
        if (member?.userId) {
          this.persistSession(() => this.sessions!.recordLeave(room.lessonId, member.userId))
        }
        if (member) this.logger.log(`${member.userName}(${member.clientType}) left ${roomId}`)
        if (room.members.size === 0 && (!room.activeQuiz || room.activeQuiz.status === 'completed')) {
          this.scheduleRoomCleanup(roomId)
        }
      }
    }
  }

  /**
   * 房间归零后启动延迟销毁定时器。`ROOM_GRACE_MS` 内若有任何 socket 重新 `room:join`
   * 同一 lessonId，定时器会被取消，房间继续存活；否则到期后真正销毁。
   *
   * 设计动机：教师从平板切回桌面 / 短暂掉网 / 切 wifi 时，老的 socket 会被销毁
   * 然后新 socket 在几秒内重连。如果原行为"members.size===0 立即 delete"，
   * 此时课件 / 知识点 / 测验结果都会被清空，体验非常糟糕。
   */
  private scheduleRoomCleanup(roomId: string) {
    const existing = this.roomCleanupTimers.get(roomId)
    if (existing) clearTimeout(existing)
    const timer = setTimeout(() => {
      this.roomCleanupTimers.delete(roomId)
      const room = this.rooms.get(roomId)
      if (!room) return
      if (room.members.size > 0) return // 期间有人回归
      if (room.activeQuiz && room.activeQuiz.status === 'in_progress') return // quiz 还没收尾
      this.rooms.delete(roomId)
      const t = this.autoCompleteTimers.get(roomId)
      if (t) { clearTimeout(t); this.autoCompleteTimers.delete(roomId) }
      this.logger.log(`Room ${roomId} cleaned up after grace period`)
    }, ClassroomGateway.ROOM_GRACE_MS)
    this.roomCleanupTimers.set(roomId, timer)
  }

  private cancelRoomCleanup(roomId: string) {
    const t = this.roomCleanupTimers.get(roomId)
    if (t) {
      clearTimeout(t)
      this.roomCleanupTimers.delete(roomId)
    }
  }

  private getTeacher(client: Socket): { roomId: string; room: RoomState; member: RoomMember } | null {
    const roomId = this.socketToRoom.get(client.id)
    if (!roomId) return null
    const room = this.rooms.get(roomId)
    if (!room) return null
    const member = room.members.get(client.id)
    if (!member) return null
    if (member.role !== 'teacher' || !this.isTeacherControllerMember(member)) {
      client.emit('error:permission', { message: '此操作仅教师可执行', op: client.id })
      return null
    }
    return { roomId, room, member }
  }

  /**
   * 返回当前房间正在进行的"高优先级独占活动"标签；无则返回 null。
   * 用于 task/ai-practice 等会切换学生屏幕状态的操作的互斥检查。
   * quiz:start 仍保留"自动结束其他活动"的语义，不走此函数。
   */
  private getBlockingActivityLabel(room: RoomState): string | null {
    if (room.activeQuiz && room.activeQuiz.status === 'in_progress') return '随堂测验'
    if (room.activeCompete?.active) return '抢答'
    if (room.activeAttendance?.active) return '签到'
    return null
  }

  private emitToRoom(roomId: string, event: string, data?: any) {
    this.server.to(roomId).emit(event, data)
    if (ADMIN_OBSERVED_EVENTS.has(event)) {
      const room = this.rooms.get(roomId)
      this.server.to(ADMIN_OBSERVERS_ROOM).emit('admin:event', {
        roomId,
        lessonId: roomId.startsWith('lesson:') ? roomId.slice('lesson:'.length) : roomId,
        context: room?.context,
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

  private resolveJoinContext(data: {
    tenantId?: string
    schoolId?: string
    classId?: string
    className?: string
    gradeId?: string
    subject?: string
    externalUserId?: string
    phone?: string
  }): ClassroomPlatformContext {
    return this.platformConfig.resolveClassroomContext({
      tenantId: data.tenantId,
      schoolId: data.schoolId,
      classId: data.classId,
      className: data.className,
      gradeId: data.gradeId,
      subject: data.subject,
      externalUserId: data.externalUserId,
      phone: data.phone,
    })
  }

  /**
   * 会话落库的统一入口：DB 未配置时直接跳过，写库失败只记日志。
   * 正在上的课不能因为一次写库失败被打断，所以这里刻意不 await、不抛出。
   */
  private persistSession(run: () => Promise<unknown>): void {
    if (!this.sessions) return
    void run().catch(err => this.logger.warn(`课堂会话落库失败：${err?.message || err}`))
  }

  @SubscribeMessage('room:join')
  handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: {
      lessonId: string
      userId: string
      userName: string
      role: string
      clientType: string
      tenantId?: string
      schoolId?: string
      classId?: string
      className?: string
      gradeId?: string
      subject?: string
      externalUserId?: string
      phone?: string
    },
  ) {
    // 如果 WS 启用 JWT 鉴权（required / optional），用 token payload 覆盖客户端声明的 userId/role，
    // 防止学生改前端代码假装成教师。
    if (this.wsAuthMode !== 'off') {
      const { jwtToken } = this.extractAuthToken(client)
      const payload = this.verifyJwt(jwtToken)
      if (this.wsAuthMode === 'required' && !payload) {
        client.emit('error:auth', { code: 'JWT_REQUIRED', message: '加入课堂需要登录' })
        return
      }
      if (payload) {
        if (payload.sub) data.userId = payload.sub
        if (payload.role) data.role = payload.role
        if (payload.username && !data.userName) data.userName = payload.username
      }
    }

    data.lessonId = String(data.lessonId || '').trim()
    data.userId = String(data.userId || '').trim()
    data.userName = String(data.userName || '').trim()
    data.role = String(data.role || '').trim()
    data.clientType = String(data.clientType || '').trim()
    data.tenantId = String(data.tenantId || '').trim()
    data.schoolId = String(data.schoolId || '').trim()
    data.classId = String(data.classId || '').trim()
    data.className = String(data.className || '').trim()
    data.gradeId = String(data.gradeId || '').trim()
    data.subject = String(data.subject || '').trim()
    data.externalUserId = String(data.externalUserId || '').trim()
    data.phone = String(data.phone || '').trim()

    if (!data.lessonId || !this.isValidRole(data.role) || !this.isValidClientType(data.clientType)) {
      this.rejectJoin(client, 'INVALID_JOIN_PAYLOAD', '加入课堂参数无效')
      return
    }

    const isAdminMonitor = data.lessonId === 'admin-monitor' && data.role === 'admin' && data.clientType === 'admin'
    if (!isAdminMonitor && !this.isRoomCode(data.lessonId)) {
      this.rejectJoin(client, 'INVALID_ROOM_CODE', '课堂码必须是 6 位数字')
      return
    }

    const roomId = `lesson:${data.lessonId}`
    const existingRoom = this.rooms.get(roomId)
    const isScreen = this.isScreenJoin(data)
    const isTeacherController = this.isTeacherControllerJoin(data)
    const isStudent = data.role === 'student'
    const joinContext = this.resolveJoinContext(data)

    if (!existingRoom && !isScreen && !isAdminMonitor) {
      this.rejectJoin(client, 'SCREEN_NOT_READY', '请先在大屏展示二维码，并由教师扫码接管')
      return
    }

    if (existingRoom && !isScreen && !isAdminMonitor && !this.roomHasScreen(existingRoom)) {
      this.rejectJoin(client, 'SCREEN_NOT_READY', '当前课堂未绑定大屏，请先扫码接管大屏')
      return
    }

    if (isStudent && (!existingRoom || !existingRoom.studentEntryOpen)) {
      this.rejectJoin(client, 'WAITING_TEACHER_TAKEOVER', '请等待教师扫码接管大屏后再加入课堂')
      return
    }

    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, {
        lessonId: data.lessonId,
        context: joinContext,
        studentEntryOpen: false,
        lessonMeta: null,
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
        activePoll: null,
        danmakuEnabled: false,
        reactions: { recent: [] },
        recentlyCalled: new Set(),
        timer: null,
        points: new Map(),
        studentGroups: new Map(),
        activeWall: null,
        annotations: new Map(),
        activeStrokes: new Map(),
        reportData: createEmptyReportData(),
      })
    }

    // 有人重新加入 → 取消该房间的延迟销毁
    this.cancelRoomCleanup(roomId)

    const room = this.rooms.get(roomId)!
    let memberContext = existingRoom
      ? this.platformConfig.mergeContext(room.context, data)
      : joinContext
    if (isScreen || isTeacherController || isAdminMonitor) {
      room.context = this.platformConfig.mergeContext(room.context, data)
      memberContext = room.context
    }
    if (isTeacherController) {
      room.studentEntryOpen = true
    }

    const prevRoomId = this.socketToRoom.get(client.id)
    if (prevRoomId && prevRoomId !== roomId) {
      const prevRoom = this.rooms.get(prevRoomId)
      if (prevRoom) {
        prevRoom.members.delete(client.id)
        client.leave(prevRoomId)
        this.broadcastMemberUpdate(prevRoomId)
        if (prevRoom.members.size === 0 && (!prevRoom.activeQuiz || prevRoom.activeQuiz.status === 'completed')) {
          this.scheduleRoomCleanup(prevRoomId)
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
      tenantId: memberContext.tenantId,
      schoolId: memberContext.schoolId,
      classId: memberContext.classId,
      className: memberContext.className,
      gradeId: memberContext.gradeId,
      subject: memberContext.subject,
      externalUserId: memberContext.externalUserId,
      phone: memberContext.phone,
      joinedAt: new Date(),
    })

    this.socketToRoom.set(client.id, roomId)
    client.join(roomId)

    this.persistSession(() =>
      this.sessions!.recordJoin(data.lessonId, room.context, {
        userId: data.userId,
        userName: data.userName,
        role: data.role,
        clientType: data.clientType,
        tenantId: memberContext.tenantId,
        schoolId: memberContext.schoolId,
        classId: memberContext.classId,
        externalUserId: memberContext.externalUserId,
      }),
    )

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
      tenantId: m.tenantId,
      schoolId: m.schoolId,
      classId: m.classId,
      className: m.className,
      gradeId: m.gradeId,
      subject: m.subject,
      externalUserId: m.externalUserId,
      phone: m.phone,
      onlineAt: m.joinedAt.toISOString(),
    }))

    const activeQuizSnapshot = room.activeQuiz && room.activeQuiz.status === 'in_progress'
      ? {
          taskId: room.activeQuiz.taskId,
          title: room.activeQuiz.title,
          questions: room.activeQuiz.randomMode ? [] : room.activeQuiz.questions,
          timeLimit: room.activeQuiz.timeLimit,
          status: room.activeQuiz.status,
          submittedCount: room.activeQuiz.submissions.size,
          totalStudents: room.activeQuiz.expectedStudentIds.size,
          randomMode: room.activeQuiz.randomMode || false,
          poolSize: room.activeQuiz.randomMode ? room.activeQuiz.questions.length : undefined,
          perStudentCount: room.activeQuiz.perStudentCount,
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
          requirePhoto: room.activeAttendance.requirePhoto,
          requireLocation: room.activeAttendance.requireLocation,
          radius: room.activeAttendance.radius,
          teacherLocation: room.activeAttendance.teacherLocation,
        }
      : null

    client.emit('room:joined', {
      roomId,
      currentSlide: room.currentSlide,
      totalSlides: room.totalSlides,
      isLocked: room.isLocked,
      memberCount: room.members.size,
      context: room.context,
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
      activePoll: room.activePoll
        ? {
            pollId: room.activePoll.pollId,
            kind: room.activePoll.kind,
            question: room.activePoll.question,
            options: room.activePoll.options,
            maxSelect: room.activePoll.maxSelect,
            max: room.activePoll.max,
            startedAt: room.activePoll.startedAt,
            durationSec: room.activePoll.durationSec,
            total: room.activePoll.submissions.size,
            hasSubmitted: data.role === 'student' ? room.activePoll.submissions.has(data.userId) : false,
          }
        : null,
      classTimer: room.timer,
      danmakuEnabled: room.danmakuEnabled,
      leaderboard: this.buildLeaderboard(room),
      activeWall: room.activeWall
        ? {
            wallId: room.activeWall.wallId,
            prompt: room.activeWall.prompt,
            allowImage: room.activeWall.allowImage,
            items: Array.from(room.activeWall.items.values()),
          }
        : null,
      lessonMeta: room.lessonMeta,
      // 把整本课件的标注一次性发回，前端按当前页过滤展示
      annotations: this.serializeAnnotations(room),
    })

    if (room.slides.length > 0) {
      client.emit('slides:loaded', { slides: room.slides, total: room.slides.length })
    }

    // P0 互动：late-join 同步——用与实时相同的事件补发给刚加入的 socket，
    // 前端复用同一 handler，无需读 room:joined 里的快照字段。
    if (room.activePoll) {
      client.emit(RoomEvent.PollStart, {
        pollId: room.activePoll.pollId,
        kind: room.activePoll.kind,
        question: room.activePoll.question,
        options: room.activePoll.options,
        maxSelect: room.activePoll.maxSelect,
        max: room.activePoll.max,
        startedAt: room.activePoll.startedAt,
        durationSec: room.activePoll.durationSec,
      })
      const { total, stats } = this.computePollStats(room.activePoll)
      client.emit(RoomEvent.PollUpdate, { pollId: room.activePoll.pollId, kind: room.activePoll.kind, total, stats })
    }
    if (room.danmakuEnabled) {
      client.emit(RoomEvent.DanmakuToggle, { enabled: true })
    }
    if (room.timer) {
      client.emit(RoomEvent.TimerSync, room.timer)
    }

    if (
      data.role === 'student' &&
      room.activeQuiz?.status === 'in_progress' &&
      room.activeQuiz.randomMode &&
      room.activeQuiz.studentQuestionMap &&
      !room.activeQuiz.studentQuestionMap.has(data.userId)
    ) {
      room.activeQuiz.expectedStudentIds.add(data.userId)
      this.assignRandomQuestions(room.activeQuiz, data.userId, client.id)
      this.logger.log(`Late student ${data.userName} auto-assigned ${room.activeQuiz.perStudentCount} random questions`)
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
    const blocker = this.getBlockingActivityLabel(ctx.room)
    if (blocker) {
      client.emit('task:push:error', {
        message: `已有「${blocker}」正在进行，请先结束后再推送新任务`,
      })
      this.logger.warn(`task:push rejected: ${blocker} active in ${ctx.roomId}`)
      return
    }
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
      const type = this.normalizeQuestionType(q?.type)
      const options = this.normalizeQuestionOptions(q?.options) || (type === 'true_false'
        ? [{ key: '对', content: '对' }, { key: '错', content: '错' }]
        : undefined)
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
        type,
        content: q.content || q.stem || '',
        options,
        answer: this.normalizeQuestionAnswer(q.answer, options),
        analysis: q.analysis,
        referenceAnswer: this.normalizeQuestionAnswer(q.referenceAnswer || q.answer, options),
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

    const isRandom = !!data.randomMode && questions.length > 1
    const perStudent = isRandom
      ? Math.max(1, Math.min(data.perStudentCount || 5, questions.length))
      : questions.length

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
      randomMode: isRandom,
      perStudentCount: perStudent,
      questionPool: isRandom ? questions : undefined,
      studentQuestionMap: isRandom ? new Map() : undefined,
    }
    room.activeTaskId = taskId
    if (room.activeCompete?.active) {
      room.activeCompete.active = false
      const stale = room.activeCompete
      this.emitToRoom(roomId, 'compete:stop', { winner: null, ranking: stale.responders.slice(0, 5) })
      setTimeout(() => { if (room.activeCompete === stale && !stale.active) room.activeCompete = null }, 4000)
    }
    if (room.activeAttendance?.active) {
      if (room.activeAttendance.autoEndTimer) {
        clearTimeout(room.activeAttendance.autoEndTimer)
        room.activeAttendance.autoEndTimer = undefined
      }
      room.activeAttendance.active = false
      const stale = room.activeAttendance
      this.emitToRoom(roomId, 'attendance:end')
      setTimeout(() => { if (room.activeAttendance === stale && !stale.active) room.activeAttendance = null }, 4000)
    }
    if (room.aiPractice) {
      room.aiPractice = null
    }

    if (isRandom) {
      const taskMeta = {
        id: taskId,
        title: data.title || '随堂测验',
        type: 'quiz',
        status: 'in_progress',
        createdAt: room.activeQuiz.startedAt,
        totalStudents: expectedStudentIds.size,
        randomMode: true,
        poolSize: questions.length,
        perStudentCount: perStudent,
        timeLimit: data.timeLimit,
      }
      this.emitToRoom(roomId, 'quiz:start', taskMeta)

      for (const member of room.members.values()) {
        if (member.role !== 'student') continue
        this.assignRandomQuestions(room.activeQuiz, member.userId, member.socketId)
      }
    } else {
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
    }
    this.logger.log(`Quiz started: ${data.title} (pool=${questions.length}, perStudent=${perStudent}, random=${isRandom}, students=${expectedStudentIds.size})`)
  }

  /** Fisher-Yates shuffle 抽取 N 题并单独推送给学生 */
  private assignRandomQuestions(quiz: ActiveQuiz, studentId: string, socketId: string) {
    if (!quiz.questionPool || !quiz.studentQuestionMap) return
    const pool = [...quiz.questionPool]
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]]
    }
    const count = quiz.perStudentCount || pool.length
    const selected = pool.slice(0, count)
    const ids = selected.map(q => q.id)
    quiz.studentQuestionMap.set(studentId, ids)

    this.server.to(socketId).emit('quiz:questions', {
      taskId: quiz.taskId,
      questions: selected,
      poolSize: quiz.questionPool.length,
      perStudentCount: count,
    })
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

    const assignedIds = quiz.randomMode && quiz.studentQuestionMap
      ? new Set(quiz.studentQuestionMap.get(submission.studentId))
      : null
    const questionsToGrade = assignedIds
      ? quiz.questions.filter(q => assignedIds.has(q.id))
      : quiz.questions

    for (const q of questionsToGrade) {
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
      const assignedIds = quiz.randomMode && quiz.studentQuestionMap
        ? new Set(quiz.studentQuestionMap.get(submission.studentId))
        : null
      const shortQs = assignedIds
        ? shortAnswerQuestions.filter(q => assignedIds.has(q.id))
        : shortAnswerQuestions

      for (const q of shortQs) {
        const studentAnswer = submission.answers[q.id] || ''
        if (!studentAnswer.trim()) {
          submission.perQuestion = submission.perQuestion || {}
          submission.perQuestion[q.id] = { score: 0, correct: false, comment: '未作答', aiGraded: true }
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
              correct: safeScore >= 60,
              earned: Math.round((safeScore / 100) * pts),
              points: pts,
              comment: result.comment,
              aiGraded: true,
            }
          }).catch(() => {
            submission.perQuestion = submission.perQuestion || {}
            submission.perQuestion[q.id] = {
              score: 60,
              correct: true,
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
      const assignedIds = quiz.randomMode && quiz.studentQuestionMap
        ? new Set(quiz.studentQuestionMap.get(submission.studentId))
        : null
      const gradedQuestions = assignedIds
        ? quiz.questions.filter(q => assignedIds.has(q.id))
        : quiz.questions

      for (const q of gradedQuestions) {
        const pts = q.points ?? 10
        totalPoints += pts
        const pq = submission.perQuestion?.[q.id]
        if (pq) {
          const earned = pq.earned != null ? pq.earned : Math.round((pq.score / 100) * pts)
          totalEarned += earned
          if (pq.points == null) pq.points = pts
          if (pq.earned == null) pq.earned = earned
        }
      }
      submission.score = totalPoints > 0 ? Math.round((totalEarned / totalPoints) * 100) : 0
    }

    // P1 错题本：把本次测验每个学生的错题落库（DB 开启时；wrongBook 为 undefined 时静默跳过）
    if (this.wrongBook) {
      const subject = currentRoom.lessonMeta?.courseName
      const wrongEntries: WrongQuestionInput[] = []
      for (const submission of quiz.submissions.values()) {
        const assignedIds = quiz.randomMode && quiz.studentQuestionMap
          ? new Set(quiz.studentQuestionMap.get(submission.studentId))
          : null
        const gradedQuestions = assignedIds
          ? quiz.questions.filter(q => assignedIds.has(q.id))
          : quiz.questions
        for (const q of gradedQuestions) {
          const pq = submission.perQuestion?.[q.id]
          if (!pq || pq.correct !== false) continue
          wrongEntries.push({
            studentId: submission.studentId,
            studentName: submission.studentName,
            lessonId: room.lessonId,
            taskId: quiz.taskId,
            questionId: q.id,
            subject,
            questionContent: q.content,
            questionType: q.type,
            options: q.options,
            correctAnswer: q.answer || q.referenceAnswer,
            analysis: q.analysis,
            wrongAnswer: submission.answers[q.id] || '',
            knowledgePoints: q.knowledgePoints,
            score: pq.score,
          })
        }
      }
      if (wrongEntries.length > 0) {
        this.wrongBook
          .recordWrongQuestions(wrongEntries)
          .then(() => this.logger.log(`错题本已归集 ${wrongEntries.length} 条（quiz ${quiz.taskId}）`))
          .catch(err => this.logger.error(`错题本归集失败: ${err}`))
      }
    }

    // P1 游戏化：按答对题数给分（每题 +10），广播积分与排行榜
    for (const submission of quiz.submissions.values()) {
      let correctCount = 0
      const assignedIds = quiz.randomMode && quiz.studentQuestionMap
        ? new Set(quiz.studentQuestionMap.get(submission.studentId))
        : null
      const gq = assignedIds ? quiz.questions.filter(q => assignedIds.has(q.id)) : quiz.questions
      for (const q of gq) {
        if (submission.perQuestion?.[q.id]?.correct) correctCount++
      }
      if (correctCount > 0) {
        const delta = correctCount * 10
        const total = this.addPoints(currentRoom, submission.studentId, submission.studentName, delta)
        this.emitToRoom(roomId, RoomEvent.PointsAward, { studentId: submission.studentId, delta, reason: '答题得分', total })
      }
    }
    this.emitToRoom(roomId, RoomEvent.LeaderboardUpdate, this.buildLeaderboard(currentRoom))

    const report = this.buildQuizReport(currentRoom, quiz)
    this.emitToRoom(roomId, 'quiz:report', report)
    this.logger.log(`Quiz report sent: ${quiz.title}, ${quiz.submissions.size} submissions`)

    // 归档到 reportData 供「AI 课堂分析报告」聚合使用
    currentRoom.reportData.quizHistory.push({
      taskId: report.taskId,
      title: report.title,
      questions: report.questions,
      questionStats: report.questionStats,
      submittedCount: report.submittedCount,
      avgScore: report.avgScore,
      knowledgeMastery: report.knowledgeMastery,
      startedAt: report.startedAt,
      endedAt: report.endedAt || new Date().toISOString(),
    })

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
      let assignedCount = 0

      for (const sub of submissions) {
        if (quiz.randomMode && quiz.studentQuestionMap) {
          const assigned = quiz.studentQuestionMap.get(sub.studentId)
          if (assigned && !assigned.includes(q.id)) continue
        }
        assignedCount++
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

      const denominator = quiz.randomMode ? assignedCount : submissions.length
      return {
        question: q,
        answerCount,
        correctCount,
        correctRate: denominator > 0 ? Math.round((correctCount / denominator) * 100) : 0,
        avgScore: scoredCount > 0 ? Math.round(totalScoreSum / scoredCount) : 0,
        answers,
        assignedCount: quiz.randomMode ? assignedCount : undefined,
      }
    }).filter(qs => !quiz.randomMode || (qs.assignedCount != null && qs.assignedCount > 0))

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
      randomMode: quiz.randomMode || false,
      poolSize: quiz.randomMode ? quiz.questions.length : undefined,
      perStudentCount: quiz.randomMode ? quiz.perStudentCount : undefined,
      submissions: submissions.map(s => ({
        studentId: s.studentId,
        studentName: s.studentName,
        score: s.score,
        submittedAt: s.submittedAt,
        perQuestion: s.perQuestion,
        assignedQuestionIds: quiz.randomMode && quiz.studentQuestionMap
          ? quiz.studentQuestionMap.get(s.studentId)
          : undefined,
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
    room.reportData.handRaiseCount += 1
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
    ctx.room.reportData.lockCount += 1
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
  handleGroupCreate(@ConnectedSocket() client: Socket, @MessageBody() data: { strategy: string; groupCount: number; topic?: string; duration?: number }) {
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

    room.reportData.discussionHistory.push({
      topic: data.topic || '',
      groupCount: groupCount,
      duration: data.duration || 0,
      startedAt: Date.now(),
    })

    // P1 游戏化：登记小组归属，供小组 PK 聚合
    room.studentGroups.clear()
    for (const g of groups) {
      for (const m of g.members) {
        room.studentGroups.set(m.id, { groupId: g.id, groupName: g.name })
      }
    }

    this.emitToRoom(roomId, 'group:create', groups)
    this.emitToRoom(roomId, RoomEvent.LeaderboardUpdate, this.buildLeaderboard(room))
    this.logger.log(`Groups created: ${data.groupCount}`)
  }

  @SubscribeMessage('group:dissolve')
  handleGroupDissolve(@ConnectedSocket() client: Socket) {
    const ctx = this.getTeacher(client)
    if (!ctx) return
    ctx.room.studentGroups.clear()
    this.emitToRoom(ctx.roomId, 'group:dissolve')
    this.emitToRoom(ctx.roomId, RoomEvent.LeaderboardUpdate, this.buildLeaderboard(ctx.room))
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

    const students = Array.from(room.members.values()).filter(m => m.role === 'student')
    if (students.length === 0) return

    let selected: RoomMember | undefined
    if (data.mode === 'random') {
      // 不重复：优先从"未点过"的学生里抽；点满一轮后清空重来
      let pool = students.filter(m => !room.recentlyCalled.has(m.userId))
      if (pool.length === 0) {
        room.recentlyCalled.clear()
        pool = students
      }
      selected = pool[Math.floor(Math.random() * pool.length)]
      if (selected) {
        room.recentlyCalled.add(selected.userId)
        // 转盘动画需要候选名单 + 命中目标
        this.emitToRoom(roomId, RoomEvent.RollCallResult, {
          studentId: selected.userId,
          studentName: selected.userName,
          candidates: students.map(m => ({ id: m.userId, name: m.userName })),
        })
      }
    } else if (data.studentId) {
      selected = students.find(m => m.userId === data.studentId)
    }

    if (selected) {
      this.emitToRoom(roomId, 'roll:call', { studentId: selected.userId, studentName: selected.userName, mode: data.mode })
    }
  }

  // ==================== P1 游戏化：积分 / 排行榜 / 小组 PK ====================

  /** 仅更新内存积分表，返回该生最新总分 */
  private addPoints(room: RoomState, studentId: string, name: string, delta: number): number {
    if (!studentId || !delta) return room.points.get(studentId)?.points || 0
    const cur = room.points.get(studentId) || { name: name || studentId, points: 0 }
    cur.points += delta
    if (name) cur.name = name
    room.points.set(studentId, cur)
    return cur.points
  }

  /** 构建排行榜快照（个人 Top20 + 小组 PK 聚合） */
  private buildLeaderboard(room: RoomState) {
    const entries = Array.from(room.points.entries())
      .map(([studentId, v]) => ({ studentId, name: v.name, points: v.points }))
      .sort((a, b) => b.points - a.points)
    const top = entries.slice(0, 20).map((e, i) => ({ ...e, rank: i + 1 }))
    const groupMap = new Map<string, { groupId: string; groupName: string; points: number; memberCount: number }>()
    for (const [studentId, g] of room.studentGroups.entries()) {
      const pts = room.points.get(studentId)?.points || 0
      const gg = groupMap.get(g.groupId) || { groupId: g.groupId, groupName: g.groupName, points: 0, memberCount: 0 }
      gg.points += pts
      gg.memberCount += 1
      groupMap.set(g.groupId, gg)
    }
    const groups = Array.from(groupMap.values())
      .sort((a, b) => b.points - a.points)
      .map((g, i) => ({ ...g, rank: i + 1 }))
    return { top, groups, totalStudents: room.points.size }
  }

  /** 加分 + 广播积分变动 + 广播最新排行榜（单次加分场景用） */
  private awardAndBroadcast(roomId: string, studentId: string, name: string, delta: number, reason: string) {
    const room = this.rooms.get(roomId)
    if (!room || !studentId || !delta) return
    const total = this.addPoints(room, studentId, name, delta)
    this.emitToRoom(roomId, RoomEvent.PointsAward, { studentId, delta, reason, total })
    this.emitToRoom(roomId, RoomEvent.LeaderboardUpdate, this.buildLeaderboard(room))
  }

  // ==================== P0 课堂气氛互动包 ====================

  /** 按 kind 计算投票/评分/词云的实时统计 */
  private computePollStats(poll: ActivePoll): { total: number; stats: any } {
    const total = poll.submissions.size
    if (poll.kind === 'choice') {
      const counts = new Array((poll.options || []).length).fill(0)
      for (const v of poll.submissions.values()) {
        const ids = Array.isArray(v) ? v : [Number(v)]
        for (const i of ids) {
          if (Number.isInteger(i) && i >= 0 && i < counts.length) counts[i] += 1
        }
      }
      return { total, stats: { counts } }
    }
    if (poll.kind === 'rating') {
      const maxScore = poll.max || 5
      const distribution = new Array(maxScore).fill(0)
      let sum = 0
      let n = 0
      for (const v of poll.submissions.values()) {
        const score = Math.round(Number(v))
        if (score >= 1 && score <= maxScore) {
          distribution[score - 1] += 1
          sum += score
          n += 1
        }
      }
      return { total, stats: { avg: n > 0 ? +(sum / n).toFixed(2) : 0, distribution } }
    }
    // text → 词云：按归一化文本聚合词频
    const freq = new Map<string, number>()
    for (const v of poll.submissions.values()) {
      const text = String(v).trim().slice(0, 30)
      if (!text) continue
      const key = text.toLowerCase()
      freq.set(key, (freq.get(key) || 0) + 1)
    }
    const words = Array.from(freq.entries())
      .map(([text, weight]) => ({ text, weight }))
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 100)
    return { total, stats: { words } }
  }

  @SubscribeMessage('poll:start')
  handlePollStart(@ConnectedSocket() client: Socket, @MessageBody() data: {
    kind: PollKind
    question: string
    options?: string[]
    maxSelect?: number
    max?: number
    durationSec?: number
  }) {
    const ctx = this.getTeacher(client)
    if (!ctx) return
    const { roomId, room } = ctx
    const kind: PollKind = data?.kind === 'text' || data?.kind === 'rating' ? data.kind : 'choice'
    const question = String(data?.question || '').trim().slice(0, 200)
    const options = kind === 'choice'
      ? (Array.isArray(data?.options) ? data.options.map(o => String(o).slice(0, 100)).filter(Boolean).slice(0, 10) : [])
      : undefined
    if (kind === 'choice' && (!options || options.length < 2)) {
      client.emit('error:input', { message: '投票至少需要 2 个选项' })
      return
    }
    if (room.activePoll?.autoStopTimer) clearTimeout(room.activePoll.autoStopTimer)
    const pollId = `poll-${Date.now()}`
    const poll: ActivePoll = {
      pollId,
      kind,
      question,
      options,
      maxSelect: kind === 'choice' ? Math.max(1, Math.min(options!.length, Number(data?.maxSelect) || 1)) : undefined,
      max: kind === 'rating' ? Math.max(2, Math.min(10, Number(data?.max) || 5)) : undefined,
      startedAt: Date.now(),
      durationSec: data?.durationSec && data.durationSec > 0 ? Math.min(3600, Math.floor(data.durationSec)) : undefined,
      submissions: new Map(),
    }
    room.activePoll = poll
    this.emitToRoom(roomId, RoomEvent.PollStart, {
      pollId,
      kind,
      question,
      options,
      maxSelect: poll.maxSelect,
      max: poll.max,
      startedAt: poll.startedAt,
      durationSec: poll.durationSec,
    })
    if (poll.durationSec) {
      poll.autoStopTimer = setTimeout(() => this.stopPoll(roomId, pollId), poll.durationSec * 1000)
    }
    this.logger.log(`Poll started (${kind}) in ${roomId}: ${question}`)
  }

  @SubscribeMessage('poll:submit')
  handlePollSubmit(@ConnectedSocket() client: Socket, @MessageBody() data: { pollId: string; value: number[] | string | number }) {
    const roomId = this.socketToRoom.get(client.id)
    if (!roomId) return
    const room = this.rooms.get(roomId)
    const member = room?.members.get(client.id)
    if (!room || !member || member.role !== 'student') return
    const poll = room.activePoll
    if (!poll || poll.pollId !== data?.pollId) {
      client.emit(RoomEvent.PollSubmitAck, { pollId: data?.pollId, error: '投票已结束或不存在' })
      return
    }
    if (poll.submissions.has(member.userId)) {
      client.emit(RoomEvent.PollSubmitAck, { pollId: poll.pollId, duplicate: true })
      return
    }
    let value: number[] | string | number
    if (poll.kind === 'choice') {
      const arr = Array.isArray(data.value) ? data.value : [Number(data.value)]
      const picked = arr
        .map(Number)
        .filter(n => Number.isInteger(n) && n >= 0 && n < (poll.options?.length || 0))
        .slice(0, poll.maxSelect || 1)
      if (picked.length === 0) {
        client.emit(RoomEvent.PollSubmitAck, { pollId: poll.pollId, error: '无效选项' })
        return
      }
      value = picked
    } else if (poll.kind === 'rating') {
      const score = Math.round(Number(data.value))
      if (!(score >= 1 && score <= (poll.max || 5))) {
        client.emit(RoomEvent.PollSubmitAck, { pollId: poll.pollId, error: '无效评分' })
        return
      }
      value = score
    } else {
      const text = String(data.value ?? '').trim().slice(0, 30)
      if (!text) {
        client.emit(RoomEvent.PollSubmitAck, { pollId: poll.pollId, error: '内容为空' })
        return
      }
      value = text
    }
    poll.submissions.set(member.userId, value)
    client.emit(RoomEvent.PollSubmitAck, { pollId: poll.pollId, ok: true })
    const { total, stats } = this.computePollStats(poll)
    this.emitToRoom(roomId, RoomEvent.PollUpdate, { pollId: poll.pollId, kind: poll.kind, total, stats })
  }

  @SubscribeMessage('poll:stop')
  handlePollStop(@ConnectedSocket() client: Socket, @MessageBody() data: { pollId?: string }) {
    const ctx = this.getTeacher(client)
    if (!ctx) return
    this.stopPoll(ctx.roomId, data?.pollId)
  }

  private stopPoll(roomId: string, pollId?: string) {
    const room = this.rooms.get(roomId)
    if (!room || !room.activePoll) return
    if (pollId && room.activePoll.pollId !== pollId) return
    const poll = room.activePoll
    if (poll.autoStopTimer) clearTimeout(poll.autoStopTimer)
    const { total, stats } = this.computePollStats(poll)
    room.activePoll = null
    this.emitToRoom(roomId, RoomEvent.PollStop, { pollId: poll.pollId, kind: poll.kind, total, finalStats: stats })
    this.logger.log(`Poll stopped in ${roomId}: ${poll.pollId}`)
  }

  @SubscribeMessage('danmaku:toggle')
  handleDanmakuToggle(@ConnectedSocket() client: Socket, @MessageBody() data: { enabled?: boolean }) {
    const ctx = this.getTeacher(client)
    if (!ctx) return
    ctx.room.danmakuEnabled = data?.enabled !== false
    this.emitToRoom(ctx.roomId, RoomEvent.DanmakuToggle, { enabled: ctx.room.danmakuEnabled })
    this.logger.log(`Danmaku ${ctx.room.danmakuEnabled ? 'ON' : 'OFF'} in ${ctx.roomId}`)
  }

  @SubscribeMessage('danmaku:send')
  handleDanmakuSend(@ConnectedSocket() client: Socket, @MessageBody() data: { text: string; color?: string }) {
    const roomId = this.socketToRoom.get(client.id)
    if (!roomId) return
    const room = this.rooms.get(roomId)
    const member = room?.members.get(client.id)
    if (!room || !member) return
    if (!room.danmakuEnabled) return
    const text = String(data?.text || '').trim().slice(0, 50)
    if (!text) return
    this.emitToRoom(roomId, RoomEvent.DanmakuPush, {
      id: `dm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      text,
      studentId: member.userId,
      studentName: member.userName,
      color: typeof data?.color === 'string' ? data.color.slice(0, 16) : undefined,
    })
  }

  @SubscribeMessage('danmaku:clear')
  handleDanmakuClear(@ConnectedSocket() client: Socket) {
    const ctx = this.getTeacher(client)
    if (!ctx) return
    this.emitToRoom(ctx.roomId, RoomEvent.DanmakuClear, {})
  }

  @SubscribeMessage('reaction:send')
  handleReactionSend(@ConnectedSocket() client: Socket, @MessageBody() data: { type: string }) {
    const roomId = this.socketToRoom.get(client.id)
    if (!roomId) return
    const room = this.rooms.get(roomId)
    const member = room?.members.get(client.id)
    if (!room || !member) return
    const type = String(data?.type || '')
    if (!ClassroomGateway.REACTION_TYPES.has(type)) return
    const now = Date.now()
    room.reactions.recent.push({ type, ts: now })
    // 飘 emoji（全房间）
    this.emitToRoom(roomId, RoomEvent.ReactionPush, { type, studentId: member.userId })
    // 情绪热度：近 60s 窗口聚合
    const cutoff = now - ClassroomGateway.REACTION_WINDOW_MS
    room.reactions.recent = room.reactions.recent.filter(r => r.ts >= cutoff)
    const counts: Record<string, number> = { got: 0, confused: 0, tooFast: 0, like: 0, applause: 0 }
    for (const r of room.reactions.recent) counts[r.type] = (counts[r.type] || 0) + 1
    this.emitToRoom(roomId, RoomEvent.ReactionStats, { counts, windowSec: 60 })
  }

  @SubscribeMessage('timer:start')
  handleTimerStart(@ConnectedSocket() client: Socket, @MessageBody() data: { durationSec: number; label?: string }) {
    const ctx = this.getTeacher(client)
    if (!ctx) return
    const durationSec = Math.max(1, Math.min(7200, Math.floor(Number(data?.durationSec) || 0)))
    if (!durationSec) {
      client.emit('error:input', { message: '请设置有效的倒计时时长' })
      return
    }
    const timer: ClassTimer = {
      timerId: `timer-${Date.now()}`,
      durationSec,
      label: String(data?.label || '').trim().slice(0, 40) || undefined,
      startedAt: Date.now(),
    }
    ctx.room.timer = timer
    this.emitToRoom(ctx.roomId, RoomEvent.TimerStart, timer)
    this.logger.log(`Timer started ${durationSec}s in ${ctx.roomId}`)
  }

  @SubscribeMessage('timer:stop')
  handleTimerStop(@ConnectedSocket() client: Socket, @MessageBody() data: { timerId?: string }) {
    const ctx = this.getTeacher(client)
    if (!ctx) return
    if (!ctx.room.timer) return
    if (data?.timerId && ctx.room.timer.timerId !== data.timerId) return
    const timerId = ctx.room.timer.timerId
    ctx.room.timer = null
    this.emitToRoom(ctx.roomId, RoomEvent.TimerStop, { timerId })
  }

  // ==================== P1 答案上墙 / 作品墙 ====================

  @SubscribeMessage('wall:open')
  handleWallOpen(@ConnectedSocket() client: Socket, @MessageBody() data: { prompt?: string; allowImage?: boolean }) {
    const ctx = this.getTeacher(client)
    if (!ctx) return
    const wallId = `wall-${Date.now()}`
    ctx.room.activeWall = {
      wallId,
      prompt: String(data?.prompt || '').slice(0, 200),
      allowImage: data?.allowImage === true,
      items: new Map(),
    }
    this.emitToRoom(ctx.roomId, RoomEvent.WallOpen, {
      wallId,
      prompt: ctx.room.activeWall.prompt,
      allowImage: ctx.room.activeWall.allowImage,
    })
    this.logger.log(`Wall opened in ${ctx.roomId}: ${ctx.room.activeWall.prompt}`)
  }

  @SubscribeMessage('wall:submit')
  handleWallSubmit(@ConnectedSocket() client: Socket, @MessageBody() data: { wallId: string; text?: string; image?: string }) {
    const roomId = this.socketToRoom.get(client.id)
    if (!roomId) return
    const room = this.rooms.get(roomId)
    const member = room?.members.get(client.id)
    if (!room || !member || member.role !== 'student') return
    const wall = room.activeWall
    if (!wall || wall.wallId !== data?.wallId) return
    const text = String(data?.text || '').slice(0, 500)
    const image = wall.allowImage && typeof data?.image === 'string' ? data.image.slice(0, 2_000_000) : undefined
    if (!text && !image) return
    const item: WallItem = {
      id: `wi-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      studentId: member.userId,
      studentName: member.userName,
      text: text || undefined,
      image,
      picked: false,
      ts: Date.now(),
    }
    wall.items.set(item.id, item)
    this.emitToRoom(roomId, RoomEvent.WallItem, { wallId: wall.wallId, item })
  }

  @SubscribeMessage('wall:pick')
  handleWallPick(@ConnectedSocket() client: Socket, @MessageBody() data: { wallId: string; id: string; picked?: boolean }) {
    const ctx = this.getTeacher(client)
    if (!ctx) return
    const wall = ctx.room.activeWall
    if (!wall || wall.wallId !== data?.wallId) return
    const it = wall.items.get(data?.id)
    if (!it) return
    it.picked = data?.picked !== false
    this.emitToRoom(ctx.roomId, RoomEvent.WallPick, { wallId: wall.wallId, id: it.id, picked: it.picked })
  }

  @SubscribeMessage('wall:close')
  handleWallClose(@ConnectedSocket() client: Socket) {
    const ctx = this.getTeacher(client)
    if (!ctx) return
    if (!ctx.room.activeWall) return
    const wallId = ctx.room.activeWall.wallId
    ctx.room.activeWall = null
    this.emitToRoom(ctx.roomId, RoomEvent.WallClose, { wallId })
  }

  // ==================== P1 反馈闭环：教师回复学生提问 ====================

  @SubscribeMessage('question:reply')
  handleQuestionReply(@ConnectedSocket() client: Socket, @MessageBody() data: { studentId: string; questionId?: string; text: string }) {
    const ctx = this.getTeacher(client)
    if (!ctx) return
    const text = String(data?.text || '').slice(0, 500)
    if (!text || !data?.studentId) return
    this.emitToRoom(ctx.roomId, RoomEvent.QuestionReply, {
      studentId: data.studentId,
      questionId: data.questionId,
      text,
      time: new Date().toISOString(),
    })
  }

  @SubscribeMessage('question:ask')
  handleQuestion(@ConnectedSocket() client: Socket, @MessageBody() data: { text: string; slideIndex: number }) {
    const roomId = this.socketToRoom.get(client.id)
    if (!roomId) return
    const room = this.rooms.get(roomId)
    const member = room?.members.get(client.id)
    if (!room || !member || member.role !== 'student') return
    const time = new Date().toISOString()
    room.reportData.questions.push({
      studentId: member.userId,
      studentName: member.userName,
      text: data.text,
      time,
    })
    this.emitToRoom(roomId, 'question:new', {
      studentId: member.userId,
      studentName: member.userName,
      text: data.text,
      slideIndex: data.slideIndex,
      time,
    })
    this.logger.log(`Question from ${member.userName}: ${data.text}`)
  }

  @SubscribeMessage('attendance:start')
  handleAttendanceStart(@ConnectedSocket() client: Socket, @MessageBody() data: {
    mode: string
    duration: number
    requirePhoto?: boolean
    requireLocation?: boolean
    radius?: number
    teacherLocation?: { latitude: number; longitude: number }
  }) {
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
      // 只有客户端显式置 true 才开启，避免老客户端意外强制学生拍照/定位
      requirePhoto: data.requirePhoto === true,
      requireLocation: data.requireLocation === true,
      radius: data.radius || 50,
      teacherLocation: data.teacherLocation,
    }
    const roomId = ctx.roomId
    const att = ctx.room.activeAttendance
    this.emitToRoom(roomId, 'attendance:start', {
      ...data,
      requirePhoto: att.requirePhoto,
      requireLocation: att.requireLocation,
      radius: att.radius,
      teacherLocation: att.teacherLocation,
      startedAt: att.startedAt,
    })
    att.autoEndTimer = setTimeout(() => {
      this.autoEndAttendance(roomId)
    }, data.duration * 60 * 1000)
    this.logger.log(`Attendance started: ${data.mode}, ${data.duration}min`)
  }

  @SubscribeMessage('attendance:sign')
  handleAttendanceSign(@ConnectedSocket() client: Socket, @MessageBody() data?: {
    photo?: string
    location?: { latitude: number; longitude: number; accuracy?: number }
    distance?: number
    verified?: boolean
  }) {
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
      photo: data?.photo,
      location: data?.location,
      distance: data?.distance,
      verified: data?.verified,
    }
    att.signed.push(record)
    this.emitToRoom(roomId, 'attendance:signed', record)
    // P1 游戏化：签到 +5 分
    this.awardAndBroadcast(roomId, member.userId, member.userName, 5, '签到')
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
    // 换了课件，旧标注全部失效
    room.annotations.clear()
    room.activeStrokes.clear()

    this.emitToRoom(roomId, 'slides:loaded', { slides: data.slides, total: data.slides.length })
    this.emitToRoom(roomId, 'slide:goto', { index: 1, total: data.slides.length })
    // 通知三端清掉本地缓存的所有页标注
    this.emitToRoom(roomId, RoomEvent.AnnotationClear, { slideIndex: -1 })
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
      if (room.activeAttendance.autoEndTimer) {
        clearTimeout(room.activeAttendance.autoEndTimer)
        room.activeAttendance.autoEndTimer = undefined
      }
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
    // 反馈闭环：给抢答学生即时 ACK（名次 + 响应耗时）
    client.emit('compete:answer:ack', { ok: true, rank: responder.rank, responseTime })
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
      // P1 游戏化：抢答获胜 +20 分
      if (winner?.studentId) {
        this.awardAndBroadcast(ctx.roomId, winner.studentId, winner.studentName, 20, '抢答获胜')
      }
      // 归档到 reportData，供「AI 课堂分析报告」聚合使用
      ctx.room.reportData.competeHistory.push({
        question: compete.question,
        startedAt: compete.startTime,
        winner: winner ? { studentId: winner.studentId, studentName: winner.studentName } : null,
        totalResponders: compete.responders.length,
      })
      const cur = compete
      setTimeout(() => {
        if (ctx.room.activeCompete === cur && !cur.active) ctx.room.activeCompete = null
      }, 8000)
    }
    this.emitToRoom(ctx.roomId, 'compete:stop', { winner, ranking })
  }

  @SubscribeMessage('lesson:start')
  handleLessonStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: {
      courseName?: string
      lessonTitle?: string
      roomCode?: string
      startedAt?: string
      resetState?: boolean
      tenantId?: string
      schoolId?: string
      classId?: string
      className?: string
      gradeId?: string
      subject?: string
    } = {},
  ) {
    const ctx = this.getTeacher(client)
    if (!ctx) return
    const { roomId, room } = ctx
    const resetState = data?.resetState !== false
    if (resetState) {
      room.currentSlide = 1
      room.totalSlides = 0
      room.slides = []
      room.isLocked = false
      room.activeTaskId = null
      room.activeQuiz = null
      room.activeCompete = null
      room.activeAttendance = null
      room.aiPractice = null
      if (room.activePoll?.autoStopTimer) clearTimeout(room.activePoll.autoStopTimer)
      room.activePoll = null
      room.danmakuEnabled = false
      room.reactions = { recent: [] }
      room.recentlyCalled.clear()
      room.timer = null
      room.points.clear()
      room.studentGroups.clear()
      room.activeWall = null
      room.handRaisedStudents.clear()
      room.annotations.clear()
      room.activeStrokes.clear()
      room.reportData = createEmptyReportData()
      const quizTimer = this.autoCompleteTimers.get(roomId)
      if (quizTimer) {
        clearTimeout(quizTimer)
        this.autoCompleteTimers.delete(roomId)
      }
    }
    room.context = this.platformConfig.mergeContext(room.context, data)
    const payload = {
      courseName: String(data?.courseName || '').trim() || room.context.productName || '三元课堂',
      lessonTitle: String(data?.lessonTitle || '').trim() || '',
      roomCode: String(data?.roomCode || room.lessonId || '').trim(),
      startedAt: data?.startedAt || new Date().toISOString(),
      resetState,
      context: room.context,
    }
    room.lessonMeta = payload
    room.studentEntryOpen = true
    this.emitToRoom(roomId, 'lesson:start', payload)
    this.persistSession(() =>
      this.sessions!.startSession(
        room.lessonId,
        room.context,
        { courseName: payload.courseName, lessonTitle: payload.lessonTitle, startedAt: payload.startedAt },
        { reset: resetState },
      ),
    )
    this.logger.log(`Lesson started in ${roomId}: ${payload.courseName}`)
  }

  @SubscribeMessage('lesson:end')
  handleLessonEnd(@ConnectedSocket() client: Socket) {
    const ctx = this.getTeacher(client)
    if (!ctx) return
    const { roomId, room } = ctx
    const endedAt = new Date().toISOString()
    const learningSnapshot = {
      lessonId: room.lessonId,
      lessonMeta: room.lessonMeta,
      endedAt,
      currentSlide: room.currentSlide,
      totalSlides: room.totalSlides,
      studentCount: Array.from(room.members.values()).filter(m => m.role === 'student').length,
      memberCount: room.members.size,
      members: Array.from(room.members.values()).map(m => ({
        userId: m.userId,
        userName: m.userName,
        role: m.role,
        clientType: m.clientType,
        tenantId: m.tenantId,
        schoolId: m.schoolId,
        classId: m.classId,
        gradeId: m.gradeId,
        subject: m.subject,
        externalUserId: m.externalUserId,
        phone: m.phone,
      })),
      reportData: room.reportData,
    }
    room.activeQuiz = null
    room.activeTaskId = null
    room.activeCompete = null
    room.activeAttendance = null
    room.aiPractice = null
    if (room.activePoll?.autoStopTimer) clearTimeout(room.activePoll.autoStopTimer)
    room.activePoll = null
    room.danmakuEnabled = false
    room.reactions = { recent: [] }
    room.recentlyCalled.clear()
    room.timer = null
    room.points.clear()
    room.studentGroups.clear()
    room.activeWall = null
    room.currentSlide = 1
    room.totalSlides = 0
    room.slides = []
    room.isLocked = false
    room.lessonMeta = null
    room.studentEntryOpen = false
    room.handRaisedStudents.clear()
    room.annotations.clear()
    room.activeStrokes.clear()
    const t = this.autoCompleteTimers.get(roomId)
    if (t) {
      clearTimeout(t)
      this.autoCompleteTimers.delete(roomId)
    }
    this.emitToRoom(roomId, 'lesson:end')
    this.persistSession(() => this.sessions!.closeSession(room.lessonId, new Date(endedAt)))
    void this.learningRecords
      .recordLessonEnded(room.context, learningSnapshot)
      .then(item => this.logger.log(`Learning record queued: ${item.id} (${item.eventType})`))
      .catch(err => this.logger.warn(`Learning record queue failed: ${err?.message || err}`))
    this.logger.log(`Lesson ended in ${roomId}`)
  }

  /**
   * 标注：教师开始一笔。负载里带 strokeId（教师本地生成 uuid）、color、width、slideIndex、首个 point。
   * 服务端落库到 activeStrokes，再广播给整个房间（含教师本人 echo，用于幂等渲染）。
   */
  @SubscribeMessage('annotation:stroke:start')
  handleAnnotationStrokeStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { strokeId: string; slideIndex: number; color: string; width: number; point?: AnnotationPoint },
  ) {
    const ctx = this.getTeacher(client)
    if (!ctx) return
    const { roomId, room, member } = ctx
    const strokeId = String(data?.strokeId || '').trim()
    if (!strokeId) return
    const slideIndex = Number(data?.slideIndex) || room.currentSlide
    const color = String(data?.color || '#facc15').slice(0, 16)
    const width = Math.max(1, Math.min(20, Number(data?.width) || 4))
    const initialPoints: AnnotationPoint[] = data?.point && Number.isFinite(data.point.x) && Number.isFinite(data.point.y)
      ? [{ x: clamp01(data.point.x), y: clamp01(data.point.y) }]
      : []
    const stroke: AnnotationStroke = {
      id: strokeId,
      slideIndex,
      color,
      width,
      points: initialPoints,
      createdBy: member.userId,
      createdAt: Date.now(),
    }
    room.activeStrokes.set(strokeId, stroke)
    this.emitToRoom(roomId, RoomEvent.AnnotationStrokeStart, {
      strokeId,
      slideIndex,
      color,
      width,
      point: initialPoints[0],
      createdBy: member.userId,
    })
  }

  @SubscribeMessage('annotation:stroke:point')
  handleAnnotationStrokePoint(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { strokeId: string; point: AnnotationPoint },
  ) {
    const ctx = this.getTeacher(client)
    if (!ctx) return
    const { roomId, room } = ctx
    const strokeId = String(data?.strokeId || '').trim()
    const stroke = room.activeStrokes.get(strokeId)
    if (!stroke) return
    const p = data?.point
    if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return
    const normalized = { x: clamp01(p.x), y: clamp01(p.y) }
    stroke.points.push(normalized)
    this.emitToRoom(roomId, RoomEvent.AnnotationStrokePoint, {
      strokeId,
      slideIndex: stroke.slideIndex,
      point: normalized,
    })
  }

  @SubscribeMessage('annotation:stroke:end')
  handleAnnotationStrokeEnd(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { strokeId: string },
  ) {
    const ctx = this.getTeacher(client)
    if (!ctx) return
    const { roomId, room } = ctx
    const strokeId = String(data?.strokeId || '').trim()
    const stroke = room.activeStrokes.get(strokeId)
    if (!stroke) return
    room.activeStrokes.delete(strokeId)
    if (stroke.points.length === 0) return // 点没攒成形就丢掉
    const list = room.annotations.get(stroke.slideIndex) || []
    list.push(stroke)
    room.annotations.set(stroke.slideIndex, list)
    this.emitToRoom(roomId, RoomEvent.AnnotationStrokeEnd, {
      strokeId,
      slideIndex: stroke.slideIndex,
    })
  }

  /**
   * 清空某一页（slideIndex 大于 0）或全部页（slideIndex 传 -1）的标注。
   */
  @SubscribeMessage('annotation:clear')
  handleAnnotationClear(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { slideIndex?: number } = {},
  ) {
    const ctx = this.getTeacher(client)
    if (!ctx) return
    const { roomId, room } = ctx
    const slideIndex = Number.isFinite(data?.slideIndex) ? Number(data.slideIndex) : -1
    if (slideIndex === -1) {
      room.annotations.clear()
      room.activeStrokes.clear()
    } else {
      room.annotations.delete(slideIndex)
      for (const [id, s] of room.activeStrokes) {
        if (s.slideIndex === slideIndex) room.activeStrokes.delete(id)
      }
    }
    this.emitToRoom(roomId, RoomEvent.AnnotationClear, { slideIndex })
  }

  /**
   * 撤销某页最后一笔；slideIndex 未传则用 currentSlide。
   */
  @SubscribeMessage('annotation:undo')
  handleAnnotationUndo(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { slideIndex?: number } = {},
  ) {
    const ctx = this.getTeacher(client)
    if (!ctx) return
    const { roomId, room } = ctx
    const slideIndex = Number.isFinite(data?.slideIndex) ? Number(data.slideIndex) : room.currentSlide
    const list = room.annotations.get(slideIndex)
    if (!list || list.length === 0) return
    const removed = list.pop()
    if (list.length === 0) room.annotations.delete(slideIndex)
    this.emitToRoom(roomId, RoomEvent.AnnotationUndo, {
      slideIndex,
      strokeId: removed?.id,
    })
  }

  /**
   * 把 room.annotations Map 序列化为可 JSON 化的 { [slideIndex]: stroke[] }，供 room:joined 一次性下发。
   */
  private serializeAnnotations(room: RoomState): Record<string, AnnotationStroke[]> {
    const out: Record<string, AnnotationStroke[]> = {}
    for (const [slideIndex, list] of room.annotations.entries()) {
      if (list && list.length > 0) {
        out[String(slideIndex)] = list.map(s => ({
          ...s,
          points: s.points.slice(),
        }))
      }
    }
    return out
  }

  @SubscribeMessage('ai:practice:start')
  handleAiPracticeStart(@ConnectedSocket() client: Socket, @MessageBody() data: { topic: string; prompt: string }) {
    const ctx = this.getTeacher(client)
    if (!ctx) return
    const blocker = this.getBlockingActivityLabel(ctx.room)
    if (blocker) {
      client.emit('ai:practice:start:error', {
        message: `已有「${blocker}」正在进行，请先结束后再开启 AI 实践`,
      })
      this.logger.warn(`ai:practice:start rejected: ${blocker} active in ${ctx.roomId}`)
      return
    }
    const payload = {
      topic: data.topic,
      prompt: data.prompt,
      startedAt: new Date().toISOString(),
    }
    ctx.room.aiPractice = payload
    ctx.room.reportData.practiceHistory.push({
      topic: payload.topic,
      prompt: payload.prompt,
      startedAt: payload.startedAt,
    })
    this.emitToRoom(ctx.roomId, 'ai:practice:start', payload)
    this.logger.log(`AI practice started: ${data.topic}`)
  }

  /**
   * 教师下发"结束 AI 实践"。
   * - 清掉 room.aiPractice 快照（避免新加入学生看到旧 practice）
   * - 广播 ai:practice:end 让学生端把 viewState 切回 listening
   * - 同时关闭可能仍打开的 ai:interactive 大屏（学生端可能在看 HTML 沙盘）
   */
  @SubscribeMessage('ai:practice:end')
  handleAiPracticeEnd(@ConnectedSocket() client: Socket) {
    const ctx = this.getTeacher(client)
    if (!ctx) return
    ctx.room.aiPractice = null
    this.emitToRoom(ctx.roomId, 'ai:practice:end', {})
    this.emitToRoom(ctx.roomId, 'ai:interactive:hide', {})
    this.logger.log(`AI practice ended in ${ctx.roomId}`)
  }

  /** 教师单独关闭学生端的 ai:interactive HTML 沙盘视图（不结束 AI 实践本身） */
  @SubscribeMessage('ai:interactive:hide')
  handleAiInteractiveHide(@ConnectedSocket() client: Socket) {
    const ctx = this.getTeacher(client)
    if (!ctx) return
    this.emitToRoom(ctx.roomId, 'ai:interactive:hide', {})
    this.logger.log(`AI interactive hidden in ${ctx.roomId}`)
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

  private autoEndAttendance(roomId: string) {
    const room = this.rooms.get(roomId)
    if (!room || !room.activeAttendance?.active) return
    const att = room.activeAttendance
    if (att.autoEndTimer) { clearTimeout(att.autoEndTimer); att.autoEndTimer = undefined }
    att.active = false
    room.reportData.attendanceHistory.push({
      mode: att.mode || '',
      startedAt: att.startedAt || Date.now(),
      endedAt: Date.now(),
      signed: [...att.signed],
    })
    const cur = att
    setTimeout(() => {
      if (room.activeAttendance === cur && !cur.active) room.activeAttendance = null
    }, 6000)
    this.emitToRoom(roomId, 'attendance:end')
    this.logger.log(`Attendance auto-ended in ${roomId}`)
  }

  @SubscribeMessage('attendance:end')
  handleAttendanceEnd(@ConnectedSocket() client: Socket) {
    const ctx = this.getTeacher(client)
    if (!ctx) return
    if (ctx.room.activeAttendance) {
      if (ctx.room.activeAttendance.autoEndTimer) {
        clearTimeout(ctx.room.activeAttendance.autoEndTimer)
        ctx.room.activeAttendance.autoEndTimer = undefined
      }
      ctx.room.activeAttendance.active = false
      ctx.room.reportData.attendanceHistory.push({
        mode: (ctx.room.activeAttendance as any).mode || '',
        startedAt: (ctx.room.activeAttendance as any).startedAt || Date.now(),
        endedAt: Date.now(),
        signed: [...ctx.room.activeAttendance.signed],
      })
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
      groupId?: string
      /** 客户端可选指定模型，例 "qwen:qwen-turbo" / "openai:gpt-4o" */
      model?: string
      /** 客户端自带 key 覆盖服务端默认 */
      apiKey?: string
      baseUrl?: string
    },
  ) {
    const roomId = this.socketToRoom.get(client.id)
    const room = roomId ? this.rooms.get(roomId) : null
    const member = room?.members.get(client.id)
    const source = data.source || 'unknown'
    if (room && member?.role === 'student') {
      room.reportData.aiChatCount += 1
    }
    this.logger.log(`AI chat from ${member?.userName} [${source}] [${data.model || 'default'}]: ${data.message?.slice(0, 30)}`)

    const isGroupDiscussion = source === 'group-discussion' && roomId && data.groupId
    if (isGroupDiscussion) {
      this.emitToRoom(roomId, 'group:msg', {
        groupId: String(data.groupId),
        studentId: member?.userId || '',
        studentName: member?.userName || '',
        text: `@AI ${data.message}`,
        time: new Date().toISOString(),
      })
    }

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
        if (isGroupDiscussion) {
          this.emitToRoom(roomId, 'group:msg', {
            groupId: String(data.groupId),
            studentId: '__ai__',
            studentName: 'AI',
            text: fullContent,
            time: new Date().toISOString(),
            originStudentId: member?.userId,
          })
        }
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
        if (isGroupDiscussion) {
          this.emitToRoom(roomId, 'group:msg', {
            groupId: String(data.groupId),
            studentId: '__ai__',
            studentName: 'AI',
            text: response.content,
            time: new Date().toISOString(),
            originStudentId: member?.userId,
          })
        }
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
      let lastEmittedChars = 0
      let finalResult: WhiteboardGenResult | null = null
      let lastEmitAt = Date.now()

      for await (const ev of this.aiService.generateWhiteboardStream(data)) {
        if (ev.type === 'delta') {
          const now = Date.now()
          if (ev.totalChars - lastEmittedChars >= 200 || now - lastEmitAt >= 350) {
            client.emit('ai:whiteboard:gen:progress', {
              totalChars: ev.totalChars,
              done: false,
            })
            lastEmittedChars = ev.totalChars
            lastEmitAt = now
          }
        } else if (ev.type === 'done') {
          finalResult = ev.result
        }
      }
      client.emit('ai:whiteboard:gen:progress', {
        totalChars: lastEmittedChars,
        done: true,
      })
      const payload = {
        topic: data.topic,
        title: finalResult?.title,
        subtitle: finalResult?.subtitle,
        items: finalResult?.items || [],
        error: finalResult?.error,
        generatedAt: new Date().toISOString(),
      }
      client.emit('ai:whiteboard:gen', payload)
      if (data.broadcast && finalResult && Array.isArray(finalResult.items) && finalResult.items.length > 0) {
        const roomId = this.socketToRoom.get(client.id)
        if (roomId) {
          this.emitToRoom(roomId, 'ai:whiteboard:show', payload)
        }
      }
    } catch (err: any) {
      this.logger.error(`AI whiteboard gen error: ${err?.message || err}`)
      client.emit('ai:whiteboard:gen:progress', { totalChars: 0, done: true })
      client.emit('ai:whiteboard:gen', { error: 'AI 板书生成失败：' + (err?.message || String(err)) })
    }
  }

  /**
   * 教师点"推送到大屏" → 把本地预览过的板书 payload 透传给整教室。
   *
   * 不重新 AI 调用，节省 token 与等待时间；教师可以在预览基础上修改 title/subtitle/items 后再推。
   * 服务端不深度校验 payload 结构（信任教师 client），只验有 items 数组。
   */
  @SubscribeMessage('ai:whiteboard:show')
  handleAiWhiteboardShow(@ConnectedSocket() client: Socket, @MessageBody() payload: any) {
    const ctx = this.getTeacher(client)
    if (!ctx) return
    if (!payload || !Array.isArray(payload.items) || payload.items.length === 0) {
      this.logger.warn(`ai:whiteboard:show rejected: empty/invalid payload`)
      return
    }
    const out = {
      topic: payload.topic,
      title: payload.title,
      subtitle: payload.subtitle,
      items: payload.items,
      generatedAt: payload.generatedAt || new Date().toISOString(),
    }
    ctx.room.reportData.whiteboardHistory.push({
      topic: payload.topic || '',
      title: payload.title,
      itemCount: payload.items.length,
      pushedAt: out.generatedAt,
    })
    this.emitToRoom(ctx.roomId, 'ai:whiteboard:show', out)
    this.logger.log(`AI whiteboard pushed to room ${ctx.roomId}: ${payload.title || payload.topic}`)
  }

  /**
   * 教师下发"AI 生成详细课堂报告"。
   *
   * 流程：
   *   1. 从 RoomState 汇总所有原始数据（学生 / 签到 / 举手 / 测验 / 抢答 / 讨论 / AI 实践等）
   *   2. 调 aiService.generateLessonReportStream 流式生成 markdown
   *   3. 通过 `lesson:report:stream` 增量推回给请求方
   *      - 每个 chunk: `{ chunk, done: false }`
   *      - 流末:     `{ chunk: '', done: true, fullContent }`
   *
   * 仅请求方（教师 client）订阅响应，不广播到学生 / 大屏。
   */
  @SubscribeMessage('lesson:report:gen')
  async handleLessonReportGen(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: {
      model?: string
      apiKey?: string
      baseUrl?: string
    },
  ) {
    const ctx = this.getTeacher(client)
    if (!ctx) return
    const { roomId, room } = ctx
    this.logger.log(`Lesson report gen requested in ${roomId}`)

    try {
      const input = this.buildLessonReportInput(room, data || {})
      let fullContent = ''
      for await (const chunk of this.aiService.generateLessonReportStream(input)) {
        fullContent += chunk
        client.emit('lesson:report:stream', { chunk, done: false })
      }
      client.emit('lesson:report:stream', { chunk: '', done: true, fullContent })
      this.logger.log(`Lesson report gen done: ${fullContent.length} chars`)
    } catch (err: any) {
      this.logger.error(`Lesson report gen failed: ${err?.message || err}`)
      client.emit('lesson:report:stream', {
        chunk: '',
        done: true,
        error: 'AI 报告生成失败：' + (err?.message || String(err)),
      })
    }
  }

  /** 汇总 RoomState + 课堂元信息为 LessonReportInput */
  private buildLessonReportInput(room: RoomState, opts: { model?: string; apiKey?: string; baseUrl?: string }) {
    const meta = room.lessonMeta
    const studentMembers = Array.from(room.members.values()).filter(m => m.role === 'student')
    const totalStudents = studentMembers.length
    const onlineCount = studentMembers.length

    const startedAtIso = meta?.startedAt || new Date().toISOString()
    const startedAt = new Date(startedAtIso)
    const durationMinutes = Math.max(0, Math.round((Date.now() - startedAt.getTime()) / 60_000))

    const rd = room.reportData

    // 签到：优先取归档（reportData.attendanceHistory），否则取 active session
    const allSigned = rd.attendanceHistory.length > 0
      ? rd.attendanceHistory.flatMap(a => a.signed)
      : (room.activeAttendance?.signed || [])
    const signedById = new Map<string, AttendanceSigned>()
    allSigned.forEach(s => signedById.set(s.studentId, s))
    const signed = Array.from(signedById.values())
    const signedIds = new Set(signed.map(s => s.studentId))
    const unsigned = studentMembers.filter(m => !signedIds.has(m.userId))

    const attendanceList = signed.length > 0
      ? signed.map(s => `- ${s.studentName}${s.distance != null ? `（距离 ${Math.round(s.distance)}m）` : ''}`).join('\n')
      : '(本节未发起签到)'

    const unsignedList = unsigned.length > 0
      ? unsigned.slice(0, 30).map(m => `- ${m.userName}`).join('\n')
      : '(全部签到 或 未发起签到)'

    const questionsList = rd.questions.length > 0
      ? rd.questions.slice(-20).map(q => `- ${q.studentName}：${q.text}`).join('\n')
      : '(无学生提问)'

    const competeList = rd.competeHistory.length > 0
      ? rd.competeHistory.slice(-10).map((c, i) => `${i + 1}. 「${c.question}」优胜者 ${c.winner?.studentName || '(无人抢答)'} · ${c.totalResponders} 人参与`).join('\n')
      : '(本节未发起抢答)'

    const quizSummary = rd.quizHistory.length > 0
      ? rd.quizHistory.map((q, i) => `${i + 1}. 「${q.title}」共 ${q.questions?.length || 0} 题 · 提交 ${q.submittedCount} 人 · 平均 ${q.avgScore} 分`).join('\n')
      : '(本节未发起测验)'

    const allKp = new Map<string, { totalScore: number; count: number }>()
    const allErrorQs: Array<{ rate: number; title: string }> = []
    for (const quiz of rd.quizHistory) {
      for (const km of quiz.knowledgeMastery || []) {
        const cur = allKp.get(km.knowledgePointName) || { totalScore: 0, count: 0 }
        cur.totalScore += km.masteryPercent
        cur.count += 1
        allKp.set(km.knowledgePointName, cur)
      }
      for (const qs of quiz.questionStats || []) {
        if (qs?.correctRate < 60 && qs?.question?.content) {
          allErrorQs.push({
            rate: qs.correctRate,
            title: String(qs.question.content).slice(0, 80),
          })
        }
      }
    }
    const knowledgeMastery = allKp.size > 0
      ? Array.from(allKp.entries())
          .map(([kp, e]) => ({ kp, avg: Math.round(e.totalScore / e.count) }))
          .sort((a, b) => a.avg - b.avg)
          .map(x => `- ${x.kp}：${x.avg}%`)
          .join('\n')
      : '(本节未进行测验，无法量化知识点掌握度)'

    const topErrorQuestions = allErrorQs.length > 0
      ? allErrorQs
          .sort((a, b) => a.rate - b.rate)
          .slice(0, 5)
          .map((x, i) => `${i + 1}. 正确率 ${x.rate}% · ${x.title}${x.title.length === 80 ? '…' : ''}`)
          .join('\n')
      : '(无低于 60% 错误率的题目)'

    const discussionList = rd.discussionHistory.length > 0
      ? rd.discussionHistory.map((d, i) => `${i + 1}. 主题「${d.topic || '(无主题)'}」分 ${d.groupCount} 组 · 计时 ${d.duration || '?'} 分钟`).join('\n')
      : '(本节未发起分组讨论)'

    return {
      ...opts,
      courseName: meta?.courseName || '(未指定课程)',
      lessonTitle: meta?.lessonTitle || '(未指定课题)',
      roomCode: meta?.roomCode || '(无)',
      startedAt: startedAtIso,
      durationMinutes,
      totalStudents,
      onlineCount,
      attendanceCount: signed.length,
      attendanceList,
      unsignedList,
      handRaiseCount: rd.handRaiseCount,
      aiChatCount: rd.aiChatCount,
      questionsList,
      competeRounds: rd.competeHistory.length,
      competeList,
      quizCount: rd.quizHistory.length,
      quizSummary,
      knowledgeMastery,
      topErrorQuestions,
      discussionCount: rd.discussionHistory.length,
      discussionList,
      whiteboardCount: rd.whiteboardHistory.length,
      whiteboardTopics: rd.whiteboardHistory.map(w => w.topic).filter(Boolean).join('、') || '(无)',
      practiceCount: rd.practiceHistory.length,
      practiceTopics: rd.practiceHistory.map(p => p.topic).filter(Boolean).join('、') || '(无)',
      coursewareCount: rd.coursewareHistory.length,
      slideTotalPages: room.totalSlides || 0,
      slideCurrentPage: room.currentSlide || 0,
      lockCount: rd.lockCount,
      focusLostCount: rd.focusLostCount,
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

  /** 教师板书画笔：完整笔画转发到大屏和学生端 */
  @SubscribeMessage('ai:whiteboard:stroke')
  handleAiWhiteboardStroke(@ConnectedSocket() client: Socket, @MessageBody() data: any) {
    const roomId = this.socketToRoom.get(client.id)
    if (roomId) {
      client.to(roomId).emit(RoomEvent.AiWhiteboardStroke, data)
    }
  }

  /** 教师板书画笔：清除所有标注 */
  @SubscribeMessage('ai:whiteboard:clear')
  handleAiWhiteboardClear(@ConnectedSocket() client: Socket) {
    const roomId = this.socketToRoom.get(client.id)
    if (roomId) {
      client.to(roomId).emit(RoomEvent.AiWhiteboardClear)
    }
  }

  /**
   * 学生端切到后台 / 离开应用上报。
   * - 计数累加到 reportData，供课堂分析报告
   * - 转发给教师端，便于课堂上即时提醒
   */
  @SubscribeMessage('student:focus:lost')
  handleStudentFocusLost(@ConnectedSocket() client: Socket) {
    const roomId = this.socketToRoom.get(client.id)
    if (!roomId) return
    const room = this.rooms.get(roomId)
    const member = room?.members.get(client.id)
    if (!room || !member || member.role !== 'student') return
    room.reportData.focusLostCount += 1
    this.emitToRoom(roomId, 'student:focus:lost', {
      studentId: member.userId,
      studentName: member.userName,
      time: new Date().toISOString(),
    })
  }

  /** 学生端回到前台，仅广播让教师看到状态变化 */
  @SubscribeMessage('student:focus:gained')
  handleStudentFocusGained(@ConnectedSocket() client: Socket) {
    const roomId = this.socketToRoom.get(client.id)
    if (!roomId) return
    const room = this.rooms.get(roomId)
    const member = room?.members.get(client.id)
    if (!room || !member || member.role !== 'student') return
    this.emitToRoom(roomId, 'student:focus:gained', {
      studentId: member.userId,
      studentName: member.userName,
      time: new Date().toISOString(),
    })
  }

  /**
   * 教师点"推送给学生" → 把已预览的 AI 实践 HTML 沙盘 payload 透传给整教室学生平板。
   *
   * 与 ai:interactive:gen 区别：gen 是 AI 调用 + 沙盘生成；show 是把已生成的 payload 二次推送。
   * 教师可以在 gen 后预览、编辑 title/description，再点"推送给学生"。
   */
  @SubscribeMessage('ai:interactive:show')
  handleAiInteractiveShow(@ConnectedSocket() client: Socket, @MessageBody() payload: any) {
    const ctx = this.getTeacher(client)
    if (!ctx) return
    if (!payload || typeof payload.html !== 'string' || payload.html.length < 100) {
      this.logger.warn(`ai:interactive:show rejected: empty/invalid payload`)
      return
    }
    const out = {
      topic: payload.topic,
      title: payload.title,
      description: payload.description,
      html: payload.html,
      sanitizeStats: payload.sanitizeStats,
      generatedAt: payload.generatedAt || new Date().toISOString(),
    }
    this.emitToRoom(ctx.roomId, 'ai:interactive:show', out)
    this.logger.log(`AI interactive pushed to room ${ctx.roomId}: ${payload.title || payload.topic}`)
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
      let lastEmittedChars = 0
      let finalResult: InteractiveGenResult | null = null
      // 同 whiteboard：节流推进度，让前端能持续显示「已生成 X 字符」
      let lastEmitAt = Date.now()
      for await (const ev of this.aiService.generateInteractiveStream(data)) {
        if (ev.type === 'delta') {
          const now = Date.now()
          if (ev.totalChars - lastEmittedChars >= 200 || now - lastEmitAt >= 350) {
            client.emit('ai:interactive:gen:progress', {
              totalChars: ev.totalChars,
              done: false,
            })
            lastEmittedChars = ev.totalChars
            lastEmitAt = now
          }
        } else if (ev.type === 'done') {
          finalResult = ev.result
        }
      }
      client.emit('ai:interactive:gen:progress', {
        totalChars: lastEmittedChars,
        done: true,
      })
      const payload = {
        topic: data.topic,
        title: finalResult?.title,
        description: finalResult?.description,
        html: finalResult?.html,
        sanitizeStats: finalResult?.sanitizeStats,
        error: finalResult?.error,
        generatedAt: new Date().toISOString(),
      }
      client.emit('ai:interactive:gen', payload)
      if (data.broadcast && finalResult?.html) {
        const roomId = this.socketToRoom.get(client.id)
        if (roomId) {
          this.emitToRoom(roomId, 'ai:interactive:show', payload)
        }
      }
    } catch (err: any) {
      this.logger.error(`AI interactive gen error: ${err?.message || err}`)
      client.emit('ai:interactive:gen:progress', { totalChars: 0, done: true })
      client.emit('ai:interactive:gen', { error: 'AI 生成失败：' + (err?.message || String(err)) })
    }
  }

  /**
   * 教师平板订阅一次性 courseware-upload session：
   * 当手机扫码上传文件到 /api/v1/courseware-upload/sessions/:sessionId/files 后，
   * CoursewareUploadController 会调 pushCoursewareUploadFile(socketId, ...) 把 dataUrl 推回给这个 socket。
   *
   * 跟其他 WS 事件一样：通过 sessionId 锁定一对一通道，不广播。
   */
  @SubscribeMessage('courseware-upload:subscribe')
  handleCoursewareUploadSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId: string },
  ): { ok: boolean; message?: string } {
    const sessionId = String(data?.sessionId || '').trim()
    if (!/^[A-Z0-9]{6}$/.test(sessionId)) {
      return { ok: false, message: 'sessionId 格式不合法' }
    }
    // 真正的 session map 在 CoursewareUploadService 里；这里只是给 controller 用的回流目标
    this.coursewareUploadSubscribers.set(sessionId, client.id)
    this.logger.log(`courseware-upload subscribed: ${sessionId} → ${client.id}`)
    return { ok: true }
  }

  /**
   * 平板主动取消（一般是已关 QR overlay）
   */
  @SubscribeMessage('courseware-upload:unsubscribe')
  handleCoursewareUploadUnsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId: string },
  ) {
    const sessionId = String(data?.sessionId || '').trim()
    const subscribed = this.coursewareUploadSubscribers.get(sessionId)
    if (subscribed === client.id) {
      this.coursewareUploadSubscribers.delete(sessionId)
    }
  }

  /**
   * 由 CoursewareUploadController 调，把多张 slides 推回订阅的平板 socket。
   * 推完后即清掉订阅关系（session 单次使用语义）。
   * 返回是否成功推送（false 表示平板未在监听 / 已断开）。
   */
  pushCoursewareUploadFile(
    sessionId: string,
    payload: {
      sessionId: string
      slides: Array<{ filename: string; mimetype: string; size: number; dataUrl: string }>
      totalCount: number
    },
  ): boolean {
    const socketId = this.coursewareUploadSubscribers.get(sessionId)
    if (!socketId) {
      this.logger.warn(`courseware-upload push: no subscriber for session ${sessionId}`)
      return false
    }
    const sock = this.server.sockets.sockets.get(socketId)
    if (!sock) {
      this.logger.warn(`courseware-upload push: socket ${socketId} for session ${sessionId} not found, dropping`)
      this.coursewareUploadSubscribers.delete(sessionId)
      return false
    }
    sock.emit('courseware-upload:file', payload)
    this.coursewareUploadSubscribers.delete(sessionId)
    const totalSize = payload.slides.reduce((s, x) => s + x.size, 0)
    this.logger.log(
      `courseware-upload pushed: ${sessionId} ${payload.totalCount} slide(s), ${totalSize}B → ${socketId}`,
    )
    return true
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
        const teacher = Array.from(room.members.values()).find(m => m.role === 'teacher' && this.isTeacherControllerMember(m))
        return {
          roomId,
          lessonId: room.lessonId,
          context: room.context,
          schoolId: room.context.schoolId,
          schoolName: room.context.schoolName,
          classId: room.context.classId,
          className: room.context.className,
          subject: room.context.subject,
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
        context: room.context,
        schoolId: room.context.schoolId,
        schoolName: room.context.schoolName,
        classId: room.context.classId,
        className: room.context.className,
        subject: room.context.subject,
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
          tenantId: m.tenantId,
          schoolId: m.schoolId,
          classId: m.classId,
          className: m.className,
          gradeId: m.gradeId,
          subject: m.subject,
          externalUserId: m.externalUserId,
          phone: m.phone,
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
      tenantId: m.tenantId,
      schoolId: m.schoolId,
      classId: m.classId,
      className: m.className,
      gradeId: m.gradeId,
      subject: m.subject,
      externalUserId: m.externalUserId,
      phone: m.phone,
      onlineAt: m.joinedAt.toISOString(),
    }))

    const students = members.filter(m => m.role === 'student')

    this.emitToRoom(roomId, 'member:update', {
      members,
      context: room.context,
      onlineCount: members.length,
      studentCount: students.length,
    })
  }
}
