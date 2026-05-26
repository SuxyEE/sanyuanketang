/**
 * Socket.IO 实时事件名集中注册表（与 `events.ts` 的高层枚举互补）。
 *
 * 设计目标：
 *   - `events.ts` 里的 `TeacherCommand` / `StudentEvent` / `SystemEvent` 是面向"语义/角色"的强类型枚举，
 *     适合在 `ServerToClientEvents` / `ClientToServerEvents` 接口里精确建模。
 *   - 但实际 `ClassroomGateway` 还广播大量"派生事件"（`quiz:report` / `quiz:progress` / `admin:event`...），
 *     这些用强枚举建模代价过大；如果让 gateway 与前端各自写字符串字面量，事件改名时编译器
 *     不会报错。
 *   - 所以这里用 `as const` 对象集中所有事件名（语义事件 + 派生事件），让 gateway 与前端 import 同一来源。
 *
 * 用法：
 *   import { RoomEvent } from '@snyuan/shared'
 *   client.emit(RoomEvent.QuizStartError, { message })
 *   socket.on(RoomEvent.AdminEvent, handler)
 *
 * 命名空间约定（按业务域分组）：
 *   - Room: 房间生命周期 / 通用
 *   - Slide: 课件
 *   - Quiz: 测验流程
 *   - Compete: 抢答
 *   - Attendance: 签到
 *   - Question: 学生提问
 *   - Hand: 举手
 *   - Group: 分组讨论
 *   - Screen: 锁屏
 *   - Broadcast: 广播
 *   - Lesson: 课程
 *   - AI: AI 副驾（chat / quiz-gen / grade / whiteboard / interactive / practice）
 *   - Admin: 管理后台观察者
 *   - Error: 通用错误
 */
export const RoomEvent = {
  // 房间
  Join: 'room:join',
  Joined: 'room:joined',
  JoinError: 'room:join:error',
  Leave: 'room:leave',
  RoomsList: 'rooms:list',
  MemberUpdate: 'member:update',
  Heartbeat: 'heartbeat',

  // 课件
  SlideGoto: 'slide:goto',
  SlidesUpload: 'slides:upload',
  SlidesLoaded: 'slides:loaded',

  // 蒙版涂鸦标注（A 方案：逐点同步）
  AnnotationStrokeStart: 'annotation:stroke:start',
  AnnotationStrokePoint: 'annotation:stroke:point',
  AnnotationStrokeEnd: 'annotation:stroke:end',
  AnnotationClear: 'annotation:clear',
  AnnotationUndo: 'annotation:undo',

  // 测验
  TaskPush: 'task:push',
  TaskPushError: 'task:push:error',
  QuizStart: 'quiz:start',
  QuizStartError: 'quiz:start:error',
  QuizStop: 'quiz:stop',
  QuizComplete: 'quiz:complete',
  QuizProgress: 'quiz:progress',
  QuizGrading: 'quiz:grading',
  QuizReport: 'quiz:report',
  QuizSubmitAck: 'quiz:submit:ack',
  AnswerSubmit: 'answer:submit',
  AnswerSubmitted: 'answer:submitted',

  // 抢答
  CompeteStart: 'compete:start',
  CompeteStop: 'compete:stop',
  CompeteAnswer: 'compete:answer',
  CompeteAnswerAck: 'compete:answer:ack',

  // 签到
  AttendanceStart: 'attendance:start',
  AttendanceStartError: 'attendance:start:error',
  AttendanceSign: 'attendance:sign',
  AttendanceSigned: 'attendance:signed',
  AttendanceSignedAck: 'attendance:signed:ack',
  AttendanceEnd: 'attendance:end',

  // 学生提问
  QuestionAsk: 'question:ask',
  QuestionNew: 'question:new',

  // 举手
  HandRaise: 'hand:raise',
  HandLower: 'hand:lower',

  // 分组
  GroupCreate: 'group:create',
  GroupDissolve: 'group:dissolve',
  GroupMsg: 'group:msg',

  // 屏控
  ScreenLock: 'screen:lock',
  ScreenUnlock: 'screen:unlock',

  // 广播
  BroadcastMsg: 'broadcast:msg',

  // 课程
  LessonStart: 'lesson:start',
  LessonPause: 'lesson:pause',
  LessonResume: 'lesson:resume',
  LessonEnd: 'lesson:end',

  // 点名
  RollCall: 'roll:call',

  // AI
  AiChat: 'ai:chat',
  AiResponse: 'ai:response',
  AiStream: 'ai:stream',
  AiQuizGen: 'ai:quiz-gen',
  AiGrade: 'ai:grade',
  AiWhiteboardGen: 'ai:whiteboard:gen',
  AiWhiteboardGenProgress: 'ai:whiteboard:gen:progress',
  AiWhiteboardShow: 'ai:whiteboard:show',
  AiWhiteboardHide: 'ai:whiteboard:hide',
  AiInteractiveGen: 'ai:interactive:gen',
  AiInteractiveGenProgress: 'ai:interactive:gen:progress',
  AiInteractiveShow: 'ai:interactive:show',
  AiInteractiveHide: 'ai:interactive:hide',
  AiPracticeStart: 'ai:practice:start',
  AiPracticeStartError: 'ai:practice:start:error',
  AiPracticeEnd: 'ai:practice:end',

  // 课件 beam（手机扫码 → 教师平板）
  CoursewareUploadSubscribe: 'courseware-upload:subscribe',
  CoursewareUploadUnsubscribe: 'courseware-upload:unsubscribe',
  CoursewareUploadFile: 'courseware-upload:file',

  // 课堂分析报告（AI 流式生成）
  LessonReportGen: 'lesson:report:gen',
  LessonReportStream: 'lesson:report:stream',

  // 课后作业
  HomeworkPublish: 'homework:publish',

  // Admin 观察者
  AdminSubscribe: 'admin:subscribe',
  AdminUnsubscribe: 'admin:unsubscribe',
  AdminRooms: 'admin:rooms',
  AdminEvent: 'admin:event',
  AdminBroadcast: 'admin:broadcast',
  AdminBroadcastAck: 'admin:broadcast:ack',

  // 通用错误
  ErrorPermission: 'error:permission',
  ErrorInput: 'error:input',
} as const

export type RoomEventName = (typeof RoomEvent)[keyof typeof RoomEvent]

/** 所有事件名集合（用于运行时白名单校验，比如 admin 观察者只复制下列事件） */
export const ALL_ROOM_EVENTS: ReadonlySet<string> = new Set(Object.values(RoomEvent))
