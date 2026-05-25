<template>
  <div class="student-main">
    <transition name="toast">
      <div v-if="toastMsg" class="toast-notification" :class="toastType">
        <svg v-if="toastType === 'success'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
        <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <span>{{ toastMsg }}</span>
      </div>
    </transition>

    <div v-if="store.viewState === 'locked'" class="lock-overlay" role="alert" aria-live="assertive">
      <div class="lock-content">
        <div class="lock-icon" v-html="icons.lock" aria-hidden="true"></div>
        <h2>屏幕已锁定</h2>
        <p>请认真听老师讲课</p>
      </div>
    </div>

    <transition name="bcast-pop">
      <div v-if="store.showBroadcast" class="broadcast-overlay">
        <div class="broadcast-card">
          <div class="bcast-head">
            <span class="bcast-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
            </span>
            <span class="bcast-label">教师广播</span>
            <button class="bcast-close" @click="store.dismissBroadcast()" aria-label="关闭">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          <p class="bcast-body">{{ store.broadcastMessage }}</p>
          <p class="bcast-hint">点击右上角 × 关闭 · 历史消息可在「笔记」中查看</p>
        </div>
      </div>
    </transition>

    <transition name="fade">
      <div v-if="store.latestHomework" class="homework-overlay">
        <div class="homework-card">
          <div class="hw-icon">📘</div>
          <h3>{{ store.latestHomework.title }}</h3>
          <p class="hw-desc">{{ store.latestHomework.description || '老师刚刚发布了一份作业，请在截止时间前完成。' }}</p>
          <div class="hw-meta">
            <span class="hw-tag">{{ store.latestHomework.questions.length }} 题</span>
            <span class="hw-tag" v-if="store.latestHomework.deadline">截止：{{ formatDeadline(store.latestHomework.deadline) }}</span>
          </div>
          <div class="hw-questions" v-if="store.latestHomework.questions.length > 0">
            <div v-for="(q, i) in store.latestHomework.questions.slice(0, 3)" :key="i" class="hw-q">
              <span class="hw-q-num">{{ i + 1 }}.</span>
              <span class="hw-q-text">{{ q.content }}</span>
            </div>
            <p v-if="store.latestHomework.questions.length > 3" class="hw-more">还有 {{ store.latestHomework.questions.length - 3 }} 题…</p>
          </div>
          <button class="hw-close" @click="store.dismissLatestHomework()">我知道了</button>
        </div>
      </div>
    </transition>

    <transition name="fade">
      <div v-if="store.showRollCall && store.rolledStudent" class="rollcall-overlay">
        <div class="rollcall-card" :class="{ 'is-me': store.rolledStudent.studentId === store.studentId }">
          <h3>{{ store.rolledStudent.studentId === store.studentId ? '你被点到了！' : '点名' }}</h3>
          <p class="rolled-name">{{ store.rolledStudent.studentName }}</p>
          <button v-if="store.rolledStudent.studentId === store.studentId" class="respond-btn" @click="store.showRollCall = false">
            收到
          </button>
        </div>
      </div>
    </transition>

    <header class="lesson-header">
      <div class="header-left">
        <h2 class="course-name">{{ store.courseName }}</h2>
        <span class="slide-info">第 {{ store.currentSlide }}/{{ store.totalSlides }} 页</span>
      </div>
      <div class="header-right">
        <span class="conn-badge" :class="{ online: store.isOnline }">
          <span class="conn-dot"></span>
          {{ store.isOnline ? '已连接' : '未连接' }}
        </span>
        <span class="student-name">{{ store.studentName }}</span>
      </div>
    </header>

    <main class="main-area">
      <transition name="view-switch" mode="out-in">
      <div v-if="store.viewState === 'listening'" key="listening" class="slide-sync">
        <div v-if="store.slides.length > 0 && store.slides[store.currentSlide - 1]" class="slide-image-wrap">
          <transition name="slide-fade" mode="out-in">
          <img :key="store.currentSlide" :src="store.slides[store.currentSlide - 1].dataUrl" alt="课件" class="slide-image" />
          </transition>
          <div class="slide-page-badge">{{ store.currentSlide }} / {{ store.totalSlides }}</div>
        </div>
        <div v-else class="slide-placeholder">
          <div class="slide-content">
            <div class="slide-badge">第 {{ store.currentSlide }} / {{ store.totalSlides || '--' }} 页</div>
            <h3>{{ store.lessonTitle }}</h3>
            <p class="slide-desc">{{ store.totalSlides > 0 ? '课件加载中...' : '等待教师导入课件...' }}</p>
          </div>
        </div>
        <div class="sync-status">
          <span class="sync-dot"></span>
          <span>实时同步 · 跟随教师进度</span>
        </div>

        <button class="ask-float-btn" @click="showAskInput = !showAskInput" aria-label="向老师提问">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          提问
        </button>

        <transition name="slide-up">
          <div v-if="showAskInput" class="ask-input-bar">
            <input v-model="askText" placeholder="输入你想问老师的问题..." @keyup.enter="submitQuestion" />
            <button class="ask-send" @click="submitQuestion" :disabled="!askText.trim()" aria-label="发送提问">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            </button>
          </div>
        </transition>
      </div>

      <div v-else-if="store.viewState === 'quiz'" key="quiz" class="quiz-panel">
        <div class="quiz-header">
          <span class="quiz-tag">随堂测验</span>
          <span class="quiz-timer" v-if="quizCountdown > 0">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            {{ formatTime(quizCountdown) }}
          </span>
          <span class="quiz-progress">{{ store.currentQuestionIndex + 1 }}/{{ store.quizQuestions.length }}</span>
        </div>

        <div class="question-card" v-if="store.currentQuestion">
          <div class="question-row">
            <span class="q-type-badge" :class="store.currentQuestion.type">{{ qTypeLabel(store.currentQuestion.type) }}</span>
            <p class="question-text">{{ store.currentQuestion.content }}</p>
          </div>

          <div
            v-if="store.currentQuestion.type === 'single_choice' || store.currentQuestion.type === 'true_false'"
            class="options-list"
          >
            <button
              v-for="opt in resolveOptions(store.currentQuestion)"
              :key="opt.key"
              class="option-btn"
              :class="{ selected: store.selectedAnswers[store.currentQuestion.id] === opt.key }"
              @click="selectAnswer(store.currentQuestion.id, opt.key)"
            >
              <span class="option-key">{{ opt.displayKey || opt.key }}</span>
              <span class="option-text">{{ opt.content }}</span>
            </button>
          </div>

          <div
            v-else-if="store.currentQuestion.type === 'multiple_choice'"
            class="options-list"
          >
            <button
              v-for="opt in store.currentQuestion.options"
              :key="opt.key"
              class="option-btn"
              :class="{ selected: isMultiSelected(store.currentQuestion.id, opt.key) }"
              @click="toggleMultiAnswer(store.currentQuestion.id, opt.key)"
            >
              <span class="option-key">{{ opt.key }}</span>
              <span class="option-text">{{ opt.content }}</span>
            </button>
            <p class="multi-hint">多选题：点选多个选项，再次点击取消</p>
          </div>

          <div v-else-if="store.currentQuestion.type === 'short_answer'" class="short-answer">
            <textarea
              :value="store.selectedAnswers[store.currentQuestion.id] || ''"
              @input="(e: any) => store.selectedAnswers[store.currentQuestion.id] = e.target.value"
              placeholder="请输入你的答案，AI 会根据答案合理性自动批改并给出评分..."
              rows="6"
            ></textarea>
            <div class="short-hint">
              <span>{{ (store.selectedAnswers[store.currentQuestion.id] || '').length }} 字</span>
              <span>提交后由 AI 自动批改</span>
            </div>
          </div>

          <div class="quiz-actions">
            <button
              v-if="store.currentQuestionIndex > 0"
              class="quiz-nav-btn"
              @click="store.currentQuestionIndex--"
            >上一题</button>
            <button
              v-if="store.currentQuestionIndex < store.quizQuestions.length - 1"
              class="quiz-nav-btn next"
              :disabled="!hasCurrentAnswer"
              @click="store.currentQuestionIndex++"
            >下一题</button>
            <button
              v-if="store.currentQuestionIndex === store.quizQuestions.length - 1"
              class="submit-btn"
              :disabled="!canSubmitAll"
              @click="confirmSubmit"
            >
              提交全部答案（{{ answeredCount }}/{{ store.quizQuestions.length }}）
            </button>
          </div>
        </div>
      </div>

      <div v-else-if="store.viewState === 'ai_practice'" key="ai" class="ai-chat">
        <div class="chat-messages">
          <div
            v-for="(msg, idx) in store.aiMessages"
            :key="idx"
            class="chat-bubble"
            :class="msg.role"
          >
            <div class="bubble-avatar">{{ msg.role === 'user' ? '我' : 'AI' }}</div>
            <div class="bubble-body">
              <div v-if="msg.role === 'assistant'" class="bubble-md md-body" v-html="renderMarkdown(msg.content)"></div>
              <p v-else>{{ msg.content }}</p>
              <span class="bubble-time">{{ msg.time }}</span>
            </div>
          </div>
        </div>
        <div class="chat-input">
          <input v-model="chatInput" placeholder="输入你的问题..." @keyup.enter="sendMessage" />
          <button class="send-btn" @click="sendMessage">发送</button>
        </div>
      </div>

      <div v-else-if="store.viewState === 'discussion'" key="discussion" class="discussion-wrapper">
        <GroupDiscussionPanel
          v-if="store.groupData"
          :group-id="store.groupData.id"
          :topic="store.groupData.topic || '课堂讨论'"
          :members="store.groupData.members"
          :duration="10"
        />
        <div v-else class="no-group">
          <p>等待教师分组...</p>
        </div>
      </div>

      <div v-else-if="store.viewState === 'compete'" key="compete" class="compete-stage">
        <div class="compete-header">
          <span class="compete-badge">抢答中</span>
          <span class="compete-countdown" v-if="competeCountdown > 0">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            剩余 {{ competeCountdown }} 秒
          </span>
        </div>
        <div class="compete-question">
          <p>{{ store.competeQuestion }}</p>
        </div>
        <div v-if="!store.competeResult" class="compete-grab">
          <button
            class="compete-grab-btn"
            :class="{ pressed: hasGrabbed }"
            :disabled="hasGrabbed || competeCountdown <= 0"
            @click="grabCompete"
          >
            <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 11V6a2 2 0 0 0-4 0v5"/><path d="M14 10V4a2 2 0 0 0-4 0v6"/><path d="M10 10.5V5a2 2 0 0 0-4 0v9"/><path d="M18 11a2 2 0 1 1 4 0v3a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/></svg>
            <span>{{ hasGrabbed ? '已抢答' : '点我抢答' }}</span>
          </button>
          <p class="compete-tip">{{ hasGrabbed ? '已记录，等待老师揭晓结果' : '率先点击的同学有优先答题权' }}</p>
        </div>
        <div v-else class="compete-result">
          <div v-if="store.competeResult.winner" class="winner-card">
            <span class="trophy">🏆</span>
            <p class="winner-name">{{ store.competeResult.winner.studentName }}</p>
            <p class="winner-time">{{ store.competeResult.winner.responseTime }} ms</p>
            <p class="winner-tag">{{ store.competeResult.winner.studentId === store.studentId ? '恭喜你抢到首答！' : '由该同学先抢到首答' }}</p>
          </div>
          <p v-else class="no-winner">本轮无人抢答</p>
        </div>
      </div>
      </transition>
    </main>

    <SignInPopup
      :visible="store.showAttendance && !store.attendanceSigned"
      :course-name="store.courseName"
      @signed="handleSignIn"
      @close="store.showAttendance = false"
    />

    <AiChatDrawer
      :visible="showAiDrawer"
      :current-slide="store.currentSlide"
      :course-name="store.courseName"
      @close="showAiDrawer = false"
    />

    <AiInteractiveViewer
      v-if="aiInteractive"
      :scene="aiInteractive"
      @close="aiInteractive = null"
    />

    <NotesPanel
      ref="notesRef"
      :visible="showNotesPanel"
      :current-slide="store.currentSlide"
      :course-name="store.courseName"
      @close="showNotesPanel = false"
    />

    <footer class="toolbar" role="toolbar" aria-label="学生工具栏">
      <button
        class="tool-btn"
        :class="{ active: store.isHandRaised }"
        :aria-pressed="store.isHandRaised"
        aria-label="举手"
        @click="toggleHandRaise"
      >
        <span class="tool-icon" v-html="icons.hand" aria-hidden="true"></span>
        <span>{{ store.isHandRaised ? '放下' : '举手' }}</span>
      </button>
      <button class="tool-btn" :class="{ active: showNotesPanel }" aria-label="笔记" @click="showNotesPanel = !showNotesPanel">
        <span class="tool-icon" v-html="icons.edit" aria-hidden="true"></span>
        <span>笔记</span>
      </button>
      <button
        class="tool-btn ai-btn"
        @click="showAiDrawer = !showAiDrawer"
        :aria-pressed="showAiDrawer"
        aria-label="AI助手"
      >
        <span class="tool-icon" v-html="icons.bot" aria-hidden="true"></span>
        <span>AI助手</span>
      </button>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useStudentStore } from '../stores/student'
