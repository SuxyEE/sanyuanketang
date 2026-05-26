import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export type ViewState = 'listening' | 'quiz' | 'discussion' | 'ai_practice' | 'compete' | 'locked'

export interface QuizQuestion {
  id: string
  type: 'single_choice' | 'multiple_choice' | 'true_false' | 'short_answer'
  content: string
  options?: { key: string; content: string }[]
  timeLimit?: number
  answer?: string
  referenceAnswer?: string
}

export interface AiMessage {
  role: 'user' | 'assistant'
  content: string
  time: string
}

export interface GroupMember {
  id: string
  name: string
}

export interface GroupData {
  id: string
  name: string
  members: GroupMember[]
  topic?: string
}

export const useStudentStore = defineStore('student', () => {
  const courseName = ref('数字化设计与制造技术')
  const lessonTitle = ref('三维建模与逆向工程实训')
  const surnames = ['张', '李', '王', '陈', '赵', '刘', '周', '吴', '黄', '林', '杨', '郑', '谢', '何', '马']
  const randomSurname = surnames[Math.floor(Math.random() * surnames.length)]
  const randomNum = Math.floor(Math.random() * 50) + 1
  const studentName = ref(`${randomSurname}同学${String(randomNum).padStart(2, '0')}`)
  const studentId = ref('student-' + Math.random().toString(36).slice(2, 8))

  const currentSlide = ref(1)
  const totalSlides = ref(0)
  const slides = ref<{ index: number; dataUrl: string }[]>([])

  const viewState = ref<ViewState>('listening')
  const previousViewState = ref<ViewState>('listening')
  const isHandRaised = ref(false)
  const isOnline = ref(false)

  const quizQuestions = ref<QuizQuestion[]>([])
  const currentQuestionIndex = ref(0)
  const selectedAnswers = ref<Record<string, string>>({})
  const quizTimeLimit = ref(0)
  const activeTaskId = ref('')

  const aiMessages = ref<AiMessage[]>([
    {
      role: 'assistant',
      content: '你好！我是AI学习助手。有什么问题可以随时问我。',
      time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
    },
  ])

  const currentQuestion = computed(() => quizQuestions.value[currentQuestionIndex.value])

  const showAttendance = ref(false)
  const attendanceSigned = ref(false)
  const attendanceMode = ref('')
  const attendanceConfig = ref<{
    requirePhoto: boolean
    requireLocation: boolean
    radius: number
    teacherLocation?: { latitude: number; longitude: number }
  }>({
    requirePhoto: false,
    requireLocation: false,
    radius: 50,
  })

  const groupData = ref<GroupData | null>(null)
  const myGroupId = ref('')
  const pendingGroups = ref<{ groups: GroupData[]; studentId: string } | null>(null)

  const broadcastMessage = ref('')
  const showBroadcast = ref(false)
  interface BroadcastNotice {
    id: string
    message: string
    time: string
    from?: string
  }
  const broadcastHistory = ref<BroadcastNotice[]>([])

  const rolledStudent = ref<{ studentId: string; studentName: string } | null>(null)
  const showRollCall = ref(false)

  const competeQuestion = ref('')
  const competeTimeLimit = ref(0)
  const competeStartTime = ref(0)
  const competeResult = ref<{ winner: { studentId: string; studentName: string; responseTime: number } | null; ranking: any[] } | null>(null)

  interface HomeworkItem {
    id: string
    title: string
    description?: string
    questions: any[]
    deadline?: string | null
    publishedAt: string
    type?: string
  }
  const homeworkList = ref<HomeworkItem[]>([])
  const latestHomework = ref<HomeworkItem | null>(null)

  function setQuiz(task: any) {
    quizQuestions.value = task.questions || []
    currentQuestionIndex.value = 0
    selectedAnswers.value = {}
    quizTimeLimit.value = task.timeLimit || 300
    activeTaskId.value = task.id || ''
    viewState.value = 'quiz'
  }

  function endQuiz() {
    viewState.value = 'listening'
    quizQuestions.value = []
    selectedAnswers.value = {}
    currentQuestionIndex.value = 0

    if (pendingGroups.value) {
      const { groups, studentId } = pendingGroups.value
      pendingGroups.value = null
      const myGroup = groups.find(g => g.members.some(m => m.id === studentId))
      if (myGroup) {
        groupData.value = myGroup
        myGroupId.value = myGroup.id
        viewState.value = 'discussion'
      }
    }
  }

  function lockScreen() {
    if (viewState.value !== 'locked') {
      previousViewState.value = viewState.value
    }
    viewState.value = 'locked'
  }

  function unlockScreen() {
    viewState.value = previousViewState.value || 'listening'
  }

  function setGroups(groups: GroupData[], myId: string) {
    const myGroup = groups.find(g =>
      g.members.some(m => m.id === myId)
    )
    if (myGroup) {
      groupData.value = myGroup
      myGroupId.value = myGroup.id
      viewState.value = 'discussion'
    }
  }

  function dissolveGroups() {
    groupData.value = null
    myGroupId.value = ''
    pendingGroups.value = null
    // 只有当前正在「分组讨论」视图时才切回听课；测验/锁屏/AI 实践时保留当前视图
    if (viewState.value === 'discussion') {
      viewState.value = 'listening'
    }
  }

  /** 教师下发 AI 实践结束 → 把 viewState 从 ai_practice 还原 */
  function endAiPractice() {
    if (viewState.value === 'ai_practice') {
      viewState.value = previousViewState.value === 'ai_practice'
        ? 'listening'
        : (previousViewState.value || 'listening')
    }
  }

  function showBroadcastMsg(msg: string, from?: string) {
    broadcastMessage.value = msg
    showBroadcast.value = true
    broadcastHistory.value.unshift({
      id: `bcast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      message: msg,
      from,
      time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
    })
    if (broadcastHistory.value.length > 20) broadcastHistory.value.pop()
  }
  function dismissBroadcast() {
    showBroadcast.value = false
  }

  function startCompete(data: { question: string; timeLimit: number; startTime: number }) {
    competeQuestion.value = data.question
    competeTimeLimit.value = data.timeLimit
    competeStartTime.value = data.startTime || Date.now()
    competeResult.value = null
    if (viewState.value !== 'locked' && viewState.value !== 'quiz') {
      previousViewState.value = viewState.value
      viewState.value = 'compete'
    }
  }

  function stopCompete(result: { winner: any; ranking: any[] } | null) {
    competeResult.value = result
    if (viewState.value === 'compete') {
      const generation = competeStartTime.value
      setTimeout(() => {
        if (viewState.value === 'compete' && competeStartTime.value === generation) {
          viewState.value = previousViewState.value || 'listening'
        }
      }, 4000)
    }
  }

  function addHomework(hw: HomeworkItem) {
    if (!homeworkList.value.find(h => h.id === hw.id)) {
      homeworkList.value.unshift(hw)
      latestHomework.value = hw
    }
  }

  function dismissLatestHomework() {
    latestHomework.value = null
  }

  return {
    courseName,
    lessonTitle,
    studentName,
    studentId,
    currentSlide,
    totalSlides,
    slides,
    viewState,
    previousViewState,
    isHandRaised,
    isOnline,
    quizQuestions,
    currentQuestionIndex,
    selectedAnswers,
    quizTimeLimit,
    activeTaskId,
    aiMessages,
    currentQuestion,
    showAttendance,
    attendanceSigned,
    attendanceMode,
    attendanceConfig,
    groupData,
    myGroupId,
    pendingGroups,
    broadcastMessage,
    showBroadcast,
    broadcastHistory,
    rolledStudent,
    showRollCall,
    competeQuestion,
    competeTimeLimit,
    competeStartTime,
    competeResult,
    homeworkList,
    latestHomework,
    setQuiz,
    endQuiz,
    lockScreen,
    unlockScreen,
    setGroups,
    dissolveGroups,
    endAiPractice,
    showBroadcastMsg,
    dismissBroadcast,
    startCompete,
    stopCompete,
    addHomework,
    dismissLatestHomework,
  }
})
