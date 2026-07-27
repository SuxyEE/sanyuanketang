export interface PlatformJoinContext {
  tenantId?: string
  schoolId: string
  classId?: string
  className?: string
  gradeId?: string
  subject?: string
  externalUserId?: string
  phone?: string
}

const DEFAULT_SCHOOL_ID = 'jimei-industrial'

function readStorage(key: string): string | undefined {
  try {
    return (uni.getStorageSync(key) as string) || undefined
  } catch {
    return undefined
  }
}

export function getPlatformJoinContext(): PlatformJoinContext {
  return {
    tenantId: readStorage('snyuan_tenant_id') || ((import.meta as any).env?.VITE_TENANT_ID as string | undefined),
    schoolId: readStorage('snyuan_school_id') || ((import.meta as any).env?.VITE_SCHOOL_ID as string | undefined) || DEFAULT_SCHOOL_ID,
    classId: readStorage('snyuan_class_id'),
    className: readStorage('snyuan_class_name'),
    gradeId: readStorage('snyuan_grade_id'),
    subject: readStorage('snyuan_subject'),
    externalUserId: readStorage('snyuan_external_user_id'),
    phone: readStorage('snyuan_phone'),
  }
}
