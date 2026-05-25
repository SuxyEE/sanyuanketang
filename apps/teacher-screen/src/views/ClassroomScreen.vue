<template>
  <div class="classroom-screen">
    <transition name="picker-fade">
      <div v-if="showPicker" class="picker-overlay">
        <div class="picker-card">
          <h2>请选择课堂</h2>
          <p class="picker-sub">教师端进入课堂后，请在这里选择对应的课堂，或手动输入课堂入口码。</p>

          <div class="picker-quick">
            <button class="picker-btn refresh" @click="refreshRoomsList" :disabled="loadingRooms">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
              {{ loadingRooms ? '刷新中…' : '刷新课堂列表' }}
            </button>
          </div>

          <div v-if="activeRooms.length > 0" class="picker-rooms">
            <div
              v-for="r in activeRooms"
              :key="r.roomId"
              class="picker-room"
              @click="joinRoom(r.lessonId)"
            >
              <div class="picker-room-main">
                <span class="picker-room-code">{{ r.lessonId }}</span>
                <span class="picker-room-info">
                  {{ r.teacherName || '教师未上线' }} · {{ r.studentCount }} 学生
                  <span v-if="r.activeQuiz" class="picker-tag quiz">测验中</span>
                  <span v-if="r.activeCompete" class="picker-tag compete">抢答中</span>
                  <span v-if="r.activeAttendance" class="picker-tag att">签到中</span>
                  <span v-if="r.hasScreen" class="picker-tag screen">已接大屏</span>
                </span>
              </div>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
            </div>
          </div>
          <div v-else class="picker-empty">
            <p>暂未发现进行中的课堂</p>
            <p class="hint">请教师先在平板端选课进入课堂，然后回到这里刷新</p>
          </div>

          <div class="picker-manual">
            <span class="picker-or">或直接输入入口码</span>
            <div class="picker-input-row">
              <input
                v-model="manualRoomCode"
                placeholder="6位数字入口码 / lessonId"
                maxlength="40"
                @keyup.enter="joinManualRoom"
              />
              <button class="picker-join-btn" :disabled="!manualRoomCode.trim()" @click="joinManualRoom">进入</button>
            </div>
          </div>
        </div>
      </div>
    </transition>

    <header class="screen-header">
      <div class="header-left">
        <span class="course-badge">{{ store.courseName }}</span>
        <span class="slide-indicator" v-if="store.totalSlides > 0">
          {{ store.currentSlide }} / {{ store.totalSlides }}
        </span>
        <span class="room-code-chip" v-if="currentRoomLabel" @click="showPicker = true">
          课堂 {{ currentRoomLabel }}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
        </span>
      </div>
      <div class="header-right">
        <span class="time-display">{{ currentTime }}</span>
        <span class="conn-status" :class="{ online: store.isConnected }">
          <span class="conn-dot"></span>
          {{ store.isConnected ? `${store.onlineStudents} 人在线` : '未连接' }}
        </span>
      </div>
    </header>

    <main class="screen-main">
      <div class="display-area">
        <transition name="slide-fade" mode="out-in">
          <div v-if="store.lessonEnded" key="ended" class="end-screen">
            <svg width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="var(--accent-green)" stroke-width="1.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            <h1>本节课已结束</h1>
            <p>感谢大家的参与，请完成课后作业</p>
          </div>

          <div v-else-if="store.isLocked" key="locked" class="lock-screen">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="rgba(65,120,255,0.6)" stroke-width="1.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            <h2>屏幕已锁定</h2>
            <p>请注意听老师讲解</p>
          </div>

          <div v-else-if="store.activeQuiz" key="quiz" class="quiz-display">
            <div class="quiz-title-bar">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#faad14" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
              <h2>随堂测验进行中</h2>
            </div>
            <div class="quiz-stats-row">
              <div class="quiz-stat-item">
                <span class="stat-val">{{ store.answerStats.submitted }}</span>
                <span class="stat-label">已提交</span>
              </div>
              <div class="quiz-stat-divider"></div>
              <div class="quiz-stat-item">
                <span class="stat-val">{{ store.onlineStudents }}</span>
                <span class="stat-label">总人数</span>
              </div>
              <div class="quiz-stat-divider"></div>
              <div class="quiz-stat-item">
                <span class="stat-val">{{ store.onlineStudents > 0 ? Math.round(store.answerStats.submitted / store.onlineStudents * 100) : 0 }}%</span>
                <span class="stat-label">完成率</span>
              </div>
            </div>
            <div class="quiz-progress-wrap">
              <div class="quiz-progress-fill" :style="{ width: store.onlineStudents ? `${store.answerStats.submitted / store.onlineStudents * 100}%` : '0%' }"></div>
            </div>
          </div>

          <div v-else-if="store.compete" key="compete" class="compete-display">
            <div class="compete-title-bar">
              <span class="compete-badge">抢答 {{ store.compete.active ? '进行中' : '已结束' }}</span>
              <span v-if="store.compete.active" class="compete-countdown">剩余 {{ competeRemaining }} 秒</span>
            </div>
            <div class="compete-question">{{ store.compete.question }}</div>
            <div class="compete-body">
              <div class="compete-timer-ring">
                <svg viewBox="0 0 120 120" class="ring-svg">
                  <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="8" />
                  <circle
                    cx="60" cy="60" r="52" fill="none"
                    stroke="#fa541c" stroke-width="8" stroke-linecap="round"
                    :stroke-dasharray="competeCircumference"
                    :stroke-dashoffset="competeCircumference - competeProgress * competeCircumference"
                    transform="rotate(-90 60 60)"
                    style="transition: stroke-dashoffset 0.4s ease"
                  />
                </svg>
                <div class="ring-center">
                  <span class="ring-num">{{ store.compete.active ? competeRemaining : (store.compete.result?.winner ? '🏆' : '—') }}</span>
                  <span class="ring-label">{{ store.compete.active ? '秒' : (store.compete.result?.winner ? '揭晓' : '结束') }}</span>
                </div>
              </div>
              <div class="compete-ranking">
                <h3>抢答排行</h3>
                <div v-if="store.compete.responders.length === 0 && !store.compete.result" class="compete-waiting">
                  等待学生抢答…
                </div>
                <div
                  v-for="(r, i) in (store.compete.result?.ranking?.length ? store.compete.result.ranking : store.compete.responders).slice(0, 5)"
                  :key="r.studentId"
                  class="compete-rank-row"
                  :class="{ first: i === 0 }"
                >
                  <span class="rank-medal" :class="{ gold: i === 0, silver: i === 1, bronze: i === 2 }">{{ i + 1 }}</span>
                  <span class="rank-name">{{ r.studentName }}</span>
                  <span class="rank-time">{{ r.responseTime }} ms</span>
                </div>
              </div>
            </div>
          </div>

          <div v-else-if="store.attendance" key="attendance" class="attendance-display">
            <div class="attendance-title-bar">
              <span class="attendance-badge">{{ attendanceModeLabel }}</span>
              <span class="attendance-time" v-if="store.attendance.active">剩余 {{ attendanceRemaining }} 秒</span>
              <span class="attendance-time ended" v-else>签到已结束</span>
            </div>
            <div class="attendance-content">
              <div class="attendance-ring">
                <svg viewBox="0 0 160 160" class="att-ring-svg">
                  <circle cx="80" cy="80" r="70" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="10" />
                  <circle
                    cx="80" cy="80" r="70" fill="none"
                    stroke="#52c41a" stroke-width="10" stroke-linecap="round"
                    :stroke-dasharray="attendanceCircumference"
                    :stroke-dashoffset="attendanceCircumference - attendancePct * attendanceCircumference"
                    transform="rotate(-90 80 80)"
                    style="transition: stroke-dashoffset 0.4s ease"
                  />
                </svg>
                <div class="ring-center">
                  <span class="ring-num">{{ store.attendance.signed.length }}</span>
                  <span class="ring-label">/ {{ Math.max(store.onlineStudents, store.attendance.signed.length) }} 已签到</span>
                </div>
              </div>
              <div class="attendance-list">
                <h3>已签到 ({{ store.attendance.signed.length }})</h3>
                <div class="att-chips">
                  <span v-for="s in store.attendance.signed.slice(0, 24)" :key="s.studentId" class="att-chip">{{ s.studentName }}</span>
                  <span v-if="store.attendance.signed.length === 0" class="att-empty">等待学生签到…</span>
                </div>
              </div>
            </div>
          </div>

          <div v-else-if="store.aiPractice" key="aipractice" class="ai-practice-display">
            <div class="aip-header">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#52c41a" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/></svg>
              <h2>AI 实践进行中</h2>
            </div>
            <p class="aip-topic">{{ store.aiPractice.topic }}</p>
            <p class="aip-desc">{{ store.aiPractice.prompt || '学生已在各自学生端与 AI 对话学习中…' }}</p>
            <div class="aip-stats">
              <span>{{ store.onlineStudents }} 名学生正在与 AI 互动</span>
            </div>
          </div>

          <div v-else-if="store.slides.length > 0 && currentSlideData" key="slides" class="slide-display">
            <transition name="slide-crossfade" mode="out-in">
              <img :key="store.currentSlide" :src="currentSlideData.dataUrl" alt="课件" class="slide-image" />
            </transition>
            <div class="slide-page-label">{{ store.currentSlide }} / {{ store.totalSlides }}</div>
          </div>

          <div v-else key="waiting" class="waiting-screen">
            <div class="waiting-content">
              <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="rgba(65,120,255,0.5)" stroke-width="1.5">
                <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
              </svg>
              <h2>智慧课堂</h2>
              <p>等待教师开始上课...</p>
            </div>
          </div>
        </transition>
      </div>

      <aside class="side-info" v-if="!store.lessonEnded && !store.isLocked">
        <div v-if="store.handRaisedStudents.length > 0" class="info-card hand-raised">
          <div class="card-title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#faad14" stroke-width="2"><path d="M18 11V6a2 2 0 0 0-4 0v5"/><path d="M14 10V4a2 2 0 0 0-4 0v6"/><path d="M10 10.5V5a2 2 0 0 0-4 0v9"/><path d="M18 11a2 2 0 1 1 4 0v3a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/></svg>
            <span>举手 ({{ store.handRaisedStudents.length }})</span>
          </div>
          <div class="hand-tags">
            <span v-for="s in store.handRaisedStudents" :key="s.studentId" class="hand-tag">{{ s.studentName }}</span>
          </div>
        </div>

        <div v-if="store.questions.length > 0" class="info-card questions">
          <div class="card-title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-blue)" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            <span>学生提问</span>
          </div>
          <div class="question-list">
            <div v-for="q in store.questions.slice(0, 5)" :key="q.time" class="q-item">
              <span class="q-name">{{ q.studentName }}</span>
              <span class="q-text">{{ q.text }}</span>
            </div>
          </div>
        </div>

        <div v-if="store.groups.length > 0" class="info-card groups">
          <div class="card-title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-green)" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            <span>分组讨论</span>
          </div>
          <div class="group-list">
            <div v-for="g in store.groups" :key="g.id" class="group-item">
              <span class="g-name">{{ g.name }}</span>
              <span class="g-count">{{ g.members?.length || 0 }} 人</span>
            </div>
          </div>
        </div>
      </aside>
    </main>

    <transition name="banner-fade">
      <div v-if="store.showBroadcast" class="broadcast-banner">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>
        <span>{{ store.broadcastMsg }}</span>
      </div>
    </transition>

    <AiWhiteboard
      v-if="aiWhiteboard"
      :board="aiWhiteboard"
      @close="aiWhiteboard = null"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { useClassroomStore } from '../stores/classroom'
