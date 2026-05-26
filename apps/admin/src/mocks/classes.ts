/**
 * 班级 & 学生学情 mock 数据
 *
 * 数据组织：
 *   classList       - 班级网格
 *   getClassDetail  - 单个班级详情（含学生列表 + 班级雷达 + 7日活跃曲线）
 *   getStudentProfile - 学生个人画像（雷达 / 热力图 / 错题集中度 / AI 偏好）
 *
 * 后续替换路径：
 *   GET /api/v1/admin/classes
 *   GET /api/v1/admin/classes/:id
 *   GET /api/v1/admin/students/:id/profile
 */

/* ============ 班级列表 ============ */

export type ClassStatus = 'active' | 'archived'

export interface ClassSummary {
  id: string
  name: string                 // 班级名（如 '机器人 2401 班'）
  department: string           // 学院
  headTeacher: string          // 班主任
  studentCount: number
  /** 当前学期完成的课堂数 */
  lessonsDone: number
  /** 平均出勤率 */
  attendanceRate: number
  /** 平均测验得分 */
  avgScore: number
  /** 班级 AI 使用活跃度（0-100） */
  aiActivity: number
  /** 主修课程 */
  subjects: string[]
  /** 班级状态 */
  status: ClassStatus
  /** 最近一周日活曲线（7 个点，0-100） */
  weekActivity: number[]
}

export const classList: ClassSummary[] = [
  {
    id: 'cls-robo-2401',
    name: '机器人 2401 班',
    department: '机器人工程学院',
    headTeacher: '李明',
    studentCount: 45,
    lessonsDone: 32,
    attendanceRate: 96,
    avgScore: 86.4,
    aiActivity: 82,
    subjects: ['工业机器人编程', '机械制图', '电气控制'],
    status: 'active',
    weekActivity: [62, 68, 75, 72, 84, 88, 82],
  },
  {
    id: 'cls-design-2401',
    name: '数设 2401 班',
    department: '数字设计学院',
    headTeacher: '王芳',
    studentCount: 40,
    lessonsDone: 28,
    attendanceRate: 94,
    avgScore: 84.2,
    aiActivity: 78,
    subjects: ['三维建模', '渲染基础', '产品设计'],
    status: 'active',
    weekActivity: [54, 62, 68, 76, 72, 80, 78],
  },
  {
    id: 'cls-ctrl-2402',
    name: '智控 2402 班',
    department: '智能控制学院',
    headTeacher: '张伟',
    studentCount: 48,
    lessonsDone: 36,
    attendanceRate: 93,
    avgScore: 88.6,
    aiActivity: 91,
    subjects: ['PLC 编程', '工业网络', '运动控制'],
    status: 'active',
    weekActivity: [70, 78, 82, 88, 86, 92, 91],
  },
  {
    id: 'cls-ev-2401',
    name: '新能源 2401 班',
    department: '新能源汽车学院',
    headTeacher: '陈磊',
    studentCount: 42,
    lessonsDone: 24,
    attendanceRate: 91,
    avgScore: 82.8,
    aiActivity: 68,
    subjects: ['电池系统', '电控原理', '充电技术'],
    status: 'active',
    weekActivity: [48, 56, 62, 58, 70, 72, 68],
  },
  {
    id: 'cls-chem-2401',
    name: '化工 2401 班',
    department: '应用化工学院',
    headTeacher: '赵敏',
    studentCount: 30,
    lessonsDone: 22,
    attendanceRate: 89,
    avgScore: 80.2,
    aiActivity: 56,
    subjects: ['单元操作', '化工原理', '安全管理'],
    status: 'active',
    weekActivity: [42, 48, 52, 56, 60, 58, 56],
  },
  {
    id: 'cls-net-2401',
    name: '网络 2401 班',
    department: '信息工程学院',
    headTeacher: '刘洋',
    studentCount: 38,
    lessonsDone: 26,
    attendanceRate: 92,
    avgScore: 83.6,
    aiActivity: 74,
    subjects: ['网络配置', '路由交换', '安全运维'],
    status: 'active',
    weekActivity: [58, 64, 70, 72, 76, 78, 74],
  },
  {
    id: 'cls-mech-2302',
    name: '机械 2302 班',
    department: '机械工程学院',
    headTeacher: '孙琳',
    studentCount: 44,
    lessonsDone: 60,
    attendanceRate: 88,
    avgScore: 78.4,
    aiActivity: 48,
    subjects: ['机械设计', '材料力学', '加工工艺'],
    status: 'active',
    weekActivity: [38, 42, 46, 50, 52, 48, 48],
  },
  {
    id: 'cls-it-2302',
    name: '信息 2302 班',
    department: '信息工程学院',
    headTeacher: '黄博',
    studentCount: 36,
    lessonsDone: 58,
    attendanceRate: 90,
    avgScore: 85.0,
    aiActivity: 86,
    subjects: ['Java 程序设计', '数据库', '前端开发'],
    status: 'active',
    weekActivity: [68, 72, 80, 84, 88, 90, 86],
  },
]

