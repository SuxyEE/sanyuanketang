import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/auth.guard'
import { CourseService } from './course.service'
import { CourseEntity } from './course.entity'

@ApiTags('课程')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('courses')
export class CourseController {
  constructor(private readonly courseService: CourseService) {}

  @Get()
  @ApiOperation({ summary: '获取所有课程' })
  findAll() {
    return this.courseService.findAll()
  }

  @Get(':id')
  @ApiOperation({ summary: '获取课程详情' })
  findById(@Param('id') id: string) {
    return this.courseService.findById(id)
  }

  @Post()
  @ApiOperation({ summary: '创建课程' })
  create(@Body() data: Partial<CourseEntity>) {
    return this.courseService.create(data)
  }

  @Put(':id')
  @ApiOperation({ summary: '更新课程' })
  update(@Param('id') id: string, @Body() data: Partial<CourseEntity>) {
    return this.courseService.update(id, data)
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除课程' })
  delete(@Param('id') id: string) {
    return this.courseService.delete(id)
  }
}
