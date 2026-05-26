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

  ErrorPermission: 'error:permission',
  ErrorAuth: 'error:auth',
} as const

export type RoomEventName = (typeof RoomEvent)[keyof typeof RoomEvent]
