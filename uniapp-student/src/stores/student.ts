import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { QuizQuestion, AiMessage, GroupData, HomeworkItem } from '@/shared/types'

export type ViewState = 'listening' | 'quiz' | 'discussion' | 'ai_practice' | 'compete' | 'locked'

const STORAGE_KEY_NAME = 'snyuan_student_name_v1'
const STORAGE_KEY_ID = 'snyuan_student_id_v1'

function getOrCreateStudent() {
  let id = ''
  let name = ''
  try {
    id = uni.getStorageSync(STORAGE_KEY_ID) || ''
    name = uni.getStorageSync(STORAGE_KEY_NAME) || ''
  } catch { /* ignore */ }

  if (!id) {
    id = 'student-' + Math.random().toString(36).slice(2, 8)
    try { uni.setStorageSync(STORAGE_KEY_ID, id) } catch { /* ignore */ }
  }
  if (!name) {
    const surnames = ['张', '李', '王', '陈', '赵', '刘', '周', '吴', '黄', '林', '杨', '郑', '谢', '何', '马']
    const r = surnames[Math.floor(Math.random() * surnames.length)]
    name = `${r}同学${String(Math.floor(Math.random() * 50) + 1).padStart(2, '0')}`
    try { uni.setStorageSync(STORAGE_KEY_NAME, name) } catch { /* ignore */ }
  }
  return { id, name }
}

export const useStudentStore = defineStore('student', () => {
  const init = getOrCreateStudent()

  const courseName = ref('')
  const lessonTitle = ref('')
  const studentName = ref(init.name)
  const studentId = ref(init.id)

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
      time: formatNowHm(),
    },
  ])

  const showAttendance = ref(false)
  const attendanceSigned = ref(false)
  const attendanceMode = ref('')
  const attendanceConfig = ref<{
    requirePhoto: boolean
    requireLocation: boolean
    radius: number
    teacherLocation?: { latitude: number; longitude: number }
  }>({
    requirePhoto: true,
    requireLocation: true,
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
  const competeResult = ref<{ winner: any; ranking: any[] } | null>(null)

  const homeworkList = ref<HomeworkItem[]>([])
  const latestHomework = ref<HomeworkItem | null>(null)

  const currentQuestion = computed(() => quizQuestions.value[currentQuestionIndex.value])

  function formatNowHm() {
    const d = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`
  }

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
      const { groups, studentId: sid } = pendingGroups.value
      pendingGroups.value = null
      const myGroup = groups.find(g => g.members.some(m => m.id === sid))
      if (myGroup) {
        groupData.value = myGroup
        myGroupId.value = myGroup.id
        viewState.value = 'discussion'
      }
    }
  }

  function lockScreen() {
    if (viewState.value !== 'locked') previousViewState.value = viewState.value
    viewState.value = 'locked'
  }

  function unlockScreen() {
    viewState.value = previousViewState.value || 'listening'
  }

  function setGroups(groups: GroupData[], myId: string) {
    const myGroup = groups.find(g => g.members.some(m => m.id === myId))
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

  /**
   * 教师下发"结束 AI 实践"。把 viewState 从 ai_practice 切回 listening，
   * 同时清掉关联的 HTML 沙盘 payload，让大屏/平板回到课件。
   */
  function endAiPractice() {
    if (viewState.value === 'ai_practice') {
      viewState.value = previousViewState.value === 'ai_practice' ? 'listening' : (previousViewState.value || 'listening')
    }
  }

  function showBroadcastMsg(msg: string, from?: string) {
    broadcastMessage.value = msg
    showBroadcast.value = true
    broadcastHistory.value.unshift({
      id: `bcast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      message: msg,
      from,
      time: formatNowHm(),
    })
    if (broadcastHistory.value.length > 20) broadcastHistory.value.pop()
  }

  function dismissBroadcast() { showBroadcast.value = false }

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

  function dismissLatestHomework() { latestHomework.value = null }

  /** AI 消息上限：超过 80 条折叠最早 20 条为单条占位（防内存膨胀） */
  function pushAiMessage(m: AiMessage) {
    aiMessages.value.push(m)
    if (aiMessages.value.length > 80) {
      const dropped = aiMessages.value.splice(0, 20)
      aiMessages.value.unshift({
        role: 'assistant',
        content: `（已折叠 ${dropped.length} 条早期消息）`,
        time: dropped[0].time,
      })
    }
  }

  return {
    courseName, lessonTitle, studentName, studentId,
    currentSlide, totalSlides, slides,
    viewState, previousViewState, isHandRaised, isOnline,
    quizQuestions, currentQuestionIndex, selectedAnswers, quizTimeLimit, activeTaskId,
    aiMessages, currentQuestion,
    showAttendance, attendanceSigned, attendanceMode, attendanceConfig,
    groupData, myGroupId, pendingGroups,
    broadcastMessage, showBroadcast, broadcastHistory,
    rolledStudent, showRollCall,
    competeQuestion, competeTimeLimit, competeStartTime, competeResult,
    homeworkList, latestHomework,
    setQuiz, endQuiz, lockScreen, unlockScreen,
    setGroups, dissolveGroups, endAiPractice,
    showBroadcastMsg, dismissBroadcast,
    startCompete, stopCompete, addHomework, dismissLatestHomework,
    pushAiMessage,
  }
})
