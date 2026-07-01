import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  Unique,
} from 'typeorm'

/**
 * 错题本：由课堂测验批改结果自动归集（perQuestion.correct === false）。
 * 以 (studentId, taskId, questionId) 唯一，重复批改时 upsert（保留 mastered 状态）。
 */
@Entity('wrong_questions')
@Unique('uq_student_task_question', ['studentId', 'taskId', 'questionId'])
export class WrongQuestionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Index()
  @Column()
  studentId: string

  @Column({ nullable: true })
  studentName: string

  @Index()
  @Column()
  lessonId: string

  @Column()
  taskId: string

  @Column()
  questionId: string

  /** 学科（取自课堂 courseName），供学生端学科 tab 过滤 */
  @Column({ length: 100, nullable: true })
  subject: string

  @Column({ type: 'text' })
  questionContent: string

  @Column({ length: 40, nullable: true })
  questionType: string

  @Column({ type: 'json', nullable: true })
  options: any

  @Column({ type: 'text', nullable: true })
  correctAnswer: string

  @Column({ type: 'text', nullable: true })
  analysis: string

  @Column({ type: 'text', nullable: true })
  wrongAnswer: string

  @Column({ type: 'simple-json', nullable: true })
  knowledgePoints: string[]

  /** 该题得分（0-100） */
  @Column({ type: 'float', nullable: true })
  score: number

  @Column({ default: false })
  mastered: boolean

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
