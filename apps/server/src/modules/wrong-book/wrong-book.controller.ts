import { Controller, Get, Post, Param, Body, Query } from '@nestjs/common'
import { ApiTags, ApiOperation } from '@nestjs/swagger'
import { WrongBookService } from './wrong-book.service'

@ApiTags('错题本')
@Controller('wrong-book')
export class WrongBookController {
  constructor(private readonly service: WrongBookService) {}

  @Get()
  @ApiOperation({ summary: '学生错题列表 + 统计' })
  async list(
    @Query('studentId') studentId: string,
    @Query('subject') subject?: string,
    @Query('mastered') mastered?: string,
  ) {
    const masteredFilter = mastered === undefined || mastered === '' ? undefined : mastered === 'true'
    const data = await this.service.listByStudent(studentId, {
      subject: subject || undefined,
      mastered: masteredFilter,
    })
    return { success: true, data }
  }

  @Get('lesson-stats')
  @ApiOperation({ summary: '本堂错题学情聚合（教师/大屏用）' })
  async lessonStats(@Query('lessonId') lessonId: string) {
    const data = await this.service.lessonStats(lessonId)
    return { success: true, data }
  }

  @Post(':id/mastered')
  @ApiOperation({ summary: '标记 / 取消掌握' })
  async setMastered(@Param('id') id: string, @Body() body: { mastered?: boolean }) {
    const data = await this.service.setMastered(id, body?.mastered !== false)
    return { success: true, data }
  }
}
