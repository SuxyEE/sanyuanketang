import { IsNotEmpty, IsString, MaxLength } from 'class-validator'

export class RedeemTicketDto {
  @IsString()
  @IsNotEmpty({ message: '缺少登录票据' })
  @MaxLength(128)
  ticket: string
}
