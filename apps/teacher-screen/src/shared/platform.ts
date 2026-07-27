export interface PlatformJoinContext {
  tenantId?: string
  schoolId: string
  classId?: string
  className?: string
  gradeId?: string
  subject?: string
}

const DEFAULT_SCHOOL_ID = 'jimei-industrial'

export function getPlatformJoinContext(): PlatformJoinContext {
  const query = new URLSearchParams(window.location.search)
  const schoolId =
    query.get('schoolId') ||
    localStorage.getItem('snyuan_school_id') ||
    ((import.meta as any).env?.VITE_SCHOOL_ID as string | undefined) ||
    DEFAULT_SCHOOL_ID

  return {
    tenantId:
      query.get('tenantId') ||
      localStorage.getItem('snyuan_tenant_id') ||
      ((import.meta as any).env?.VITE_TENANT_ID as string | undefined) ||
      undefined,
    schoolId,
    classId: query.get('classId') || localStorage.getItem('snyuan_class_id') || undefined,
    className: query.get('className') || localStorage.getItem('snyuan_class_name') || undefined,
    gradeId: query.get('gradeId') || localStorage.getItem('snyuan_grade_id') || undefined,
    subject: query.get('subject') || localStorage.getItem('snyuan_subject') || undefined,
  }
}
