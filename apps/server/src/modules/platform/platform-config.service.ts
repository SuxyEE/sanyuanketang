import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common'
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

  /**
   * 精确解析学校配置，解析不到返回 null。
   * schoolId 既可以是课堂自己的 slug，也可以是智慧校园的数字 school_id。
   */
  findSchoolConfig(schoolId?: string, tenantId?: string): PlatformSchoolConfig | null {
    const normalizedSchoolId = String(schoolId || '').trim()
    const normalizedTenantId = String(tenantId || '').trim()
    if (!normalizedSchoolId) return null

    const schools = this.configFile.schools
    const idMatches = (s: PlatformSchoolConfig) =>
      s.schoolId === normalizedSchoolId || String(s.campusSchoolId || '').trim() === normalizedSchoolId

    const matched =
      schools.find(s => idMatches(s) && (!normalizedTenantId || s.tenantId === normalizedTenantId)) ||
      schools.find(s => idMatches(s))

    return matched ? this.clone(matched) : null
  }

  /**
   * 兜底版解析：内部链路（WS 上下文、题库、学情）不能因为一个未知学校就中断，
   * 所以仍返回默认学校，但会告警。对外展示的配置请走 getPublicSchoolConfig。
   */
  getSchoolConfig(schoolId?: string, tenantId?: string): PlatformSchoolConfig {
    return this.findSchoolConfig(schoolId, tenantId) ?? this.defaultSchoolConfig(schoolId)
  }

  private defaultSchoolConfig(requestedSchoolId?: string): PlatformSchoolConfig {
    if (String(requestedSchoolId || '').trim()) {
      this.logger.warn(
        `未找到学校配置 schoolId=${String(requestedSchoolId).trim()}，暂用默认学校 ${this.configFile.defaultSchoolId}；` +
          '智慧校园用数字 school_id，课堂配置需要用 campusSchoolId 显式对上。',
      )
    }
    const fallback =
      this.configFile.schools.find(s => s.schoolId === this.configFile.defaultSchoolId) ||
      this.configFile.schools[0] ||
      FALLBACK_CONFIG.schools[0]
    return this.clone(fallback)
  }

  getPublicSchoolConfig(schoolId?: string, tenantId?: string) {
    // 品牌展示不能张冠李戴：明确传了学校却解析不到时报 404，不要拿默认学校顶上
    const resolved = String(schoolId || '').trim()
      ? this.findSchoolConfig(schoolId, tenantId)
      : this.getSchoolConfig(schoolId, tenantId)
    if (!resolved) {
      throw new NotFoundException(`未找到学校 ${String(schoolId).trim()} 的运行配置`)
    }
    const school = resolved
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
    const matched = this.findSchoolConfig(input.schoolId, input.tenantId)
    const school = matched ?? this.defaultSchoolConfig(input.schoolId)
    return {
      tenantId: String(input.tenantId || school.tenantId).trim(),
      schoolId: String(input.schoolId || school.schoolId).trim(),
      // 学校没配过就留空，不要顶着默认学校的名字对外显示
      schoolName: this.resolveSchoolName(school, matched, input.schoolId),
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
    const schoolId = next.schoolId || base.schoolId
    const matched = this.findSchoolConfig(schoolId, next.tenantId || base.tenantId)
    const school = matched ?? this.defaultSchoolConfig(schoolId)
    return {
      tenantId: next.tenantId || base.tenantId || school.tenantId,
      schoolId: next.schoolId || base.schoolId || school.schoolId,
      schoolName: this.resolveSchoolName(school, matched, schoolId),
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

  private resolveSchoolName(
    school: PlatformSchoolConfig,
    matched: PlatformSchoolConfig | null,
    requestedSchoolId?: string,
  ): string {
    if (matched) return school.schoolName
    return String(requestedSchoolId || '').trim() ? '' : school.schoolName
  }

  private cleanOptional(value: unknown): string | undefined {
    const text = String(value || '').trim()
    return text || undefined
  }

  private clone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T
  }
}