/* ============ 班级详情 ============ */

export interface KnowledgePoint {
  name: string
  mastery: number              // 平均掌握度 0-100
}

export interface ClassStudent {
  id: string
  name: string
  studentNo: string
  /** 性别 */
  gender: '男' | '女'
  /** 平均测验分 */
  avgScore: number
  /** 出勤率 */
  attendanceRate: number
  /** AI 使用次数（本周） */
  aiUsage: number
  /** 学习状态自动判定 */
  status: '优秀' | '良好' | '需关注' | '待激活'
  /** 风险标签（可空） */
  riskTag?: string
}

export interface ClassDetail extends ClassSummary {
  /** 雷达图 5 维（与学生画像对齐） */
  radar: { name: string; value: number }[]
  /** 班级累计 AI 各功能调用占比 */
  aiBreakdown: { name: string; value: number; color: string }[]
  /** 最薄弱的 5 个知识点 */
  weakPoints: KnowledgePoint[]
  /** 学生列表 */
  students: ClassStudent[]
  /** 给出班级层面的 AI 洞察 */
  insights: { kind: 'highlight' | 'warning' | 'tip'; title: string; desc: string }[]
}

// 静态种子，避免随机化导致刷新跳变；不同班级用不同的 radar / aiBreakdown
const radarSeeds: Record<string, { name: string; value: number }[]> = {
  'cls-robo-2401':    [{ name: '出勤', value: 96 }, { name: '答题', value: 84 }, { name: '互动', value: 78 }, { name: 'AI使用', value: 82 }, { name: '协作', value: 76 }],
  'cls-design-2401':  [{ name: '出勤', value: 94 }, { name: '答题', value: 82 }, { name: '互动', value: 88 }, { name: 'AI使用', value: 78 }, { name: '协作', value: 84 }],
  'cls-ctrl-2402':    [{ name: '出勤', value: 93 }, { name: '答题', value: 88 }, { name: '互动', value: 92 }, { name: 'AI使用', value: 91 }, { name: '协作', value: 86 }],
  'cls-ev-2401':      [{ name: '出勤', value: 91 }, { name: '答题', value: 80 }, { name: '互动', value: 72 }, { name: 'AI使用', value: 68 }, { name: '协作', value: 78 }],
  'cls-chem-2401':    [{ name: '出勤', value: 89 }, { name: '答题', value: 78 }, { name: '互动', value: 68 }, { name: 'AI使用', value: 56 }, { name: '协作', value: 74 }],
  'cls-net-2401':     [{ name: '出勤', value: 92 }, { name: '答题', value: 82 }, { name: '互动', value: 78 }, { name: 'AI使用', value: 74 }, { name: '协作', value: 80 }],
  'cls-mech-2302':    [{ name: '出勤', value: 88 }, { name: '答题', value: 76 }, { name: '互动', value: 64 }, { name: 'AI使用', value: 48 }, { name: '协作', value: 70 }],
  'cls-it-2302':      [{ name: '出勤', value: 90 }, { name: '答题', value: 86 }, { name: '互动', value: 88 }, { name: 'AI使用', value: 86 }, { name: '协作', value: 82 }],
}

