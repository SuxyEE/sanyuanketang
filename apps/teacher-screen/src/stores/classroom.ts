/* eslint-disable @typescript-eslint/no-unused-vars */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface StudentInfo {
  id: string
  name: string
  state: 'online' | 'working' | 'submitted' | 'offline'
  progress: number
  score?: number
}

export interface KnowledgePoint {
  name: string
  percent: number
  status: 'mastered' | 'practicing' | 'needs_improvement'
}

export interface AiMessage {
  role: 'user' | 'assistant'
  content: string
  time: string
}

export interface QuestionItem {
  studentId: string
  studentName: string
  text: string
  slideIndex: number
  time: string
}

export const useClassroomStore = defineStore('classroom', () => {
  const lessonTitle = ref('数字化设计与制造技术')
  const sectionTitle = ref('三维建模与逆向工程实训')
  const courseName = ref('【数字化设计与制造】：三维建模与逆向工程实训')
  const startTime = ref('14:30')
  const endTime = ref('15:15')
  const lessonDate = ref(new Date().toLocaleDateString('zh-CN'))
  const isLive = ref(true)
  const isConnected = ref(false)

  const totalStudents = ref(0)
  const onlineStudents = ref(0)

  const currentSlide = ref(1)
  const totalSlides = ref(0)
  const slides = ref<{ index: number; dataUrl: string }[]>([])

  const students = ref<StudentInfo[]>([])
  const handRaisedStudents = ref<{ studentId: string; studentName: string }[]>([])
  const questions = ref<QuestionItem[]>([])

  const activeQuiz = ref<any>(null)
  const answerStats = ref<{ submitted: number; total: number; accuracy: number }>({
    submitted: 0,
    total: 0,
    accuracy: 0,
  })

  const isLocked = ref(false)
  const groups = ref<any[]>([])
  const broadcastMsg = ref('')
  const showBroadcast = ref(false)
  const lessonEnded = ref(false)

  const compete = ref<{
    active: boolean
    question: string
    timeLimit: number
    startTime: number
    responders: { studentId: string; studentName: string; responseTime: number }[]
    result: { winner: any; ranking: any[] } | null
  } | null>(null)

  const aiPractice = ref<{ topic: string; prompt?: string; startedAt: string } | null>(null)
  const attendance = ref<{ active: boolean; mode: string; duration: number; startedAt: number; signed: { studentId: string; studentName: string; time: string }[] } | null>(null)

  const knowledgePoints = ref<KnowledgePoint[]>([
    { name: '三维建模基础原理', percent: 42, status: 'needs_improvement' },
    { name: '逆向工程扫描技术', percent: 88, status: 'mastered' },
    { name: '曲面重构方法', percent: 65, status: 'practicing' },
    { name: 'CAD/CAM数据转换', percent: 75, status: 'practicing' },
  ])

  const aiMessages = ref<AiMessage[]>([
    {
      role: 'assistant',
      content: 'AI课堂助手已就绪，正在监控课堂状态...',
      time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
    },
  ])

  const aiSuggestion = ref({
    content: '等待课堂开始后生成教学建议...',
    action: '',
  })

  const submittedCount = computed(() => students.value.filter((s) => s.state === 'submitted').length)
  const workingCount = computed(() => students.value.filter((s) => s.state === 'working').length)

  function updateMembers(data: any) {
    const memberList = data.members || []
    const studentMembers = memberList.filter((m: any) => m.role === 'student')

    students.value = studentMembers.map((m: any) => ({
      id: m.userId,
      name: m.userName,
      state: 'online' as const,
      progress: 0,
    }))

    onlineStudents.value = data.studentCount || studentMembers.length
    totalStudents.value = Math.max(totalStudents.value, onlineStudents.value)
  }

  function addHandRaise(data: { studentId: string; studentName: string }) {
    if (!handRaisedStudents.value.find(s => s.studentId === data.studentId)) {
      handRaisedStudents.value.push(data)
    }
  }

  function removeHandRaise(studentId: string) {
    handRaisedStudents.value = handRaisedStudents.value.filter(s => s.studentId !== studentId)
  }

  function addQuestion(q: QuestionItem) {
    questions.value.unshift(q)
  }

  function onAnswerSubmitted(data: any) {
    answerStats.value.submitted++
    const student = students.value.find(s => s.id === data.studentId)
    if (student) {
      student.state = 'submitted'
      student.progress = 100
    }
  }

  function startCompete(data: { question: string; timeLimit: number; startTime: number; responders?: { studentId: string; studentName: string; responseTime: number }[] }) {
    compete.value = {
      active: true,
      question: data.question,
      timeLimit: data.timeLimit,
      startTime: data.startTime || Date.now(),
      responders: Array.isArray(data.responders) ? [...data.responders] : [],
      result: null,
    }
  }

  function addCompeteResponder(data: { studentId: string; studentName: string; responseTime?: number }) {
    if (!compete.value?.active) return
    if (compete.value.responders.find(r => r.studentId === data.studentId)) return
    const responseTime = typeof data.responseTime === 'number'
      ? data.responseTime
      : Math.max(0, Date.now() - compete.value.startTime)
    compete.value.responders.push({
      studentId: data.studentId,
      studentName: data.studentName,
      responseTime,
    })
    compete.value.responders.sort((a, b) => a.responseTime - b.responseTime)
  }

  function stopCompete(result: { winner: any; ranking: any[] } | null) {
    if (compete.value) {
      compete.value.active = false
      compete.value.result = result
      const cur = compete.value
      setTimeout(() => {
        if (compete.value === cur && !compete.value.active) compete.value = null
      }, 6000)
    }
  }

  function setAiPractice(data: { topic: string; prompt?: string; startedAt: string } | null) {
    aiPractice.value = data
  }

  function startAttendance(data: { mode: string; duration: number }) {
    attendance.value = {
      active: true,
      mode: data.mode,
      duration: data.duration,
      startedAt: Date.now(),
      signed: [],
    }
  }

  function addAttendanceSigned(data: { studentId: string; studentName: string; time: string }) {
    if (!attendance.value) return
    if (attendance.value.signed.find(s => s.studentId === data.studentId)) return
    attendance.value.signed.push(data)
  }

  function endAttendance() {
    if (attendance.value) {
      attendance.value.active = false
      const cur = attendance.value
      setTimeout(() => { if (attendance.value === cur && !attendance.value.active) attendance.value = null }, 4000)
    }
  }

  return {
    lessonTitle,
    sectionTitle,
    courseName,
    startTime,
    endTime,
    lessonDate,
    isLive,
    isConnected,
    totalStudents,
    onlineStudents,
    currentSlide,
    totalSlides,
    slides,
    students,
    handRaisedStudents,
    questions,
    activeQuiz,
    answerStats,
    isLocked,
    groups,
    broadcastMsg,
    showBroadcast,
    lessonEnded,
    knowledgePoints,
    aiMessages,
    aiSuggestion,
    submittedCount,
    workingCount,
    compete,
    aiPractice,
    attendance,
    updateMembers,
    addHandRaise,
    removeHandRaise,
    addQuestion,
    onAnswerSubmitted,
    startCompete,
    addCompeteResponder,
    stopCompete,
    setAiPractice,
    startAttendance,
    addAttendanceSigned,
    endAttendance,
  }
})
