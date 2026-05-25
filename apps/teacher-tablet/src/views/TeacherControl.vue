<template>
  <div class="teacher-control">
    <QuizCreator
      v-if="activePanel === 'quiz'"
      @close="activePanel = ''"
      @push="handleQuizPush"
    />
    <GroupCreator
      v-if="activePanel === 'discuss'"
      @close="activePanel = ''"
      @start="handleGroupStart"
    />
    <RollCall
      v-if="activePanel === 'rollcall'"
      @close="activePanel = ''"
      @focus="handleFocus"
    />
    <AttendancePanel
      v-if="activePanel === 'attendance'"
      @close="activePanel = ''"
    />
    <LessonRecord
      v-if="activePanel === 'report'"
      @close="activePanel = ''"
    />
    <HomeworkPanel
      v-if="activePanel === 'paper'"
      @close="activePanel = ''"
    />
    <BroadcastDialog
      v-if="activePanel === 'broadcast'"
      @close="activePanel = ''"
      @send="handleBroadcast"
    />
    <CompetePanel
      v-if="activePanel === 'compete'"
      @close="activePanel = ''"
    />
    <AiPracticePanel
      v-if="activePanel === 'ai'"
      @close="activePanel = ''"
      @start="handleAiPractice"
    />
    <CoursewareUpload
      v-if="activePanel === 'courseware'"
      @close="activePanel = ''"
      @publish="handleSlidesPublish"
    />
    <AiSettings
      v-if="activePanel === 'ai-settings'"
      @close="activePanel = ''"
    />
    <AiWhiteboardPanel
      v-if="activePanel === 'ai-whiteboard'"
      @close="activePanel = ''"
    />
    <QuizReport
      v-if="quizReport"
      :report="quizReport"
      @close="quizReport = null"
    />

    <header class="lesson-header">
      <div class="header-info">
        <h2 class="course-name">{{ store.courseName }}</h2>
        <p class="lesson-title">{{ store.lessonTitle }}</p>
      </div>
      <div class="header-stats">
        <button
          v-if="store.handRaisedList.length > 0"
          class="hand-alert-btn"
          @click="scrollToHandList"
          :aria-label="`${store.handRaisedList.length}名学生举手`"
        >
          <span class="hand-alert-icon" v-html="icons.hand" aria-hidden="true"></span>
          <span class="hand-alert-text">{{ store.handRaisedList.length }} 人举手</span>
        </button>
        <button class="attendance-btn" @click="activePanel = 'attendance'" aria-label="签到">
          <span v-html="icons.userCheck" aria-hidden="true"></span>
          签到
        </button>
        <button
          class="attendance-btn ai-settings-btn"
          @click="activePanel = 'ai-settings'"
          aria-label="AI 设置"
          :title="aiSettings.configured ? `当前模型：${aiSettings.model || '服务端默认'}` : 'AI 设置（点击配置模型与 API Key）'"
        >
          <span v-html="icons.zap" aria-hidden="true"></span>
          AI
          <span v-if="aiSettings.configured" class="ai-dot" aria-hidden="true"></span>
        </button>
        <span class="online-badge" :class="{ disconnected: !connected }">
          <span class="dot" :class="connected ? 'green' : 'red'"></span>
          {{ connected ? `${store.onlineCount}/${store.totalCount} 在线` : '未连接' }}
        </span>
        <span class="record-badge" v-if="store.isRecording">
          <span class="dot red"></span>
          录制中
        </span>
      </div>
    </header>

    <div class="scroll-content">
      <section class="slide-control card">
        <div class="slide-nav" v-if="store.slides.length > 0">
          <button class="nav-btn" @click="prevSlide" :disabled="store.currentSlide <= 1">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <div class="slide-info">
            <span class="slide-current">{{ store.currentSlide }}</span>
            <span class="slide-sep">/</span>
            <span class="slide-total">{{ store.totalSlides }}</span>
            <span class="slide-label">页</span>
          </div>
          <button class="nav-btn" @click="nextSlide" :disabled="store.currentSlide >= store.totalSlides">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>
        <div class="slide-preview">
          <div v-if="store.slides.length > 0 && store.slides[store.currentSlide - 1]" class="preview-image">
            <transition name="slide-fade" mode="out-in">
              <img :key="store.currentSlide" :src="store.slides[store.currentSlide - 1].dataUrl" alt="当前课件" />
            </transition>
          </div>
          <div v-else class="preview-placeholder" @click="activePanel = 'courseware'">
            <div class="preview-content">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.5">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              <span class="preview-text">点击导入课件</span>
              <span class="preview-slide">支持 PDF / 图片</span>
            </div>
          </div>
        </div>
        <div v-if="store.slides.length > 0" class="slide-thumbs">
          <div
            v-for="(s, idx) in store.slides"
            :key="idx"
            class="thumb"
            :class="{ active: store.currentSlide === idx + 1 }"
            @click="gotoSlide(idx + 1)"
          >
            <img :src="s.dataUrl" alt="" />
          </div>
        </div>
        <div class="slide-mode-toggle">
          <button class="mode-btn active">同步模式</button>
          <button class="mode-btn">自由浏览</button>
        </div>
      </section>

      <section class="activity-grid" role="toolbar" aria-label="课堂活动">
        <button
          v-for="item in activities"
          :key="item.key"
          class="activity-card"
          :class="{ active: activeActivity === item.key }"
          :aria-label="item.label"
          :aria-pressed="activeActivity === item.key"
          :style="activeActivity === item.key ? { borderColor: item.color, background: item.bg } : {}"
          @click="selectActivity(item.key)"
        >
          <span
            class="activity-icon"
            v-html="item.icon"
            aria-hidden="true"
            :style="{ color: item.color }"
          ></span>
          <span class="activity-name">{{ item.label }}</span>
        </button>
      </section>

      <section v-if="store.questions.length > 0" class="questions-section card">
        <div class="section-header">
          <h3>学生提问</h3>
          <span class="monitor-badge online">{{ store.questions.length }} 条</span>
        </div>
        <div class="question-list">
          <div v-for="q in store.questions.slice(0, 5)" :key="q.time" class="question-item">
            <div class="q-header">
              <span class="q-name">{{ q.studentName }}</span>
              <span class="q-slide">P{{ q.slideIndex }}</span>
            </div>
            <p class="q-text">{{ q.text }}</p>
          </div>
        </div>
      </section>

      <section class="monitor-section card">
        <div class="section-header">
          <h3>学情监控</h3>
          <div class="monitor-badges">
            <span class="monitor-badge online">{{ store.onlineCount }} 在线</span>
            <span class="monitor-badge submitted">{{ store.submittedCount }} 已提交</span>
          </div>
        </div>

        <div v-if="store.handRaisedList.length > 0" class="hand-raised">
          <div class="hand-title">举手列表</div>
          <div class="hand-list">
            <div v-for="s in store.handRaisedList" :key="s.id" class="hand-item">
              <span class="hand-icon" v-html="icons.hand" aria-hidden="true"></span>
              <span>{{ s.name }}</span>
            </div>
          </div>
        </div>

        <div v-if="store.students.length === 0" class="empty-hint">
          等待学生加入课堂...
        </div>
        <div class="student-list" v-else>
          <div
            v-for="s in store.students.slice(0, 20)"
            :key="s.id"
            class="student-row"
          >
            <span class="stu-name">{{ s.name }}</span>
            <div class="stu-progress-track">
              <div
                class="stu-progress-fill"
                :class="s.state"
                :style="{ width: `${s.progress}%` }"
              ></div>
            </div>
            <span class="stu-percent" :class="s.state">{{ s.progress }}%</span>
          </div>
        </div>
      </section>
    </div>

    <footer class="control-bar" role="toolbar" aria-label="课堂管控">
      <button class="ctrl-btn" :class="{ active: isLocked }" @click="toggleLock" aria-label="锁屏">
        <span class="ctrl-icon" v-html="icons.lock" aria-hidden="true"></span>
        <span>{{ isLocked ? '解锁' : '锁屏' }}</span>
      </button>
      <button class="ctrl-btn" aria-label="广播" @click="activePanel = 'broadcast'">
        <span class="ctrl-icon" v-html="icons.megaphone" aria-hidden="true"></span>
        <span>广播</span>
      </button>
      <button class="ctrl-btn" aria-label="点名" @click="activePanel = 'rollcall'">
        <span class="ctrl-icon" v-html="icons.userCheck" aria-hidden="true"></span>
        <span>点名</span>
      </button>
      <button class="ctrl-btn danger" aria-label="下课" @click="showEndConfirm = true">
        <span class="ctrl-icon" v-html="icons.logOut" aria-hidden="true"></span>
        <span>下课</span>
      </button>

      <transition name="fade">
        <div v-if="showEndConfirm" class="end-confirm-overlay" @click.self="showEndConfirm = false">
          <div class="end-confirm-card">
            <h3>确认下课？</h3>
            <p>所有学生端将收到下课通知</p>
            <div class="confirm-actions">
              <button class="cancel-btn" @click="showEndConfirm = false">取消</button>
              <button class="confirm-btn" @click="endLesson">确认下课</button>
            </div>
          </div>
        </div>
      </transition>
    </footer>

    <transition name="quiz-status-fade">
      <div v-if="activeQuizStatus" class="quiz-status-bar">
        <div class="qs-left">
          <span class="qs-dot" :class="{ grading: activeQuizStatus.grading }"></span>
          <span class="qs-text">
            <strong v-if="activeQuizStatus.grading">AI 批改中…</strong>
            <strong v-else>测验进行中</strong>
            <span class="qs-sub">{{ activeQuizStatus.submitted }} / {{ Math.max(activeQuizStatus.total, activeQuizStatus.submitted) }} 提交</span>
          </span>
        </div>
        <div class="qs-bar"><div class="qs-fill" :style="{ width: progressPct + '%' }"></div></div>
        <button class="qs-end-btn" @click="endQuizManually" :disabled="activeQuizStatus.grading">结束并出报告</button>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useClassroomStore } from '../stores/classroom'
