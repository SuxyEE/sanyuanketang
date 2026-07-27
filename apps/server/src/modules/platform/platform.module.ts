import { Module } from '@nestjs/common'
import { PlatformController } from './platform.controller'
import { InternalPlatformGuard } from './internal-platform.guard'
import { LearningRecordService } from './learning-record.service'
import { PlatformConfigService } from './platform-config.service'
import { QuestionBankService } from './question-bank.service'

@Module({
  controllers: [PlatformController],
  providers: [
    PlatformConfigService,
    InternalPlatformGuard,
    QuestionBankService,
    LearningRecordService,
  ],
  exports: [PlatformConfigService, QuestionBankService, LearningRecordService],
})
export class PlatformModule {}
