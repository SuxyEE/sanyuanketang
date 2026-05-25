import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm'

@Entity('lessons')
export class LessonEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column()
  courseId: string

  @Column({ length: 200 })
  title: string

  @Column({ length: 200, nullable: true })
  sectionTitle: string

  @Column({ type: 'datetime' })
  startTime: Date

  @Column({ type: 'datetime' })
  endTime: Date

  @Column({ type: 'enum', enum: ['pending', 'ongoing', 'paused', 'ended'], default: 'pending' })
  status: 'pending' | 'ongoing' | 'paused' | 'ended'

  @Column({ length: 20, unique: true })
  roomCode: string

  @Column({ nullable: true })
  slideUrl: string

  @Column({ default: 0 })
  totalSlides: number

  @Column({ default: 0 })
  currentSlide: number

  @Column({ nullable: true })
  classId: string

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
