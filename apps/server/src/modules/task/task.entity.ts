import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm'

@Entity('tasks')
export class TaskEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column()
  lessonId: string

  @Column({ type: 'enum', enum: ['quiz', 'discussion', 'practice', 'ai_practice', 'survey', 'homework'] })
  type: string

  @Column({ length: 200 })
  title: string

  @Column({ type: 'text', nullable: true })
  description: string

  @Column({ type: 'json', nullable: true })
  questions: any

  @Column({ nullable: true })
  timeLimit: number

  @Column({ type: 'enum', enum: ['draft', 'published', 'in_progress', 'collecting', 'ended'], default: 'draft' })
  status: string

  @Column({ type: 'simple-json', nullable: true })
  targetStudentIds: string[]

  @CreateDateColumn()
  createdAt: Date
}