const aiBreakdownSeeds: Record<string, ClassDetail['aiBreakdown']> = {
  'cls-robo-2401':   [{ name: 'AI 对话', value: 184, color: 'var(--color-brand-500)' }, { name: 'AI 板书', value: 96, color: 'var(--color-ai-500)' }, { name: 'AI 实践', value: 68, color: 'var(--color-info-500)' }, { name: 'AI 出题', value: 42, color: 'var(--color-success-500)' }, { name: 'AI 课件', value: 22, color: 'var(--color-warning-500)' }],
  'cls-design-2401': [{ name: 'AI 对话', value: 156, color: 'var(--color-brand-500)' }, { name: 'AI 板书', value: 72, color: 'var(--color-ai-500)' }, { name: 'AI 实践', value: 88, color: 'var(--color-info-500)' }, { name: 'AI 出题', value: 36, color: 'var(--color-success-500)' }, { name: 'AI 课件', value: 28, color: 'var(--color-warning-500)' }],
  'cls-ctrl-2402':   [{ name: 'AI 对话', value: 218, color: 'var(--color-brand-500)' }, { name: 'AI 板书', value: 142, color: 'var(--color-ai-500)' }, { name: 'AI 实践', value: 96, color: 'var(--color-info-500)' }, { name: 'AI 出题', value: 64, color: 'var(--color-success-500)' }, { name: 'AI 课件', value: 36, color: 'var(--color-warning-500)' }],
  'cls-ev-2401':     [{ name: 'AI 对话', value: 124, color: 'var(--color-brand-500)' }, { name: 'AI 板书', value: 56, color: 'var(--color-ai-500)' }, { name: 'AI 实践', value: 48, color: 'var(--color-info-500)' }, { name: 'AI 出题', value: 28, color: 'var(--color-success-500)' }, { name: 'AI 课件', value: 18, color: 'var(--color-warning-500)' }],
  'cls-chem-2401':   [{ name: 'AI 对话', value: 86,  color: 'var(--color-brand-500)' }, { name: 'AI 板书', value: 38, color: 'var(--color-ai-500)' }, { name: 'AI 实践', value: 26, color: 'var(--color-info-500)' }, { name: 'AI 出题', value: 22, color: 'var(--color-success-500)' }, { name: 'AI 课件', value: 12, color: 'var(--color-warning-500)' }],
  'cls-net-2401':    [{ name: 'AI 对话', value: 142, color: 'var(--color-brand-500)' }, { name: 'AI 板书', value: 68, color: 'var(--color-ai-500)' }, { name: 'AI 实践', value: 52, color: 'var(--color-info-500)' }, { name: 'AI 出题', value: 38, color: 'var(--color-success-500)' }, { name: 'AI 课件', value: 24, color: 'var(--color-warning-500)' }],
  'cls-mech-2302':   [{ name: 'AI 对话', value: 68,  color: 'var(--color-brand-500)' }, { name: 'AI 板书', value: 28, color: 'var(--color-ai-500)' }, { name: 'AI 实践', value: 18, color: 'var(--color-info-500)' }, { name: 'AI 出题', value: 14, color: 'var(--color-success-500)' }, { name: 'AI 课件', value: 8,  color: 'var(--color-warning-500)' }],
  'cls-it-2302':     [{ name: 'AI 对话', value: 196, color: 'var(--color-brand-500)' }, { name: 'AI 板书', value: 88, color: 'var(--color-ai-500)' }, { name: 'AI 实践', value: 74, color: 'var(--color-info-500)' }, { name: 'AI 出题', value: 56, color: 'var(--color-success-500)' }, { name: 'AI 课件', value: 32, color: 'var(--color-warning-500)' }],
}