import { useSocket } from '../composables/useSocket'
import { useMarkdown } from '../composables/useMarkdown'
import { icons } from '@snyuan/shared'
import AiChatDrawer from '../components/AiChatDrawer.vue'
import GroupDiscussionPanel from '../components/GroupDiscussionPanel.vue'
import SignInPopup from '../components/SignInPopup.vue'
import NotesPanel from '../components/NotesPanel.vue'
import AiInteractiveViewer from '../components/AiInteractiveViewer.vue'

interface AiInteractiveScene {
  topic?: string
  title: string
  description: string
  html: string
  generatedAt?: string
}

const route = useRoute()
const router = useRouter()
const store = useStudentStore()
const { socket, connected, connect } = useSocket()
const { renderMarkdown } = useMarkdown()
const chatInput = ref('')
const showAiDrawer = ref(false)
const showNotesPanel = ref(false)
const showAskInput = ref(false)
const notesRef = ref<InstanceType<typeof NotesPanel> | null>(null)
const askText = ref('')
const toastMsg = ref('')
const aiInteractive = ref<AiInteractiveScene | null>(null)
const toastType = ref<'success' | 'info'>('success')
let toastTimer: ReturnType<typeof setTimeout> | null = null
const quizCountdown = ref(0)
const competeCountdown = ref(0)
let competeTimer: ReturnType<typeof setInterval> | null = null
const hasGrabbed = ref(false)