import { useSocket } from '../composables/useSocket'
import { useToast } from '../composables/useToast'
import { icons } from '@snyuan/shared'
import QuizCreator from '../components/QuizCreator.vue'
import GroupCreator from '../components/GroupCreator.vue'
import RollCall from '../components/RollCall.vue'
import AttendancePanel from '../components/AttendancePanel.vue'
import LessonRecord from '../components/LessonRecord.vue'
import HomeworkPanel from '../components/HomeworkPanel.vue'
import BroadcastDialog from '../components/BroadcastDialog.vue'
import CompetePanel from '../components/CompetePanel.vue'
import AiPracticePanel from '../components/AiPracticePanel.vue'
import CoursewareUpload from '../components/CoursewareUpload.vue'
import QuizReport from '../components/QuizReport.vue'
import AiSettings from '../components/AiSettings.vue'
import AiWhiteboardPanel from '../components/AiWhiteboardPanel.vue'
import { useAiSettings } from '../composables/useAiSettings'

const store = useClassroomStore()
const { socket, connected, connect } = useSocket()
const { toastSuccess, toastInfo, toastWarning, toastError } = useToast()
const { settings: aiSettings, getRequestConfig: getAiConfig } = useAiSettings()
import { useRoute } from 'vue-router'

const route = useRoute()
const activeActivity = ref('')
const activePanel = ref('')
const lessonId = (route.query.roomCode as string) || 'demo-lesson-001'

if (route.query.courseName) {
  store.courseName = route.query.courseName as string
}
if (route.query.subject) {
  store.lessonTitle = route.query.subject as string
}

const ACTIVITY_FOR_EVENT: Record<string, string> = {
  quiz: 'quiz',
  compete: 'compete',
  attendance: 'attendance',
  ai: 'ai',
  paper: 'paper',
}

