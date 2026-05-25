import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm'

@Entity('courses')
export class CourseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ length: 100 })
  name: string

  @Column({ length: 50, nullable: true })
  subjectTemplateId: string

  @Column()
  teacherId: string

  @Column({ length: 20 })
  semester: string

  @Column({ type: 'simple-json', nullable: true })
  classIds: string[]

  @Column({ nullable: true })
  coverImage: string

  @Column({ type: 'text', nullable: true })
  description: string

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
