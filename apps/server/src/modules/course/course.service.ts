import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { CourseEntity } from './course.entity'

@Injectable()
export class CourseService {
  constructor(
    @InjectRepository(CourseEntity)
    private readonly courseRepo: Repository<CourseEntity>,
  ) {}

  findAll() {
    return this.courseRepo.find({ order: { createdAt: 'DESC' } })
  }

  findById(id: string) {
    return this.courseRepo.findOneBy({ id })
  }

  findByTeacherId(teacherId: string) {
    return this.courseRepo.find({ where: { teacherId }, order: { createdAt: 'DESC' } })
  }

  create(data: Partial<CourseEntity>) {
    const course = this.courseRepo.create(data)
    return this.courseRepo.save(course)
  }

  async update(id: string, data: Partial<CourseEntity>) {
    await this.courseRepo.update(id, data)
    return this.findById(id)
  }

  delete(id: string) {
    return this.courseRepo.delete(id)
  }
}
