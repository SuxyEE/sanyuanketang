import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { ClassroomModule } from './modules/classroom/classroom.module'
import { AiModule } from './modules/ai/ai.module'
import { AccessCodeModule } from './modules/access-code/access-code.module'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AccessCodeModule,
    ClassroomModule,
    AiModule,
  ],
})
export class AppModule {}
