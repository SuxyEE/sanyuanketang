/**
 * AI 助教治理中心 mock 数据
 *
 * 目标：
 * 1. 演示「AI 是可观测可治理的」：消耗 / 健康 / 流水 / 告警 全套指标
 * 2. 每个 export 都是「未来要接的真实 API 形状」，便于后期一一替换
 *
 * 后续替换路径示例：
 *   `aiGovernanceKpi`   → 后端 `GET /api/v1/admin/ai/kpi?range=today`
 *   `tokenUsageSeries`  → 后端 `GET /api/v1/admin/ai/token-usage?range=7d`
 *   `providerHealth`    → 后端 `GET /api/v1/admin/ai/providers/health`
 *   `aiCallLog`         → 后端 `GET /api/v1/admin/ai/calls?limit=100`
 *   `sensitiveAlerts`   → 后端 `GET /api/v1/admin/ai/alerts?limit=20`
 *   `tokenTopUsers`     → 后端 `GET /api/v1/admin/ai/top-users?range=7d`
 */

/** ----- 顶部 KPI ----- */
export interface AiKpi {
  value: number
  unit?: string
  delta: number          // 相对昨日/上周百分比
  series: number[]       // sparkline 最近 7 个点
}

export const aiGovernanceKpi = {
  /** 今日累计 Token 消耗（千） */
  todayTokens:    { value: 348.6, unit: 'k', delta: +18.3, series: [180, 210, 245, 220, 268, 312, 348] } as AiKpi,
  /** 今日累计调用次数 */
  todayCalls:     { value: 2348,  unit: '次', delta: +22.7, series: [1320, 1480, 1640, 1820, 1980, 2180, 2348] } as AiKpi,
  /** 平均首字延迟（毫秒） */
  avgLatency:     { value: 1240,  unit: 'ms', delta: -8.4,  series: [1480, 1420, 1380, 1320, 1280, 1260, 1240] } as AiKpi,
  /** 调用错误率（%） */
  errorRate:      { value: 0.42,  unit: '%',  delta: -32.1, series: [1.2, 0.95, 0.82, 0.68, 0.55, 0.48, 0.42] } as AiKpi,
}

/** ----- 7 日 Token 用量按功能拆分（堆叠面积图） ----- */
export interface TokenUsageDay {
  date: string           // 'MM-DD'
  chat: number           // AI 对话（千 token）
  whiteboard: number     // AI 板书
  practice: number       // AI 实践
  courseware: number     // AI 课件
  quiz: number           // AI 出题
}

export const tokenUsageSeries: TokenUsageDay[] = [
  { date: '05-20', chat: 82,  whiteboard: 28, practice: 18, courseware: 24, quiz: 28 },
  { date: '05-21', chat: 96,  whiteboard: 34, practice: 22, courseware: 28, quiz: 32 },
  { date: '05-22', chat: 108, whiteboard: 42, practice: 28, courseware: 32, quiz: 38 },
  { date: '05-23', chat: 88,  whiteboard: 36, practice: 24, courseware: 26, quiz: 34 },
  { date: '05-24', chat: 124, whiteboard: 52, practice: 32, courseware: 38, quiz: 44 },
  { date: '05-25', chat: 138, whiteboard: 58, practice: 38, courseware: 42, quiz: 48 },
  { date: '05-26', chat: 152, whiteboard: 68, practice: 42, courseware: 46, quiz: 52 },
]

/** ----- Provider 健康表 ----- */
export type ProviderStatus = 'healthy' | 'degraded' | 'down' | 'standby'

export interface ProviderHealth {
  id: string
  name: string
  model: string
  status: ProviderStatus
  /** 24h 调用次数 */
  requests24h: number
  /** 平均首字延迟（ms） */
  avgLatency: number
  /** 成功率（%，0-100） */
  successRate: number
  /** 24h 错误次数 */
  errors24h: number
  /** 今日累计消耗（USD ¥） */
  costToday: number
  /** 是否为当前主路由 */
  isPrimary: boolean
  /** 最后心跳时间（'刚刚' / '12s 前' / '3m 前'） */
  lastCheck: string
}

export const providerHealth: ProviderHealth[] = [
  {
    id: 'qwen',
    name: '阿里云通义千问',
    model: 'qwen3.5-plus',
    status: 'healthy',
    requests24h: 1842,
    avgLatency: 1180,
    successRate: 99.8,
    errors24h: 4,
    costToday: 28.4,
    isPrimary: true,
    lastCheck: '12s 前',
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    model: 'deepseek-v3',
    status: 'healthy',
    requests24h: 384,
    avgLatency: 1420,
    successRate: 99.5,
    errors24h: 2,
    costToday: 6.8,
    isPrimary: false,
    lastCheck: '18s 前',
  },
  {
    id: 'claude',
    name: 'Anthropic Claude',
    model: 'claude-3.5-sonnet',
    status: 'degraded',
    requests24h: 96,
    avgLatency: 2840,
    successRate: 96.2,
    errors24h: 4,
    costToday: 12.6,
    isPrimary: false,
    lastCheck: '34s 前',
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    model: 'gemini-2.0-flash',
    status: 'standby',
    requests24h: 26,
    avgLatency: 980,
    successRate: 100,
    errors24h: 0,
    costToday: 1.2,
    isPrimary: false,
    lastCheck: '46s 前',
  },
]

