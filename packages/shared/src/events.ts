import type {
  SlideInfo,
  Task,
  TaskSubmission,
  GroupInfo,
  StudentProgress,
  ClassroomStats,
  GroupStrategy,
  AiMessage,
  JoinRoomPayload,
} from './types'

export enum TeacherCommand {
  SLIDE_GOTO = 'slide:goto',
  TASK_PUSH = 'task:push',
  TASK_RECALL = 'task:recall',
  QUIZ_START = 'quiz:start',
  QUIZ_STOP = 'quiz:stop',
  GROUP_CREATE = 'group:create',
  GROUP_DISSOLVE = 'group:dissolve',
  ROLL_CALL = 'roll:call',
  COMPETE_START = 'compete:start',
  COMPETE_STOP = 'compete:stop',
  SCREEN_LOCK = 'screen:lock',
  SCREEN_UNLOCK = 'screen:unlock',
  BROADCAST_MSG = 'broadcast:msg',
  STUDENT_FOCUS = 'student:focus',
  LESSON_START = 'lesson:start',
  LESSON_PAUSE = 'lesson:pause',
  LESSON_RESUME = 'lesson:resume',
  LESSON_END = 'lesson:end',
  AI_PRACTICE_START = 'ai_practice:start',
}

export enum StudentEvent {
  ANSWER_SUBMIT = 'answer:submit',
  HAND_RAISE = 'hand:raise',
  HAND_LOWER = 'hand:lower',
  PROGRESS_SYNC = 'progress:sync',
  HELP_REQUEST = 'help:request',
  AI_CHAT = 'ai:chat',
  NOTE_SAVE = 'note:save',
}

export enum SystemEvent {
  ROOM_JOIN = 'room:join',
  ROOM_LEAVE = 'room:leave',
  MEMBER_UPDATE = 'member:update',
  STATS_REFRESH = 'stats:refresh',
  AI_RESPONSE = 'ai:response',
  ERROR = 'error',
  HEARTBEAT = 'heartbeat',
}

export interface ServerToClientEvents {
  [TeacherCommand.SLIDE_GOTO]: (slide: SlideInfo) => void
  [TeacherCommand.TASK_PUSH]: (task: Task) => void
  [TeacherCommand.TASK_RECALL]: (data: { taskId: string }) => void
  [TeacherCommand.QUIZ_START]: (task: Task) => void
  [TeacherCommand.QUIZ_STOP]: (data: { taskId: string }) => void
  [TeacherCommand.GROUP_CREATE]: (groups: GroupInfo[]) => void
  [TeacherCommand.GROUP_DISSOLVE]: () => void
  [TeacherCommand.ROLL_CALL]: (data: { studentId: string; studentName: string }) => void
  [TeacherCommand.COMPETE_START]: (data: { questionId: string; question: string }) => void
  [TeacherCommand.COMPETE_STOP]: () => void
  [TeacherCommand.SCREEN_LOCK]: () => void
  [TeacherCommand.SCREEN_UNLOCK]: () => void
  [TeacherCommand.BROADCAST_MSG]: (data: { message: string; type: 'text' | 'image' | 'file' }) => void
  [TeacherCommand.STUDENT_FOCUS]: (data: { studentId: string }) => void
  [TeacherCommand.LESSON_START]: (data: { lessonId: string }) => void
  [TeacherCommand.LESSON_PAUSE]: () => void
  [TeacherCommand.LESSON_RESUME]: () => void
  [TeacherCommand.LESSON_END]: () => void
  [TeacherCommand.AI_PRACTICE_START]: (data: { topic: string; prompt: string }) => void

  [SystemEvent.MEMBER_UPDATE]: (data: { students: StudentProgress[] }) => void
  [SystemEvent.STATS_REFRESH]: (stats: ClassroomStats) => void
  [SystemEvent.AI_RESPONSE]: (data: { conversationId: string; message: AiMessage }) => void
  [SystemEvent.ERROR]: (data: { code: string; message: string }) => void
}

export interface ClientToServerEvents {
  [SystemEvent.ROOM_JOIN]: (payload: JoinRoomPayload) => void
  [SystemEvent.ROOM_LEAVE]: () => void
  [SystemEvent.HEARTBEAT]: () => void

  [TeacherCommand.SLIDE_GOTO]: (slide: SlideInfo) => void
  [TeacherCommand.TASK_PUSH]: (task: Omit<Task, 'id' | 'createdAt'>) => void
  [TeacherCommand.TASK_RECALL]: (data: { taskId: string }) => void
  [TeacherCommand.QUIZ_START]: (task: Omit<Task, 'id' | 'createdAt'>) => void
  [TeacherCommand.QUIZ_STOP]: (data: { taskId: string }) => void
  [TeacherCommand.GROUP_CREATE]: (data: { strategy: GroupStrategy; groupCount: number }) => void
  [TeacherCommand.GROUP_DISSOLVE]: () => void
  [TeacherCommand.ROLL_CALL]: (data: { mode: 'random' | 'manual'; studentId?: string }) => void
  [TeacherCommand.COMPETE_START]: (data: { questionId: string }) => void
  [TeacherCommand.COMPETE_STOP]: () => void
  [TeacherCommand.SCREEN_LOCK]: () => void
  [TeacherCommand.SCREEN_UNLOCK]: () => void
  [TeacherCommand.BROADCAST_MSG]: (data: { message: string; type: 'text' | 'image' | 'file' }) => void
  [TeacherCommand.STUDENT_FOCUS]: (data: { studentId: string }) => void
  [TeacherCommand.LESSON_START]: () => void
  [TeacherCommand.LESSON_PAUSE]: () => void
  [TeacherCommand.LESSON_RESUME]: () => void
  [TeacherCommand.LESSON_END]: () => void
  [TeacherCommand.AI_PRACTICE_START]: (data: { topic: string; prompt: string }) => void

  [StudentEvent.ANSWER_SUBMIT]: (submission: Omit<TaskSubmission, 'id' | 'score' | 'aiComment' | 'submittedAt'>) => void
  [StudentEvent.HAND_RAISE]: () => void
  [StudentEvent.HAND_LOWER]: () => void
  [StudentEvent.PROGRESS_SYNC]: (data: { taskId: string; progress: number }) => void
  [StudentEvent.HELP_REQUEST]: (data: { message: string }) => void
  [StudentEvent.AI_CHAT]: (data: { conversationId?: string; message: string }) => void
  [StudentEvent.NOTE_SAVE]: (data: { slideIndex: number; content: string }) => void
}