import { useSocket } from '../composables/useSocket'
import AiWhiteboard from '../components/AiWhiteboard.vue'

interface AiWhiteboardPayload {
  topic?: string
  title: string
  subtitle?: string
  items: any[]
  generatedAt?: string
}

const aiWhiteboard = ref<AiWhiteboardPayload | null>(null)

const route = useRoute()
const store = useClassroomStore()
const { socket, connected, connect } = useSocket()
const queryRoom = (route.query.room as string) || ''
const currentLessonId = ref(queryRoom)
const currentRoomLabel = computed(() => currentLessonId.value)
const showPicker = ref(!queryRoom)
const activeRooms = ref<Array<any>>([])
const loadingRooms = ref(false)
const manualRoomCode = ref('')
const currentTime = ref('')
let timeInterval: ReturnType<typeof setInterval>
let broadcastTimer: ReturnType<typeof setTimeout> | null = null
let screenSocket: ReturnType<typeof connect> | null = null
let roomsPollTimer: ReturnType<typeof setInterval> | null = null

function refreshRoomsList() {
  if (!screenSocket?.connected) return
  loadingRooms.value = true
  screenSocket.emit('rooms:list')
  setTimeout(() => { loadingRooms.value = false }, 600)
}

function joinRoom(lessonId: string) {
  manualRoomCode.value = ''
  currentLessonId.value = lessonId
  showPicker.value = false
  if (roomsPollTimer) { clearInterval(roomsPollTimer); roomsPollTimer = null }
  if (screenSocket?.connected) {
    screenSocket.emit('room:join', {
      lessonId,
      userId: 'screen-001',
      userName: '教室大屏',
      role: 'teacher',
      clientType: 'teacher-screen',
    })
  }
  const url = new URL(window.location.href)
  url.searchParams.set('room', lessonId)
  window.history.replaceState({}, '', url.toString())
}

