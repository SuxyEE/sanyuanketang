/**
 * Dashboard 静态 mock 数据
 *
 * 目标：
 * 1. 让 Dashboard 在没有任何后端真实统计接口时也能演示完整功能
 * 2. 每个 export 都是「未来要接的真实 API 形状」，便于后期一一替换
 * 3. 数据语境贴合三元课堂业务：工业机器人 / PLC / 数字化设计 / 网络等专业
 *
 * 后续替换路径示例：
 *   `aiUsageSeries` → 后端 `GET /api/v1/admin/stats/ai-usage?range=7d`
 *   `liveClassrooms` → 复用 `useAdminSocket` 实时数据（已通）
 */

/** ----- KPI 卡片 ----- */
export interface KpiTrend {
  value: number
  unit?: string
  delta: number          // 相对昨日/上周的百分比变化
  series: number[]       // sparkline 用的最近 7 个点
}

export const kpiMock = {
  todayLessons:    { value: 28,   unit: '节',   delta: +12.5, series: [16, 19, 22, 18, 24, 26, 28] } as KpiTrend,
  totalOnline:     { value: 1286, unit: '人',   delta: +8.3,  series: [840, 920, 1050, 980, 1180, 1230, 1286] } as KpiTrend,
  activeRate:      { value: 87,   unit: '%',    delta: +3.2,  series: [78, 80, 84, 82, 86, 88, 87] } as KpiTrend,
  aiTotalCalls:    { value: 2348, unit: '次',   delta: +22.7, series: [1320, 1480, 1640, 1820, 1980, 2180, 2348] } as KpiTrend,
  aiWhiteboard:    { value: 412,  unit: '次',   delta: +35.4, series: [120, 165, 198, 245, 298, 340, 412] } as KpiTrend,
  aiPractice:      { value: 186,  unit: '次',   delta: +18.9, series: [85, 102, 118, 132, 148, 165, 186] } as KpiTrend,
  groupDiscussion: { value: 64,   unit: '次',   delta: +9.1,  series: [38, 42, 48, 50, 56, 58, 64] } as KpiTrend,
  attendanceRate:  { value: 94,   unit: '%',    delta: +1.4,  series: [89, 91, 92, 90, 93, 93, 94] } as KpiTrend,
}

/** ----- AI 各功能用量分布（堆叠面积图） ----- */
export interface AiUsageDay {
  date: string           // 'MM-DD'
  chat: number           // AI 对话
  whiteboard: number     // AI 板书
  practice: number       // AI 实践
  courseware: number     // AI 课件
  quiz: number           // AI 出题
}

export const aiUsageSeries: AiUsageDay[] = [
  { date: '05-20', chat: 180, whiteboard: 38, practice: 22, courseware: 14, quiz: 28 },
  { date: '05-21', chat: 210, whiteboard: 45, practice: 28, courseware: 18, quiz: 36 },
  { date: '05-22', chat: 245, whiteboard: 52, practice: 31, courseware: 22, quiz: 42 },
  { date: '05-23', chat: 198, whiteboard: 48, practice: 26, courseware: 17, quiz: 38 },
  { date: '05-24', chat: 268, whiteboard: 64, practice: 38, courseware: 24, quiz: 48 },
  { date: '05-25', chat: 295, whiteboard: 72, practice: 42, courseware: 28, quiz: 52 },
  { date: '05-26', chat: 320, whiteboard: 93, practice: 46, courseware: 32, quiz: 58 },
]

/** ----- 实时课堂（fallback 静态数据 · 真实数据来自 useAdminSocket） ----- */
export interface MockClassroom {
  id: string
  name: string
  teacher: string
  className: string
  online: number
  total: number
  progress: number       // 当前页 / 总页 百分比
  activity: '授课中' | '随堂测验' | 'AI实践' | '分组讨论' | '签到中' | '抢答中'
  trend: 'up' | 'down' | 'flat'
}

export const liveClassrooms: MockClassroom[] = [
  { id: 'c1', name: '工业机器人编程实训',  teacher: '李明',   className: '机器人2401班',    online: 42, total: 45, progress: 60, activity: '授课中',   trend: 'up'   },
  { id: 'c2', name: '三维建模与曲面设计',  teacher: '王芳',   className: '数设2401班',      online: 38, total: 40, progress: 45, activity: 'AI实践',   trend: 'up'   },
  { id: 'c3', name: 'PLC梯形图与运动控制', teacher: '张伟',   className: '智控2402班',      online: 44, total: 48, progress: 75, activity: '随堂测验', trend: 'flat' },
  { id: 'c4', name: '新能源汽车电控系统',  teacher: '陈磊',   className: '新能源2401班',    online: 40, total: 42, progress: 55, activity: '分组讨论', trend: 'up'   },
  { id: 'c5', name: '化工单元操作实务',    teacher: '赵敏',   className: '化工2401班',      online: 28, total: 30, progress: 82, activity: '授课中',   trend: 'down' },
  { id: 'c6', name: '网络设备配置与排错',  teacher: '刘洋',   className: '网络2401班',      online: 35, total: 38, progress: 30, activity: '签到中',   trend: 'up'   },
]

