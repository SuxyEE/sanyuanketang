export type PlatformUserRole = 'teacher' | 'student' | 'admin'

export interface SchoolBrandingConfig {
  productName: string
  schoolName: string
  logoText?: string
  logoUrl?: string
  primaryColor?: string
  aiColor?: string
  backgroundImageUrl?: string
  siderBackground?: string
}

export interface PlatformFeatureFlags {
  questionBank: boolean
  learningRecordSync: boolean
  aiWhiteboard: boolean
  aiPractice: boolean
  wrongBook: boolean
  classroomMonitor: boolean
}

export interface PlatformModelConfig {
  provider: string
  model: string
  baseUrlEnv?: string
  apiKeyEnv?: string
  temperature?: number
}

export interface PlatformDataSourceConfig {
  id: string
  name: string
  type: 'mysql' | 'postgres' | 'mssql' | 'oracle' | 'http' | 'other'
  scope: 'tenant' | 'school' | 'product'
  readonly?: boolean
  jdbcUrlEnv?: string
  endpoint?: string
  credentialRef?: string
  remark?: string
}

export interface PlatformQuestionOption {
  key: string
  content: string
}

export interface PlatformQuestion {
  id: string
  type: 'single_choice' | 'multiple_choice' | 'true_false' | 'fill_blank' | 'short_answer' | string
  content: string
  options?: PlatformQuestionOption[]
  answer?: string | string[]
  analysis?: string
  points?: number
  difficulty?: 'easy' | 'medium' | 'hard'
  subject?: string
  gradeId?: string
  knowledgePoints?: string[]
  source?: string
}

export interface PlatformQuestionBankConfig {
  mode: 'local-fixture' | 'external-api'
  endpoint?: string
  baseUrlEnv?: string
  extractPath?: string
  tokenEnv?: string
  mockQuestions?: PlatformQuestion[]
}

export interface PlatformLearningRecordSinkConfig {
  mode: 'outbox' | 'external-api'
  endpoint?: string
  tokenEnv?: string
}

export interface PlatformSchoolConfig {
  tenantId: string
  schoolId: string
  schoolName: string
  productName: string
  branding: SchoolBrandingConfig
  features: PlatformFeatureFlags
  model: PlatformModelConfig
  dataSources: PlatformDataSourceConfig[]
  questionBank: PlatformQuestionBankConfig
  learningRecordSink: PlatformLearningRecordSinkConfig
}

export interface PlatformConfigFile {
  version: number
  defaultTenantId: string
  defaultSchoolId: string
  schools: PlatformSchoolConfig[]
}

export interface ClassroomPlatformContext {
  tenantId: string
  schoolId: string
  schoolName: string
  productName: string
  classId?: string
  className?: string
  gradeId?: string
  subject?: string
  externalUserId?: string
  phone?: string
}

export interface PlatformUserContext extends ClassroomPlatformContext {
  userId: string
  userName: string
  role: PlatformUserRole
}
