import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/auth.guard'
import { LessonService } from './lesson.service'
import { LessonEntity } from './lesson.entity'

@ApiTags('课堂')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('lessons')
export class LessonController {
  constructor(private readonly lessonService: LessonService) {}

  @Get()
  @ApiOperation({ summary: '获取所有课堂' })
  findAll() {
    return this.lessonService.findAll()
  }

  @Get('today')
  @ApiOperation({ summary: '获取今日课堂' })
  findToday() {
    return this.lessonService.findToday()
  }

  @Get('ongoing')
  @ApiOperation({ summary: '获取进行中的课堂' })
  findOngoing() {
    return this.lessonService.findOngoing()
  }

  @Get(':id')
  @ApiOperation({ summary: '获取课堂详情' })
  findById(@Param('id') id: string) {
    return this.lessonService.findById(id)
  }

  @Post()
  @ApiOperation({ summary: '创建课堂' })
  create(@Body() data: Partial<LessonEntity>) {
    return this.lessonService.create(data)
  }

  @Put(':id')
  @ApiOperation({ summary: '更新课堂' })
  update(@Param('id') id: string, @Body() data: Partial<LessonEntity>) {
    return this.lessonService.update(id, data)
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除课堂' })
  delete(@Param('id') id: string) {
    return this.lessonService.delete(id)
  }
}
