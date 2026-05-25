import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { TaskEntity } from './task.entity'
import { TaskSubmissionEntity } from './task-submission.entity'
import { TaskService } from './task.service'
import { TaskController } from './task.controller'
import { AuthModule } from '../auth/auth.module'

@Module({
  imports: [
    TypeOrmModule.forFeature([TaskEntity, TaskSubmissionEntity]),
    AuthModule,
  ],
  controllers: [TaskController],
  providers: [TaskService],
  exports: [TaskService],
})
export class TaskModule {}
