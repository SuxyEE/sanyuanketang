import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

export interface StudentInfo {
  id: string
  name: string
  no: string
  state: 'online' | 'working' | 'submitted' | 'offline'
  progress: number
  handRaised: boolean
}

export interface QuestionItem {
  studentId: string
  studentName: string
  text: string
  slideIndex: number
  time: string
}

export interface AttendanceSignedRecord {
  studentId: string
  studentName: string
  time: string
  photo?: string
  location?: { latitude: number; longitude: number; accuracy?: number }
  distance?: number
  verified?: boolean
}

/**
 * 教师端"签到进行中"快照。
 * 注意：单独维护这个状态，避免和"当前选中的活动卡片"(activeActivity) 混用，
 * 否则一打开签到面板（即使还没真正发起签到）就会被误判成"已发起"，导致只显示结束按钮。
 */
export interface ActiveAttendanceState {
  mode: string
  duration: number
  startedAt: number
  requirePhoto?: boolean
  requireLocation?: boolean
  radius?: number
  teacherLocation?: { latitude: number; longitude: number }
}

export const useClassroomStore = defineStore('teacher-classroom', () => {
  const courseName = ref('工业机器人编程实训')
  const lessonTitle = ref('工业机器人技术')
  const roomCode = ref('')
  const isRecording = ref(true)
  const isLocked = ref(false)

  const currentSlide = ref(1)
  const totalSlides = ref(0)
  const slides = ref<{ index: number; dataUrl: string }[]>([])

  const students = ref<StudentInfo[]>([])
  const questions = ref<QuestionItem[]>([])
  const attendanceSigned = ref<AttendanceSignedRecord[]>([])
  const activeQuiz = ref<{ taskId: string; submitted: number; total: number; grading: boolean } | null>(null)
  const activeCompete = ref<{ question: string; responders: { studentId: string; studentName: string; responseTime: number }[] } | null>(null)
  const activeAttendance = ref<ActiveAttendanceState | null>(null)
  const activeAiPractice = ref<{ topic: string; prompt?: string; startedAt: string } | null>(null)
  const activeDiscussion = ref<{ topic: string; duration: number; startedAt: number; strategy: string; groupCount: number } | null>(null)

  const onlineCount = computed(() => students.value.filter((s) => s.state !== 'offline').length)
  const totalCount = computed(() => students.value.length)
  const submittedCount = computed(() => students.value.filter((s) => s.state === 'submitted').length)
  const handRaisedList = computed(() => students.value.filter((s) => s.handRaised))

  function updateMembers(data: any) {
    const memberList = Array.isArray(data?.members) ? data.members : []
    const studentMembers = memberList.filter((m: any) => m.role === 'student')
    const existingMap = new Map(students.value.map((s) => [s.id, s]))

    students.value = studentMembers.map((m: any, i: number) => {
      const existing = existingMap.get(m.userId)
      return {
        id: m.userId,
        name: m.userName || `学生${i + 1}`,
        no: `2024${String(i + 1).padStart(4, '0')}`,
        state: existing?.state || 'online',
        progress: existing?.progress || 0,
        handRaised: existing?.handRaised || false,
      }
    })
  }

  function onHandRaise(data: { studentId: string; studentName: string }) {
    const student = students.value.find((s) => s.id === data.studentId)
    if (student) student.handRaised = true
    else {
      students.value.push({
        id: data.studentId,
        name: data.studentName,
        no: '',
        state: 'online',
        progress: 0,
        handRaised: true,
      })
    }
  }

  function onHandLower(data: { studentId: string }) {
    const student = students.value.find((s) => s.id === data.studentId)
    if (student) student.handRaised = false
  }

  function onAnswerSubmitted(data: any) {
    const student = students.value.find((s) => s.id === data.studentId)
    if (student) {
      student.state = 'submitted'
      student.progress = 100
    }
  }

  function addQuestion(q: QuestionItem) {
    questions.value.unshift(q)
  }

  function resetLesson() {
    isLocked.value = false
    activeQuiz.value = null
    activeCompete.value = null
    activeAttendance.value = null
    activeAiPractice.value = null
    activeDiscussion.value = null
    attendanceSigned.value = []
    questions.value = []
    slides.value = []
    totalSlides.value = 0
    currentSlide.value = 1
    students.value.forEach((s) => {
      s.state = 'online'
      s.progress = 0
      s.handRaised = false
    })
  }

  return {
    courseName,
    lessonTitle,
    roomCode,
    isRecording,
    isLocked,
    currentSlide,
    totalSlides,
    slides,
    students,
    questions,
    attendanceSigned,
    activeQuiz,
    activeCompete,
    activeAttendance,
    activeAiPractice,
    activeDiscussion,
    onlineCount,
    totalCount,
    submittedCount,
    handRaisedList,
    updateMembers,
    onHandRaise,
    onHandLower,
    onAnswerSubmitted,
    addQuestion,
    resetLesson,
  }
})