/** ----- 实时调用流水 ----- */
export type CallFeature = 'chat' | 'whiteboard' | 'practice' | 'courseware' | 'quiz'
export type CallStatus = 'success' | 'failed' | 'timeout' | 'flagged'

export interface AiCallLogItem {
  id: string
  time: string          // 'HH:mm:ss'
  provider: string      // 'qwen' / 'claude' / ...
  feature: CallFeature
  /** 触发用户：教师/学生姓名 */
  user: string
  /** 输入 prompt 摘要（前 24 字） */
  promptPreview: string
  /** 输入 token 数 */
  tokensIn: number
  /** 输出 token 数 */
  tokensOut: number
  /** 首字延迟（ms） */
  latency: number
  /** 单次成本（人民币元） */
  cost: number
  status: CallStatus
}

export const aiCallLog: AiCallLogItem[] = [
  { id: 'l001', time: '14:48:32', provider: 'qwen',     feature: 'whiteboard', user: '张伟',  promptPreview: 'PLC 梯形图 START 按钮逻辑讲解…',  tokensIn: 132, tokensOut: 824,  latency: 980,  cost: 0.024, status: 'success' },
  { id: 'l002', time: '14:48:14', provider: 'qwen',     feature: 'chat',       user: '陈雨涵', promptPreview: '老师，第 3 页那个公式怎么推导的？', tokensIn: 86,  tokensOut: 412,  latency: 1180, cost: 0.012, status: 'success' },
  { id: 'l003', time: '14:47:58', provider: 'deepseek', feature: 'quiz',       user: '王芳',   promptPreview: '为"三维建模"出 5 道选择题，难度…',  tokensIn: 168, tokensOut: 1840, latency: 1420, cost: 0.018, status: 'success' },
  { id: 'l004', time: '14:47:42', provider: 'qwen',     feature: 'practice',   user: '张伟',   promptPreview: '生成一个 PLC 仿真练习场景，包含…',   tokensIn: 142, tokensOut: 2360, latency: 1340, cost: 0.038, status: 'success' },
  { id: 'l005', time: '14:47:26', provider: 'qwen',     feature: 'chat',       user: '林浩然', promptPreview: '工业机器人六轴是哪六个？',          tokensIn: 32,  tokensOut: 268,  latency: 920,  cost: 0.008, status: 'success' },
  { id: 'l006', time: '14:47:08', provider: 'claude',   feature: 'courseware', user: '李明',   promptPreview: '把这份教案生成 8 页课件大纲，主题…', tokensIn: 286, tokensOut: 1920, latency: 2640, cost: 0.062, status: 'success' },
  { id: 'l007', time: '14:46:54', provider: 'qwen',     feature: 'chat',       user: '苏梦琪', promptPreview: '什么是 PID 控制？通俗解释一下',     tokensIn: 28,  tokensOut: 386,  latency: 1080, cost: 0.011, status: 'success' },
  { id: 'l008', time: '14:46:38', provider: 'qwen',     feature: 'whiteboard', user: '陈磊',   promptPreview: '画一个新能源车三电系统结构图',       tokensIn: 96,  tokensOut: 1240, latency: 1260, cost: 0.032, status: 'success' },
  { id: 'l009', time: '14:46:22', provider: 'qwen',     feature: 'chat',       user: '赵小雨', promptPreview: '老师我没听懂上面那段，能再讲一遍吗', tokensIn: 38,  tokensOut: 524,  latency: 1140, cost: 0.014, status: 'flagged' },
  { id: 'l010', time: '14:46:08', provider: 'claude',   feature: 'practice',   user: '王芳',   promptPreview: '生成一个曲面 NURBS 建模练习…',      tokensIn: 184, tokensOut: 0,    latency: 8200, cost: 0,     status: 'timeout' },
  { id: 'l011', time: '14:45:52', provider: 'qwen',     feature: 'quiz',       user: '赵敏',   promptPreview: '化工单元操作蒸馏塔出 3 道题',       tokensIn: 96,  tokensOut: 982,  latency: 1080, cost: 0.018, status: 'success' },
  { id: 'l012', time: '14:45:36', provider: 'deepseek', feature: 'chat',       user: '吴佳怡', promptPreview: '蒸馏塔回流比是什么意思',             tokensIn: 24,  tokensOut: 312,  latency: 1240, cost: 0.009, status: 'success' },
  { id: 'l013', time: '14:45:18', provider: 'qwen',     feature: 'whiteboard', user: '刘洋',   promptPreview: '画 OSI 七层模型示意图，每层贴…',     tokensIn: 78,  tokensOut: 968,  latency: 1180, cost: 0.026, status: 'success' },
  { id: 'l014', time: '14:45:02', provider: 'qwen',     feature: 'chat',       user: '黄思源', promptPreview: 'VLAN 和 VPN 的区别？',             tokensIn: 18,  tokensOut: 442,  latency: 980,  cost: 0.012, status: 'success' },
  { id: 'l015', time: '14:44:48', provider: 'qwen',     feature: 'chat',       user: '匿名学生', promptPreview: '【已被过滤】涉及不当内容的请求',     tokensIn: 28,  tokensOut: 0,    latency: 120,  cost: 0,     status: 'flagged' },
]