function syncActivityFromState(opts: { quiz?: boolean; compete?: boolean; attendance?: boolean; aiPractice?: boolean }) {
  if (opts.quiz) activeActivity.value = ACTIVITY_FOR_EVENT.quiz
  else if (opts.compete) activeActivity.value = ACTIVITY_FOR_EVENT.compete
  else if (opts.attendance) activeActivity.value = ACTIVITY_FOR_EVENT.attendance
  else if (opts.aiPractice) activeActivity.value = ACTIVITY_FOR_EVENT.ai
}

const socketHandlers = {
  onRoomJoined: (data: any) => {
    store.currentSlide = data.currentSlide || 1
    store.totalSlides = data.totalSlides || 0
    isLocked.value = data.isLocked || false
    store.isLockedShared = data.isLocked || false
    if (data.members) store.updateMembers(data)
    if (data.activeQuiz && data.activeQuiz.status === 'in_progress') {
      activeQuizStatus.value = {
        taskId: data.activeQuiz.taskId,
        submitted: data.activeQuiz.submittedCount || 0,
        total: data.activeQuiz.totalStudents || store.totalCount,
        grading: false,
      }
    } else {
      activeQuizStatus.value = null
    }
    if (data.activeCompete && data.activeCompete.active) {
      store.setActiveCompete({
        taskId: data.activeCompete.taskId,
        question: data.activeCompete.question,
        timeLimit: data.activeCompete.timeLimit,
        startTime: data.activeCompete.startTime,
        active: true,
        responders: Array.isArray(data.activeCompete.responders) ? [...data.activeCompete.responders] : [],
      })
    } else {
      store.setActiveCompete(null)
    }
    if (data.activeAttendance && data.activeAttendance.active) {
      store.setActiveAttendance({
        mode: data.activeAttendance.mode,
        duration: data.activeAttendance.duration,
        startedAt: data.activeAttendance.startedAt,
        active: true,
        signed: Array.isArray(data.activeAttendance.signed) ? [...data.activeAttendance.signed] : [],
      })
    } else {
      store.setActiveAttendance(null)
    }
    store.setAiPractice(data.aiPractice || null)
    syncActivityFromState({
      quiz: !!(data.activeQuiz && data.activeQuiz.status === 'in_progress'),
      compete: !!(data.activeCompete && data.activeCompete.active),
      attendance: !!(data.activeAttendance && data.activeAttendance.active),
      aiPractice: !!data.aiPractice,
    })
  },
  onMemberUpdate: (data: any) => {
    store.updateMembers(data)
  },
  onHandRaise: (data: { studentId: string; studentName: string }) => {
    store.onHandRaise(data)
    toastWarning(`${data.studentName} 举手了`, 4000)
  },
  onHandLower: (data: { studentId: string }) => {
    const student = store.students.find(s => s.id === data.studentId)
    store.onHandLower(data)
    if (student) toastInfo(`${student.name} 已放下手`, 2000)
  },
  onAnswerSubmitted: (data: any) => {
    store.onAnswerSubmitted(data)
  },
  onQuestionNew: (data: any) => {
    store.addQuestion({
      studentId: data.studentId,
      studentName: data.studentName,
      text: data.text,
      slideIndex: data.slideIndex,
      time: data.time,
    })
    const preview = (data.text || '').slice(0, 18) + ((data.text || '').length > 18 ? '…' : '')
    toastWarning(`${data.studentName} 提问：${preview}`, 4500)
  },
  onAttendanceSigned: (data: any) => {
    store.addAttendanceSigned({
      studentId: data.studentId,
      studentName: data.studentName,
      time: data.time,
    })
    const att = store.activeAttendance
    if (att) {
      toastInfo(`${data.studentName} 已签到（${att.signed.length}/${store.totalCount || att.signed.length}）`, 1800)
    } else {
      toastInfo(`${data.studentName} 已签到`, 1600)
    }
  },
  onCompeteAnswerToast: (data: { studentId: string; studentName: string; responseTime: number; rank: number }) => {
    const medal = data.rank === 1 ? '🥇' : data.rank === 2 ? '🥈' : data.rank === 3 ? '🥉' : `${data.rank}.`
    toastSuccess(`${medal} ${data.studentName} 抢答 (${data.responseTime} ms)`, 2400)
  },
  onRollCallEcho: (data: { studentId: string; studentName: string }) => {
    toastInfo(`点名：${data.studentName}`, 2400)
  },
  onSlidesLoaded: (data: { slides: any[]; total: number }) => {
    store.slides = data.slides
    store.totalSlides = data.total
  },
  onSlideGoto: (data: { index: number; total: number }) => {
    store.currentSlide = data.index
    store.totalSlides = data.total || store.totalSlides
  },
  onQuizProgress: (data: { taskId: string; submittedCount: number; totalStudents: number; latestStudent?: string }) => {
    const prevGrading = activeQuizStatus.value?.grading || false
    activeQuizStatus.value = {
      taskId: data.taskId,
      submitted: data.submittedCount,
      total: data.totalStudents,
      grading: prevGrading,
    }
    if (data.latestStudent && !prevGrading) {
      lastSubmittedName.value = data.latestStudent
      lastSubmittedCount.value = data.submittedCount
      lastSubmittedTotal.value = data.totalStudents
      bumpSubmitNotice()
    }
  },
  onQuizStart: (task: any) => {
    activeQuizStatus.value = {
      taskId: task.id || task.taskId || 'pending',
      submitted: 0,
      total: task.totalStudents || store.totalCount,
      grading: false,
    }
    store.setStudentsWorking()
    activeActivity.value = ACTIVITY_FOR_EVENT.quiz
  },
  onQuizGrading: () => {
    if (activeQuizStatus.value) activeQuizStatus.value.grading = true
    if (manualEndTimer) { clearTimeout(manualEndTimer); manualEndTimer = null }
    toastInfo('AI 正在批改简答题…')
  },
  onQuizReport: (report: any) => {
    activeQuizStatus.value = null
    quizReport.value = report
    store.resetStudentsToOnline()
    if (manualEndTimer) { clearTimeout(manualEndTimer); manualEndTimer = null }
    if (activeActivity.value === ACTIVITY_FOR_EVENT.quiz) activeActivity.value = ''
    toastSuccess(`测验报告已生成，平均 ${report.avgScore} 分`)
  },
  onQuizStop: () => {
    activeQuizStatus.value = null
    if (manualEndTimer) { clearTimeout(manualEndTimer); manualEndTimer = null }
    if (activeActivity.value === ACTIVITY_FOR_EVENT.quiz) activeActivity.value = ''
  },
  onQuizStartError: (data: { message: string }) => {
    activeQuizStatus.value = null
    toastError(data?.message || '测验开始失败')
  },
  onCompeteStart: (data: { question: string; timeLimit: number; startTime?: number; taskId?: string }) => {
    activeActivity.value = ACTIVITY_FOR_EVENT.compete
    store.setActiveCompete({
      taskId: data.taskId,
      question: data.question,
      timeLimit: data.timeLimit,
      startTime: data.startTime || Date.now(),
      active: true,
      responders: [],
    })
  },
  onCompeteAnswer: (data: { studentId: string; studentName: string; responseTime: number }) => {
    store.addCompeteResponder({
      studentId: data.studentId,
      studentName: data.studentName,
      responseTime: data.responseTime,
    })
  },
  onCompeteStop: (data: { winner?: any; ranking?: any[] }) => {
    if (activeActivity.value === ACTIVITY_FOR_EVENT.compete) activeActivity.value = ''
    store.endActiveCompete()
    if (Array.isArray(data?.ranking) && data.ranking.length > 0 && store.activeCompete) {
      store.activeCompete.responders = data.ranking.map((r: any) => ({
        studentId: r.studentId,
        studentName: r.studentName,
        responseTime: r.responseTime,
      }))
    }
  },
  onAttendanceStart: (data: { mode: string; duration: number; startedAt?: number }) => {
    activeActivity.value = ACTIVITY_FOR_EVENT.attendance
    store.setActiveAttendance({
      mode: data.mode,
      duration: data.duration,
      startedAt: data.startedAt || Date.now(),
      active: true,
      signed: [],
    })
  },
  onAttendanceEnd: () => {
    if (activeActivity.value === ACTIVITY_FOR_EVENT.attendance) activeActivity.value = ''
    store.endActiveAttendance()
  },
  onAttendanceStartError: (data: { message?: string }) => {
    toastError(data?.message || '签到开始失败')
  },
  onAiPracticeStart: (data: { topic: string; prompt?: string; startedAt?: string }) => {
    activeActivity.value = ACTIVITY_FOR_EVENT.ai
    store.setAiPractice({ topic: data.topic, prompt: data.prompt, startedAt: data.startedAt || new Date().toISOString() })
    toastInfo(`AI 实践已开启：${data.topic}`)
  },
  onHomeworkPublish: (hw: any) => {
    toastSuccess(`课后作业「${hw.title}」已下发`)
  },
  onScreenLockEvent: () => { isLocked.value = true; store.isLockedShared = true },
  onScreenUnlockEvent: () => { isLocked.value = false; store.isLockedShared = false },
  onGroupCreate: (groups: any[]) => {
    toastInfo(`分组已生成（${groups?.length || 0} 组）`)
  },
  onGroupDissolve: () => {
    toastInfo('分组讨论已结束')
  },
  onBroadcastMsg: (data: { message: string; from?: string }) => {
    const prefix = data?.from ? `[${data.from}] ` : ''
    toastInfo(`${prefix}${data?.message || ''}`)
  },
  onLessonEnd: () => {
    activeQuizStatus.value = null
    quizReport.value = null
    if (manualEndTimer) { clearTimeout(manualEndTimer); manualEndTimer = null }
    isLocked.value = false
    activeActivity.value = ''
    store.resetStudentsToOnline()
    store.handRaisedList.forEach(s => store.onHandLower({ studentId: s.id }))
    store.questions.splice(0)
    store.setActiveCompete(null)
    store.setActiveAttendance(null)
    store.setAiPractice(null)
    store.isLockedShared = false
  },
  onErrorPermission: (data: { message?: string }) => {
    toastError(data?.message || '没有权限执行此操作')
  },
}