function showToast(msg: string, type: 'success' | 'info' = 'success') {
  if (toastTimer) clearTimeout(toastTimer)
  toastMsg.value = msg
  toastType.value = type
  toastTimer = setTimeout(() => { toastMsg.value = '' }, 2500)
}
let quizTimer: ReturnType<typeof setInterval> | null = null

const lessonId = (route.query.room as string) || 'demo-lesson-001'

const handlers = {
  onConnect: () => { store.isOnline = true },
  onDisconnect: () => { store.isOnline = false },
  onRoomJoined: (data: any) => {
    store.currentSlide = data.currentSlide || 1
    store.totalSlides = data.totalSlides || 0
    if (data.isLocked) store.lockScreen()
    if (data.activeQuiz && data.activeQuiz.status === 'in_progress') {
      store.setQuiz({
        ...data.activeQuiz,
        id: data.activeQuiz.taskId || data.activeQuiz.id,
      })
      const remaining = data.activeQuiz.remainingTime || data.activeQuiz.timeLimit || 300
      startQuizTimer(remaining)
    } else if (data.activeCompete && data.activeCompete.active) {
      store.startCompete({
        question: data.activeCompete.question,
        timeLimit: data.activeCompete.timeLimit,
        startTime: data.activeCompete.startTime,
      })
      hasGrabbed.value = !!data.activeCompete.hasGrabbed
      startCompeteTimer(data.activeCompete.timeLimit, data.activeCompete.startTime)
    } else if (data.aiPractice) {
      store.aiMessages.splice(0, store.aiMessages.length, {
        role: 'assistant',
        content: `## ${data.aiPractice.topic}\n\n${data.aiPractice.prompt || '欢迎进入 AI 实践，请输入你想探究的问题。'}`,
        time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
      })
      if (store.viewState !== 'locked' && store.viewState !== 'quiz') {
        store.previousViewState = store.viewState
        store.viewState = 'ai_practice'
      }
    }
    if (data.activeAttendance && data.activeAttendance.active) {
      store.attendanceMode = data.activeAttendance.mode
      if (data.activeAttendance.alreadySigned) {
        store.attendanceSigned = true
        store.showAttendance = false
      } else if (!store.attendanceSigned) {
        store.showAttendance = true
      }
    }
  },
  onSlideGoto: (data: { index: number; total: number }) => {
    store.currentSlide = data.index
    store.totalSlides = data.total
  },
  onQuizStart: (task: any) => {
    store.setQuiz(task)
    startQuizTimer(task.timeLimit || 300)
    const count = (task.questions || []).length
    showToast(`随堂测验开始（${count} 题）`, 'info')
  },
  onQuizStop: () => {
    store.endQuiz()
    stopQuizTimer()
  },
  onQuizGrading: () => {
    if (store.viewState === 'quiz') {
      submitAnswers({ silent: true })
    }
  },
  onQuizReport: () => {
    if (store.viewState === 'quiz') {
      store.endQuiz()
      stopQuizTimer()
      showToast('测验已结束，老师正在查看报告', 'info')
    }
  },
  onTaskPush: (task: any) => {
    if (task.type === 'quiz') {
      store.setQuiz(task)
      startQuizTimer(task.timeLimit || 300)
    }
  },
  onScreenLock: () => {
    store.lockScreen()
    showToast('屏幕已被教师锁定', 'info')
  },
  onScreenUnlock: () => {
    store.unlockScreen()
    showToast('屏幕已解锁', 'success')
  },
  onGroupCreate: (groups: any[]) => {
    if (store.viewState === 'quiz') {
      showToast('教师已分组，测验结束后将进入讨论', 'info')
      store.pendingGroups = { groups, studentId: store.studentId }
      return
    }
    store.setGroups(groups, store.studentId)
    const myGroup = groups.find(g => g.members.some((m: any) => m.id === store.studentId))
    if (myGroup) showToast(`已加入「${myGroup.name}」（${myGroup.members.length}人）`, 'info')
  },
  onGroupDissolve: () => {
    if (store.viewState === 'discussion') showToast('分组讨论已结束', 'info')
    store.dissolveGroups()
  },
  onAttendanceStart: (data: { mode: string; duration: number }) => {
    store.attendanceMode = data.mode
    store.showAttendance = true
    store.attendanceSigned = false
  },
  onAttendanceEnd: () => {
    store.showAttendance = false
  },
  onAiPracticeStart: (data: { topic: string; prompt?: string }) => {
    if (store.viewState === 'quiz') {
      showToast('AI 实践已开启，结束当前测验后可进入', 'info')
      return
    }
    store.aiMessages.splice(0, store.aiMessages.length, {
      role: 'assistant',
      content: `## ${data.topic}\n\n${data.prompt || '欢迎进入 AI 实践，请输入你想探究的问题。'}`,
      time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
    })
    store.viewState = 'ai_practice'
    showToast(`AI 实践已开启：${data.topic}`, 'info')
  },
  onAiInteractiveShow: (data: AiInteractiveScene & { error?: string }) => {
    if (!data || !data.html || data.error) {
      showToast(data?.error || 'AI 沙盘下发失败', 'info')
      return
    }
    aiInteractive.value = data
    showToast(`教师下发了 AI 沙盘：${data.title}`, 'info')
  },
  onBroadcastMsg: (data: { message: string; from?: string }) => {
    const prefix = data.from ? `${data.from}：` : ''
    store.showBroadcastMsg(prefix + data.message, data.from)
  },
  onRollCall: (data: { studentId: string; studentName: string }) => {
    store.rolledStudent = data
    store.showRollCall = true
    if (data.studentId !== store.studentId) {
      setTimeout(() => { store.showRollCall = false }, 5000)
    } else {
      showToast(`老师点了你的名！`, 'info')
    }
  },
  onSlidesLoaded: (data: { slides: any[]; total: number }) => {
    const isInitial = store.slides.length === 0
    store.slides = data.slides
    store.totalSlides = data.total
    if (isInitial && data.slides.length > 0) {
      showToast(`教师已导入 ${data.total} 页课件`, 'info')
    }
  },
  onMemberUpdate: (_data: any) => {
    /* no-op */
  },
  onLessonEnd: () => {
    store.endQuiz()
    stopQuizTimer()
    store.dissolveGroups()
    store.isHandRaised = false
    stopCompete()
    showToast('本节课已结束，正在前往课后页面', 'info')
    setTimeout(() => router.push('/after-class'), 800)
  },
  onCompeteStart: (data: { question: string; timeLimit: number; startTime: number }) => {
    store.startCompete(data)
    hasGrabbed.value = false
    startCompeteTimer(data.timeLimit, data.startTime)
  },
  onCompeteStop: (data: { winner: any; ranking: any[] }) => {
    stopCompete()
    store.stopCompete(data)
  },
  onHomeworkPublish: (hw: any) => {
    store.addHomework(hw)
    showToast(`收到新作业：${hw.title}`, 'info')
  },
}