const weakPointsSeeds: Record<string, KnowledgePoint[]> = {
  'cls-robo-2401':   [{ name: '六轴坐标变换', mastery: 58 }, { name: 'TCP 标定', mastery: 62 }, { name: '示教器编程', mastery: 68 }, { name: 'I/O 配置', mastery: 72 }, { name: '末端执行器选型', mastery: 74 }],
  'cls-design-2401': [{ name: 'NURBS 曲面拓扑', mastery: 52 }, { name: '布尔运算优化', mastery: 60 }, { name: 'UV 展开', mastery: 64 }, { name: '渲染光源布置', mastery: 70 }, { name: '材质 PBR', mastery: 72 }],
  'cls-ctrl-2402':   [{ name: 'PID 参数整定', mastery: 64 }, { name: 'PROFINET 配置', mastery: 68 }, { name: '梯形图嵌套循环', mastery: 70 }, { name: '伺服位置同步', mastery: 72 }, { name: 'HMI 报警', mastery: 76 }],
  'cls-ev-2401':     [{ name: 'BMS 均衡算法', mastery: 48 }, { name: 'CAN 总线协议', mastery: 56 }, { name: '电机矢量控制', mastery: 60 }, { name: '充电握手', mastery: 66 }, { name: '冷却回路', mastery: 70 }],
  'cls-chem-2401':   [{ name: '精馏塔板效率', mastery: 50 }, { name: '反应器热平衡', mastery: 54 }, { name: '换热器选型', mastery: 60 }, { name: '安全联锁', mastery: 66 }, { name: 'PID 回路', mastery: 70 }],
  'cls-net-2401':    [{ name: 'VLAN 间路由', mastery: 45 }, { name: 'OSPF LSA 类型', mastery: 52 }, { name: 'ACL 通配符', mastery: 58 }, { name: 'NAT 静态映射', mastery: 64 }, { name: 'STP 收敛', mastery: 70 }],
  'cls-mech-2302':   [{ name: '齿轮强度校核', mastery: 56 }, { name: '材料疲劳曲线', mastery: 60 }, { name: '公差配合', mastery: 64 }, { name: '工艺路线编排', mastery: 70 }, { name: '热处理工艺', mastery: 72 }],
  'cls-it-2302':     [{ name: 'JVM 内存模型', mastery: 60 }, { name: 'B+树索引', mastery: 64 }, { name: 'CSS Grid 布局', mastery: 70 }, { name: 'Vue 响应式原理', mastery: 72 }, { name: 'Promise 链', mastery: 74 }],
}

const insightsSeeds: Record<string, ClassDetail['insights']> = {
  'cls-net-2401':    [{ kind: 'warning',   title: 'VLAN 间路由掌握率仅 45%',  desc: '建议本周末安排 1 次专项习题课，配合 AI 实践沙盒' }, { kind: 'highlight', title: '出勤率高于同年级 +4 pp',     desc: '班长机制运转良好' }, { kind: 'tip',       title: '黄思源连续 3 次抢答最快',  desc: '可作为分组 leader' }],
  'cls-ctrl-2402':   [{ kind: 'highlight', title: '班级 AI 活跃度 91 居全校第一', desc: 'AI 实践调用占整体 22%，效果可推广' }, { kind: 'highlight', title: 'PID 整定模拟通过率 86%',     desc: '相较学期初 +28 pp' }, { kind: 'tip',       title: '可申报为校级"AI 试点班"',   desc: '数据维度均达到申报标准' }],
  'cls-robo-2401':   [{ kind: 'highlight', title: 'AI 板书使用排名第二',         desc: '示教器编程相关板书最多' }, { kind: 'warning',   title: '六轴坐标变换错题集中度高', desc: '12 名学生在该题型上反复出错' }, { kind: 'tip',       title: '建议增加 1 节专题习题课',  desc: '配合 AI 实践沙盒效果更佳' }],
  'cls-design-2401': [{ kind: 'highlight', title: 'AI 实践占比高于全校均值',     desc: '渲染光源练习贡献最多' }, { kind: 'warning',   title: 'NURBS 曲面拓扑薄弱',       desc: '12 人挂科风险' }, { kind: 'tip',       title: '陈雨涵适合担任助教',       desc: '答题准确率 95%' }],
  'cls-ev-2401':     [{ kind: 'warning',   title: 'AI 活跃度低于全校均值 14 pp', desc: '建议班主任组织 AI 助教工作坊' }, { kind: 'warning',   title: 'BMS 均衡算法掌握率仅 48%', desc: '建议增加 1 次仿真课' }, { kind: 'tip',       title: '可邀请头部企业工程师答疑',  desc: '宁德 / 比亚迪 已联系' }],
  'cls-chem-2401':   [{ kind: 'warning',   title: 'AI 使用率全校最低',            desc: '建议班主任 + 教务长面谈' }, { kind: 'warning',   title: '精馏塔板效率掌握 50%',     desc: '反应工程链是瓶颈' }, { kind: 'tip',       title: '可与化工厂签订实习协议',    desc: '实战练习提升积极性' }],
  'cls-mech-2302':   [{ kind: 'warning',   title: 'AI 活跃度仅 48',              desc: '老学生群体使用习惯偏弱，建议引导' }, { kind: 'tip',       title: '可推送 AI 课件给学生预习',  desc: 'AI 课件库已有 23 份适配课件' }, { kind: 'highlight', title: '出勤率仍维持 88%',          desc: '班委管理到位' }],
  'cls-it-2302':     [{ kind: 'highlight', title: 'AI 活跃度 86 全校第二',       desc: 'AI 课件使用最多，自驱性强' }, { kind: 'highlight', title: '平均测验分 85.0',          desc: '高于同年级 +6 pp' }, { kind: 'tip',       title: '建议加入"AI 项目实战"模块', desc: '已有 7 人完成 LeetCode 50 题' }],
}

