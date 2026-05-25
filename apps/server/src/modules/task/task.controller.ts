import { Controller, Get, Post, Param, Body, Query, UseGuards } from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/auth.guard'
import { TaskService } from './task.service'
import { TaskEntity } from './task.entity'

@ApiTags('任务')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('tasks')
export class TaskController {
  constructor(private readonly taskService: TaskService) {}

  @Get()
  @ApiOperation({ summary: '获取课堂任务列表' })
  findByLesson(@Query('lessonId') lessonId: string) {
    return this.taskService.findByLessonId(lessonId)
  }

  @Get(':id')
  @ApiOperation({ summary: '获取任务详情' })
  findById(@Param('id') id: string) {
    return this.taskService.findById(id)
  }

  @Get(':id/stats')
  @ApiOperation({ summary: '获取任务统计' })
  getStats(@Param('id') id: string) {
    return this.taskService.getTaskStats(id)
  }

  @Post()
  @ApiOperation({ summary: '创建任务' })
  create(@Body() data: Partial<TaskEntity>) {
    return this.taskService.create(data)
  }
}