let teacherSocket: ReturnType<typeof connect> | null = null
let manualEndTimer: ReturnType<typeof setTimeout> | null = null

onMounted(() => {
  const s = connect(lessonId, 'teacher-001', '教师')
  teacherSocket = s

  s.on('room:joined', socketHandlers.onRoomJoined)
  s.on('member:update', socketHandlers.onMemberUpdate)
  s.on('hand:raise', socketHandlers.onHandRaise)
  s.on('hand:lower', socketHandlers.onHandLower)
  s.on('answer:submitted', socketHandlers.onAnswerSubmitted)
  s.on('question:new', socketHandlers.onQuestionNew)
  s.on('attendance:signed', socketHandlers.onAttendanceSigned)
  s.on('attendance:start', socketHandlers.onAttendanceStart)
  s.on('attendance:end', socketHandlers.onAttendanceEnd)
  s.on('attendance:start:error', socketHandlers.onAttendanceStartError)
  s.on('slides:loaded', socketHandlers.onSlidesLoaded)
  s.on('slide:goto', socketHandlers.onSlideGoto)
  s.on('quiz:start', socketHandlers.onQuizStart)
  s.on('quiz:stop', socketHandlers.onQuizStop)
  s.on('quiz:progress', socketHandlers.onQuizProgress)
  s.on('quiz:grading', socketHandlers.onQuizGrading)
  s.on('quiz:report', socketHandlers.onQuizReport)
  s.on('quiz:start:error', socketHandlers.onQuizStartError)
  s.on('compete:start', socketHandlers.onCompeteStart)
  s.on('compete:stop', socketHandlers.onCompeteStop)
  s.on('compete:answer', socketHandlers.onCompeteAnswer)
  s.on('compete:answer', socketHandlers.onCompeteAnswerToast)
  s.on('roll:call', socketHandlers.onRollCallEcho)
  s.on('ai:practice:start', socketHandlers.onAiPracticeStart)
  s.on('homework:publish', socketHandlers.onHomeworkPublish)
  s.on('screen:lock', socketHandlers.onScreenLockEvent)
  s.on('screen:unlock', socketHandlers.onScreenUnlockEvent)
  s.on('group:create', socketHandlers.onGroupCreate)
  s.on('group:dissolve', socketHandlers.onGroupDissolve)
  s.on('broadcast:msg', socketHandlers.onBroadcastMsg)
  s.on('lesson:end', socketHandlers.onLessonEnd)
  s.on('error:permission', socketHandlers.onErrorPermission)
})