function joinManualRoom() {
  const code = manualRoomCode.value.trim()
  if (!code) return
  joinRoom(code)
}

const competeCircumference = 2 * Math.PI * 52
const attendanceCircumference = 2 * Math.PI * 70

const tickClock = ref(Date.now())
let tickInterval: ReturnType<typeof setInterval>

const competeRemaining = computed(() => {
  void tickClock.value
  if (!store.compete || !store.compete.active) return 0
  const elapsed = Math.floor((Date.now() - store.compete.startTime) / 1000)
  return Math.max(0, store.compete.timeLimit - elapsed)
})

const competeProgress = computed(() => {
  if (!store.compete || !store.compete.active) return 0
  return Math.max(0, Math.min(1, competeRemaining.value / store.compete.timeLimit))
})

const attendanceRemaining = computed(() => {
  void tickClock.value
  if (!store.attendance || !store.attendance.active) return 0
  const elapsed = Math.floor((Date.now() - store.attendance.startedAt) / 1000)
  return Math.max(0, store.attendance.duration * 60 - elapsed)
})

const attendanceModeLabel = computed(() => {
  const m = store.attendance?.mode
  if (m === 'code') return '签到码模式'
  if (m === 'location') return '位置签到模式'
  return '普通签到模式'
})

const attendancePct = computed(() => {
  if (!store.attendance) return 0
  const denom = Math.max(store.onlineStudents, store.attendance.signed.length, 1)
  return Math.max(0, Math.min(1, store.attendance.signed.length / denom))
})

