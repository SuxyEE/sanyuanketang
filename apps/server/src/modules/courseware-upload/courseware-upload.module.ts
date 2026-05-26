import { Module } from '@nestjs/common'
import { CoursewareUploadService } from './courseware-upload.service'
import { CoursewareUploadController } from './courseware-upload.controller'
import { ClassroomModule } from '../classroom/classroom.module'

/**
 * 手机扫码 → 上传课件 → WS 推回教师平板 链路所在的 module。
 *
 * 依赖 ClassroomModule export ClassroomGateway，用其方法 push 文件给订阅 socket。
 */
@Module({
  imports: [ClassroomModule],
  controllers: [CoursewareUploadController],
  providers: [CoursewareUploadService],
})
export class CoursewareUploadModule {}