// 生成 N 个学生的种子（带稳定性）
function genStudents(seed: string, count: number): ClassStudent[] {
  const lastNames = ['张','王','李','陈','赵','黄','吴','刘','孙','周','徐','朱','马','胡','郭','林','何','高','梁','郑','罗','宋','谢','韩','唐','冯','于','董','萧','程']
  const firstNames = ['浩然','梓涵','雨涵','子轩','思源','婷','睿','一鸣','梦琪','嘉怡','明哲','志远','子涵','宇航','沐辰','若曦','可儿','文博','晨曦','嘉豪','子睿','若汐','一诺','子涵']
  // 生成稳定的伪随机
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  function rand() { h = (h * 1103515245 + 12345) & 0x7fffffff; return h / 0x7fffffff }
  const out: ClassStudent[] = []
  for (let i = 0; i < count; i++) {
    const ln = lastNames[Math.floor(rand() * lastNames.length)]
    const fn = firstNames[Math.floor(rand() * firstNames.length)]
    const gender: '男' | '女' = rand() > 0.5 ? '男' : '女'
    const avg = Math.round(60 + rand() * 38)  // 60-98
    const att = Math.round(80 + rand() * 19)  // 80-99
    const ai  = Math.floor(rand() * 60)       // 0-60
    let status: ClassStudent['status'] = '良好'
    let riskTag: string | undefined
    if (avg >= 90) status = '优秀'
    else if (avg < 70 && att < 90) { status = '需关注'; riskTag = '挂科风险' }
    else if (ai < 5) { status = '待激活'; riskTag = '低 AI 互动' }
    out.push({
      id: `${seed}-stu-${String(i + 1).padStart(3, '0')}`,
      name: `${ln}${fn}`,
      studentNo: `${seed.slice(-4)}${String(i + 1).padStart(3, '0')}`,
      gender,
      avgScore: avg,
      attendanceRate: att,
      aiUsage: ai,
      status,
      riskTag,
    })
  }
  return out
}

export function getClassDetail(classId: string): ClassDetail | null {
  const cls = classList.find(c => c.id === classId)
  if (!cls) return null
  return {
    ...cls,
    radar:        radarSeeds[classId]      || [{ name: '出勤', value: 90 }, { name: '答题', value: 80 }, { name: '互动', value: 75 }, { name: 'AI使用', value: 70 }, { name: '协作', value: 78 }],
    aiBreakdown:  aiBreakdownSeeds[classId] || [],
    weakPoints:   weakPointsSeeds[classId]  || [],
    insights:     insightsSeeds[classId]    || [],
    students:     genStudents(classId, cls.studentCount),
  }
}

/* ============ 学生画像 ============ */