/** ----- 智能洞察（AI 生成的本日精华） ----- */
export interface Insight {
  id: string
  kind: 'highlight' | 'warning' | 'tip'
  title: string
  desc: string
  metric?: string         // 可选量化指标，例 '+24%'
}

export const insights: Insight[] = [
  {
    id: 'i1',
    kind: 'highlight',
    title: 'AI 板书使用量创新高',
    desc: '今日 412 次，较昨日 +35.4%，主要集中在工业机器人与 PLC 课程',
    metric: '+35.4%',
  },
  {
    id: 'i2',
    kind: 'warning',
    title: 'VLAN 配置知识点掌握率偏低',
    desc: '"网络设备配置"课近 3 节平均掌握率 45%，建议教师强化讲解',
    metric: '45%',
  },
  {
    id: 'i3',
    kind: 'highlight',
    title: '"PLC 梯形图编程" AI 实践效果显著',
    desc: '使用 AI 实践模块后，平均测验成绩提升 14 分，建议推广',
    metric: '+14分',
  },
  {
    id: 'i4',
    kind: 'tip',
    title: '今日抢答最活跃班级',
    desc: '智控 2402 班连续 3 节课触发抢答，平均响应 1.2s',
    metric: '1.2s',
  },
]

/** ----- 课堂活动类型分布（环形图） ----- */
export interface ActivitySlice {
  name: string
  value: number
  color: string
}

export const activityDistribution: ActivitySlice[] = [
  { name: '授课讲解',  value: 320, color: 'var(--color-brand-500)'  },
  { name: 'AI 板书',   value: 158, color: 'var(--color-ai-500)'      },
  { name: '随堂测验',  value: 142, color: 'var(--color-warning-500)' },
  { name: 'AI 实践',   value: 96,  color: 'var(--color-info-500)'    },
  { name: '分组讨论',  value: 78,  color: 'var(--color-success-500)' },
  { name: '签到点名',  value: 54,  color: '#eb2f96'                   },
]

/** ----- 教师 TOP 5（按 AI 使用 + 课堂数综合） ----- */
export interface TeacherRank {
  name: string
  department: string
  lessons: number
  aiCalls: number
  rating: number          // 1-5
}

export const teacherTopList: TeacherRank[] = [
  { name: '张伟', department: '智能控制学院',   lessons: 32, aiCalls: 268, rating: 4.9 },
  { name: '李明', department: '机器人工程学院', lessons: 28, aiCalls: 234, rating: 4.8 },
  { name: '王芳', department: '数字设计学院',   lessons: 26, aiCalls: 198, rating: 4.7 },
  { name: '陈磊', department: '新能源汽车学院', lessons: 22, aiCalls: 172, rating: 4.6 },
  { name: '赵敏', department: '应用化工学院',   lessons: 18, aiCalls: 142, rating: 4.5 },
]

/** ----- 静态 timeline（无 WS 事件时的占位） ----- */
export interface TimelineItem {
  time: string
  type: 'quiz' | 'attendance' | 'broadcast' | 'hand' | 'question' | 'answer' | 'lock' | 'group' | 'lesson' | 'ai'
  text: string
}

export const staticTimeline: TimelineItem[] = [
  { time: '14:48', type: 'ai',         text: '张伟老师 · "PLC梯形图" 已生成 AI 板书 412 字' },
  { time: '14:45', type: 'quiz',       text: '张伟 在"PLC 控制技术"课堂发起了随堂测验（5 题）' },
  { time: '14:32', type: 'lesson',     text: '李明 开始了"工业机器人编程实训"直播授课' },
  { time: '14:30', type: 'attendance', text: '4 个课堂同时开课，386 名师生在线' },
  { time: '12:15', type: 'lesson',     text: '上午课程全部结束，生成 12 份课堂报告' },
  { time: '10:30', type: 'ai',         text: '王芳老师的课堂 AI 助手使用次数达到 50 次' },
]