onUnmounted(() => {
  if (submitNoticeTimer) clearTimeout(submitNoticeTimer)
  if (manualEndTimer) clearTimeout(manualEndTimer)
  const s = teacherSocket
  if (s) {
    s.off('room:joined', socketHandlers.onRoomJoined)
    s.off('member:update', socketHandlers.onMemberUpdate)
    s.off('hand:raise', socketHandlers.onHandRaise)
    s.off('hand:lower', socketHandlers.onHandLower)
    s.off('answer:submitted', socketHandlers.onAnswerSubmitted)
    s.off('question:new', socketHandlers.onQuestionNew)
    s.off('attendance:signed', socketHandlers.onAttendanceSigned)
    s.off('attendance:start', socketHandlers.onAttendanceStart)
    s.off('attendance:end', socketHandlers.onAttendanceEnd)
    s.off('attendance:start:error', socketHandlers.onAttendanceStartError)
    s.off('slides:loaded', socketHandlers.onSlidesLoaded)
    s.off('slide:goto', socketHandlers.onSlideGoto)
    s.off('quiz:start', socketHandlers.onQuizStart)
    s.off('quiz:stop', socketHandlers.onQuizStop)
    s.off('quiz:progress', socketHandlers.onQuizProgress)
    s.off('quiz:grading', socketHandlers.onQuizGrading)
    s.off('quiz:report', socketHandlers.onQuizReport)
    s.off('quiz:start:error', socketHandlers.onQuizStartError)
    s.off('compete:start', socketHandlers.onCompeteStart)
    s.off('compete:stop', socketHandlers.onCompeteStop)
    s.off('compete:answer', socketHandlers.onCompeteAnswer)
    s.off('compete:answer', socketHandlers.onCompeteAnswerToast)
    s.off('roll:call', socketHandlers.onRollCallEcho)
    s.off('ai:practice:start', socketHandlers.onAiPracticeStart)
    s.off('homework:publish', socketHandlers.onHomeworkPublish)
    s.off('screen:lock', socketHandlers.onScreenLockEvent)
    s.off('screen:unlock', socketHandlers.onScreenUnlockEvent)
    s.off('group:create', socketHandlers.onGroupCreate)
    s.off('group:dissolve', socketHandlers.onGroupDissolve)
    s.off('broadcast:msg', socketHandlers.onBroadcastMsg)
    s.off('lesson:end', socketHandlers.onLessonEnd)
    s.off('error:permission', socketHandlers.onErrorPermission)
  }
})

const activities = [
  { key: 'knowledge', icon: icons.play, label: '知识讲解', color: '#1677ff', bg: '#e6f4ff' },
  { key: 'quiz', icon: icons.zap, label: '智能出题', color: '#faad14', bg: '#fffbe6' },
  { key: 'paper', icon: icons.clipboard, label: '智能组卷', color: '#722ed1', bg: '#f9f0ff' },
  { key: 'discuss', icon: icons.users, label: '分组讨论', color: '#52c41a', bg: '#f6ffed' },
  { key: 'case', icon: icons.search, label: '案例扩展', color: '#13c2c2', bg: '#e6fffb' },
  { key: 'ai', icon: icons.bot, label: 'AI实践', color: '#1677ff', bg: '#e6f4ff' },
  { key: 'ai-whiteboard', icon: icons.edit, label: 'AI板书', color: '#722ed1', bg: '#f9f0ff' },
  { key: 'report', icon: icons.barChart, label: '分析报告', color: '#eb2f96', bg: '#fff0f6' },
  { key: 'compete', icon: icons.trophy, label: '抢答', color: '#fa541c', bg: '#fff2e8' },
]

function prevSlide() {
  if (store.currentSlide > 1) {
    store.currentSlide--
    socket.value?.emit('slide:goto', { index: store.currentSlide, total: store.totalSlides })
  }
}

function nextSlide() {
  if (store.currentSlide < store.totalSlides) {
    store.currentSlide++
    socket.value?.emit('slide:goto', { index: store.currentSlide, total: store.totalSlides })
  }
}

const showEndConfirm = ref(false)
const quizReport = ref<any | null>(null)
const activeQuizStatus = ref<{ taskId: string; submitted: number; total: number; grading: boolean } | null>(null)

const progressPct = computed(() => {
  const st = activeQuizStatus.value
  if (!st) return 0
  const total = Math.max(st.total, st.submitted, 1)
  return Math.min(100, Math.round((st.submitted / total) * 100))
})

const lastSubmittedName = ref('')
const lastSubmittedCount = ref(0)
const lastSubmittedTotal = ref(0)
let submitNoticeTimer: ReturnType<typeof setTimeout> | null = null

function bumpSubmitNotice() {
  if (submitNoticeTimer) return
  submitNoticeTimer = setTimeout(() => {
    submitNoticeTimer = null
    if (lastSubmittedName.value) {
      toastInfo(`${lastSubmittedName.value} 已提交（${lastSubmittedCount.value}/${lastSubmittedTotal.value}）`)
    }
  }, 800)
}

