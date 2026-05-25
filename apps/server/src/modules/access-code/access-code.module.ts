import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common'
import { AccessCodeService } from './access-code.service'
import { AccessCodeController } from './access-code.controller'
import { AccessCodeMiddleware } from './access-code.middleware'

@Module({
  controllers: [AccessCodeController],
  providers: [AccessCodeService, AccessCodeMiddleware],
  exports: [AccessCodeService],
})
export class AccessCodeModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // 全部 API 路径都过中间件（中间件内部对豁免路径自行放行）
    consumer.apply(AccessCodeMiddleware).forRoutes('*')
  }
}
