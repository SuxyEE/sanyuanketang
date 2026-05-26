import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { JwtModule } from '@nestjs/jwt'
import { ClassroomGateway } from './classroom.gateway'
import { AiModule } from '../ai/ai.module'
import { AccessCodeModule } from '../access-code/access-code.module'

@Module({
  imports: [
    AiModule,
    AccessCodeModule,
    // ClassroomGateway 用 JwtService 校验 socket auth.token；
    // 与 AuthModule 是独立的 JwtModule 实例，但 secret 一致，verify 结果一致。
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get('JWT_SECRET', 'snyuan-default-secret'),
      }),
    }),
  ],
  providers: [ClassroomGateway],
  exports: [ClassroomGateway],
})
export class ClassroomModule {}