function selectActivity(key: string) {
  activeActivity.value = activeActivity.value === key ? '' : key

  const panelActivities = ['quiz', 'discuss', 'report', 'paper', 'compete', 'ai']
  if (panelActivities.includes(key)) {
    activePanel.value = key
  } else if (key === 'ai-whiteboard') {
    activePanel.value = 'ai-whiteboard'
  } else if (key === 'knowledge') {
    socket.value?.emit('broadcast:msg', { message: '请注意听讲，教师正在进行知识讲解', type: 'text' })
    toastSuccess('已向所有学生端发送「知识讲解」提示')
  } else if (key === 'case') {
    socket.value?.emit('broadcast:msg', { message: '请查看当前课件，教师正在展示案例', type: 'text' })
    toastSuccess('已向所有学生端发送「案例扩展」提示')
  }
}

const isLocked = ref(false)

function toggleLock() {
  isLocked.value = !isLocked.value
  if (isLocked.value) {
    socket.value?.emit('screen:lock')
    toastWarning('已锁定所有学生屏幕')
  } else {
    socket.value?.emit('screen:unlock')
    toastSuccess('已解锁学生屏幕')
  }
}

function handleQuizPush(data: any) {
  socket.value?.emit('quiz:start', data)
  toastSuccess(`测验已下发：${data.questions?.length || 0} 题`)
  activeQuizStatus.value = {
    taskId: 'pending',
    submitted: 0,
    total: store.totalCount,
    grading: false,
  }
}

function endQuizManually() {
  if (!activeQuizStatus.value) return
  if (activeQuizStatus.value.grading) return
  activeQuizStatus.value.grading = true
  socket.value?.emit('quiz:complete')
  toastInfo('已结束测验，AI 批改中…')

  if (manualEndTimer) clearTimeout(manualEndTimer)
  manualEndTimer = setTimeout(() => {
    manualEndTimer = null
    if (activeQuizStatus.value?.grading && !quizReport.value) {
      activeQuizStatus.value = null
      toastError('生成报告超时，请稍后重试')
    }
  }, 45000)
}

function handleGroupStart(data: any) {
  socket.value?.emit('group:create', data)
  const count = (data && (data.groupCount || data.count)) || ''
  toastSuccess(`已发起分组讨论${count ? `（${count} 组）` : ''}`)
}

function handleFocus(payload: { studentId: string; studentName: string }) {
  socket.value?.emit('roll:call', { mode: 'manual', studentId: payload.studentId })
  toastInfo(`已点名 ${payload.studentName}`)
}

function handleBroadcast(message: string) {
  socket.value?.emit('broadcast:msg', { message, type: 'text' })
  toastSuccess('广播已发送到所有学生与大屏')
}

function gotoSlide(index: number) {
  store.currentSlide = index
  socket.value?.emit('slide:goto', { index: store.currentSlide, total: store.totalSlides })
}

function handleSlidesPublish(slides: any[]) {
  store.slides = slides
  store.totalSlides = slides.length
  store.currentSlide = 1
  socket.value?.emit('slides:upload', { slides })
}

function handleAiPractice(data: { topic: string; prompt: string }) {
  socket.value?.emit('ai:practice:start', {
    topic: data.topic,
    prompt: data.prompt,
  })
  socket.value?.emit('broadcast:msg', {
    message: `【AI实践任务】${data.topic}`,
    type: 'text',
  })
  toastSuccess(`AI 实践已开启：${data.topic}`)
}

function endLesson() {
  socket.value?.emit('lesson:end')
  socket.value?.emit('broadcast:msg', {
    message: '本节课已结束，感谢大家！',
    type: 'text',
  })
  showEndConfirm.value = false
  quizReport.value = null
  toastInfo('本节课已结束')
}

function scrollToHandList() {
  const handBlock = document.querySelector('.hand-raised') as HTMLElement | null
  if (handBlock) {
    handBlock.scrollIntoView({ behavior: 'smooth', block: 'center' })
    handBlock.animate?.(
      [
        { boxShadow: '0 0 0 0 rgba(250, 173, 20, 0)' },
        { boxShadow: '0 0 0 8px rgba(250, 173, 20, 0.35)' },
        { boxShadow: '0 0 0 0 rgba(250, 173, 20, 0)' },
      ],
      { duration: 900, iterations: 2 },
    )
  }
}
</script>

<style scoped lang="scss">
.teacher-control {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg-page);
}

.lesson-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: var(--bg-card);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.course-name {
  font-size: 17px;
  font-weight: 700;
  color: var(--text-primary);
}

.lesson-title {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 2px;
}

.header-stats {
  display: flex;
  gap: 12px;
  align-items: center;
}

.attendance-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 12px;
  border: 1px solid var(--primary);
  border-radius: 20px;
  background: var(--primary-light);
  color: var(--primary);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  min-height: 32px;
  transition: all 0.2s;
  position: relative;

  :deep(svg) { width: 14px; height: 14px; }
  &:active { background: rgba(22, 119, 255, 0.15); }

  &.ai-settings-btn {
    border-color: #722ed1;
    background: rgba(114, 46, 209, 0.08);
    color: #722ed1;
    .ai-dot {
      position: absolute;
      top: 4px;
      right: 4px;
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #52c41a;
      box-shadow: 0 0 0 2px #fff;
    }
  }
}

.hand-alert-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border: 1px solid #faad14;
  border-radius: 20px;
  background: #fff7e6;
  color: #ad6800;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  min-height: 32px;
  position: relative;
  animation: handPulse 1.4s ease-in-out infinite;

  :deep(svg) { width: 14px; height: 14px; }

  .hand-alert-icon { display: flex; animation: handWave 0.6s ease-in-out infinite alternate; }
  .hand-alert-text { letter-spacing: 0.5px; }

  &:active { background: #ffe7ba; transform: scale(0.97); }
}

@keyframes handPulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(250, 173, 20, 0.45); }
  60% { box-shadow: 0 0 0 6px rgba(250, 173, 20, 0); }
}

