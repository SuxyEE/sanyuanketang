import { Module } from '@nestjs/common'
import { AiService } from './ai.service'
import { AiController } from './ai.controller'
import { LlmService } from './llm/llm.service'

@Module({
  controllers: [AiController],
  providers: [LlmService, AiService],
  exports: [AiService, LlmService],
})
export class AiModule {}
