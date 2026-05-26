/**
 * 实时课堂详情 mock 数据
 *
 * 该 mock 用于 /monitor/:roomId 详情页，让没有真实 WS 连接的演示
 * 也能看到「完整运行中的课堂」画面（学生网格 / 答题进度 / 互动 timeline / AI 调用）。
 *
 * 真实数据接入：
 *   优先用 `useAdminSocket().rooms` 里命中的 room；mock 仅作补充和兜底。
 *
 * 后端接口（如要替换）：
 *   GET /api/v1/admin/classrooms/:id        → ClassroomLiveDetail
 *   GET /api/v1/admin/classrooms/:id/events → 互动 timeline
 *   GET /api/v1/admin/classrooms/:id/ai     → AI 调用流水
 */

/* ============ 类型 ============ */

export type StudentStatus =
  | 'online'        // 在线、空闲
  | 'answering'     // 正在答题
  | 'submitted'     // 已提交
  | 'raised'        // 举手
  | 'ai-asking'     // 正在向 AI 提问
  | 'compete-fast'  // 抢答最快
  | 'offline'       // 掉线
  | 'late'          // 迟到

export interface LiveStudent {
  id: string
  name: string
  studentNo: string
  gender: '男' | '女'
  status: StudentStatus
  /** 当前小测的得分（无活动则空） */
  currentScore?: number
  /** 当前小测选择（A-D） */
  currentChoice?: 'A' | 'B' | 'C' | 'D'
  /** 最近一次互动文本（用于鼠标 hover） */
  lastInteraction?: string
}

export type LessonActivity =
  | { kind: 'idle';      label: '授课中' }
  | { kind: 'quiz';      label: '随堂测验';  question: string; choices: string[]; correct: 'A' | 'B' | 'C' | 'D'; distribution: { A: number; B: number; C: number; D: number }; submitted: number; total: number }
  | { kind: 'compete';   label: '抢答进行中'; question: string; winnerName?: string; secondsLeft: number }
  | { kind: 'group';     label: '分组讨论';  groups: { id: string; name: string; members: number; topic: string; messages: number }[] }
  | { kind: 'attendance';label: '签到中';    mode: '普通签到' | '人脸签到' | '位置签到'; signed: number; total: number }
  | { kind: 'practice';  label: 'AI 实践';   topic: string; participants: number; completed: number }
  | { kind: 'locked';    label: '屏幕已锁定' }

export interface LiveTimelineItem {
  id: string
  time: string             // 'HH:mm:ss'
  type:
    | 'lesson:start' | 'lesson:slide' | 'lesson:end'
    | 'quiz:start' | 'quiz:submit' | 'quiz:report'
    | 'compete:start' | 'compete:answer' | 'compete:stop'
    | 'attendance:sign'
    | 'broadcast'
    | 'hand:raise'
    | 'student:question'
    | 'ai:chat' | 'ai:whiteboard' | 'ai:practice'
    | 'screen:lock' | 'screen:unlock'
  /** 主体动作描述 */
  title: string
  /** 副本/补充 */
  detail?: string
  /** 触发者 */
  actor?: string
}

export interface AiCallItem {
  id: string
  time: string             // 'HH:mm:ss'
  /** 触发者：'teacher' | 学生姓名 */
  actorName: string
  actorRole: '教师' | '学生'
  feature: 'chat' | 'whiteboard' | 'practice' | 'courseware' | 'quiz'
  prompt: string
  tokens: number
  durationMs: number
  status: 'success' | 'streaming' | 'flagged'
}

export interface SlideInfo {
  index: number          // 从 1 开始
  thumb?: string         // 占位为 emoji，真接入时换 URL
  title: string
}

export interface ClassroomLiveDetail {
  id: string
  name: string             // 课堂/课程名
  teacherName: string
  className: string
  /** 当前活动 */
  activity: LessonActivity
  /** 在线总数 / 总人数 */
  online: number
  total: number
  /** 当前页 / 总页数 */
  currentSlide: number
  totalSlides: number
  /** 当前主题/章节 */
  currentTopic: string
  /** 开始时间（用于已上时长） */
  startedAt: string        // 'HH:mm'
  /** 学生列表 */
  students: LiveStudent[]
  /** 互动 timeline（倒序，最新在前） */
  timeline: LiveTimelineItem[]
  /** AI 调用流水 */
  aiCalls: AiCallItem[]
  /** 课件 slides（缩略+标题） */
  slides: SlideInfo[]
  /** 是否锁屏 */
  isLocked: boolean
  /** 学习氛围（mock 评分 0-100） */
  vibeScore: number
}

