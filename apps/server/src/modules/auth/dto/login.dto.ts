import { IsString, IsNotEmpty } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class LoginDto {
  @ApiProperty({ example: 'teacher01' })
  @IsString()
  @IsNotEmpty()
  username: string

  @ApiProperty({ example: '123456' })
  @IsString()
  @IsNotEmpty()
  password: string
}
