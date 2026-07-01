import { Global, Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { WrongQuestionEntity } from './wrong-question.entity'
import { WrongBookService } from './wrong-book.service'
import { WrongBookController } from './wrong-book.controller'

/**
 * @Global：让 ClassroomGateway 能用 @Optional() @Inject(WrongBookService) 注入，
 * 而 ClassroomModule 无需 import 本模块（本模块仅在 DB 启用时挂载，DB 关时网关注入为 undefined 自动 no-op）。
 */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([WrongQuestionEntity])],
  controllers: [WrongBookController],
  providers: [WrongBookService],
  exports: [WrongBookService],
})
export class WrongBookModule {}