/* ============ 静态种子（5 个典型课堂） ============ */

interface RoomSeed {
  name: string
  teacherName: string
  className: string
  activity: LessonActivity
  total: number
  online: number
  currentSlide: number
  totalSlides: number
  currentTopic: string
  startedAt: string
  isLocked: boolean
  vibeScore: number
  // 自定义 timeline / aiCalls
  extraTimeline?: LiveTimelineItem[]
  extraAi?: AiCallItem[]
}

const roomSeeds: Record<string, RoomSeed> = {
  '1': {
    name: '工业机器人编程实训',
    teacherName: '李明',
    className: '机器人 2401 班',
    activity: { kind: 'idle', label: '授课中' },
    total: 45, online: 42, currentSlide: 7, totalSlides: 12,
    currentTopic: '六轴机器人坐标系变换',
    startedAt: '14:00',
    isLocked: false,
    vibeScore: 86,
  },
  '2': {
    name: '三维建模基础',
    teacherName: '王芳',
    className: '数设 2401 班',
    activity: {
      kind: 'practice',
      label: 'AI 实践',
      topic: 'NURBS 曲面建模沙盒',
      participants: 38,
      completed: 26,
    },
    total: 40, online: 38, currentSlide: 5, totalSlides: 10,
    currentTopic: 'NURBS 曲面拓扑与控制点',
    startedAt: '14:05',
    isLocked: false,
    vibeScore: 78,
  },
  '3': {
    name: 'PLC 控制技术',
    teacherName: '张伟',
    className: '智控 2402 班',
    activity: {
      kind: 'quiz',
      label: '随堂测验',
      question: '在 PLC 梯形图中，常开触点 ─| |─ 检测到信号为 1 时…',
      choices: [
        '触点保持断开',
        '触点闭合并导通',
        '触发系统报警',
        '与常闭触点行为相同',
      ],
      correct: 'B',
      distribution: { A: 4, B: 32, C: 2, D: 1 },
      submitted: 39,
      total: 48,
    },
    total: 48, online: 44, currentSlide: 9, totalSlides: 14,
    currentTopic: 'PLC 触点逻辑与梯形图基础',
    startedAt: '14:10',
    isLocked: false,
    vibeScore: 92,
  },
  '4': {
    name: '网络设备配置',
    teacherName: '刘洋',
    className: '网络 2401 班',
    activity: {
      kind: 'compete',
      label: '抢答进行中',
      question: '在三层交换机上配置 VLAN 间路由的关键命令是？',
      winnerName: '黄思源',
      secondsLeft: 6,
    },
    total: 38, online: 35, currentSlide: 11, totalSlides: 16,
    currentTopic: 'VLAN 间路由与三层交换',
    startedAt: '14:08',
    isLocked: false,
    vibeScore: 84,
  },
  '5': {
    name: '新能源汽车电控',
    teacherName: '陈磊',
    className: '新能源 2401 班',
    activity: {
      kind: 'group',
      label: '分组讨论',
      groups: [
        { id: 'g1', name: '第一组 · BMS 均衡', members: 8, topic: '主动 vs 被动均衡',  messages: 24 },
        { id: 'g2', name: '第二组 · 冷却回路', members: 8, topic: '液冷与风冷对比',  messages: 18 },
        { id: 'g3', name: '第三组 · 电机控制', members: 8, topic: '矢量控制原理',    messages: 31 },
        { id: 'g4', name: '第四组 · 充电握手', members: 8, topic: '快充协议',        messages: 12 },
        { id: 'g5', name: '第五组 · 系统集成', members: 8, topic: '三电系统协同',    messages: 9  },
      ],
    },
    total: 42, online: 40, currentSlide: 6, totalSlides: 10,
    currentTopic: '新能源车三电系统',
    startedAt: '14:00',
    isLocked: false,
    vibeScore: 88,
  },
  '6': {
    name: '化工单元操作',
    teacherName: '赵敏',
    className: '化工 2401 班',
    activity: { kind: 'locked', label: '屏幕已锁定' },
    total: 30, online: 28, currentSlide: 10, totalSlides: 12,
    currentTopic: '精馏塔操作与控制',
    startedAt: '14:15',
    isLocked: true,
    vibeScore: 72,
  },
}