@keyframes handWave {
  from { transform: rotate(-15deg); }
  to { transform: rotate(15deg); }
}

.online-badge, .record-badge {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: var(--text-secondary);
  padding: 4px 10px;
  background: var(--bg-page);
  border-radius: 20px;

  &.disconnected {
    background: #fff1f0;
    color: var(--danger);
  }
}

.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;

  &.green { background: var(--success); }
  &.red { background: var(--danger); animation: blink 1.5s infinite; }
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

.scroll-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  -webkit-overflow-scrolling: touch;
  padding-bottom: 80px;
}

.card {
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  padding: 16px;
  box-shadow: var(--shadow-sm);
}

.slide-control {
  .slide-nav {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 24px;
    margin-bottom: 12px;
  }

  .nav-btn {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    border: 2px solid var(--border);
    background: var(--bg-card);
    color: var(--text-primary);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s;

    &:active {
      background: var(--primary-light);
      border-color: var(--primary);
      color: var(--primary);
      transform: scale(0.95);
    }
  }

  .slide-info {
    text-align: center;

    .slide-current {
      font-size: 28px;
      font-weight: 700;
      color: var(--primary);
    }

    .slide-sep, .slide-total {
      font-size: 16px;
      color: var(--text-muted);
    }

    .slide-label {
      font-size: 12px;
      color: var(--text-muted);
      margin-left: 4px;
    }
  }

  .slide-preview {
    .preview-placeholder {
      width: 100%;
      height: 140px;
      background: linear-gradient(135deg, #f8f9fc, #eef1f8);
      border-radius: var(--radius-md);
      display: flex;
      align-items: center;
      justify-content: center;
      border: 1px solid var(--border);
    }

    .preview-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
    }

    .preview-text {
      font-size: 14px;
      font-weight: 600;
      color: var(--text-primary);
    }

    .preview-slide {
      font-size: 12px;
      color: var(--primary);
      padding: 2px 10px;
      background: var(--primary-light);
      border-radius: 10px;
    }

    .preview-image {
      width: 100%;
      border-radius: var(--radius-md);
      overflow: hidden;
      border: 1px solid var(--border);

      img { width: 100%; display: block; }
    }
  }

  .slide-thumbs {
    display: flex;
    gap: 6px;
    overflow-x: auto;
    padding: 8px 0;
    -webkit-overflow-scrolling: touch;

    .thumb {
      flex-shrink: 0;
      width: 56px;
      height: 32px;
      border-radius: 4px;
      overflow: hidden;
      border: 2px solid var(--border);
      cursor: pointer;
      transition: all 0.2s;

      &.active { border-color: var(--primary); }
      img { width: 100%; height: 100%; object-fit: cover; }
    }
  }

  .slide-mode-toggle {
    display: flex;
    gap: 6px;
    margin-top: 10px;

    .mode-btn {
      flex: 1;
      padding: 8px;
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      background: transparent;
      font-size: 12px;
      color: var(--text-muted);
      cursor: pointer;
      min-height: 36px;
      transition: all 0.2s;

      &.active {
        background: var(--primary-light);
        border-color: var(--primary);
        color: var(--primary);
        font-weight: 600;
      }
    }
  }
}

.activity-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;

  @media (max-width: 480px) {
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }

  @media (min-width: 1024px) {
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
  }
}

.activity-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 16px 8px;
  background: var(--bg-card);
  border: 2px solid var(--border);
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: var(--shadow-sm);
  min-height: 80px;

  &:active {
    transform: scale(0.95);
    box-shadow: none;
  }

  &.active {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);

    .activity-name {
      font-weight: 600;
    }
  }

  .activity-icon {
    width: 40px;
    height: 40px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg-page);
    transition: background 0.2s;
    :deep(svg) { width: 22px; height: 22px; }
  }

  .activity-name {
    font-size: 12px;
    color: var(--text-primary);
    font-weight: 500;
    line-height: 1.3;
    text-align: center;
  }
}

