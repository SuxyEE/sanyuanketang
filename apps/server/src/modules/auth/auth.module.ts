import { Module, forwardRef } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { AuthService } from './auth.service'
import { AuthController } from './auth.controller'
import { JwtAuthGuard } from './auth.guard'
import { UserModule } from '../user/user.module'
import { ShuzhouAuthConfig } from './shuzhou/shuzhou-auth.config'
import { ShuzhouIdentityService } from './shuzhou/shuzhou-identity.service'
import { ShuzhouJwksService } from './shuzhou/shuzhou-jwks.service'
import { ShuzhouOidcService } from './shuzhou/shuzhou-oidc.service'
import { ShuzhouSsoService } from './shuzhou/shuzhou-sso.service'
import { ShuzhouController } from './shuzhou/shuzhou.controller'

@Module({
  imports: [
    forwardRef(() => UserModule),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get('JWT_SECRET', 'snyuan-default-secret'),
        signOptions: { expiresIn: config.get('JWT_EXPIRES_IN', '7d') },
      }),
    }),
  ],
  controllers: [AuthController, ShuzhouController],
  providers: [
    AuthService,
    JwtAuthGuard,
    ShuzhouAuthConfig,
    ShuzhouJwksService,
    ShuzhouOidcService,
    ShuzhouSsoService,
    ShuzhouIdentityService,
  ],
  exports: [AuthService, JwtAuthGuard, JwtModule, ShuzhouOidcService],
})
export class AuthModule {}