function updateTime() {
  currentTime.value = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

const currentSlideData = computed(() => {
  if (store.slides.length === 0) return null
  return store.slides[store.currentSlide - 1] || null
})

function showBroadcastBanner(msg: string, ttl = 5000) {
  store.broadcastMsg = msg
  store.showBroadcast = true
  if (broadcastTimer) clearTimeout(broadcastTimer)
  broadcastTimer = setTimeout(() => { store.showBroadcast = false; broadcastTimer = null }, ttl)
}

const handlers = {
  onConnect: () => { store.isConnected = true },
  onDisconnect: () => { store.isConnected = false },
  onRoomJoined: (data: any) => {
    store.currentSlide = data.currentSlide || 1
    store.totalSlides = data.totalSlides || 0
    store.isLocked = data.isLocked || false
    if (data.activeQuiz && data.activeQuiz.status === 'in_progress') {
      store.activeQuiz = data.activeQuiz
      store.answerStats = {
        submitted: data.activeQuiz.submittedCount || 0,
        total: data.activeQuiz.totalStudents || store.onlineStudents,
        accuracy: 0,
      }
    } else {
      store.activeQuiz = null
    }
    if (data.activeCompete && data.activeCompete.active) {
      store.startCompete({
        question: data.activeCompete.question,
        timeLimit: data.activeCompete.timeLimit,
        startTime: data.activeCompete.startTime,
        responders: data.activeCompete.responders || [],
      })
    } else {
      store.compete = null
    }
    if (data.activeAttendance && data.activeAttendance.active) {
      store.startAttendance({ mode: data.activeAttendance.mode, duration: data.activeAttendance.duration })
      if (store.attendance) store.attendance.startedAt = data.activeAttendance.startedAt
    }
    if (data.aiPractice) {
      store.setAiPractice(data.aiPractice)
    }
  },
  onSlideGoto: (data: { index: number; total: number }) => {
    store.currentSlide = data.index
    store.totalSlides = data.total
  },
  onSlidesLoaded: (data: { slides: any[]; total: number }) => {
    store.slides = data.slides
    store.totalSlides = data.total
    if (data.slides.length > 0 && (!store.currentSlide || store.currentSlide < 1)) {
      store.currentSlide = 1
    }
  },
  onMemberUpdate: (data: any) => { store.updateMembers(data) },
  onQuizStart: (task: any) => {
    store.activeQuiz = task
    store.answerStats = { submitted: 0, total: task.totalStudents || store.onlineStudents, accuracy: 0 }
    store.aiPractice = null
  },
  onQuizProgress: (data: { submittedCount: number; totalStudents: number }) => {
    if (store.activeQuiz) {
      store.answerStats.submitted = data.submittedCount
      store.answerStats.total = Math.max(data.totalStudents, store.answerStats.total)
    }
  },
  onQuizGrading: () => {
    if (store.activeQuiz) (store.activeQuiz as any).grading = true
  },
  onQuizReport: () => {
    store.activeQuiz = null
    showBroadcastBanner('测验已结束，老师正在查看报告', 3500)
  },
  onQuizStop: () => { store.activeQuiz = null },
  onAnswerSubmitted: (data: any) => { store.onAnswerSubmitted(data) },
  onHandRaise: (data: { studentId: string; studentName: string }) => { store.addHandRaise(data) },
  onHandLower: (data: { studentId: string }) => { store.removeHandRaise(data.studentId) },
  onScreenLock: () => { store.isLocked = true },
  onScreenUnlock: () => { store.isLocked = false },
  onGroupCreate: (groups: any[]) => { store.groups = groups },
  onGroupDissolve: () => { store.groups = [] },
  onBroadcastMsg: (data: { message: string; from?: string }) => {
    showBroadcastBanner((data.from ? `${data.from}：` : '') + data.message)
  },
  onRollCall: (data: { studentId: string; studentName: string }) => {
    showBroadcastBanner(`点名：${data.studentName}`)
  },
  onQuestionNew: (data: any) => {
    store.addQuestion({
      studentId: data.studentId,
      studentName: data.studentName,
      text: data.text,
      slideIndex: data.slideIndex,
      time: data.time,
    })
  },
  onAttendanceStart: (data: { mode: string; duration: number }) => {
    store.startAttendance({ mode: data.mode, duration: data.duration })
    showBroadcastBanner('签到已开始', 3000)
  },
  onAttendanceEnd: () => {
    store.endAttendance()
    showBroadcastBanner('签到已结束', 2000)
  },
  onAttendanceSigned: (data: { studentId: string; studentName: string; time: string }) => {
    store.addAttendanceSigned(data)
  },
  onAiPracticeStart: (data: { topic: string; prompt?: string; startedAt: string }) => {
    store.setAiPractice(data)
    showBroadcastBanner(`AI 实践已开启：${data.topic}`, 4500)
  },
  onAiWhiteboardShow: (data: AiWhiteboardPayload & { error?: string }) => {
    if (!data || !Array.isArray(data.items) || data.error) {
      showBroadcastBanner(data?.error || 'AI 板书下发失败', 4500)
      return
    }
    aiWhiteboard.value = data
    showBroadcastBanner(`AI 板书：${data.title}`, 3000)
  },
  onAiWhiteboardHide: () => {
    aiWhiteboard.value = null
  },
  onLessonEnd: () => {
    store.lessonEnded = true
    store.activeQuiz = null
    store.groups = []
    store.isLocked = false
    store.compete = null
    store.attendance = null
    store.aiPractice = null
  },
  onCompeteStart: (data: { question: string; timeLimit: number; startTime?: number }) => {
    store.startCompete({ question: data.question, timeLimit: data.timeLimit, startTime: data.startTime || Date.now() })
    store.aiPractice = null
  },
  onCompeteStop: (data: { winner: any; ranking: any[] }) => {
    store.stopCompete(data)
  },
  onCompeteAnswer: (data: { studentId: string; studentName: string; responseTime: number }) => {
    if (store.compete?.active) {
      store.addCompeteResponder(data)
    }
  },
  onHomeworkPublish: (hw: { title: string; questions: any[] }) => {
    showBroadcastBanner(`课后作业已下发：${hw.title}（${(hw.questions || []).length} 题）`, 5000)
  },
}

onMounted(() => {
  updateTime()
  timeInterval = setInterval(updateTime, 5000)

  const initialRoom = currentLessonId.value || '__picker__'
  const s = connect(initialRoom, 'screen-001', '教室大屏')
  screenSocket = s
  store.isConnected = s.connected

  s.on('rooms:list', (list: any[]) => {
    activeRooms.value = Array.isArray(list) ? list : []
    loadingRooms.value = false
  })

  if (showPicker.value) {
    const tryFetch = () => {
      if (s.connected) {
        refreshRoomsList()
      } else {
        setTimeout(tryFetch, 400)
      }
    }
    tryFetch()
    roomsPollTimer = setInterval(refreshRoomsList, 4000)
  }

  s.on('connect', handlers.onConnect)
  s.on('disconnect', handlers.onDisconnect)
  s.on('room:joined', handlers.onRoomJoined)
  s.on('slide:goto', handlers.onSlideGoto)
  s.on('slides:loaded', handlers.onSlidesLoaded)
  s.on('member:update', handlers.onMemberUpdate)
  s.on('quiz:start', handlers.onQuizStart)
  s.on('quiz:progress', handlers.onQuizProgress)
  s.on('quiz:grading', handlers.onQuizGrading)
  s.on('quiz:report', handlers.onQuizReport)
  s.on('quiz:stop', handlers.onQuizStop)
  s.on('answer:submitted', handlers.onAnswerSubmitted)
  s.on('hand:raise', handlers.onHandRaise)
  s.on('hand:lower', handlers.onHandLower)
  s.on('compete:answer', handlers.onCompeteAnswer)
  s.on('homework:publish', handlers.onHomeworkPublish)
  s.on('screen:lock', handlers.onScreenLock)
  s.on('screen:unlock', handlers.onScreenUnlock)
  s.on('group:create', handlers.onGroupCreate)
  s.on('group:dissolve', handlers.onGroupDissolve)
  s.on('broadcast:msg', handlers.onBroadcastMsg)
  s.on('roll:call', handlers.onRollCall)
  s.on('question:new', handlers.onQuestionNew)
  s.on('attendance:start', handlers.onAttendanceStart)
  s.on('attendance:end', handlers.onAttendanceEnd)
  s.on('attendance:signed', handlers.onAttendanceSigned)
  s.on('ai:practice:start', handlers.onAiPracticeStart)
  s.on('ai:whiteboard:show', handlers.onAiWhiteboardShow)
  s.on('ai:whiteboard:hide', handlers.onAiWhiteboardHide)
  s.on('compete:start', handlers.onCompeteStart)
  s.on('compete:stop', handlers.onCompeteStop)
  s.on('lesson:end', handlers.onLessonEnd)

  tickInterval = setInterval(() => { tickClock.value = Date.now() }, 1000)
})

onUnmounted(() => {
  clearInterval(timeInterval)
  if (broadcastTimer) { clearTimeout(broadcastTimer); broadcastTimer = null }
  const s = screenSocket
  if (s) {
    s.off('connect', handlers.onConnect)
    s.off('disconnect', handlers.onDisconnect)
    s.off('room:joined', handlers.onRoomJoined)
    s.off('slide:goto', handlers.onSlideGoto)
    s.off('slides:loaded', handlers.onSlidesLoaded)
    s.off('member:update', handlers.onMemberUpdate)
    s.off('quiz:start', handlers.onQuizStart)
    s.off('quiz:progress', handlers.onQuizProgress)
    s.off('quiz:grading', handlers.onQuizGrading)
    s.off('quiz:report', handlers.onQuizReport)
    s.off('quiz:stop', handlers.onQuizStop)
    s.off('answer:submitted', handlers.onAnswerSubmitted)
    s.off('hand:raise', handlers.onHandRaise)
    s.off('hand:lower', handlers.onHandLower)
    s.off('compete:answer', handlers.onCompeteAnswer)
    s.off('homework:publish', handlers.onHomeworkPublish)
    s.off('screen:lock', handlers.onScreenLock)
    s.off('screen:unlock', handlers.onScreenUnlock)
    s.off('group:create', handlers.onGroupCreate)
    s.off('group:dissolve', handlers.onGroupDissolve)
    s.off('broadcast:msg', handlers.onBroadcastMsg)
    s.off('roll:call', handlers.onRollCall)
    s.off('question:new', handlers.onQuestionNew)
    s.off('attendance:start', handlers.onAttendanceStart)
    s.off('attendance:end', handlers.onAttendanceEnd)
    s.off('attendance:signed', handlers.onAttendanceSigned)
    s.off('ai:practice:start', handlers.onAiPracticeStart)
    s.off('ai:whiteboard:show', handlers.onAiWhiteboardShow)
    s.off('ai:whiteboard:hide', handlers.onAiWhiteboardHide)
    s.off('compete:start', handlers.onCompeteStart)
    s.off('compete:stop', handlers.onCompeteStop)
    s.off('lesson:end', handlers.onLessonEnd)
  }
  if (tickInterval) clearInterval(tickInterval)
  if (roomsPollTimer) { clearInterval(roomsPollTimer); roomsPollTimer = null }
})
</script>

<style scoped lang="scss">
.classroom-screen {
  width: 100vw;
  height: 100vh;
  background: linear-gradient(135deg, #0a0e27 0%, #0d1135 50%, #111637 100%);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  color: #fff;
}

.screen-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 24px;
  background: rgba(8, 12, 32, 0.6);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  flex-shrink: 0;

  .header-left {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 16px;
  }
}

.course-badge {
  font-size: 14px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
}

.slide-indicator {
  padding: 3px 12px;
  background: rgba(65, 120, 255, 0.2);
  border: 1px solid rgba(65, 120, 255, 0.3);
  border-radius: 12px;
  font-size: 12px;
  color: rgba(65, 120, 255, 0.9);
  font-weight: 500;
}

.time-display {
  font-size: 16px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.7);
  font-variant-numeric: tabular-nums;
}