.monitor-section {
  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;

    h3 {
      font-size: 15px;
      font-weight: 600;
      color: var(--text-primary);
    }

    .monitor-badges {
      display: flex;
      gap: 6px;
    }

    .monitor-badge {
      font-size: 11px;
      padding: 3px 10px;
      border-radius: 12px;
      font-weight: 500;

      &.online { background: #f6ffed; color: #52c41a; }
      &.submitted { background: #e6f4ff; color: #1677ff; }
    }
  }
}

.empty-hint {
  text-align: center;
  padding: 24px;
  color: var(--text-muted);
  font-size: 13px;
}

.questions-section {
  .question-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .question-item {
    padding: 10px;
    background: var(--bg-page);
    border-radius: var(--radius-md);

    .q-header {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 4px;
    }

    .q-name {
      font-size: 12px;
      font-weight: 600;
      color: var(--primary);
    }

    .q-slide {
      font-size: 10px;
      color: var(--text-muted);
      padding: 1px 6px;
      background: var(--bg-card);
      border-radius: 8px;
    }

    .q-text {
      font-size: 13px;
      color: var(--text-primary);
      line-height: 1.5;
    }
  }
}

.hand-raised {
  margin-bottom: 12px;
  padding: 10px;
  background: #fff7e6;
  border-radius: var(--radius-md);
  border: 1px solid #ffe58f;

  .hand-title {
    font-size: 12px;
    color: var(--warning);
    font-weight: 600;
    margin-bottom: 8px;
  }

  .hand-list {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .hand-item {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    background: #fff;
    border-radius: 16px;
    font-size: 12px;
    color: var(--text-primary);
    border: 1px solid #ffe58f;

    .hand-icon {
      display: flex;
      :deep(svg) { width: 14px; height: 14px; }
    }
  }
}

.student-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.student-row {
  display: flex;
  align-items: center;
  gap: 10px;

  .stu-name {
    width: 60px;
    font-size: 12px;
    color: var(--text-primary);
    flex-shrink: 0;
  }

  .stu-progress-track {
    flex: 1;
    height: 8px;
    background: var(--bg-page);
    border-radius: 4px;
    overflow: hidden;
  }

  .stu-progress-fill {
    height: 100%;
    border-radius: 4px;
    transition: width 0.6s ease;

    &.submitted { background: linear-gradient(90deg, var(--success), #73d13d); }
    &.working { background: linear-gradient(90deg, var(--warning), #ffc53d); }
    &.online { background: var(--border); }
  }

  .stu-percent {
    width: 36px;
    text-align: right;
    font-size: 11px;
    font-weight: 600;

    &.submitted { color: var(--success); }
    &.working { color: var(--warning); }
    &.online { color: var(--text-muted); }
  }
}

.control-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  gap: 10px;
  padding: 12px 16px;
  padding-bottom: calc(12px + var(--safe-bottom));
  background: var(--bg-card);
  border-top: 1px solid var(--border);
  box-shadow: 0 -4px 16px rgba(0, 0, 0, 0.06);
}

.ctrl-btn {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--bg-card);
  cursor: pointer;
  transition: all 0.2s;
  min-height: 52px;

  &:active {
    background: var(--primary-light);
    transform: scale(0.97);
  }

  &.active {
    border-color: var(--primary);
    background: var(--primary-light);
    .ctrl-icon { color: var(--primary); }
    span { color: var(--primary); }
  }

  &.danger {
    border-color: rgba(255, 77, 79, 0.3);
    color: var(--danger);

    &:active {
      background: #fff1f0;
    }

    span { color: var(--danger); }
  }

  .ctrl-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    :deep(svg) { width: 20px; height: 20px; }
  }
  span {
    font-size: 11px;
    color: var(--text-secondary);
    font-weight: 500;
  }
}

.end-confirm-overlay {
  position: fixed; inset: 0; z-index: 200;
  background: rgba(0, 0, 0, 0.45);
  display: flex; align-items: center; justify-content: center;
}

.end-confirm-card {
  background: var(--bg-card); border-radius: 20px;
  padding: 32px; width: 280px; text-align: center;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.2);

  h3 { font-size: 18px; font-weight: 700; margin-bottom: 8px; }
  p { font-size: 13px; color: var(--text-muted); margin-bottom: 24px; }

  .confirm-actions { display: flex; gap: 10px; }

  .cancel-btn, .confirm-btn {
    flex: 1; padding: 12px; border-radius: 12px; font-size: 14px; font-weight: 600;
    cursor: pointer; min-height: 44px; transition: all 0.2s;
  }

  .cancel-btn {
    border: 1px solid var(--border); background: var(--bg-card); color: var(--text-primary);
  }

  .confirm-btn {
    border: none; background: var(--danger); color: #fff;
    &:active { transform: scale(0.97); }
  }
}

.quiz-status-bar {
  position: fixed;
  left: 50%;
  transform: translateX(-50%);
  bottom: calc(86px + var(--safe-bottom));
  z-index: 90;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  background: #fff;
  border: 1px solid rgba(22, 119, 255, 0.25);
  border-radius: 14px;
  box-shadow: 0 14px 30px -10px rgba(15, 23, 42, 0.2);
  min-width: 320px;
  max-width: calc(100vw - 32px);
}

.qs-left {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.qs-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #52c41a;
  box-shadow: 0 0 0 3px rgba(82, 196, 26, 0.25);
  animation: qs-pulse 1.4s ease-in-out infinite;
  &.grading { background: #1677ff; box-shadow: 0 0 0 3px rgba(22, 119, 255, 0.25); }
}

@keyframes qs-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(0.85); }
}

.qs-text {
  display: flex;
  flex-direction: column;
  font-size: 12px;
  line-height: 1.2;
  strong { font-size: 13px; color: var(--text-primary); font-weight: 700; }
  .qs-sub { color: var(--text-muted); }
}

.qs-bar {
  flex: 1;
  height: 6px;
  background: var(--bg-page);
  border-radius: 3px;
  overflow: hidden;
  min-width: 80px;
}

.qs-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--primary), #52c41a);
  border-radius: 3px;
  transition: width 0.4s ease;
}

.qs-end-btn {
  flex-shrink: 0;
  padding: 7px 12px;
  border: none;
  border-radius: 10px;
  background: var(--primary);
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  &:disabled { opacity: 0.55; cursor: not-allowed; }
}

.quiz-status-fade-enter-active, .quiz-status-fade-leave-active {
  transition: transform 0.25s ease, opacity 0.2s ease;
}
.quiz-status-fade-enter-from {
  transform: translateX(-50%) translateY(20px);
  opacity: 0;
}
.quiz-status-fade-leave-to {
  transform: translateX(-50%) translateY(8px);
  opacity: 0;
}

@media (max-width: 480px) {
  .lesson-header {
    padding: 10px 14px;
    .course-name { font-size: 15px; }
    .lesson-title { font-size: 11px; }
  }

  .scroll-content { padding: 10px; padding-bottom: 70px; gap: 10px; }

  .activity-card {
    padding: 12px 6px; min-height: 68px;
    .activity-icon { width: 32px; height: 32px; border-radius: 8px; :deep(svg) { width: 18px; height: 18px; } }
    .activity-name { font-size: 11px; }
  }

  .control-bar { padding: 8px 10px; gap: 6px; }
  .ctrl-btn { min-height: 46px; padding: 8px; span { font-size: 10px; } }
}

@media (min-width: 1024px) {
  .scroll-content { padding: 20px; gap: 16px; max-width: 800px; margin: 0 auto; }
  .slide-control .slide-preview .preview-placeholder { height: 180px; }
}

.fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

.slide-fade-enter-active { transition: all 0.25s ease-out; }
.slide-fade-leave-active { transition: all 0.15s ease-in; }
.slide-fade-enter-from { opacity: 0; }
.slide-fade-leave-to { opacity: 0; }
</style>