export interface StudentProfile {
  id: string
  name: string
  studentNo: string
  gender: '男' | '女'
  className: string
  classId: string
  department: string
  avatar?: string             // 可选头像 URL
  /** 个人雷达 5 维 */
  radar: { name: string; value: number }[]
  /** 4 周 × 5 天 出勤热力图（0=未出勤 1=迟到 2=出勤 3=请假） */
  attendanceHeatmap: { week: number; day: number; value: number }[]
  /** 各科目掌握度 */
  subjectMastery: { subject: string; mastery: number; delta: number }[]
  /** 错题集中度（按知识点） */
  wrongTopics: { topic: string; count: number; subject: string }[]
  /** AI 助教使用偏好（占比百分比） */
  aiPreference: { feature: string; pct: number; color: string }[]
  /** 4 周测验趋势 */
  scoreTrend: { week: string; score: number }[]
  /** 综合评价 */
  summary: string
  /** 标签（特长 / 风险） */
  tags: { kind: 'highlight' | 'warning'; text: string }[]
}

const studentProfileSeeds: Record<string, Partial<StudentProfile>> = {
  'cls-ctrl-2402-stu-001': {
    name: '黄思源',
    gender: '男',
    radar: [{ name: '出勤', value: 98 }, { name: '答题', value: 92 }, { name: '互动', value: 95 }, { name: 'AI使用', value: 88 }, { name: '协作', value: 86 }],
    summary: '专业第一，PLC 与运动控制全面领先，AI 实践模块使用率高。建议鼓励参加技能大赛。',
    tags: [{ kind: 'highlight', text: '专业第一' }, { kind: 'highlight', text: '抢答之王' }, { kind: 'highlight', text: 'AI 实践高频用户' }],
  },
  'cls-net-2401-stu-003': {
    name: '陈雨涵',
    gender: '女',
    radar: [{ name: '出勤', value: 95 }, { name: '答题', value: 88 }, { name: '互动', value: 92 }, { name: 'AI使用', value: 84 }, { name: '协作', value: 90 }],
    summary: '善于发问，AI 对话使用率全班第一。综合能力强，可作为分组讨论 leader 培养。',
    tags: [{ kind: 'highlight', text: '问答能手' }, { kind: 'highlight', text: '协作之星' }],
  },
}