.conn-status {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: rgba(255, 77, 79, 0.8);
  padding: 4px 12px;
  background: rgba(255, 77, 79, 0.1);
  border-radius: 12px;

  .conn-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #ff4d4f;
  }

  &.online {
    color: rgba(82, 196, 26, 0.9);
    background: rgba(82, 196, 26, 0.1);
    .conn-dot { background: #52c41a; animation: pulse 1.5s infinite; }
  }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.screen-main {
  flex: 1;
  display: flex;
  overflow: hidden;
  padding: 16px;
  gap: 16px;
}

.display-area {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
}

.slide-display {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;

  .slide-image {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  }

  .slide-page-label {
    position: absolute;
    bottom: 12px;
    right: 16px;
    padding: 4px 14px;
    background: rgba(0, 0, 0, 0.6);
    color: rgba(255, 255, 255, 0.7);
    border-radius: 12px;
    font-size: 13px;
    font-weight: 500;
  }
}

.waiting-screen, .end-screen, .lock-screen {
  text-align: center;
  animation: fadeIn 0.5s ease;

  h1, h2 { font-size: 28px; font-weight: 600; margin: 20px 0 8px; color: rgba(255, 255, 255, 0.9); }
  p { font-size: 14px; color: rgba(255, 255, 255, 0.4); }
}

.lock-screen {
  h2 { font-size: 24px; }
}

.compete-display {
  width: 100%;
  max-width: 760px;
  animation: fadeIn 0.5s ease;
  display: flex;
  flex-direction: column;
  gap: 22px;

  .compete-title-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 18px;

    .compete-badge {
      padding: 6px 16px;
      background: rgba(250, 84, 28, 0.16);
      color: #ff7d4d;
      border-radius: 18px;
      font-size: 14px;
      font-weight: 700;
    }

    .compete-countdown {
      font-size: 18px;
      color: #ff9b6b;
      font-weight: 600;
    }
  }

  .compete-question {
    background: linear-gradient(135deg, rgba(250, 84, 28, 0.18), rgba(250, 84, 28, 0.08));
    border: 1px solid rgba(250, 84, 28, 0.32);
    border-radius: 18px;
    padding: 28px 32px;
    text-align: center;
    font-size: 28px;
    font-weight: 700;
    color: #fff;
    line-height: 1.5;
    box-shadow: 0 12px 30px -10px rgba(250, 84, 28, 0.35);
  }

  .compete-body {
    display: grid;
    grid-template-columns: 200px 1fr;
    gap: 28px;
    align-items: center;
  }

  .compete-timer-ring {
    position: relative;
    width: 200px;
    height: 200px;
    .ring-svg { width: 100%; height: 100%; }
    .ring-center {
      position: absolute; inset: 0; display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      .ring-num { font-size: 52px; font-weight: 700; color: #fff; line-height: 1; }
      .ring-label { font-size: 14px; color: rgba(255, 255, 255, 0.5); margin-top: 4px; }
    }
  }

  .compete-ranking {
    h3 {
      font-size: 16px;
      color: rgba(255, 255, 255, 0.85);
      margin: 0 0 12px;
      font-weight: 600;
    }
    .compete-waiting {
      color: rgba(255, 255, 255, 0.4);
      font-size: 14px;
      padding: 16px;
      text-align: center;
      background: rgba(255, 255, 255, 0.04);
      border-radius: 12px;
    }
    .compete-rank-row {
      display: grid;
      grid-template-columns: 36px 1fr 80px;
      gap: 10px;
      align-items: center;
      padding: 8px 14px;
      background: rgba(255, 255, 255, 0.05);
      border-radius: 10px;
      margin-bottom: 6px;
      transition: all 0.25s;
      &.first {
        background: linear-gradient(135deg, rgba(255, 214, 102, 0.16), rgba(250, 173, 20, 0.12));
        border: 1px solid rgba(255, 214, 102, 0.32);
      }
      .rank-medal {
        width: 30px; height: 30px; border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        font-size: 13px; font-weight: 700;
        background: rgba(255, 255, 255, 0.08); color: rgba(255, 255, 255, 0.55);
        &.gold { background: #ffd666; color: #874d00; }
        &.silver { background: #d9d9d9; color: #434343; }
        &.bronze { background: #ffbb96; color: #871400; }
      }
      .rank-name { font-size: 16px; color: rgba(255, 255, 255, 0.92); font-weight: 500; }
      .rank-time { font-size: 13px; color: rgba(255, 255, 255, 0.55); text-align: right; }
    }
  }
}

.attendance-display {
  width: 100%;
  max-width: 760px;
  animation: fadeIn 0.5s ease;
  display: flex;
  flex-direction: column;
  gap: 22px;

  .attendance-title-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;

    .attendance-badge {
      padding: 6px 16px;
      background: rgba(82, 196, 26, 0.16);
      color: #52c41a;
      border-radius: 18px;
      font-size: 14px;
      font-weight: 700;
    }

    .attendance-time {
      font-size: 16px;
      color: rgba(255, 255, 255, 0.7);
      &.ended { color: rgba(255, 255, 255, 0.4); }
    }
  }

  .attendance-content {
    display: grid;
    grid-template-columns: 200px 1fr;
    gap: 28px;
    align-items: center;
  }

  .attendance-ring {
    position: relative;
    width: 200px;
    height: 200px;
    .att-ring-svg { width: 100%; height: 100%; }
    .ring-center {
      position: absolute; inset: 0; display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      .ring-num { font-size: 56px; font-weight: 800; color: #52c41a; line-height: 1; }
      .ring-label { font-size: 13px; color: rgba(255, 255, 255, 0.55); margin-top: 4px; }
    }
  }

  .attendance-list {
    h3 {
      font-size: 16px;
      color: rgba(255, 255, 255, 0.85);
      margin: 0 0 12px;
      font-weight: 600;
    }
    .att-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      max-height: 220px;
      overflow-y: auto;
    }
    .att-chip {
      padding: 5px 12px;
      background: rgba(82, 196, 26, 0.16);
      border: 1px solid rgba(82, 196, 26, 0.32);
      border-radius: 14px;
      color: #b7eb8f;
      font-size: 13px;
    }
    .att-empty { color: rgba(255, 255, 255, 0.35); font-size: 13px; padding: 12px; }
  }
}

.ai-practice-display {
  width: 100%;
  max-width: 720px;
  animation: fadeIn 0.5s ease;
  text-align: center;
  padding: 40px 36px;
  background: linear-gradient(135deg, rgba(82, 196, 26, 0.12), rgba(22, 119, 255, 0.1));
  border: 1px solid rgba(82, 196, 26, 0.28);
  border-radius: 24px;
  box-shadow: 0 16px 40px -16px rgba(82, 196, 26, 0.35);

  .aip-header {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    margin-bottom: 12px;
    h2 { font-size: 22px; color: #b7eb8f; margin: 0; font-weight: 600; }
  }

  .aip-topic {
    font-size: 32px;
    font-weight: 800;
    color: #fff;
    margin: 4px 0 12px;
    line-height: 1.3;
  }

  .aip-desc {
    font-size: 15px;
    color: rgba(255, 255, 255, 0.65);
    margin: 0 0 22px;
    line-height: 1.6;
  }

  .aip-stats {
    display: inline-block;
    padding: 8px 20px;
    background: rgba(255, 255, 255, 0.06);
    border-radius: 18px;
    font-size: 14px;
    color: rgba(255, 255, 255, 0.7);
  }
}

.quiz-display {
  text-align: center;
  width: 100%;
  max-width: 500px;
  animation: fadeIn 0.5s ease;

  .quiz-title-bar {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    margin-bottom: 32px;

    h2 { font-size: 24px; font-weight: 600; color: #faad14; margin: 0; }
  }

  .quiz-stats-row {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 32px;
    margin-bottom: 24px;
  }

  .quiz-stat-item {
    display: flex;
    flex-direction: column;
    align-items: center;

    .stat-val { font-size: 48px; font-weight: 700; color: rgba(255, 255, 255, 0.95); }
    .stat-label { font-size: 13px; color: rgba(255, 255, 255, 0.4); margin-top: 4px; }
  }

  .quiz-stat-divider {
    width: 1px;
    height: 40px;
    background: rgba(255, 255, 255, 0.1);
  }

  .quiz-progress-wrap {
    height: 8px;
    background: rgba(255, 255, 255, 0.06);
    border-radius: 4px;
    overflow: hidden;

    .quiz-progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #faad14, #52c41a);
      border-radius: 4px;
      transition: width 0.5s ease;
    }
  }
}

.side-info {
  width: 260px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow-y: auto;

  &::-webkit-scrollbar { width: 3px; }
  &::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.1); border-radius: 3px; }
}

.info-card {
  background: rgba(15, 20, 48, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 14px;
  padding: 14px;

  .card-title {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    font-weight: 600;
    margin-bottom: 10px;
    color: rgba(255, 255, 255, 0.8);
  }

  &.hand-raised {
    border-color: rgba(250, 173, 20, 0.2);
    .card-title { color: #faad14; }
  }
}

.hand-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.hand-tag {
  padding: 3px 10px;
  background: rgba(250, 173, 20, 0.1);
  border: 1px solid rgba(250, 173, 20, 0.2);
  border-radius: 10px;
  color: #faad14;
  font-size: 11px;
}

.question-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.q-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 10px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 8px;

  .q-name { font-size: 11px; color: rgba(65, 120, 255, 0.8); font-weight: 600; }
  .q-text { font-size: 12px; color: rgba(255, 255, 255, 0.6); line-height: 1.4; }
}

.group-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.group-item {
  display: flex;
  justify-content: space-between;
  padding: 6px 10px;
  background: rgba(82, 196, 26, 0.06);
  border-radius: 8px;

  .g-name { font-size: 12px; color: rgba(82, 196, 26, 0.8); font-weight: 500; }
  .g-count { font-size: 11px; color: rgba(255, 255, 255, 0.4); }
}

.broadcast-banner {
  position: fixed;
  bottom: 32px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 32px;
  background: linear-gradient(135deg, rgba(22, 119, 255, 0.9), rgba(64, 150, 255, 0.9));
  color: #fff;
  border-radius: 24px;
  font-size: 16px;
  font-weight: 500;
  box-shadow: 0 8px 32px rgba(22, 119, 255, 0.4);
  z-index: 50;
}

.slide-fade-enter-active { transition: all 0.4s ease-out; }
.slide-fade-leave-active { transition: all 0.2s ease-in; }
.slide-fade-enter-from { opacity: 0; transform: scale(0.98); }
.slide-fade-leave-to { opacity: 0; }

.slide-crossfade-enter-active { transition: opacity 0.3s ease-out; }
.slide-crossfade-leave-active { transition: opacity 0.2s ease-in; }
.slide-crossfade-enter-from, .slide-crossfade-leave-to { opacity: 0; }

.banner-fade-enter-active { transition: all 0.3s ease-out; }
.banner-fade-leave-active { transition: all 0.3s ease-in; }
.banner-fade-enter-from { opacity: 0; transform: translateX(-50%) translateY(20px); }
.banner-fade-leave-to { opacity: 0; transform: translateX(-50%) translateY(20px); }

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@media (max-width: 1024px) {
  .screen-main { flex-direction: column; }
  .side-info { width: 100%; flex-direction: row; overflow-x: auto; flex-shrink: 0; }
  .info-card { min-width: 200px; flex-shrink: 0; }
  .waiting-screen, .end-screen, .lock-screen { h1, h2 { font-size: 22px; } }
}

@media (max-width: 768px) {
  .screen-header { padding: 8px 16px; }
  .course-badge { font-size: 12px; }
  .time-display { font-size: 14px; }
  .screen-main { padding: 8px; gap: 8px; }
  .side-info { display: none; }
  .quiz-display .quiz-stat-item .stat-val { font-size: 36px; }
}

@media (min-width: 1920px) {
  .screen-header { padding: 16px 32px; }
  .course-badge { font-size: 16px; }
  .side-info { width: 320px; }
}

.room-code-chip {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 4px 10px;
  background: rgba(82, 196, 26, 0.16);
  border: 1px solid rgba(82, 196, 26, 0.32);
  color: #b7eb8f;
  border-radius: 12px;
  font-size: 12px;
  cursor: pointer;
  transition: background 0.15s ease;
  &:hover { background: rgba(82, 196, 26, 0.24); }
}

.picker-overlay {
  position: fixed; inset: 0; z-index: 2000;
  background: radial-gradient(circle at 30% 20%, rgba(65, 120, 255, 0.18), transparent 60%), linear-gradient(135deg, #060a1f 0%, #0d1135 100%);
  display: flex; align-items: center; justify-content: center;
  padding: 40px;
}

.picker-card {
  width: 100%; max-width: 720px;
  background: rgba(15, 20, 48, 0.92);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 24px;
  padding: 36px 40px;
  box-shadow: 0 24px 80px -20px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.04) inset;
  color: rgba(255, 255, 255, 0.92);

  h2 { font-size: 28px; font-weight: 700; margin: 0 0 6px; letter-spacing: 1px; }
  .picker-sub { font-size: 14px; color: rgba(255, 255, 255, 0.55); margin: 0 0 18px; line-height: 1.6; }
}

.picker-quick { display: flex; justify-content: flex-end; margin-bottom: 12px; }

.picker-btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 8px 16px; border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: rgba(255, 255, 255, 0.04);
  color: rgba(255, 255, 255, 0.85);
  font-size: 13px; font-weight: 500; cursor: pointer;
  transition: all 0.15s ease;
  &:disabled { opacity: 0.5; cursor: not-allowed; }
  &:not(:disabled):hover { background: rgba(255, 255, 255, 0.08); border-color: rgba(255, 255, 255, 0.24); }
}

.picker-rooms {
  display: flex; flex-direction: column; gap: 10px;
  max-height: 320px; overflow-y: auto;
  padding-right: 6px;

  &::-webkit-scrollbar { width: 4px; }
  &::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.18); border-radius: 4px; }
}