let socketRef: ReturnType<typeof connect> | null = null

onMounted(() => {
  const s = connect(lessonId, store.studentId, store.studentName)
  socketRef = s
  store.isOnline = s.connected

  s.on('connect', handlers.onConnect)
  s.on('disconnect', handlers.onDisconnect)
  s.on('room:joined', handlers.onRoomJoined)
  s.on('slide:goto', handlers.onSlideGoto)
  s.on('quiz:start', handlers.onQuizStart)
  s.on('quiz:stop', handlers.onQuizStop)
  s.on('quiz:grading', handlers.onQuizGrading)
  s.on('quiz:report', handlers.onQuizReport)
  s.on('task:push', handlers.onTaskPush)
  s.on('screen:lock', handlers.onScreenLock)
  s.on('screen:unlock', handlers.onScreenUnlock)
  s.on('group:create', handlers.onGroupCreate)
  s.on('group:dissolve', handlers.onGroupDissolve)
  s.on('attendance:start', handlers.onAttendanceStart)
  s.on('attendance:end', handlers.onAttendanceEnd)
  s.on('ai:practice:start', handlers.onAiPracticeStart)
  s.on('ai:interactive:show', handlers.onAiInteractiveShow)
  s.on('broadcast:msg', handlers.onBroadcastMsg)
  s.on('roll:call', handlers.onRollCall)
  s.on('slides:loaded', handlers.onSlidesLoaded)
  s.on('member:update', handlers.onMemberUpdate)
  s.on('lesson:end', handlers.onLessonEnd)
  s.on('compete:start', handlers.onCompeteStart)
  s.on('compete:stop', handlers.onCompeteStop)
  s.on('homework:publish', handlers.onHomeworkPublish)
})

onUnmounted(() => {
  stopQuizTimer()
  const s = socketRef
  if (s) {
    s.off('connect', handlers.onConnect)
    s.off('disconnect', handlers.onDisconnect)
    s.off('room:joined', handlers.onRoomJoined)
    s.off('slide:goto', handlers.onSlideGoto)
    s.off('quiz:start', handlers.onQuizStart)
    s.off('quiz:stop', handlers.onQuizStop)
    s.off('quiz:grading', handlers.onQuizGrading)
    s.off('quiz:report', handlers.onQuizReport)
    s.off('task:push', handlers.onTaskPush)
    s.off('screen:lock', handlers.onScreenLock)
    s.off('screen:unlock', handlers.onScreenUnlock)
    s.off('group:create', handlers.onGroupCreate)
    s.off('group:dissolve', handlers.onGroupDissolve)
    s.off('attendance:start', handlers.onAttendanceStart)
    s.off('attendance:end', handlers.onAttendanceEnd)
    s.off('ai:practice:start', handlers.onAiPracticeStart)
    s.off('ai:interactive:show', handlers.onAiInteractiveShow)
    s.off('broadcast:msg', handlers.onBroadcastMsg)
    s.off('roll:call', handlers.onRollCall)
    s.off('slides:loaded', handlers.onSlidesLoaded)
    s.off('member:update', handlers.onMemberUpdate)
    s.off('lesson:end', handlers.onLessonEnd)
    s.off('compete:start', handlers.onCompeteStart)
    s.off('compete:stop', handlers.onCompeteStop)
    s.off('homework:publish', handlers.onHomeworkPublish)
  }
  if (aiPracticeTimeout) clearTimeout(aiPracticeTimeout)
  stopCompete()
})

function startQuizTimer(seconds: number) {
  stopQuizTimer()
  quizCountdown.value = seconds
  quizTimer = setInterval(() => {
    quizCountdown.value--
    if (quizCountdown.value <= 0) {
      stopQuizTimer()
      submitAnswers()
    }
  }, 1000)
}

function stopQuizTimer() {
  if (quizTimer) {
    clearInterval(quizTimer)
    quizTimer = null
  }
}

function startCompeteTimer(timeLimit: number, startTime?: number) {
  stopCompete()
  const baseStart = startTime || Date.now()
  const tick = () => {
    const elapsed = Math.floor((Date.now() - baseStart) / 1000)
    const remain = Math.max(0, timeLimit - elapsed)
    competeCountdown.value = remain
    if (remain <= 0) {
      if (competeTimer) { clearInterval(competeTimer); competeTimer = null }
    }
  }
  tick()
  competeTimer = setInterval(tick, 250)
}

function stopCompete() {
  if (competeTimer) {
    clearInterval(competeTimer)
    competeTimer = null
  }
  competeCountdown.value = 0
}

function grabCompete() {
  if (hasGrabbed.value) return
  hasGrabbed.value = true
  socket.value?.emit('compete:answer')
  showToast('已抢答，等待结果')
}

function formatDeadline(iso: string) {
  try {
    const d = new Date(iso)
    const now = new Date()
    const sameDay = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
    const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1)
    const isTomorrow = d.getFullYear() === tomorrow.getFullYear() && d.getMonth() === tomorrow.getMonth() && d.getDate() === tomorrow.getDate()
    const hh = String(d.getHours()).padStart(2, '0')
    const mm = String(d.getMinutes()).padStart(2, '0')
    if (sameDay) return `今天 ${hh}:${mm}`
    if (isTomorrow) return `明天 ${hh}:${mm}`
    return `${d.getMonth() + 1}/${d.getDate()} ${hh}:${mm}`
  } catch {
    return iso
  }
}

