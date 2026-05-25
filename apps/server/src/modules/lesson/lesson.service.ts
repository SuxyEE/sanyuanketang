import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { LessonEntity } from './lesson.entity'

@Injectable()
export class LessonService {
  constructor(
    @InjectRepository(LessonEntity)
    private readonly lessonRepo: Repository<LessonEntity>,
  ) {}

  findAll() {
    return this.lessonRepo.find({ order: { startTime: 'DESC' } })
  }

  async findById(id: string) {
    const lesson = await this.lessonRepo.findOneBy({ id })
    if (!lesson) throw new NotFoundException('课堂不存在')
    return lesson
  }

  findByRoomCode(roomCode: string) {
    return this.lessonRepo.findOneBy({ roomCode })
  }

  findByCourseId(courseId: string) {
    return this.lessonRepo.find({ where: { courseId }, order: { startTime: 'DESC' } })
  }

  findOngoing() {
    return this.lessonRepo.find({ where: { status: 'ongoing' } })
  }

  findToday() {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    return this.lessonRepo
      .createQueryBuilder('lesson')
      .where('lesson.startTime >= :today AND lesson.startTime < :tomorrow', { today, tomorrow })
      .orderBy('lesson.startTime', 'ASC')
      .getMany()
  }

  create(data: Partial<LessonEntity>) {
    if (!data.roomCode) {
      data.roomCode = this.generateRoomCode()
    }
    const lesson = this.lessonRepo.create(data)
    return this.lessonRepo.save(lesson)
  }

  async updateStatus(id: string, status: LessonEntity['status']) {
    await this.lessonRepo.update(id, { status })
    return this.findById(id)
  }

  async updateSlide(id: string, currentSlide: number) {
    await this.lessonRepo.update(id, { currentSlide })
  }

  async update(id: string, data: Partial<LessonEntity>) {
    await this.lessonRepo.update(id, data)
    return this.findById(id)
  }

  delete(id: string) {
    return this.lessonRepo.delete(id)
  }

  private generateRoomCode(): string {
    return Math.random().toString(36).substring(2, 8).toUpperCase()
  }
}
