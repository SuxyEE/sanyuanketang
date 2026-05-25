import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { UserEntity } from './user.entity'

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
  ) {}

  async findById(id: string) {
    return this.userRepo.findOneBy({ id })
  }

  async findByUsername(username: string) {
    return this.userRepo.findOne({
      where: { username },
      select: ['id', 'name', 'username', 'password', 'role', 'studentNo', 'classId', 'avatar'],
    })
  }

  async findAll(role?: string) {
    const where: any = {}
    if (role) where.role = role
    return this.userRepo.find({ where, order: { createdAt: 'DESC' } })
  }

  async create(data: Partial<UserEntity>) {
    const user = this.userRepo.create(data)
    return this.userRepo.save(user)
  }

  async update(id: string, data: Partial<UserEntity>) {
    await this.userRepo.update(id, data)
    return this.findById(id)
  }

  async findStudentsByClassId(classId: string) {
    return this.userRepo.find({
      where: { classId, role: 'student' },
      order: { studentNo: 'ASC' },
    })
  }
}