function formatTime(s: number) {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${String(sec).padStart(2, '0')}`
}

function submitQuestion() {
  if (!askText.value.trim()) return
  socket.value?.emit('question:ask', {
    text: askText.value,
    slideIndex: store.currentSlide,
  })
  askText.value = ''
  showAskInput.value = false
  showToast('提问已发送')
}

function selectAnswer(questionId: string, key: string) {
  store.selectedAnswers[questionId] = key
}

const answeredCount = computed(() => {
  return store.quizQuestions.filter(q => {
    const ans = store.selectedAnswers[q.id]
    return ans != null && String(ans).trim().length > 0
  }).length
})

const canSubmitAll = computed(() => answeredCount.value > 0)

const hasCurrentAnswer = computed(() => {
  const q = store.currentQuestion
  if (!q) return false
  const ans = store.selectedAnswers[q.id]
  return ans != null && String(ans).trim().length > 0
})

function confirmSubmit() {
  if (!canSubmitAll.value) return
  if (answeredCount.value < store.quizQuestions.length) {
    const remain = store.quizQuestions.length - answeredCount.value
    if (!confirm(`还有 ${remain} 题未作答，是否继续提交？`)) return
  }
  submitAnswers()
}

function resolveOptions(q: any) {
  if (q.type === 'true_false' && (!q.options || q.options.length === 0)) {
    return [
      { key: 'true', displayKey: '对', content: '对（正确）' },
      { key: 'false', displayKey: '错', content: '错（错误）' },
    ]
  }
  return q.options || []
}

function isMultiSelected(questionId: string, key: string) {
  const ans = store.selectedAnswers[questionId] || ''
  return ans.split(',').filter(Boolean).includes(key)
}

function toggleMultiAnswer(questionId: string, key: string) {
  const ans = store.selectedAnswers[questionId] || ''
  const list = ans.split(',').filter(Boolean)
  const idx = list.indexOf(key)
  if (idx === -1) list.push(key)
  else list.splice(idx, 1)
  store.selectedAnswers[questionId] = list.sort().join(',')
}

function qTypeLabel(type: string) {
  const map: Record<string, string> = {
    single_choice: '单选',
    multiple_choice: '多选',
    true_false: '判断',
    short_answer: '简答',
  }
  return map[type] || '题目'
}

function submitAnswers(opts: { silent?: boolean } = {}) {
  if (store.viewState !== 'quiz') return
  socket.value?.emit('answer:submit', {
    taskId: store.activeTaskId,
    studentId: store.studentId,
    answers: store.selectedAnswers,
  })
  if (!opts.silent) showToast('答案已提交')
  store.endQuiz()
  stopQuizTimer()
}

function toggleHandRaise() {
  store.isHandRaised = !store.isHandRaised
  if (store.isHandRaised) {
    socket.value?.emit('hand:raise')
  } else {
    socket.value?.emit('hand:lower')
  }
}

function handleSignIn() {
  socket.value?.emit('attendance:sign')
  store.attendanceSigned = true
  store.showAttendance = false
  showToast('签到成功')
}

const AI_PRACTICE_SOURCE = 'student-ai-practice'
let aiPracticeTimeout: ReturnType<typeof setTimeout> | null = null

function sendMessage() {
  if (!chatInput.value.trim()) return
  const timeStr = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  store.aiMessages.push({ role: 'user', content: chatInput.value, time: timeStr })
  const q = chatInput.value
  chatInput.value = ''

  const s = socket.value
  if (s?.connected) {
    s.emit('ai:chat', {
      message: q,
      courseContext: store.courseName,
      slideIndex: store.currentSlide,
      source: AI_PRACTICE_SOURCE,
    })

    const handler = (data: { content: string; sources?: string[]; source?: string }) => {
      if (data.source && data.source !== AI_PRACTICE_SOURCE) return
      store.aiMessages.push({
        role: 'assistant',
        content: data.content,
        time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
      })
      s.off('ai:response', handler)
      if (aiPracticeTimeout) { clearTimeout(aiPracticeTimeout); aiPracticeTimeout = null }
    }
    s.on('ai:response', handler)

    if (aiPracticeTimeout) clearTimeout(aiPracticeTimeout)
    aiPracticeTimeout = setTimeout(() => {
      s.off('ai:response', handler)
      aiPracticeTimeout = null
      store.aiMessages.push({
        role: 'assistant',
        content: `抱歉，AI 暂未响应，请稍后重试。`,
        time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
      })
    }, 20000)
  } else {
    setTimeout(() => {
      store.aiMessages.push({
        role: 'assistant',
        content: `关于"${q}"，建议结合课件内容深入理解。如有疑问请向老师提问。`,
        time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
      })
    }, 800)
  }
}
</script>

<style scoped lang="scss">
.student-main {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg-page);
  position: relative;
}

.lock-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: linear-gradient(135deg, #0a0e27 0%, #111637 50%, #0d1135 100%);
  display: flex;
  align-items: center;
  justify-content: center;

  &::before {
    content: '';
    position: absolute;
    width: 300px;
    height: 300px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(65, 120, 255, 0.08), transparent 70%);
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
  }

  .lock-content {
    text-align: center;
    color: #fff;
    position: relative;
    z-index: 1;

    .lock-icon {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      background: rgba(65, 120, 255, 0.1);
      border: 2px solid rgba(65, 120, 255, 0.2);
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 24px;
      animation: lockPulse 3s ease infinite;
      :deep(svg) { width: 36px; height: 36px; stroke: rgba(65, 120, 255, 0.8); }
    }
    h2 { font-size: 22px; margin-bottom: 8px; font-weight: 600; letter-spacing: 2px; }
    p { color: rgba(255, 255, 255, 0.4); font-size: 14px; }
  }
}

@keyframes lockPulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(65, 120, 255, 0.15); }
  50% { box-shadow: 0 0 0 20px rgba(65, 120, 255, 0); }
}

.broadcast-overlay {
  position: fixed;
  top: 70px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 900;
  width: calc(100% - 24px);
  max-width: 520px;

  .broadcast-card {
    padding: 16px 18px 14px;
    background: linear-gradient(135deg, #1677ff 0%, #4096ff 100%);
    color: #fff;
    border-radius: 18px;
    box-shadow: 0 18px 40px -10px rgba(22, 119, 255, 0.55), 0 0 0 3px rgba(22, 119, 255, 0.15);
    animation: bcastPulse 2.4s ease-in-out infinite;
  }

  .bcast-head {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
  }

  .bcast-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.2);
    animation: bcastIconShake 1s ease-in-out infinite;
  }

  .bcast-label {
    flex: 1;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 1px;
    text-transform: uppercase;
  }

  .bcast-close {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    border: none;
    background: rgba(255, 255, 255, 0.15);
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: background 0.15s ease, transform 0.12s ease;
    &:hover { background: rgba(255, 255, 255, 0.28); }
    &:active { transform: scale(0.92); }
  }

  .bcast-body {
    font-size: 17px;
    font-weight: 600;
    line-height: 1.55;
    margin: 0 0 6px;
    color: #fff;
    word-break: break-word;
  }

  .bcast-hint {
    font-size: 11px;
    margin: 0;
    color: rgba(255, 255, 255, 0.7);
  }
}

@keyframes bcastPulse {
  0%, 100% { box-shadow: 0 18px 40px -10px rgba(22, 119, 255, 0.55), 0 0 0 3px rgba(22, 119, 255, 0.15); }
  50% { box-shadow: 0 18px 40px -10px rgba(22, 119, 255, 0.55), 0 0 0 8px rgba(22, 119, 255, 0.05); }
}

@keyframes bcastIconShake {
  0%, 100% { transform: rotate(0); }
  20% { transform: rotate(-12deg); }
  40% { transform: rotate(12deg); }
  60% { transform: rotate(-8deg); }
  80% { transform: rotate(8deg); }
}

.bcast-pop-enter-active { transition: all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1); }
.bcast-pop-leave-active { transition: all 0.2s ease; }
.bcast-pop-enter-from { opacity: 0; transform: translateX(-50%) translateY(-30px) scale(0.9); }
.bcast-pop-leave-to { opacity: 0; transform: translateX(-50%) translateY(-10px); }

.homework-overlay {
  position: fixed;
  inset: 0;
  z-index: 940;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;

  .homework-card {
    max-width: 360px;
    width: 100%;
    background: #fff;
    border-radius: 18px;
    padding: 24px 22px;
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.2);
    text-align: center;

    .hw-icon { font-size: 36px; margin-bottom: 4px; }
    h3 { font-size: 18px; font-weight: 700; color: var(--text-primary); margin-bottom: 6px; }
    .hw-desc { font-size: 13px; color: var(--text-secondary); line-height: 1.55; margin-bottom: 12px; }
    .hw-meta {
      display: flex; justify-content: center; gap: 8px; margin-bottom: 14px; flex-wrap: wrap;
      .hw-tag {
        padding: 3px 10px; background: var(--primary-light); color: var(--primary);
        border-radius: 12px; font-size: 11px; font-weight: 500;
      }
    }
    .hw-questions {
      text-align: left;
      background: var(--bg-page); border-radius: 12px; padding: 12px 14px; margin-bottom: 14px;
      max-height: 180px; overflow-y: auto;
      .hw-q { display: flex; gap: 6px; font-size: 12px; line-height: 1.45; margin-bottom: 6px; color: var(--text-primary); }
      .hw-q-num { color: var(--primary); font-weight: 600; flex-shrink: 0; }
      .hw-more { font-size: 11px; color: var(--text-muted); margin: 0; text-align: center; }
    }
    .hw-close {
      width: 100%; padding: 12px; border: none; border-radius: 12px;
      background: linear-gradient(135deg, var(--primary), #4096ff);
      color: #fff; font-size: 14px; font-weight: 600; cursor: pointer; min-height: 44px;
      &:active { transform: scale(0.98); }
    }
  }
}

.rollcall-overlay {
  position: fixed;
  inset: 0;
  z-index: 950;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;

  .rollcall-card {
    text-align: center;
    padding: 32px 48px;
    background: #fff;
    border-radius: 20px;
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.2);

    h3 { font-size: 16px; color: var(--text-secondary); margin-bottom: 12px; }
    .rolled-name { font-size: 28px; font-weight: 700; color: var(--text-primary); margin-bottom: 20px; }

    &.is-me {
      border: 3px solid var(--primary);
      h3 { color: var(--primary); }
    }

    .respond-btn {
      padding: 10px 32px;
      background: var(--primary);
      color: #fff;
      border: none;
      border-radius: 20px;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      min-height: 44px;
    }
  }
}

.lesson-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 20px;
  background: var(--bg-card);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;

  .header-left {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .course-name {
    font-size: 16px;
    font-weight: 700;
    color: var(--text-primary);
  }

  .slide-info {
    font-size: 12px;
    color: var(--primary);
    padding: 3px 10px;
    background: var(--primary-light);
    border-radius: 12px;
    font-weight: 500;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .conn-badge {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 11px;
    color: var(--text-muted);
    padding: 3px 10px;
    background: var(--bg-page);
    border-radius: 12px;

    .conn-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--text-muted);
    }

    &.online {
      color: var(--success);
      .conn-dot { background: var(--success); }
    }
  }

  .student-name {
    font-size: 13px;
    color: var(--text-secondary);
  }
}

.main-area {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  padding-bottom: 100px;
}

.slide-sync {
  position: relative;

  .slide-image-wrap {
    position: relative;
    border-radius: var(--radius-lg);
    overflow: hidden;
    box-shadow: var(--shadow-sm);
    border: 1px solid var(--border);

    .slide-image {
      width: 100%;
      display: block;
    }

    .slide-page-badge {
      position: absolute;
      top: 10px;
      right: 10px;
      padding: 4px 12px;
      background: rgba(0, 0, 0, 0.55);
      color: #fff;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 500;
    }
  }

  .slide-placeholder {
    background: var(--bg-card);
    border-radius: var(--radius-lg);
    padding: 32px;
    box-shadow: var(--shadow-sm);
    min-height: 320px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--border);
  }

  .slide-content {
    text-align: center;
    width: 100%;

    .slide-badge {
      display: inline-block;
      padding: 4px 14px;
      background: var(--primary-light);
      color: var(--primary);
      border-radius: 16px;
      font-size: 12px;
      font-weight: 600;
      margin-bottom: 16px;
    }

    h3 {
      font-size: 20px;
      color: var(--text-primary);
      margin-bottom: 20px;
      font-weight: 700;
    }

    .slide-desc {
      color: var(--text-muted);
      font-size: 13px;
      margin-top: 20px;
    }
  }

  .slide-visual {
    display: flex;
    gap: 10px;
    justify-content: center;
    align-items: flex-end;

    .visual-bar {
      width: 40px;
      background: linear-gradient(180deg, var(--primary), rgba(82, 196, 26, 0.6));
      border-radius: 6px 6px 0 0;
    }
  }

  .sync-status {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    margin-top: 12px;
    color: var(--primary);
    font-size: 12px;
    font-weight: 500;

    .sync-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--primary);
      animation: pulse 1.5s ease infinite;
    }
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.5; transform: scale(0.8); }
  }

  .ask-float-btn {
    position: absolute;
    right: 16px;
    bottom: 60px;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 10px 16px;
    background: var(--primary);
    color: #fff;
    border: none;
    border-radius: 24px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(82, 196, 26, 0.3);
    min-height: 44px;
    transition: all 0.2s;
    z-index: 5;
    &:active { transform: scale(0.95); }
  }

  .ask-input-bar {
    display: flex;
    gap: 8px;
    margin-top: 12px;
    padding: 12px;
    background: var(--bg-card);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-md);
    border: 1px solid var(--border);

    input {
      flex: 1;
      padding: 10px 14px;
      border: 1px solid var(--border);
      border-radius: 20px;
      font-size: 14px;
      outline: none;
      min-height: 44px;
      &:focus { border-color: var(--primary); }
    }

    .ask-send {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      border: none;
      background: var(--primary);
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      &:disabled { opacity: 0.3; }
    }
  }

  .slide-up-enter-active, .slide-up-leave-active {
    transition: all 0.25s ease;
  }
  .slide-up-enter-from, .slide-up-leave-to {
    opacity: 0;
    transform: translateY(10px);
  }
}

.quiz-panel {
  .quiz-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;

    .quiz-tag {
      padding: 5px 14px;
      background: var(--accent-light);
      color: var(--accent);
      border-radius: 16px;
      font-size: 13px;
      font-weight: 600;
    }

    .quiz-timer {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 5px 12px;
      background: #fff2e8;
      color: #fa541c;
      border-radius: 16px;
      font-size: 13px;
      font-weight: 600;
    }

    .quiz-progress {
      color: var(--text-secondary);
      font-size: 13px;
    }
  }

  .question-card {
    background: var(--bg-card);
    border-radius: var(--radius-lg);
    padding: 24px;
    box-shadow: var(--shadow-sm);

    .question-row {
      display: flex;
      gap: 10px;
      align-items: flex-start;
      margin-bottom: 20px;
    }

    .q-type-badge {
      flex-shrink: 0;
      padding: 3px 10px;
      font-size: 11px;
      font-weight: 700;
      border-radius: 10px;
      margin-top: 2px;
      &.single_choice { background: #e6f4ff; color: #1677ff; }
      &.multiple_choice { background: #f9f0ff; color: #722ed1; }
      &.true_false { background: #fff7e6; color: #d46b08; }
      &.short_answer { background: #f6ffed; color: #389e0d; }
    }

    .question-text {
      font-size: 16px;
      color: var(--text-primary);
      line-height: 1.6;
      margin: 0;
      font-weight: 500;
      flex: 1;
    }
  }

  .multi-hint {
    font-size: 11px;
    color: var(--text-muted);
    margin: 6px 0 0;
    text-align: center;
  }

  .short-answer {
    margin-bottom: 20px;
    textarea {
      width: 100%;
      padding: 14px;
      border: 2px solid var(--border);
      border-radius: var(--radius-md);
      font-size: 15px;
      font-family: inherit;
      line-height: 1.6;
      outline: none;
      resize: vertical;
      min-height: 120px;
      transition: border-color 0.2s;
      &:focus { border-color: var(--primary); }
    }
    .short-hint {
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      color: var(--text-muted);
      margin-top: 6px;
    }
  }

  .options-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-bottom: 20px;
  }

  .option-btn {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px;
    border: 2px solid var(--border);
    border-radius: var(--radius-md);
    background: var(--bg-card);
    cursor: pointer;
    transition: all 0.2s;
    text-align: left;
    &:active { transform: scale(0.99); }
    &.selected {
      border-color: var(--primary);
      background: var(--primary-light);
      .option-key { background: var(--primary); color: #fff; }
    }

    .option-key {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: var(--bg-page);
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 14px;
      color: var(--text-secondary);
      flex-shrink: 0;
      transition: all 0.2s;
    }
    .option-text {
      font-size: 14px;
      color: var(--text-primary);
      line-height: 1.5;
    }
  }

  .quiz-actions {
    display: flex;
    gap: 10px;
  }

  .quiz-nav-btn {
    padding: 12px 20px;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: var(--bg-card);
    color: var(--text-primary);
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    min-height: 44px;
    &.next { border-color: var(--primary); color: var(--primary); }
  }

  .submit-btn {
    flex: 1;
    padding: 14px;
    background: linear-gradient(135deg, var(--primary), #73d13d);
    border: none;
    border-radius: var(--radius-md);
    color: #fff;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    min-height: 44px;
    &:disabled { opacity: 0.4; cursor: not-allowed; }
    &:not(:disabled):active { transform: scale(0.98); }
  }
}

.ai-chat {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 180px);

  .chat-messages {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding-bottom: 16px;
  }

  .chat-bubble {
    display: flex;
    gap: 10px;
    &.user { flex-direction: row-reverse; .bubble-avatar { background: var(--primary); } .bubble-body { background: var(--primary-light); border: 1px solid rgba(82, 196, 26, 0.15); } }
    &.assistant { .bubble-avatar { background: var(--accent); } .bubble-body { background: var(--bg-card); border: 1px solid var(--border); } }
  }

  .bubble-avatar {
    width: 36px; height: 36px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    color: #fff; font-size: 12px; font-weight: 700; flex-shrink: 0;
  }

  .bubble-body {
    max-width: 75%; padding: 12px 14px; border-radius: var(--radius-md); box-shadow: var(--shadow-sm);
    p { font-size: 14px; color: var(--text-primary); line-height: 1.6; }
    .bubble-time { display: block; font-size: 10px; color: var(--text-muted); margin-top: 6px; text-align: right; }

    .bubble-md.md-body {
      font-size: 14px; color: var(--text-primary); line-height: 1.65; word-break: break-word;
      :deep(p) { margin: 0 0 8px; }
      :deep(p:last-child) { margin-bottom: 0; }
      :deep(strong) { font-weight: 700; }
      :deep(em) { font-style: italic; }
      :deep(a) { color: var(--primary); text-decoration: none; border-bottom: 1px solid rgba(22, 119, 255, 0.3); }
      :deep(ul), :deep(ol) { margin: 4px 0 8px; padding-left: 22px; }
      :deep(li) { margin: 2px 0; }
      :deep(ol) { list-style: decimal; }
      :deep(ul) { list-style: disc; }
      :deep(h1), :deep(h2), :deep(h3), :deep(h4) { font-weight: 700; margin: 10px 0 6px; line-height: 1.4; }
      :deep(h1) { font-size: 18px; }
      :deep(h2) { font-size: 16px; }
      :deep(h3) { font-size: 15px; }
      :deep(h4) { font-size: 14px; }
      :deep(code) { font-family: Consolas, 'Cascadia Code', monospace; background: rgba(22, 119, 255, 0.08); color: #c41d7f; padding: 1px 6px; border-radius: 4px; font-size: 12.5px; }
      :deep(pre) { background: #f5f7fa; border: 1px solid var(--border); border-radius: 8px; padding: 10px 12px; margin: 6px 0; overflow-x: auto; code { background: transparent; color: var(--text-primary); padding: 0; } }
      :deep(blockquote) { margin: 6px 0; padding: 6px 12px; border-left: 3px solid var(--primary); background: rgba(22, 119, 255, 0.05); color: var(--text-secondary); border-radius: 0 6px 6px 0; }
      :deep(table) { border-collapse: collapse; width: 100%; margin: 6px 0; font-size: 13px; th, td { border: 1px solid var(--border); padding: 6px 10px; text-align: left; } th { background: rgba(22, 119, 255, 0.05); font-weight: 600; } }
    }
  }

  .chat-input {
    display: flex; gap: 10px; padding-top: 12px; border-top: 1px solid var(--border);
    input {
      flex: 1; padding: 12px 16px; border: 1px solid var(--border); border-radius: var(--radius-md);
      font-size: 14px; outline: none; background: var(--bg-card); min-height: 44px;
      &:focus { border-color: var(--primary); }
    }
    .send-btn {
      padding: 12px 20px; background: var(--primary); border: none; border-radius: var(--radius-md);
      color: #fff; font-size: 14px; font-weight: 600; cursor: pointer; min-height: 44px;
      &:active { transform: scale(0.97); }
    }
  }
}

.discussion-wrapper { height: 100%; }
.no-group { text-align: center; padding: 60px; color: var(--text-muted); font-size: 15px; }

.compete-stage {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 16px;
  padding: 12px 4px;

  .compete-header {
    display: flex;
    align-items: center;
    justify-content: space-between;

    .compete-badge {
      padding: 4px 12px;
      background: #fff2e8;
      color: #fa541c;
      border-radius: 14px;
      font-size: 12px;
      font-weight: 700;
    }

    .compete-countdown {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 4px 12px;
      background: rgba(250, 84, 28, 0.1);
      color: #fa541c;
      border-radius: 14px;
      font-size: 13px;
      font-weight: 600;
    }
  }

  .compete-question {
    background: linear-gradient(135deg, #fff2e8, #fff7ed);
    border: 1px solid #ffbb96;
    border-radius: 16px;
    padding: 22px 18px;
    p {
      font-size: 18px;
      font-weight: 600;
      color: #ad2102;
      line-height: 1.55;
      text-align: center;
      margin: 0;
    }
  }

  .compete-grab {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
    padding: 12px 0 8px;
  }

  .compete-grab-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    width: 200px;
    height: 200px;
    border-radius: 50%;
    border: none;
    background: radial-gradient(circle at 30% 30%, #ff9b6b, #fa541c);
    color: #fff;
    font-size: 22px;
    font-weight: 700;
    cursor: pointer;
    box-shadow: 0 18px 36px -10px rgba(250, 84, 28, 0.55), inset 0 -6px 14px rgba(0, 0, 0, 0.18);
    animation: compete-glow 1.4s ease-in-out infinite;
    transition: transform 0.1s ease;
    :deep(svg) { stroke: #fff; }
    &:active { transform: scale(0.95); }
    &.pressed, &:disabled {
      animation: none;
      background: linear-gradient(135deg, #d9d9d9, #bfbfbf);
      color: rgba(255, 255, 255, 0.95);
      box-shadow: none;
      cursor: not-allowed;
    }
  }

  @keyframes compete-glow {
    0%, 100% { box-shadow: 0 18px 36px -10px rgba(250, 84, 28, 0.45), inset 0 -6px 14px rgba(0, 0, 0, 0.18), 0 0 0 0 rgba(250, 84, 28, 0.4); }
    50% { box-shadow: 0 18px 36px -10px rgba(250, 84, 28, 0.55), inset 0 -6px 14px rgba(0, 0, 0, 0.18), 0 0 0 16px rgba(250, 84, 28, 0); }
  }

  .compete-tip {
    text-align: center;
    color: var(--text-secondary);
    font-size: 12px;
  }

  .compete-result {
    padding: 12px 0;

    .winner-card {
      text-align: center;
      background: linear-gradient(135deg, #fffbe6, #fff7c2);
      border: 1px solid #ffe58f;
      border-radius: 18px;
      padding: 22px 18px;
      box-shadow: 0 10px 24px -10px rgba(217, 158, 38, 0.45);

      .trophy { font-size: 38px; display: block; margin-bottom: 4px; }
      .winner-name { font-size: 22px; font-weight: 800; color: #874d00; margin: 4px 0 6px; }
      .winner-time { font-size: 13px; color: #ad6800; }
      .winner-tag { font-size: 13px; color: var(--text-secondary); margin-top: 8px; }
    }

    .no-winner {
      text-align: center;
      color: var(--text-muted);
      font-size: 14px;
      padding: 18px;
    }
  }
}

.toolbar {
  position: fixed;
  bottom: 0; left: 0; right: 0;
  display: flex; gap: 10px;
  padding: 12px 16px;
  padding-bottom: calc(12px + var(--safe-bottom));
  background: var(--bg-card);
  border-top: 1px solid var(--border);
  box-shadow: 0 -4px 16px rgba(0, 0, 0, 0.04);
  z-index: 10;
}

.tool-btn {
  flex: 1;
  display: flex; flex-direction: column; align-items: center; gap: 4px;
  padding: 10px; border: 1px solid var(--border); border-radius: var(--radius-md);
  background: var(--bg-card); cursor: pointer; transition: all 0.2s; min-height: 52px;
  &:active { transform: scale(0.97); }
  &.active { border-color: var(--warning); background: #fff7e6; .tool-icon { animation: wave 0.5s ease infinite alternate; } }
  &.ai-btn { border-color: rgba(22, 119, 255, 0.2); background: var(--accent-light); span:last-child { color: var(--accent); } }
  .tool-icon { display: flex; align-items: center; justify-content: center; :deep(svg) { width: 20px; height: 20px; } }
  span { font-size: 11px; color: var(--text-secondary); font-weight: 500; }
}

@keyframes wave {
  from { transform: rotate(-10deg); }
  to { transform: rotate(10deg); }
}

.toast-notification {
  position: fixed;
  top: 80px; left: 50%; transform: translateX(-50%);
  z-index: 999;
  display: flex; align-items: center; gap: 8px;
  padding: 12px 20px; border-radius: 12px;
  font-size: 14px; font-weight: 500;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);

  &.success { background: #f6ffed; color: #52c41a; border: 1px solid #b7eb8f; }
  &.info { background: #e6f4ff; color: #1677ff; border: 1px solid #91caff; }
}

.toast-enter-active { transition: all 0.3s ease-out; }
.toast-leave-active { transition: all 0.2s ease-in; }
.toast-enter-from { opacity: 0; transform: translateX(-50%) translateY(-12px); }
.toast-leave-to { opacity: 0; transform: translateX(-50%) translateY(-8px); }

.fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

@media (max-width: 480px) {
  .lesson-header {
    padding: 10px 14px;
    .course-name { font-size: 14px; }
    .slide-info { font-size: 11px; padding: 2px 8px; }
    .student-name { font-size: 12px; }
  }

  .main-area { padding: 10px; padding-bottom: 80px; }

  .toolbar { padding: 8px 10px; gap: 6px; }
  .tool-btn { min-height: 46px; padding: 8px; span { font-size: 10px; } }
}

@media (min-width: 1024px) {
  .main-area { max-width: 800px; margin: 0 auto; padding: 24px; padding-bottom: 100px; }
  .slide-sync .slide-placeholder { min-height: 400px; }
}

.view-switch-enter-active { transition: all 0.3s ease-out; }
.view-switch-leave-active { transition: all 0.2s ease-in; }
.view-switch-enter-from { opacity: 0; transform: translateY(16px); }
.view-switch-leave-to { opacity: 0; transform: translateY(-8px); }

.slide-fade-enter-active { transition: all 0.25s ease-out; }
.slide-fade-leave-active { transition: all 0.15s ease-in; }
.slide-fade-enter-from { opacity: 0; }
.slide-fade-leave-to { opacity: 0; }
</style>
