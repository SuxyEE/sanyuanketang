import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm'

@Entity('task_submissions')
export class TaskSubmissionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column()
  taskId: string

  @Column()
  studentId: string

  @Column({ type: 'json' })
  answers: Record<string, any>

  @Column({ type: 'float', nullable: true })
  score: number

  @Column({ type: 'text', nullable: true })
  aiComment: string

  @CreateDateColumn()
  submittedAt: Date
}
