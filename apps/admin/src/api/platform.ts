import { API_BASE } from '@/shared/backend'

export interface PlatformBrandingConfig {
  productName: string
  schoolName: string
  logoText?: string
  logoUrl?: string
  primaryColor?: string
  aiColor?: string
  backgroundImageUrl?: string
  siderBackground?: string
}

export interface PlatformPublicConfig {
  tenantId: string
  schoolId: string
  schoolName: string
  productName: string
  branding: PlatformBrandingConfig
  features: Record<string, boolean>
  model?: {
    provider: string
    model: string
    temperature?: number
  }
  questionBank?: {
    mode: string
    enabled: boolean
  }
  learningRecordSink?: {
    mode: string
    enabled: boolean
  }
  dataSources?: Array<{
    id: string
    name: string
    type: string
    scope: string
    readonly?: boolean
    remark?: string
  }>
}

export interface PlatformRuntimeHint {
  tenantId?: string
  schoolId: string
  classId?: string
  className?: string
  gradeId?: string
  subject?: string
}

const DEFAULT_SCHOOL_ID = 'jimei-industrial'

export function getPlatformRuntimeHint(): PlatformRuntimeHint {
  const query = new URLSearchParams(window.location.search)
  const schoolId =
    query.get('schoolId') ||
    localStorage.getItem('snyuan_school_id') ||
    ((import.meta as any).env?.VITE_SCHOOL_ID as string | undefined) ||
    DEFAULT_SCHOOL_ID

  const tenantId =
    query.get('tenantId') ||
    localStorage.getItem('snyuan_tenant_id') ||
    ((import.meta as any).env?.VITE_TENANT_ID as string | undefined) ||
    undefined

  return {
    tenantId: tenantId || undefined,
    schoolId,
    classId: query.get('classId') || localStorage.getItem('snyuan_class_id') || undefined,
    className: query.get('className') || localStorage.getItem('snyuan_class_name') || undefined,
    gradeId: query.get('gradeId') || localStorage.getItem('snyuan_grade_id') || undefined,
    subject: query.get('subject') || localStorage.getItem('snyuan_subject') || undefined,
  }
}

export async function fetchPlatformConfig(hint = getPlatformRuntimeHint()): Promise<PlatformPublicConfig> {
  const url = new URL(`${API_BASE}/platform/schools/${encodeURIComponent(hint.schoolId)}/config`)
  if (hint.tenantId) url.searchParams.set('tenantId', hint.tenantId)
  const res = await fetch(url.toString(), { credentials: 'include' })
  if (!res.ok) throw new Error(`平台配置读取失败：HTTP ${res.status}`)
  return res.json()
}

/**
 * 读不到平台配置时的兜底。
 * 刻意不带任何具体学校：顶着别的学校的名字比留空更糟，
 * 金林湾的老师不该在配置读取失败时看到集美工业学院。
 */
export const fallbackPlatformConfig: PlatformPublicConfig = {
  tenantId: '',
  schoolId: '',
  schoolName: '',
  productName: '智慧课堂',
  branding: {
    productName: '智慧课堂',
    schoolName: '',
    logoText: '课',
    primaryColor: '#2f54eb',
    aiColor: '#722ed1',
    siderBackground: '#0e1b3a',
  },
  features: {
    questionBank: true,
    learningRecordSync: true,
    aiWhiteboard: true,
    aiPractice: true,
    wrongBook: true,
    classroomMonitor: true,
  },
}