.picker-room {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 20px;
  background: rgba(22, 119, 255, 0.08);
  border: 1px solid rgba(22, 119, 255, 0.22);
  border-radius: 14px;
  cursor: pointer;
  transition: all 0.15s ease;
  &:hover {
    background: rgba(22, 119, 255, 0.14);
    border-color: rgba(22, 119, 255, 0.36);
    transform: translateX(4px);
  }
}

.picker-room-main {
  display: flex; flex-direction: column; gap: 4px;
}

.picker-room-code {
  font-size: 22px; font-weight: 700; color: #fff; letter-spacing: 2px;
  font-family: 'Menlo', 'Consolas', monospace;
}

.picker-room-info {
  font-size: 13px; color: rgba(255, 255, 255, 0.65); display: flex; flex-wrap: wrap; align-items: center; gap: 6px;
}

.picker-tag {
  padding: 2px 8px; border-radius: 8px; font-size: 11px; font-weight: 600;
  &.quiz { background: rgba(250, 173, 20, 0.16); color: #ffd666; }
  &.compete { background: rgba(250, 84, 28, 0.16); color: #ff9b6b; }
  &.att { background: rgba(82, 196, 26, 0.16); color: #b7eb8f; }
  &.screen { background: rgba(114, 46, 209, 0.16); color: #d3adf7; }
}

.picker-empty {
  text-align: center;
  padding: 32px 16px;
  border: 1px dashed rgba(255, 255, 255, 0.12);
  border-radius: 14px;
  color: rgba(255, 255, 255, 0.45);
  margin-bottom: 18px;
  p { margin: 0; font-size: 14px; }
  .hint { margin-top: 4px; font-size: 12px; color: rgba(255, 255, 255, 0.32); }
}

.picker-manual {
  margin-top: 20px; padding-top: 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.picker-or {
  display: block; text-align: center;
  color: rgba(255, 255, 255, 0.45); font-size: 12px; margin-bottom: 10px;
}

.picker-input-row {
  display: flex; gap: 10px;

  input {
    flex: 1;
    padding: 12px 16px;
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.16);
    background: rgba(255, 255, 255, 0.04);
    color: #fff;
    font-size: 16px;
    font-family: 'Menlo', 'Consolas', monospace;
    letter-spacing: 2px;
    outline: none;
    &:focus { border-color: rgba(22, 119, 255, 0.7); background: rgba(22, 119, 255, 0.06); }
    &::placeholder { color: rgba(255, 255, 255, 0.32); letter-spacing: normal; font-family: inherit; font-size: 13px; }
  }
}

.picker-join-btn {
  padding: 12px 26px;
  border: none; border-radius: 12px;
  background: linear-gradient(135deg, #1677ff, #4096ff);
  color: #fff; font-size: 14px; font-weight: 600; cursor: pointer;
  transition: transform 0.12s ease, box-shadow 0.18s ease, opacity 0.18s ease;
  box-shadow: 0 6px 18px -6px rgba(22, 119, 255, 0.6);
  &:disabled { opacity: 0.45; cursor: not-allowed; box-shadow: none; }
  &:not(:disabled):active { transform: scale(0.97); }
}

.picker-fade-enter-active, .picker-fade-leave-active {
  transition: opacity 0.25s ease;
}
.picker-fade-enter-from, .picker-fade-leave-to {
  opacity: 0;
}
</style>
