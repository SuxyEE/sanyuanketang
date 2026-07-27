import { Global, Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ClassroomSessionMemberEntity } from './classroom-session-member.entity'
import { ClassroomSessionEntity } from './classroom-session.entity'
import { ClassroomSessionService } from './classroom-session.service'

/**
 * @Global：与 WrongBookModule 同款做法，让 ClassroomGateway 能用
 * `@Optional() @Inject(ClassroomSessionService)` 注入，而 ClassroomModule 不必 import。
 * 本模块只在 DB 启用时挂载，演示模式下网关注入为 undefined，写入自动 no-op。
 */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([ClassroomSessionEntity, ClassroomSessionMemberEntity])],
  providers: [ClassroomSessionService],
  exports: [ClassroomSessionService],
})
export class ClassroomSessionModule {}
