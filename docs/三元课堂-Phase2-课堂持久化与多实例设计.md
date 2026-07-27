# 三元课堂 Phase 2 · 课堂持久化与多实例设计

> 日期：2026-07-27  
> 代码基线：`caf9612`  
> 对应方案：《三元课堂-SaaS产品与跨产品联动改造方案》v1.1 §12 Phase 2

## 0. 一句话

课堂运行时和业务表现在是**两套并行、互不连接**的东西。Phase 2 的本质不是「加几张表」，
而是把 gateway 的内存态接到持久层上，让课堂结束后还能被重算和恢复。

## 1. 现状盘点

以下都是对着代码核过的，不是推测。

### 1.1 已经落库的

| 表 | 谁在写 | 内容 |
|---|---|---|
| `lessons` | REST（LessonController）| 课次信息、`roomCode`、翻页进度 |
| `tasks` | REST（TaskController）| 活动定义，`questions` 内嵌 JSON |
| `task_submissions` | REST | 作答与分数 |
| `wrong_questions` | **gateway** | 批改出的错题，经 `WrongBookService` |
| `users` / `courses` | REST | 主档 |

### 1.2 完全没落库的

`RoomState` 里这些字段只活在内存，结课即消失：

- 课堂会话本身：成员进出、锁屏、当前页、举手
- `activeQuiz`、`activeCompete`、`activeAttendance`、`activePoll`、`activeWall`
- `aiPractice`、`timer`、`points`、`studentGroups`、`annotations`、`reactions`、`recentlyCalled`
- `reportData`——全堂累计池，课堂报告就是从它算出来的

### 1.3 最关键的那处断裂

`classroom.gateway.ts` 的 import 里**没有 `TaskService` 也没有 `LessonService`**，
唯一的落库路径是可选注入的 `WrongBookService`。这意味着：

- 课堂里发的测验**不写 `tasks` 表**，`room.activeQuiz` 是个独立的内存对象
- 学生作答**不写 `task_submissions`**
- `lessons.roomCode` 和 gateway 的 `room.lessonId` 没有强关联

所以现在 REST 那套业务表基本是给管理端看的，跟真实跑的课堂是两条线。
**这也解释了为什么「结课后不可可靠重算」——数据压根没留下。**

## 2. 设计原则

1. **不新造与 `tasks` / `task_submissions` 重复的表**，先把 gateway 接到它们上
2. 题目快照必须不可变：题库改题不能影响历史课堂的成绩
3. 每个写入点都要有幂等键，否则断线重连和重复事件会产生重复成绩
4. 内存态保留作为读模型（实时广播要性能），**持久层是真相源**
5. DB 未配置时（演示模式）必须继续能跑，不能让持久化变成硬依赖

## 3. 目标表结构

### 3.1 扩展现有表

| 表 | 新增列 | 原因 |
|---|---|---|
| `lessons` | `tenantId`、`schoolId`、`teacherId`、`endedAt` | 租户边界；现在只有 `classId` |
| `tasks` | `tenantId`、`schoolId`、`sessionId`、`idempotencyKey` | 关联到具体一次开课，并防重复发布 |
| `task_submissions` | `tenantId`、`schoolId`、`attemptNo` | 允许重做，且能区分第几次 |

### 3.2 新增表

| 表 | 用途 |
|---|---|
| `classroom_session` | 一次开课的运行实例。一个 `lesson` 可以被开多次，现在这个概念在库里不存在 |
| `classroom_session_member` | 名单快照与进出记录，支撑到课率、迟到、异常退出 |
| `classroom_activity` | 非测验类活动：签到、抢答、投票、点名、上墙、计时、AI 板书 |
| `classroom_activity_participation` | 上述活动的参与明细 |
| `classroom_question_snapshot` | 发题瞬间的不可变题目副本，带题库来源与 revision |
| `platform_learning_record_outbox` | SQL 草案已在 `sql/20260724_platform_foundation.sql`，缺实体 |

