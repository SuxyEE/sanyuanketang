import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

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

export interface CompeteResponderInfo {
  studentId: string
  studentName: string
  responseTime: number
}

export interface ActiveCompeteState {
  taskId?: string
  question: string
  timeLimit: number
  startTime: number
  active: boolean
  responders: CompeteResponderInfo[]
}

export interface AttendanceSignedRecord {
  studentId: string
  studentName: string
  time: string
}

export interface ActiveAttendanceState {
  mode: string
  duration: number
  startedAt: number
  active: boolean
  signed: AttendanceSignedRecord[]
}

export const useClassroomStore = defineStore('classroom', () => {
  const courseName = ref('数字化设计与制造技术')
  const lessonTitle = ref('三维建模与逆向工程实训')
  const isRecording = ref(true)

  const currentSlide = ref(1)
  const totalSlides = ref(0)
  const slides = ref<{ index: number; dataUrl: string }[]>([])

  const students = ref<StudentInfo[]>([])

  const onlineCount = computed(() => students.value.filter((s) => s.state !== 'offline').length)
  const totalCount = computed(() => students.value.length)
  const submittedCount = computed(() => students.value.filter((s) => s.state === 'submitted').length)
  const handRaisedList = computed(() => students.value.filter((s) => s.handRaised))

  const questions = ref<QuestionItem[]>([])
  const answerCount = ref(0)

  const activeCompete = ref<ActiveCompeteState | null>(null)
  const activeAttendance = ref<ActiveAttendanceState | null>(null)
  const aiPractice = ref<{ topic: string; prompt?: string; startedAt: string } | null>(null)
  const isLockedShared = ref(false)

  function setActiveCompete(data: ActiveCompeteState | null) {
    activeCompete.value = data
  }
  function addCompeteResponder(r: CompeteResponderInfo) {
    if (!activeCompete.value?.active) return
    if (activeCompete.value.responders.find(x => x.studentId === r.studentId)) return
    activeCompete.value.responders.push(r)
    activeCompete.value.responders.sort((a, b) => a.responseTime - b.responseTime)
  }
  function endActiveCompete() {
    if (activeCompete.value) activeCompete.value.active = false
  }
  function setActiveAttendance(data: ActiveAttendanceState | null) {
    activeAttendance.value = data
  }
  function endActiveAttendance() {
    if (activeAttendance.value) activeAttendance.value.active = false
  }
  function addAttendanceSigned(rec: AttendanceSignedRecord) {
    if (!activeAttendance.value) return
    if (activeAttendance.value.signed.find(s => s.studentId === rec.studentId)) return
    activeAttendance.value.signed.push(rec)
  }
  function setAiPractice(data: { topic: string; prompt?: string; startedAt: string } | null) {
    aiPractice.value = data
  }

  function updateMembers(data: any) {
    const memberList = data.members || []
    const studentMembers = memberList.filter((m: any) => m.role === 'student')

    const existingMap = new Map(students.value.map(s => [s.id, s]))

    students.value = studentMembers.map((m: any, i: number) => {
      const existing = existingMap.get(m.userId)
      return {
        id: m.userId,
        name: m.userName,
        no: `2024${String(i + 1).padStart(4, '0')}`,
        state: existing?.state || 'online' as const,
        progress: existing?.progress || 0,
        handRaised: existing?.handRaised || false,
      }
    })
  }

  function onHandRaise(data: { studentId: string; studentName: string }) {
    const student = students.value.find(s => s.id === data.studentId)
    if (student) student.handRaised = true
  }

  function onHandLower(data: { studentId: string }) {
    const student = students.value.find(s => s.id === data.studentId)
    if (student) student.handRaised = false
  }

  function onAnswerSubmitted(data: any) {
    answerCount.value++
    const student = students.value.find(s => s.id === data.studentId)
    if (student) {
      student.state = 'submitted'
      student.progress = 100
    }
  }

  function addQuestion(q: QuestionItem) {
    questions.value.unshift(q)
  }

  function setStudentsWorking() {
    students.value.forEach(s => {
      if (s.state === 'online') {
        s.state = 'working'
        s.progress = 0
      }
    })
  }

  function resetStudentsToOnline() {
    students.value.forEach(s => {
      s.state = 'online'
      s.progress = 0
    })
    answerCount.value = 0
  }

  return {
    courseName,
    lessonTitle,
    isRecording,
    currentSlide,
    totalSlides,
    slides,
    students,
    onlineCount,
    totalCount,
    submittedCount,
    handRaisedList,
    questions,
    answerCount,
    activeCompete,
    activeAttendance,
    aiPractice,
    isLockedShared,
    updateMembers,
    onHandRaise,
    onHandLower,
    onAnswerSubmitted,
    addQuestion,
    setStudentsWorking,
    resetStudentsToOnline,
    setActiveCompete,
    addCompeteResponder,
    endActiveCompete,
    setActiveAttendance,
    endActiveAttendance,
    addAttendanceSigned,
    setAiPractice,
  }
})