export function getStudentProfile(studentId: string): StudentProfile {
  // 从 classId-stu-xxx 反查 class
  const parts = studentId.split('-stu-')
  const classId = parts[0]
  const cls = classList.find(c => c.id === classId) || classList[0]
  const detail = getClassDetail(classId)
  const stu = detail?.students.find(s => s.id === studentId)

  const seed = studentProfileSeeds[studentId]

  // 用学生本人的统计反推一个 radar
  const baseRadar = stu
    ? [
        { name: '出勤',  value: stu.attendanceRate },
        { name: '答题',  value: stu.avgScore },
        { name: '互动',  value: Math.min(100, stu.aiUsage * 1.5 + 40) },
        { name: 'AI使用', value: Math.min(100, stu.aiUsage * 1.7) },
        { name: '协作',  value: Math.max(50, stu.avgScore - 5) },
      ]
    : [{ name: '出勤', value: 90 }, { name: '答题', value: 82 }, { name: '互动', value: 76 }, { name: 'AI使用', value: 70 }, { name: '协作', value: 78 }]

  // 4 周 × 5 天 热力图，根据 attendanceRate 决定数据生成
  const att = stu?.attendanceRate || 90
  const heatmap: StudentProfile['attendanceHeatmap'] = []
  let seedH = 0
  for (let i = 0; i < studentId.length; i++) seedH = (seedH * 31 + studentId.charCodeAt(i)) >>> 0
  function r() { seedH = (seedH * 1103515245 + 12345) & 0x7fffffff; return seedH / 0x7fffffff }
  for (let w = 0; w < 4; w++) {
    for (let d = 0; d < 5; d++) {
      const pct = r() * 100
      let value = 2
      if (pct > att + 8) value = 0           // 未出勤
      else if (pct > att) value = 1          // 迟到
      else if (pct < 6) value = 3            // 请假
      heatmap.push({ week: w, day: d, value })
    }
  }

  // 科目掌握度 = 班级 weakPoints 取前 5 个 + 加扰动
  const subjects = detail?.weakPoints.slice(0, 5).map(wp => ({
    subject: wp.name,
    mastery: Math.min(98, wp.mastery + Math.round((r() - 0.5) * 30)),
    delta: Math.round((r() - 0.3) * 12),
  })) || []

  // 错题集中度
  const wrongTopics = detail?.weakPoints.slice(0, 4).map((wp, i) => ({
    topic: wp.name,
    count: Math.max(3, Math.floor((100 - wp.mastery) / 8) + i),
    subject: cls.subjects[i % cls.subjects.length] || cls.subjects[0],
  })) || []

  // AI 偏好（占比，加起来 100）
  const aiPreference = (() => {
    const raw = [Math.floor(r() * 50) + 20, Math.floor(r() * 30) + 10, Math.floor(r() * 25) + 5, Math.floor(r() * 15) + 5, Math.floor(r() * 10) + 2]
    const sum = raw.reduce((a, b) => a + b, 0)
    const labels = ['AI 对话', 'AI 实践', 'AI 板书', 'AI 出题', 'AI 课件']
    const colors = ['var(--color-brand-500)', 'var(--color-info-500)', 'var(--color-ai-500)', 'var(--color-success-500)', 'var(--color-warning-500)']
    return raw.map((v, i) => ({ feature: labels[i], pct: Math.round((v / sum) * 100), color: colors[i] }))
  })()

  // 4 周分数趋势
  const baseScore = stu?.avgScore || 82
  const scoreTrend = [
    { week: '第 1 周', score: Math.max(50, Math.min(100, baseScore - 6 + Math.round((r() - 0.5) * 8))) },
    { week: '第 2 周', score: Math.max(50, Math.min(100, baseScore - 3 + Math.round((r() - 0.5) * 8))) },
    { week: '第 3 周', score: Math.max(50, Math.min(100, baseScore + 1 + Math.round((r() - 0.5) * 8))) },
    { week: '第 4 周', score: Math.max(50, Math.min(100, baseScore + 4 + Math.round((r() - 0.5) * 8))) },
  ]

  // 标签
  const tags: StudentProfile['tags'] = []
  if (stu) {
    if (stu.status === '优秀') tags.push({ kind: 'highlight', text: '优秀学员' })
    if (stu.aiUsage > 40)      tags.push({ kind: 'highlight', text: 'AI 高频用户' })
    if (stu.attendanceRate < 85) tags.push({ kind: 'warning', text: '出勤率偏低' })
    if (stu.avgScore < 70)     tags.push({ kind: 'warning', text: '成绩待提升' })
    if (stu.aiUsage < 5)       tags.push({ kind: 'warning', text: 'AI 使用偏低' })
    if (tags.length === 0)     tags.push({ kind: 'highlight', text: '稳定型' })
  }

  // 综合评价
  const summary = stu
    ? `${stu.name} 当前学习状态：${stu.status}。平均测验 ${stu.avgScore} 分、出勤率 ${stu.attendanceRate}%、本周 AI 助教使用 ${stu.aiUsage} 次。${
        stu.status === '需关注' ? '建议班主任 1v1 沟通，并安排 AI 实践沙盒巩固。' :
        stu.status === '待激活' ? '可推送 AI 预习卡 + 抢答邀请激活学习兴趣。' :
        stu.status === '优秀'   ? '可作为分组 leader 培养，参加技能大赛。' :
                                 '维持现有学习节奏，每月复盘一次。'
      }`
    : '学生信息未找到'

  return {
    id: studentId,
    name: seed?.name || stu?.name || '学生',
    studentNo: stu?.studentNo || studentId,
    gender: seed?.gender || stu?.gender || '男',
    className: cls.name,
    classId,
    department: cls.department,
    radar: seed?.radar || baseRadar,
    attendanceHeatmap: heatmap,
    subjectMastery: subjects,
    wrongTopics,
    aiPreference,
    scoreTrend,
    summary: seed?.summary || summary,
    tags: seed?.tags || tags,
  }
}

/* ============ 状态/标签的标准化 ============ */

export const STATUS_COLOR: Record<ClassStudent['status'], 'success' | 'info' | 'warning' | 'danger'> = {
  '优秀':   'success',
  '良好':   'info',
  '需关注': 'warning',
  '待激活': 'danger',
}