**为什么测验走 `tasks`、其他活动走 `classroom_activity`**：`tasks` 已经有 type 枚举和
`questions` 结构，测验天然贴合；而签到、抢答、点名这类根本没有题目，硬塞进 `tasks`
会让 `questions` 长期为空，白白背一个用不上的结构。

## 4. 幂等键

| 写入点 | 幂等键 | 备注 |
|---|---|---|
| 发布活动 | `(sessionId, clientActivityId)` | 客户端生成 id，重连重发不产生第二份 |
| 学生提交 | `(taskId, studentId, attemptNo)` | |
| 批改结果 | `(taskId, studentId, questionId)` | `wrong_questions` 已经是这个键，沿用 |
| 学情事件 | `event_id` | 已完成 |

## 5. gateway 拆分：分四步，每步可独立上线

| 步骤 | 内容 | 风险 | 是否改现有行为 |
|---|---|---|---|
| **Step 1** ✅ | outbox 落库 + 定时重试 | 低 | 否，只改 platform 模块，不碰 gateway |
| **Step 2** | 会话与名单落库：`room:join` / `lesson:start` / `lesson:end` 写 `classroom_session` 与成员表 | 中 | 否，只加写入，读路径仍走内存 |
| **Step 3** | 测验与作答落库：发题写 `tasks` + `classroom_question_snapshot`，提交写 `task_submissions` | 中 | 否，只加写入。做完这步课堂报告就能从库里重算 |
| **Step 4** | 拆分 gateway 为会话 / 活动 / 提交 / 批改 / 报告五个领域服务，内存态降级为读模型缓存 | 高 | 是，真正的重构 |

前三步都是「只加写入、不改读」，可以逐步上线，出问题直接关掉写入回退。
第 4 步才动结构，且应该在前三步的数据验证过之后再做。

## 6. Redis 与多实例：先回答一个问题

这一块**取决于多校 SaaS 的部署形态**，方案里没有明确：

- **一套部署多租户** → 必然多实例 → 需要 Redis + Socket.IO adapter，房间 key 要带
  租户和学校维度，领域服务不能持有任何内存态
- **每校独立部署** → 单实例可接受 → Redis 只为「重启不丢课堂」，优先级下降，可以推迟

**Step 1 到 Step 3 不受这个问题影响，可以先做。Step 4 的拆分方式会被它直接决定**，
因为多实例意味着领域服务必须无状态。在答案出来之前不要开始 Step 4。

## 7. 建议顺序

```text
Step 1 ──→ Step 2 ──→ Step 3 ──→ [回答租户模型问题] ──→ Step 4 + Redis
 低风险      加写入      加写入          决策              重构
```

Step 1 完全自包含，不碰 gateway，可以立刻开始。

## 8. 落地记录

### 8.1 Step 1：outbox 落库与重试（2026-07-27）

- 新增 `LearningRecordOutboxEntity`，表 `platform_learning_record_outbox`，主键就是信封的
  `event_id`，下游按它幂等。列名用驼峰，与库内既有风格和 TypeORM 默认命名策略一致；
  `sql/20260724_platform_foundation.sql` 里的建表语句同步改掉了，否则 `DB_SYNCHRONIZE=true`
  会再建一套下划线列。
- 比原草案多一列 `nextAttemptAt`：没有它就没法做退避，失败的事件会在每个轮询周期被反复重打。
- 写入顺序是**先落库再投递**，投递失败不丢事件，交给重试任务。原来是先推、推失败只在内存里
  记个 `lastError`，重启就没了。
- 重试任务每 60 秒捞一批（可配），指数退避封顶 30 分钟，超过最大次数（默认 8）不再自动重试，
  留在库里等人工排查，不会无限重打下游。
- `PlatformModule` 在演示模式下也要挂载，所以仓库是条件注册、`@Optional` 注入的：
  拿不到就降级为内存 outbox 并打警告。已实测无数据库时服务能正常启动并给出该警告。

未做：`platform_school_config` 表仍然只有 SQL 草案，配置仍从 JSON 文件读，等真要多校动态配置时再说。
