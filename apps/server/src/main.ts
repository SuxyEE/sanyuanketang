import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import cookieParser from 'cookie-parser'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  app.enableCors({
    // 允许多端口前端（3001-3004）携带 cookie 访问，cookie 鉴权要求 origin 必须是具体来源（不能用 '*'）
    origin: (origin, callback) => callback(null, origin || true),
    credentials: true,
  })

  app.use(cookieParser())

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  )

  app.setGlobalPrefix('api/v1')

  const config = new DocumentBuilder()
    .setTitle('智慧课堂 API')
    .setDescription('集美工业职业学院 · 交互课堂系统后端接口')
    .setVersion('1.0')
    .addBearerAuth()
    .build()
  const document = SwaggerModule.createDocument(app, config)
  SwaggerModule.setup('api/docs', app, document)

  const port = process.env.PORT || 3000
  await app.listen(port)
  console.log(`Server running on http://localhost:${port}`)
  console.log(`Swagger docs: http://localhost:${port}/api/docs`)
}

bootstrap()
