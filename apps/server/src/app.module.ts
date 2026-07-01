import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { ClassroomModule } from './modules/classroom/classroom.module'
import { AiModule } from './modules/ai/ai.module'
import { AccessCodeModule } from './modules/access-code/access-code.module'
import { DatabaseModule } from './database/database.module'
import { UserModule } from './modules/user/user.module'
import { CourseModule } from './modules/course/course.module'
import { LessonModule } from './modules/lesson/lesson.module'
import { TaskModule } from './modules/task/task.module'
import { WrongBookModule } from './modules/wrong-book/wrong-book.module'
import { AuthModule } from './modules/auth/auth.module'
import { QrModule } from './modules/qr/qr.module'
import { CoursewareUploadModule } from './modules/courseware-upload/courseware-upload.module'

// 业务持久化模块只在 DB 配好时挂载；否则系统继续以内存 Map 运行。
const configModule = ConfigModule.forRoot({ isGlobal: true, envFilePath: ['apps/server/.env', '.env'] })
const dbEnabled = DatabaseModule.isEnabled()
const ormModules = dbEnabled
  ? [DatabaseModule.forRoot(), UserModule, CourseModule, LessonModule, TaskModule, WrongBookModule, AuthModule]
  : []

@Module({
  imports: [
    configModule,
    ...ormModules,
    AccessCodeModule,
    QrModule,
    ClassroomModule,
    CoursewareUploadModule,
    AiModule,
  ],
})
export class AppModule {}
