import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm'

@Entity('users')
export class UserEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ length: 50 })
  name: string

  @Column({ length: 20, unique: true })
  username: string

  @Column({ select: false })
  password: string

  @Column({ type: 'enum', enum: ['teacher', 'student', 'admin'] })
  role: 'teacher' | 'student' | 'admin'

  @Column({ length: 30, nullable: true })
  studentNo: string

  @Column({ nullable: true })
  classId: string

  @Column({ nullable: true })
  avatar: string

  @Column({ length: 50, nullable: true })
  department: string

  @Column({ default: true })
  isActive: boolean

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
