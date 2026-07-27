import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { InternalPlatformGuard } from './internal-platform.guard'
import { LearningRecordPayload, LearningRecordService } from './learning-record.service'
import { PlatformConfigService } from './platform-config.service'
import { ExtractQuestionsRequest, QuestionBankService } from './question-bank.service'

@ApiTags('平台配置与跨产品联动')
@Controller('platform')
export class PlatformController {
  constructor(
    private readonly platformConfig: PlatformConfigService,
    private readonly questionBank: QuestionBankService,
    private readonly learningRecords: LearningRecordService,
  ) {}

  @Get('schools')
  @ApiOperation({ summary: '列出已配置学校' })
  listSchools() {
    return this.platformConfig.listSchools()
  }

  @Get('schools/:schoolId/config')
  @ApiOperation({ summary: '获取学校运行时公开配置' })
  getSchoolConfig(
    @Param('schoolId') schoolId: string,
    @Query('tenantId') tenantId?: string,
  ) {
    return this.platformConfig.getPublicSchoolConfig(schoolId, tenantId)
  }

  @Post('question-bank/extract')
  @UseGuards(InternalPlatformGuard)
  @ApiOperation({ summary: '从校本题库抽取课堂题目' })
  extractQuestions(@Body() body: ExtractQuestionsRequest) {
    return this.questionBank.extractQuestions(body || {})
  }

  @Post('classroom/question-bank/extract')
  @ApiOperation({ summary: '课堂教师端从校本题库抽题' })
  extractQuestionsForClassroom(@Body() body: ExtractQuestionsRequest) {
    return this.questionBank.extractQuestions(body || {})
  }

  @Post('learning-records')
  @UseGuards(InternalPlatformGuard)
  @ApiOperation({ summary: '接收或转发课堂学情事件' })
  recordLearning(@Body() body: LearningRecordPayload) {
    return this.learningRecords.record(body)
  }

  @Get('learning-records/outbox')
  @UseGuards(InternalPlatformGuard)
  @ApiOperation({ summary: '查看待回流/已回流学情 outbox' })
  listLearningOutbox(
    @Query('tenantId') tenantId?: string,
    @Query('schoolId') schoolId?: string,
  ) {
    return this.learningRecords.listOutbox({ tenantId, schoolId })
  }
}
