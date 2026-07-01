/**
 * 与 packages/shared/src/wsEvents.ts 同源的事件名注册表（UniApp 端镜像）。
 * 升级时务必同步两端。
 */
export const RoomEvent = {
  Join: 'room:join',
  Joined: 'room:joined',
  JoinError: 'room:join:error',
  Leave: 'room:leave',
  MemberUpdate: 'member:update',
  Heartbeat: 'heartbeat',

  SlideGoto: 'slide:goto',
  SlidesLoaded: 'slides:loaded',

  AnnotationStrokeStart: 'annotation:stroke:start',
  AnnotationStrokePoint: 'annotation:stroke:point',
  AnnotationStrokeEnd: 'annotation:stroke:end',
  AnnotationClear: 'annotation:clear',
  AnnotationUndo: 'annotation:undo',

  LessonStart: 'lesson:start',

  TaskPush: 'task:push',
  TaskPushError: 'task:push:error',
  QuizStart: 'quiz:start',
  QuizStartError: 'quiz:start:error',
  QuizStop: 'quiz:stop',
  QuizComplete: 'quiz:complete',
  QuizProgress: 'quiz:progress',
  QuizGrading: 'quiz:grading',
  QuizReport: 'quiz:report',
  QuizQuestions: 'quiz:questions',
  QuizSubmitAck: 'quiz:submit:ack',
  AnswerSubmit: 'answer:submit',
  AnswerSubmitted: 'answer:submitted',

  CompeteStart: 'compete:start',
  CompeteStop: 'compete:stop',
  CompeteAnswer: 'compete:answer',
  CompeteAnswerAck: 'compete:answer:ack',

  AttendanceStart: 'attendance:start',
  AttendanceSign: 'attendance:sign',
  AttendanceSigned: 'attendance:signed',
  AttendanceSignedAck: 'attendance:signed:ack',
  AttendanceEnd: 'attendance:end',

  QuestionAsk: 'question:ask',
  QuestionNew: 'question:new',

  HandRaise: 'hand:raise',
  HandLower: 'hand:lower',

  GroupCreate: 'group:create',
  GroupDissolve: 'group:dissolve',
  GroupMsg: 'group:msg',

  ScreenLock: 'screen:lock',
  ScreenUnlock: 'screen:unlock',

  BroadcastMsg: 'broadcast:msg',

  LessonEnd: 'lesson:end',
  RollCall: 'roll:call',

  AiChat: 'ai:chat',
  AiResponse: 'ai:response',
  AiStream: 'ai:stream',
  AiWhiteboardShow: 'ai:whiteboard:show',
  AiWhiteboardHide: 'ai:whiteboard:hide',
  AiWhiteboardStroke: 'ai:whiteboard:stroke',
  AiWhiteboardClear: 'ai:whiteboard:clear',
  AiInteractiveShow: 'ai:interactive:show',
  AiInteractiveHide: 'ai:interactive:hide',
  AiPracticeStart: 'ai:practice:start',
  AiPracticeStartError: 'ai:practice:start:error',
  AiPracticeEnd: 'ai:practice:end',

  HomeworkPublish: 'homework:publish',

  // 学生平板新增：报告"已切到后台 / 离开应用"
  StudentFocusLost: 'student:focus:lost',
  StudentFocusGained: 'student:focus:gained',

  // ===== P0 课堂气氛互动包 =====
  // 投票/问卷/词云/评分（统一 poll 活动，kind: choice|text|rating）
  PollStart: 'poll:start',
  PollSubmit: 'poll:submit',
  PollSubmitAck: 'poll:submit:ack',
  PollUpdate: 'poll:update',
  PollStop: 'poll:stop',

  // 弹幕
  DanmakuSend: 'danmaku:send',
  DanmakuPush: 'danmaku:push',
  DanmakuToggle: 'danmaku:toggle',
  DanmakuClear: 'danmaku:clear',

  // 表情/情绪反馈
  ReactionSend: 'reaction:send',
  ReactionPush: 'reaction:push',
  ReactionStats: 'reaction:stats',

  // 随机点名转盘结果
  RollCallResult: 'roll:call:result',

  // 课堂计时器/倒计时
  TimerStart: 'timer:start',
  TimerStop: 'timer:stop',
  TimerSync: 'timer:sync',

  // 积分 / 排行榜 / 小组 PK
  PointsAward: 'points:award',
  LeaderboardUpdate: 'leaderboard:update',

  // 答案上墙 / 作品墙
  WallOpen: 'wall:open',
  WallSubmit: 'wall:submit',
  WallItem: 'wall:item',
  WallUpdate: 'wall:update',
  WallPick: 'wall:pick',
  WallClose: 'wall:close',

  // 反馈闭环：教师回复学生提问
  QuestionReply: 'question:reply',

  ErrorPermission: 'error:permission',
  ErrorAuth: 'error:auth',
} as const

export type RoomEventName = (typeof RoomEvent)[keyof typeof RoomEvent]
