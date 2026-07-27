import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as fs from 'node:fs'
import * as path from 'node:path'
import {
  ClassroomPlatformContext,
  PlatformConfigFile,
  PlatformSchoolConfig,
} from './platform.types'

const FALLBACK_CONFIG: PlatformConfigFile = {
  version: 1,
  defaultTenantId: 'longdao',
  defaultSchoolId: 'demo-school',
  schools: [
    {
      tenantId: 'longdao',
      schoolId: 'demo-school',
      schoolName: '演示学校',
      productName: '三元课堂',
      branding: {
        productName: '三元课堂',
        schoolName: '演示学校',
        logoText: '三',
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
      model: { provider: 'openai-compatible', model: 'default' },
      dataSources: [],
      questionBank: { mode: 'local-fixture', mockQuestions: [] },
      learningRecordSink: { mode: 'outbox' },
    },
  ],
}

@Injectable()
export class PlatformConfigService implements OnModuleInit {
  private readonly logger = new Logger('PlatformConfigService')
  private configFile: PlatformConfigFile = FALLBACK_CONFIG

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    this.configFile = this.loadConfig()
    this.logger.log(
      `Platform config loaded: ${this.configFile.schools.length} school(s), default=${this.configFile.defaultSchoolId}`,
    )
  }

  listSchools() {
    return this.configFile.schools.map(s => ({
      tenantId: s.tenantId,
      schoolId: s.schoolId,
      schoolName: s.schoolName,
      productName: s.productName,
      branding: s.branding,
      features: s.features,
    }))
  }

  getSchoolConfig(schoolId?: string, tenantId?: string): PlatformSchoolConfig {
    const normalizedSchoolId = String(schoolId || '').trim()
    const normalizedTenantId = String(tenantId || '').trim()
    const schools = this.configFile.schools

    const matched =
      schools.find(s => normalizedSchoolId && s.schoolId === normalizedSchoolId && (!normalizedTenantId || s.tenantId === normalizedTenantId)) ||
      schools.find(s => normalizedSchoolId && s.schoolId === normalizedSchoolId) ||
      schools.find(s => s.schoolId === this.configFile.defaultSchoolId) ||
      schools[0] ||
      FALLBACK_CONFIG.schools[0]

    return this.clone(matched)
  }

  getPublicSchoolConfig(schoolId?: string, tenantId?: string) {
    const school = this.getSchoolConfig(schoolId, tenantId)
    return {
      tenantId: school.tenantId,
      schoolId: school.schoolId,
      schoolName: school.schoolName,
      productName: school.productName,
      branding: school.branding,
      features: school.features,
      model: {
        provider: school.model.provider,
        model: school.model.model,
        temperature: school.model.temperature,
      },
      questionBank: {
        mode: school.questionBank.mode,
        enabled: school.features.questionBank,
      },
      learningRecordSink: {
        mode: school.learningRecordSink.mode,
        enabled: school.features.learningRecordSync,
      },
      dataSources: school.dataSources.map(ds => ({
        id: ds.id,
        name: ds.name,
        type: ds.type,
        scope: ds.scope,
        readonly: ds.readonly,
        remark: ds.remark,
      })),
    }
  }

  resolveClassroomContext(input: {
    tenantId?: string
    schoolId?: string
    classId?: string
    className?: string
    gradeId?: string
    subject?: string
    externalUserId?: string
    phone?: string
  }): ClassroomPlatformContext {
    const school = this.getSchoolConfig(input.schoolId, input.tenantId)
    return {
      tenantId: String(input.tenantId || school.tenantId).trim(),
      schoolId: String(input.schoolId || school.schoolId).trim(),
      schoolName: school.schoolName,
      productName: school.productName,
      classId: this.cleanOptional(input.classId),
      className: this.cleanOptional(input.className),
      gradeId: this.cleanOptional(input.gradeId),
      subject: this.cleanOptional(input.subject),
      externalUserId: this.cleanOptional(input.externalUserId),
      phone: this.cleanOptional(input.phone),
    }
  }

  mergeContext(base: ClassroomPlatformContext, next: Partial<ClassroomPlatformContext>): ClassroomPlatformContext {
    const school = this.getSchoolConfig(next.schoolId || base.schoolId, next.tenantId || base.tenantId)
    return {
      tenantId: next.tenantId || base.tenantId || school.tenantId,
      schoolId: next.schoolId || base.schoolId || school.schoolId,
      schoolName: school.schoolName,
      productName: school.productName,
      classId: next.classId || base.classId,
      className: next.className || base.className,
      gradeId: next.gradeId || base.gradeId,
      subject: next.subject || base.subject,
      externalUserId: next.externalUserId || base.externalUserId,
      phone: next.phone || base.phone,
    }
  }

  private loadConfig(): PlatformConfigFile {
    const filePath = this.resolveConfigPath()
    if (!fs.existsSync(filePath)) {
      this.logger.warn(`Platform config file not found: ${filePath}. Using fallback config.`)
      return FALLBACK_CONFIG
    }

    try {
      const raw = fs.readFileSync(filePath, 'utf8')
      const parsed = JSON.parse(raw) as PlatformConfigFile
      this.validate(parsed, filePath)
      return parsed
    } catch (err: any) {
      this.logger.warn(`Platform config parse failed: ${err?.message || err}. Using fallback config.`)
      return FALLBACK_CONFIG
    }
  }

  private resolveConfigPath(): string {
    const configured = String(this.config.get<string>('PLATFORM_CONFIG_FILE', '') || '').trim()
    if (configured) return path.isAbsolute(configured) ? configured : path.resolve(process.cwd(), configured)
    const candidates = [
      path.resolve(process.cwd(), 'config/platform-config.json'),
      path.resolve(process.cwd(), 'apps/server/config/platform-config.json'),
      path.resolve(__dirname, '../../../../config/platform-config.json'),
      path.resolve(__dirname, '../../../config/platform-config.json'),
    ]
    return candidates.find(candidate => fs.existsSync(candidate)) || candidates[0]
  }

  private validate(config: PlatformConfigFile, filePath: string) {
    if (!config || !Array.isArray(config.schools) || config.schools.length === 0) {
      throw new Error(`${filePath} must contain at least one school`)
    }
    const seen = new Set<string>()
    for (const school of config.schools) {
      if (!school.tenantId || !school.schoolId) throw new Error('school tenantId and schoolId are required')
      const key = `${school.tenantId}:${school.schoolId}`
      if (seen.has(key)) throw new Error(`duplicate school config: ${key}`)
      seen.add(key)
    }
  }

  private cleanOptional(value: unknown): string | undefined {
    const text = String(value || '').trim()
    return text || undefined
  }

  private clone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T
  }
}