/** ----- 敏感词告警 / 异常事件 ----- */
export type AlertSeverity = 'high' | 'medium' | 'low'
export type AlertKind = 'sensitive' | 'jailbreak' | 'overlength' | 'rate-limit' | 'pii'

export interface SensitiveAlert {
  id: string
  time: string          // 'HH:mm'
  severity: AlertSeverity
  kind: AlertKind
  title: string
  desc: string
  /** 命中的关键词或标签 */
  hits: string[]
  user: string
  /** 处理状态 */
  handled: boolean
}

export const sensitiveAlerts: SensitiveAlert[] = [
  { id: 'a1', time: '14:46', severity: 'high',   kind: 'sensitive', title: '检测到敏感词命中',          desc: '学生 App 发送的对话包含涉政关键词，已拦截并屏蔽响应', hits: ['***', '***'], user: '匿名学生（chat-9821）', handled: false },
  { id: 'a2', time: '14:32', severity: 'medium', kind: 'jailbreak', title: '疑似 Prompt 注入',         desc: '检测到"忽略之前的指令"等关键短语，已拒绝执行',       hits: ['ignore previous'], user: '匿名学生（chat-9714）', handled: true  },
  { id: 'a3', time: '13:58', severity: 'low',    kind: 'overlength', title: '请求超长',                 desc: '单次 prompt 超过 8000 token，已切到 long-context 路由', hits: ['len=8642'],     user: '李明',               handled: true  },
  { id: 'a4', time: '11:24', severity: 'medium', kind: 'pii',       title: '检测到学生身份信息',         desc: '对话内容包含手机号格式，已自动脱敏后入库',           hits: ['phone'],         user: '陈雨涵',             handled: true  },
  { id: 'a5', time: '10:46', severity: 'low',    kind: 'rate-limit', title: '高频请求限流',              desc: '同一 IP 1 分钟内请求 28 次，已临时降级',            hits: ['rps=28'],        user: '账号 user-2014',    handled: true  },
]

/** ----- Token 用量 Top 教师 ----- */
export interface TokenTopUser {
  rank: number
  name: string
  role: '教师' | '学生'
  department: string
  tokensUsed: number     // 千 token
  calls: number
  topFeature: '对话' | '板书' | '实践' | '课件' | '出题'
}

export const tokenTopUsers: TokenTopUser[] = [
  { rank: 1, name: '张伟', role: '教师', department: '智能控制学院',   tokensUsed: 48.2, calls: 268, topFeature: '板书' },
  { rank: 2, name: '王芳', role: '教师', department: '数字设计学院',   tokensUsed: 42.6, calls: 234, topFeature: '实践' },
  { rank: 3, name: '李明', role: '教师', department: '机器人工程学院', tokensUsed: 38.4, calls: 198, topFeature: '课件' },
  { rank: 4, name: '陈磊', role: '教师', department: '新能源汽车学院', tokensUsed: 32.8, calls: 172, topFeature: '板书' },
  { rank: 5, name: '赵敏', role: '教师', department: '应用化工学院',   tokensUsed: 26.4, calls: 142, topFeature: '出题' },
]

/** ----- Feature → 标签 / 颜色（统一映射，避免各组件分散硬编码） ----- */
export const FEATURE_LABEL: Record<CallFeature, string> = {
  chat:       'AI 对话',
  whiteboard: 'AI 板书',
  practice:   'AI 实践',
  courseware: 'AI 课件',
  quiz:       'AI 出题',
}

export const STATUS_LABEL: Record<CallStatus, string> = {
  success: '成功',
  failed:  '失败',
  timeout: '超时',
  flagged: '已拦截',
}

export const STATUS_TONE: Record<CallStatus, 'success' | 'danger' | 'warning' | 'info'> = {
  success: 'success',
  failed:  'danger',
  timeout: 'warning',
  flagged: 'info',
}

export const PROVIDER_LABEL: Record<string, string> = {
  qwen:     '通义千问',
  deepseek: 'DeepSeek',
  claude:   'Claude',
  gemini:   'Gemini',
}

export const SEVERITY_TONE: Record<AlertSeverity, 'danger' | 'warning' | 'info'> = {
  high:   'danger',
  medium: 'warning',
  low:    'info',
}

export const SEVERITY_LABEL: Record<AlertSeverity, string> = {
  high:   '高危',
  medium: '中等',
  low:    '低危',
}

export const ALERT_KIND_LABEL: Record<AlertKind, string> = {
  sensitive:  '敏感词',
  jailbreak:  '注入攻击',
  overlength: '超长请求',
  'rate-limit': '频次告警',
  pii:        '隐私信息',
}
