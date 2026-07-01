import { DynamicModule, Logger, Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { TypeOrmModule } from '@nestjs/typeorm'
import { UserEntity } from '../modules/user/user.entity'
import { CourseEntity } from '../modules/course/course.entity'
import { LessonEntity } from '../modules/lesson/lesson.entity'
import { TaskEntity } from '../modules/task/task.entity'
import { TaskSubmissionEntity } from '../modules/task/task-submission.entity'
import { WrongQuestionEntity } from '../modules/wrong-book/wrong-question.entity'

/**
 * 条件挂载的 TypeORM 连接：
 *   - 设置了 `DATABASE_URL`（推荐）或 `DB_HOST` → 真正连接 MySQL
 *   - 都没设 → 返回空模块，整套 ORM / 业务表 跳过，系统仍以纯 Map / WS 内存运行
 *
 * 这样三种部署场景都能跑：
 *   1. **演示模式**：不配 DB env，沿用原行为（内存课堂 + 假登录）
 *   2. **生产模式**：配 DB env，启用 5 个业务模块 + JWT 鉴权
 *   3. **测试模式**：配 SQLite path 也可（需自行加 sqlite3 依赖）
 */
@Module({})
export class DatabaseModule {
  static forRoot(): DynamicModule {
    const enabled = DatabaseModule.isEnabled()
    if (!enabled) {
      new Logger('DatabaseModule').log(
        'Database not configured (set DATABASE_URL or DB_HOST to enable). Running in memory-only mode.',
      )
      return { module: DatabaseModule, imports: [] }
    }

    return {
      module: DatabaseModule,
      imports: [
        TypeOrmModule.forRootAsync({
          imports: [ConfigModule],
          inject: [ConfigService],
          useFactory: (cfg: ConfigService) => {
            const url = cfg.get<string>('DATABASE_URL')
            const baseEntities = [UserEntity, CourseEntity, LessonEntity, TaskEntity, TaskSubmissionEntity, WrongQuestionEntity]
            const synchronize = cfg.get<string>('DB_SYNCHRONIZE', 'false') === 'true'
            const logging = cfg.get<string>('DB_LOGGING', 'false') === 'true'

            if (url) {
              return {
                type: 'mysql' as const,
                url,
                entities: baseEntities,
                synchronize,
                logging,
                charset: 'utf8mb4',
              }
            }
            return {
              type: 'mysql' as const,
              host: cfg.get<string>('DB_HOST', '127.0.0.1'),
              port: Number(cfg.get<string>('DB_PORT', '3306')),
              username: cfg.get<string>('DB_USERNAME', 'root'),
              password: cfg.get<string>('DB_PASSWORD', ''),
              database: cfg.get<string>('DB_DATABASE', 'snyuan'),
              entities: baseEntities,
              synchronize,
              logging,
              charset: 'utf8mb4',
            }
          },
        }),
      ],
    }
  }

  /** 同步判断 DB 是否启用（用于 AppModule 同步 imports 列表） */
  static isEnabled(): boolean {
    return !!(process.env.DATABASE_URL || process.env.DB_HOST)
  }
}
