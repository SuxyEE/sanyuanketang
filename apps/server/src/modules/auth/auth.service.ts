import { Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import * as bcrypt from 'bcryptjs'
import { UserService } from '../user/user.service'
import { LoginDto } from './dto/login.dto'

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.userService.findByUsername(dto.username)
    if (!user) throw new UnauthorizedException('用户名或密码错误')

    const isMatch = await bcrypt.compare(dto.password, user.password)
    if (!isMatch) throw new UnauthorizedException('用户名或密码错误')

    const payload = { sub: user.id, username: user.username, role: user.role }
    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        avatar: user.avatar,
        studentNo: user.studentNo,
      },
    }
  }

  async validateUser(userId: string) {
    return this.userService.findById(userId)
  }
}
