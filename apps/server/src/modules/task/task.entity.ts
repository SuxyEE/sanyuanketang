import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm'

@Entity('tasks')
export class TaskEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string

  /** 网关房间码或 lessons.id，取决于是谁写的；课堂实时链路写的是房间码 */
  @Column()
  lessonId: string

  /** 关联到具体一次开课（classroom_sessions.id），课堂实时链路才有 */
  @Column({ nullable: true })
  sessionId: string

  @Column({ length: 64, nullable: true })
  tenantId: string

  @Column({ length: 64, nullable: true })
  schoolId: string

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