/* ============ 学生生成（基于 roomId 稳定伪随机） ============ */

const lastNames = ['张','王','李','陈','赵','黄','吴','刘','孙','周','徐','朱','马','胡','郭','林','何','高','梁','郑','罗','宋','谢','韩','唐','冯','于','董','萧','程']
const firstNames = ['浩然','梓涵','雨涵','子轩','思源','婷','睿','一鸣','梦琪','嘉怡','明哲','志远','子涵','宇航','沐辰','若曦','可儿','文博','晨曦','嘉豪','子睿','若汐','一诺','子涵','静怡','博文','子萱','若涵','宇轩','梓萱']

function rngFromSeed(seed: string): () => number {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return () => {
    h = (h * 1103515245 + 12345) & 0x7fffffff
    return h / 0x7fffffff
  }
}

function buildStudents(roomId: string, total: number, online: number, activity: LessonActivity): LiveStudent[] {
  const r = rngFromSeed(`stu-${roomId}`)
  const out: LiveStudent[] = []
  for (let i = 0; i < total; i++) {
    const ln = lastNames[Math.floor(r() * lastNames.length)]
    const fn = firstNames[Math.floor(r() * firstNames.length)]
    const gender: '男' | '女' = r() > 0.5 ? '男' : '女'
    const isOnline = i < online
    let status: StudentStatus = 'online'
    let currentChoice: LiveStudent['currentChoice']
    if (!isOnline) status = 'offline'
    else if (activity.kind === 'quiz') {
      // 给学生分布到 distribution 上
      const dist = activity.distribution
      const submittedTotal = activity.submitted
      // 这里只用伪随机：根据 (r,i) 决定是否已提交
      if (i < submittedTotal) {
        status = 'submitted'
        // 按比例分到 ABCD
        const x = r()
        const pA = dist.A / submittedTotal
        const pB = (dist.A + dist.B) / submittedTotal
        const pC = (dist.A + dist.B + dist.C) / submittedTotal
        currentChoice = x < pA ? 'A' : x < pB ? 'B' : x < pC ? 'C' : 'D'
      } else {
        status = 'answering'
      }
    }
    else if (activity.kind === 'compete' && i === 7 && isOnline) {
      status = 'compete-fast'
    }
    else if (activity.kind === 'group' && isOnline) {
      status = 'online'
    }
    else if (isOnline && r() < 0.05) status = 'raised'
    else if (isOnline && r() < 0.04) status = 'ai-asking'
    out.push({
      id: `${roomId}-stu-${String(i + 1).padStart(2, '0')}`,
      name: `${ln}${fn}`,
      studentNo: `2401${String(i + 1).padStart(3, '0')}`,
      gender,
      status,
      currentChoice,
      lastInteraction: status === 'raised'
        ? '老师，这里能再讲一遍吗？'
        : status === 'ai-asking'
        ? '正在向 AI 助手提问'
        : status === 'submitted'
        ? `已提交答案 ${currentChoice || ''}`
        : undefined,
    })
  }
  return out
}

/* ============ Timeline & AI 流水（基础种子） ============ */

