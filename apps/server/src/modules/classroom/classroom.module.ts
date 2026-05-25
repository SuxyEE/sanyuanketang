import { Module } from '@nestjs/common'
import { ClassroomGateway } from './classroom.gateway'
import { AiModule } from '../ai/ai.module'

@Module({
  imports: [AiModule],
  providers: [ClassroomGateway],
})
export class ClassroomModule {}
