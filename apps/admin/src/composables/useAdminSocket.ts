import { ref, onUnmounted } from 'vue'
import { io, Socket } from 'socket.io-client'
import { WS_URL } from '@/shared/backend'
import { getPlatformRuntimeHint, type PlatformRuntimeHint } from '@/api/platform'

let socket: Socket | null = null
let refCount = 0
let pollTimer: ReturnType<typeof setInterval> | null = null

export interface RoomInfo {
  roomId: string
  lessonId: string
  context?: PlatformRuntimeHint & {
    schoolName?: string
    productName?: string
  }
  schoolId?: string
  schoolName?: string
  classId?: string
  className?: string
  subject?: string
  memberCount: number
  studentCount: number
  currentSlide: number
  totalSlides: number
  isLocked: boolean
  activeQuiz?: {
    taskId: string
    title: string
    status: string
    submittedCount: number
    totalStudents: number
  } | null
  members: {
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
  }[]
}

export interface LiveEvent {
  type: string
  message: string
  time: string
  roomId?: string
  lessonId?: string
}

const isConnected = ref(false)
const rooms = ref<RoomInfo[]>([])
const totalOnline = ref(0)
const liveEvents = ref<LiveEvent[]>([])

function formatTime() {
  return new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function addEvent(type: string, message: string, ctx: { roomId?: string; lessonId?: string } = {}) {
  liveEvents.value.unshift({ type, message, time: formatTime(), ...ctx })
  if (liveEvents.value.length > 80) liveEvents.value.pop()
}

function summarizeAdminEvent(evt: { event: string; data: any; lessonId?: string }): { type: string; message: string } | null {
  const lessonTag = evt.lessonId ? `[${evt.lessonId}] ` : ''
  const d: any = evt.data || {}
  switch (evt.event) {
    case 'quiz:start':
      return { type: 'quiz', message: `${lessonTag}测验开始：${d.title || '随堂测验'}（${d.questions?.length || 0} 题）` }
    case 'quiz:report':
      return { type: 'quiz', message: `${lessonTag}测验报告：${d.title || ''} 平均 ${d.avgScore} 分（${d.submittedCount}/${d.totalStudents}）` }
    case 'quiz:grading':
      return { type: 'quiz', message: `${lessonTag}测验进入 AI 批改` }
    case 'quiz:progress':
      return { type: 'quiz', message: `${lessonTag}测验提交 ${d.submittedCount}/${d.totalStudents}（${d.latestStudent || ''}）` }
    case 'attendance:start':
      return { type: 'attendance', message: `${lessonTag}签到发起：${d.mode || '普通'} 模式` }
    case 'attendance:signed':
      return { type: 'attendance', message: `${lessonTag}${d.studentName || '学生'} 已签到` }
    case 'attendance:end':
      return { type: 'attendance', message: `${lessonTag}签到已结束` }
    case 'broadcast:msg':
      return { type: 'broadcast', message: `${lessonTag}广播：${d.message}` }
    case 'hand:raise':
      return { type: 'hand', message: `${lessonTag}${d.studentName} 举手` }
    case 'hand:lower':
      return { type: 'hand', message: `${lessonTag}${d.studentId} 放下手` }
    case 'question:new':
      return { type: 'question', message: `${lessonTag}${d.studentName} 提问：${(d.text || '').slice(0, 20)}` }
    case 'answer:submitted':
      return { type: 'answer', message: `${lessonTag}${d.studentName} 提交答案` }
    case 'screen:lock':
      return { type: 'lock', message: `${lessonTag}屏幕已锁定` }
    case 'screen:unlock':
      return { type: 'lock', message: `${lessonTag}屏幕已解锁` }
    case 'group:create':
      return { type: 'group', message: `${lessonTag}分组讨论已开始（${(d as any[]).length || 0} 组）` }
    case 'group:dissolve':
      return { type: 'group', message: `${lessonTag}分组讨论已结束` }
    case 'roll:call':
      return { type: 'hand', message: `${lessonTag}点名：${d.studentName}` }
    case 'compete:start':
      return { type: 'quiz', message: `${lessonTag}抢答开始：${d.question || ''}` }
    case 'compete:stop': {
      const winnerLabel = d?.winner?.studentName ? `（${d.winner.studentName} 胜出）` : '（无人响应）'
      return { type: 'quiz', message: `${lessonTag}抢答结束${winnerLabel}` }
    }
    case 'compete:answer':
      return { type: 'answer', message: `${lessonTag}${d.studentName || '学生'} 抢答（${d.responseTime ?? '?'}ms）` }
    case 'ai:practice:start':
      return { type: 'group', message: `${lessonTag}AI 实践：${d.topic || ''}` }
    case 'homework:publish':
      return { type: 'broadcast', message: `${lessonTag}作业已下发：${d.title || ''}（${(d.questions || []).length || 0} 题）` }
    case 'quiz:stop':
      return { type: 'quiz', message: `${lessonTag}测验已停止` }
    case 'lesson:end':
      return { type: 'lesson', message: `${lessonTag}课堂已结束` }
    case 'slides:loaded':
      return { type: 'broadcast', message: `${lessonTag}课件已发布（${d.total || 0} 页）` }
    case 'slide:goto':
      return null
    case 'member:update':
      return null
    default:
      return null
  }
}

export function useAdminSocket() {
  if (!socket) {
    const token = localStorage.getItem('admin_token') || ''
    const accessCode = localStorage.getItem('snyuan_access') || ''
    socket = io(`${WS_URL}/classroom`, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 2000,
      // 把登录后拿到的 JWT 和（可选）站点访问码一并带上，让后端 WS_AUTH_MODE=required 也能通
      auth: { token, accessCode },
    })

    socket.on('connect', () => {
      isConnected.value = true
      const adminName = localStorage.getItem('admin_user_name') || '管理员'
      const platformContext = getPlatformRuntimeHint()
      socket?.emit('room:join', {
        lessonId: 'admin-monitor',
        userId: 'admin-001',
        userName: adminName,
        role: 'admin',
        clientType: 'admin',
        ...platformContext,
      })
      socket?.emit('admin:subscribe')
      socket?.emit('admin:rooms')
    })

    // 后端 WS 鉴权失败 → 跳回登录页
    socket.on('error:auth', (data: { code?: string; message?: string }) => {
      console.warn('[admin-socket] auth error', data)
      localStorage.removeItem('admin_token')
      if (window.location.pathname !== '/login') {
        window.location.assign('/login')
      }
    })

    socket.on('disconnect', () => { isConnected.value = false })

    socket.on('admin:rooms', (data: RoomInfo[]) => {
      rooms.value = data
      totalOnline.value = data.reduce((sum, r) => sum + r.memberCount, 0)
    })

    socket.on('admin:event', (evt: { roomId: string; lessonId: string; event: string; data: any; time: string }) => {
      const summary = summarizeAdminEvent(evt)
      if (summary) addEvent(summary.type, summary.message, { roomId: evt.roomId, lessonId: evt.lessonId })

      if (
        evt.event === 'member:update' ||
        evt.event === 'lesson:end' ||
        evt.event === 'quiz:start' ||
        evt.event === 'quiz:report' ||
        evt.event === 'quiz:stop' ||
        evt.event === 'compete:start' ||
        evt.event === 'compete:stop' ||
        evt.event === 'attendance:start' ||
        evt.event === 'attendance:end' ||
        evt.event === 'slides:loaded' ||
        evt.event === 'screen:lock' ||
        evt.event === 'screen:unlock'
      ) {
        socket?.emit('admin:rooms')
      }
    })

    if (!pollTimer) {
      pollTimer = setInterval(() => socket?.emit('admin:rooms'), 15000)
    }
  }

  refCount++

  function sendBroadcast(message: string) {
    return new Promise<{ lessonsReached: number }>(resolve => {
      const handler = (data: { lessonsReached: number }) => {
        socket?.off('admin:broadcast:ack', handler)
        resolve(data)
      }
      socket?.on('admin:broadcast:ack', handler)
      socket?.emit('admin:broadcast', { message, type: 'text' })
      setTimeout(() => {
        socket?.off('admin:broadcast:ack', handler)
        resolve({ lessonsReached: -1 })
      }, 3000)
    })
  }

  function refreshRooms() {
    socket?.emit('admin:rooms')
  }

  onUnmounted(() => {
    refCount--
    if (refCount <= 0 && socket) {
      socket.disconnect()
      socket = null
      if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
      refCount = 0
    }
  })

  return {
    isConnected,
    rooms,
    totalOnline,
    liveEvents,
    sendBroadcast,
    refreshRooms,
  }
}
