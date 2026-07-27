import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { DatabaseModule } from '../../database/database.module'
import { PlatformController } from './platform.controller'
import { InternalPlatformGuard } from './internal-platform.guard'
import { LearningRecordOutboxEntity } from './learning-record-outbox.entity'
import { LearningRecordService } from './learning-record.service'
import { PlatformConfigService } from './platform-config.service'
import { QuestionBankService } from './question-bank.service'

// PlatformModule 在演示模式（不配 DB）下也要挂载，所以 outbox 仓库是条件注册的；
// LearningRecordService 用 @Optional 注入，拿不到就降级为内存 outbox。
const outboxImports = DatabaseModule.isEnabled()
  ? [TypeOrmModule.forFeature([LearningRecordOutboxEntity])]
  : []

@Module({
  imports: [...outboxImports],
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
