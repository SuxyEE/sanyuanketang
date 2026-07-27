import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PlatformConfigService } from './platform-config.service'
import { PlatformQuestion } from './platform.types'

export interface ExtractQuestionsRequest {
  tenantId?: string
  schoolId?: string
  classId?: string
  gradeId?: string
  subject?: string
  knowledgePoints?: string[]
  difficulty?: 'easy' | 'medium' | 'hard'
  types?: string[]
  limit?: number
  excludeQuestionIds?: string[]
  scene?: 'in_class_quiz' | 'after_class_practice' | 'wrong_book' | string
}

export interface ExtractQuestionsResult {
  tenantId: string
  schoolId: string
  source: 'external-api' | 'local-fixture'
  questions: PlatformQuestion[]
  fallbackUsed: boolean
}

@Injectable()
export class QuestionBankService {
  private readonly logger = new Logger('QuestionBankService')

  constructor(
    private readonly platformConfig: PlatformConfigService,
    private readonly config: ConfigService,
  ) {}

  async extractQuestions(request: ExtractQuestionsRequest): Promise<ExtractQuestionsResult> {
    const school = this.platformConfig.getSchoolConfig(request.schoolId, request.tenantId)
    const limit = Math.max(1, Math.min(50, Number(request.limit || 5)))

    if (
      school.features.questionBank &&
      school.questionBank.mode === 'external-api' &&
      this.config.get<string>('QUESTION_BANK_PROXY_ENABLED', 'false') === 'true'
    ) {
      const external = await this.extractFromExternalApi(school, request, limit)
      if (external) return external
    }

    return {
      tenantId: school.tenantId,
      schoolId: school.schoolId,
      source: 'local-fixture',
      questions: this.extractFromLocalFixture(school.questionBank.mockQuestions || [], request, limit),
      fallbackUsed: school.questionBank.mode === 'external-api',
    }
  }

  private extractFromLocalFixture(
    questions: PlatformQuestion[],
    request: ExtractQuestionsRequest,
    limit: number,
  ): PlatformQuestion[] {
    const excluded = new Set(request.excludeQuestionIds || [])
    const types = new Set(request.types || [])
    const kps = new Set((request.knowledgePoints || []).map(x => x.trim()).filter(Boolean))

    const matched = questions.filter(q => {
      if (excluded.has(q.id)) return false
      if (request.subject && q.subject && q.subject !== request.subject) return false
      if (request.gradeId && q.gradeId && q.gradeId !== request.gradeId) return false
      if (request.difficulty && q.difficulty && q.difficulty !== request.difficulty) return false
      if (types.size > 0 && !types.has(q.type)) return false
      if (kps.size > 0 && q.knowledgePoints?.length) {
        return q.knowledgePoints.some(kp => kps.has(kp))
      }
      return true
    })

    const pool = matched.length >= limit ? matched : questions.filter(q => !excluded.has(q.id))
    return pool.slice(0, limit).map(q => ({
      ...q,
      points: q.points || 10,
      source: q.source || 'school-fixture',
    }))
  }

  private async extractFromExternalApi(
    school: ReturnType<PlatformConfigService['getSchoolConfig']>,
    request: ExtractQuestionsRequest,
    limit: number,
  ): Promise<ExtractQuestionsResult | null> {
    const endpoint = this.resolveEndpoint(school)
    if (!endpoint) return null

    const tokenEnv = school.questionBank.tokenEnv
    const token = tokenEnv ? this.config.get<string>(tokenEnv, '') : ''
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 4000)

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-tenant-id': school.tenantId,
          'x-school-id': school.schoolId,
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ ...request, limit }),
        signal: controller.signal,
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json() as { questions?: PlatformQuestion[] }
      if (!Array.isArray(data.questions)) throw new Error('invalid response: questions missing')
      return {
        tenantId: school.tenantId,
        schoolId: school.schoolId,
        source: 'external-api',
        questions: data.questions.slice(0, limit),
        fallbackUsed: false,
      }
    } catch (err: any) {
      this.logger.warn(`Question bank external extract failed, fallback to local fixture: ${err?.message || err}`)
      return null
    } finally {
      clearTimeout(timer)
    }
  }

  private resolveEndpoint(school: ReturnType<PlatformConfigService['getSchoolConfig']>): string | null {
    if (school.questionBank.endpoint) return school.questionBank.endpoint
    const baseUrlEnv = school.questionBank.baseUrlEnv
    const baseUrl = baseUrlEnv ? String(this.config.get<string>(baseUrlEnv, '') || '').replace(/\/$/, '') : ''
    const extractPath = String(school.questionBank.extractPath || '').replace(/^\//, '')
    if (!baseUrl || !extractPath) return null
    return `${baseUrl}/${extractPath}`
  }
}