function buildBaseTimeline(roomId: string, seed: RoomSeed): LiveTimelineItem[] {
  const r = rngFromSeed(`tl-${roomId}`)
  const ts = (m: number, s: number) => `14:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  const out: LiveTimelineItem[] = []

  // 当前活动事件（最新）
  if (seed.activity.kind === 'quiz') {
    out.push({ id: 't0', time: ts(48, 32), type: 'quiz:submit',  title: `已提交 ${seed.activity.submitted}/${seed.activity.total}`, detail: '最新：苏梦琪 选 B', actor: '苏梦琪' })
    out.push({ id: 't1', time: ts(46, 12), type: 'quiz:start',   title: '发起随堂测验（共 1 题）', actor: seed.teacherName })
  } else if (seed.activity.kind === 'compete') {
    out.push({ id: 't0', time: ts(48, 30), type: 'compete:answer', title: `${seed.activity.winnerName || '匿名'} 抢答最快（响应 ${Math.floor(800 + r() * 600)}ms）`, actor: seed.activity.winnerName })
    out.push({ id: 't1', time: ts(48, 22), type: 'compete:start',  title: '发起抢答', detail: seed.activity.question, actor: seed.teacherName })
  } else if (seed.activity.kind === 'group') {
    out.push({ id: 't0', time: ts(46, 10), type: 'lesson:slide',  title: '已分组讨论中', detail: `${seed.activity.groups.length} 组，平均 ${Math.round(seed.activity.groups.reduce((a, g) => a + g.messages, 0) / seed.activity.groups.length)} 条讨论` })
  } else if (seed.activity.kind === 'attendance') {
    out.push({ id: 't0', time: ts(47, 58), type: 'attendance:sign', title: `已签到 ${seed.activity.signed}/${seed.activity.total}`, actor: seed.teacherName })
  } else if (seed.activity.kind === 'practice') {
    out.push({ id: 't0', time: ts(47, 12), type: 'ai:practice', title: `进入 AI 实践：${seed.activity.topic}`, actor: seed.teacherName })
  } else if (seed.activity.kind === 'locked') {
    out.push({ id: 't0', time: ts(48, 0),  type: 'screen:lock', title: '已锁定全员屏幕', actor: seed.teacherName })
  }

  // 历史事件
  const common: LiveTimelineItem[] = [
    { id: 'h1',  time: ts(44, 20), type: 'ai:whiteboard', title: '老师生成了 AI 板书',     detail: '主题：' + seed.currentTopic, actor: seed.teacherName },
    { id: 'h2',  time: ts(42, 14), type: 'hand:raise',    title: '王浩然 举手',             actor: '王浩然' },
    { id: 'h3',  time: ts(40, 52), type: 'student:question', title: '黄思源 提问', detail: '老师，第 5 页的公式是什么意思？', actor: '黄思源' },
    { id: 'h4',  time: ts(38, 18), type: 'ai:chat',       title: '陈雨涵 向 AI 提问',        detail: 'VLAN 与 VPN 的区别？', actor: '陈雨涵' },
    { id: 'h5',  time: ts(36, 6),  type: 'broadcast',     title: '广播：请大家拿出实训手册', actor: seed.teacherName },
    { id: 'h6',  time: ts(34, 22), type: 'lesson:slide',  title: `翻到第 ${seed.currentSlide - 1} / ${seed.totalSlides} 页`, actor: seed.teacherName },
    { id: 'h7',  time: ts(32, 8),  type: 'attendance:sign', title: '签到完成', detail: `${seed.online}/${seed.total} 人签到`, actor: seed.teacherName },
    { id: 'h8',  time: ts(30, 14), type: 'lesson:start',  title: '课堂开始', detail: seed.name, actor: seed.teacherName },
  ]
  out.push(...common)
  return out
}

function buildBaseAiCalls(roomId: string, seed: RoomSeed): AiCallItem[] {
  return [
    { id: 'ai0', time: '14:44:20', actorName: seed.teacherName, actorRole: '教师', feature: 'whiteboard', prompt: `生成「${seed.currentTopic}」的结构化板书，含示意图`,           tokens: 820, durationMs: 1280, status: 'success' },
    { id: 'ai1', time: '14:38:18', actorName: '陈雨涵',          actorRole: '学生', feature: 'chat',       prompt: 'VLAN 与 VPN 的区别？',                                          tokens: 386, durationMs: 1040, status: 'success' },
    { id: 'ai2', time: '14:32:46', actorName: seed.teacherName, actorRole: '教师', feature: 'quiz',       prompt: `为「${seed.currentTopic}」出 5 道选择题，难度中等`,             tokens: 1240, durationMs: 1860, status: 'success' },
    { id: 'ai3', time: '14:24:08', actorName: '林浩然',          actorRole: '学生', feature: 'chat',       prompt: '什么是 PID 控制？通俗讲一下',                                  tokens: 412, durationMs: 980,  status: 'success' },
    { id: 'ai4', time: '14:20:32', actorName: seed.teacherName, actorRole: '教师', feature: 'courseware', prompt: '生成本节课提纲，含 3 个重点和 1 个互动',                       tokens: 980, durationMs: 1620, status: 'success' },
    { id: 'ai5', time: '14:18:04', actorName: '匿名',            actorRole: '学生', feature: 'chat',       prompt: '【已被过滤】涉及不当内容的请求',                                tokens: 28,  durationMs: 120,  status: 'flagged' },
  ]
}

function buildSlides(seed: RoomSeed): SlideInfo[] {
  // 用 emoji 占位标题
  const emojis = ['📐', '🛠', '🔬', '📈', '⚙️', '🔧', '💡', '🧪', '🧠', '📊', '📚', '🎯', '✨', '🚀', '🎓', '🧩']
  const out: SlideInfo[] = []
  for (let i = 1; i <= seed.totalSlides; i++) {
    out.push({
      index: i,
      thumb: emojis[i % emojis.length],
      title: i === 1 ? '课堂导入' : i === seed.totalSlides ? '小结与作业' : `${seed.currentTopic} · 第 ${i - 1} 节`,
    })
  }
  return out
}

/* ============ 主入口 ============ */

export function getLiveClassroomDetail(roomId: string): ClassroomLiveDetail | null {
  const seed = roomSeeds[roomId]
  if (!seed) return null
  return {
    id: roomId,
    name: seed.name,
    teacherName: seed.teacherName,
    className: seed.className,
    activity: seed.activity,
    online: seed.online,
    total: seed.total,
    currentSlide: seed.currentSlide,
    totalSlides: seed.totalSlides,
    currentTopic: seed.currentTopic,
    startedAt: seed.startedAt,
    isLocked: seed.isLocked,
    vibeScore: seed.vibeScore,
    students: buildStudents(roomId, seed.total, seed.online, seed.activity),
    timeline: buildBaseTimeline(roomId, seed),
    aiCalls: buildBaseAiCalls(roomId, seed),
    slides: buildSlides(seed),
  }
}

/** 列出所有 mock 课堂的 id（给 Monitor.vue 跳转使用） */
export function listLiveClassroomIds(): string[] {
  return Object.keys(roomSeeds)
}

/* ============ 工具：状态映射 ============ */

export const STATUS_LABEL: Record<StudentStatus, string> = {
  online:        '在线',
  answering:     '答题中',
  submitted:     '已提交',
  raised:        '举手',
  'ai-asking':   '问 AI',
  'compete-fast': '抢答最快',
  offline:       '离线',
  late:          '迟到',
}

export const STATUS_TONE: Record<StudentStatus, 'success' | 'info' | 'warning' | 'danger' | 'ai' | 'neutral'> = {
  online:        'success',
  answering:     'warning',
  submitted:     'info',
  raised:        'warning',
  'ai-asking':   'ai',
  'compete-fast': 'warning',
  offline:       'neutral',
  late:          'danger',
}

export const TIMELINE_TONE: Record<LiveTimelineItem['type'], 'success' | 'info' | 'warning' | 'danger' | 'ai' | 'brand'> = {
  'lesson:start':    'brand',
  'lesson:slide':    'brand',
  'lesson:end':      'brand',
  'quiz:start':      'warning',
  'quiz:submit':     'warning',
  'quiz:report':     'warning',
  'compete:start':   'danger',
  'compete:answer':  'danger',
  'compete:stop':    'danger',
  'attendance:sign': 'success',
  'broadcast':       'brand',
  'hand:raise':      'warning',
  'student:question':'ai',
  'ai:chat':         'ai',
  'ai:whiteboard':   'ai',
  'ai:practice':     'ai',
  'screen:lock':     'danger',
  'screen:unlock':   'success',
}

export const FEATURE_LABEL: Record<AiCallItem['feature'], string> = {
  chat:       'AI 对话',
  whiteboard: 'AI 板书',
  practice:   'AI 实践',
  courseware: 'AI 课件',
  quiz:       'AI 出题',
}
