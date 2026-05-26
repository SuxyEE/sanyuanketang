import { Module, forwardRef } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { UserEntity } from './user.entity'
import { UserService } from './user.service'
import { UserController } from './user.controller'
import { AuthModule } from '../auth/auth.module'

@Module({
  imports: [
    TypeOrmModule.forFeature([UserEntity]),
    // forwardRef 打破 UserModule <-> AuthModule 循环依赖
    // UserController 用 @UseGuards(JwtAuthGuard) 必须能拿到 AuthModule 导出的 JwtModule + JwtAuthGuard
    forwardRef(() => AuthModule),
  ],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
