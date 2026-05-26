<template>
  <view
    class="student-main"
    :class="[
      { landscape: isLandscape, portrait: !isLandscape },
      `scene-${store.viewState}`,
    ]"
  >
    <!-- 装饰背景：根据 viewState 切换主题 -->
    <view class="scene-bg" aria-hidden="true">
      <view v-if="store.viewState === 'compete'" class="compete-aurora">
        <view class="ring ring-1"></view>
        <view class="ring ring-2"></view>
        <view class="ring ring-3"></view>
      </view>
      <view v-else-if="store.viewState === 'ai_practice'" class="ai-aurora">
        <view class="aurora-blob blob-a"></view>
        <view class="aurora-blob blob-b"></view>
        <view class="aurora-blob blob-c"></view>
      </view>
      <view v-else-if="store.viewState === 'listening'" class="listening-grid"></view>
    </view>

    <!-- 注：Toast 已全部走 uni.showToast() 原生气泡，
         不再使用页面 <view> 节点，避免在 flex 容器内挤压课件画面。 -->

    <!-- ===== 锁屏（全屏纯深底 · 100% 不透明遮盖下方课件 · 顶层 z-lock=2000） ===== -->
    <view v-if="store.viewState === 'locked'" class="lock-screen" role="alert" aria-live="assertive">
      <!-- 1. 100% 不透明深底，杜绝白课件透出 -->
      <view class="lock-base" aria-hidden="true"></view>
      <!-- 2. 三色 aurora 气团（蓝/紫/青），mix-blend-mode: screen 在深底上叠出冷色微光 -->
      <view class="lock-aurora" aria-hidden="true">
        <view class="lock-aurora-blob lock-blob-a"></view>
        <view class="lock-aurora-blob lock-blob-b"></view>
        <view class="lock-aurora-blob lock-blob-c"></view>
      </view>
      <!-- 3. 极淡星点纹理（仅中央可见、四周淡出），避免"死黑屏=掉线"误会 -->
      <view class="lock-stars" aria-hidden="true"></view>

      <view class="lock-card">
        <view class="lock-icon-wrap">
          <view class="lock-icon-pulse-ring" aria-hidden="true"></view>
          <view class="lock-icon-pulse-ring lock-icon-pulse-ring--delay" aria-hidden="true"></view>
          <Icon name="lock" size="3xl" tone="inverse" />
        </view>
        <text class="lock-title">屏幕已锁定</text>
        <text class="lock-sub">老师正在重点讲解，请放下设备专注听讲</text>
        <view class="lock-status">
          <view class="lock-status-dot" aria-hidden="true"></view>
          <text class="lock-status-text">等待教师解锁</text>
        </view>
      </view>
    </view>

    <!-- ===== 教师广播 ===== -->
    <Overlay
      v-if="store.showBroadcast"
      align="top"
      :z-index="800"
      max-width="700rpx"
      @close="store.dismissBroadcast()"
    >
      <view class="bcast-card">
        <view class="bcast-head">
          <view class="bcast-label">
            <Icon name="megaphone" size="sm" tone="primary" />
            <text>教师广播</text>
          </view>
          <IconButton
            icon="x"
            size="sm"
            aria-label="关闭广播"
            @tap="store.dismissBroadcast()"
          />
        </view>
        <text class="bcast-body">{{ store.broadcastMessage }}</text>
      </view>
    </Overlay>

    <!-- ===== 课后作业弹窗 ===== -->
    <Overlay
      v-if="store.latestHomework"
      align="center"
      :z-index="700"
      max-width="640rpx"
      @close="store.dismissLatestHomework()"
    >
      <view class="hw-card">
        <view class="hw-icon-wrap"><Icon name="book-open" size="xl" tone="primary" /></view>
        <text class="hw-title">{{ store.latestHomework.title }}</text>
        <text class="hw-desc">
          {{ store.latestHomework.description || '老师刚刚发布了一份作业，请在截止时间前完成。' }}
        </text>
        <view class="hw-meta">
          <Tag tone="primary" icon="file-text">{{ store.latestHomework.questions.length }} 题</Tag>
          <Tag v-if="store.latestHomework.deadline" tone="warning" icon="clock">
            截止 {{ formatDeadline(store.latestHomework.deadline) }}
          </Tag>
        </view>
        <Button variant="primary" block size="md" icon-left="check" @tap="store.dismissLatestHomework()">
          我知道了
        </Button>
      </view>
    </Overlay>

    <!-- ===== 被点名弹窗 ===== -->
    <Overlay
      v-if="store.showRollCall && store.rolledStudent"
      align="center"
      :z-index="700"
      max-width="560rpx"
      @close="store.showRollCall = false"
    >
      <view class="rollcall-card" :class="{ 'is-me': store.rolledStudent.studentId === store.studentId }">
        <view class="rc-icon-wrap">
          <Icon
            :name="store.rolledStudent.studentId === store.studentId ? 'zap' : 'user'"
            size="xl"
            :tone="store.rolledStudent.studentId === store.studentId ? 'warning' : 'primary'"
          />
        </view>
        <text class="rc-title">
          {{ store.rolledStudent.studentId === store.studentId ? '你被点到了！' : '老师点名' }}
        </text>
        <text class="rolled-name">{{ store.rolledStudent.studentName }}</text>
        <Button
          v-if="store.rolledStudent.studentId === store.studentId"
          variant="primary"
          size="md"
          icon-left="check"
          block
          @tap="store.showRollCall = false"
        >
          收到
        </Button>
      </view>
    </Overlay>

    <!-- ===== 顶部 header ===== -->
    <view class="lesson-header" :style="{ paddingTop: `max(${headerPad}, var(--safe-top))` }">
      <view class="header-left">
        <view class="lesson-mark"><Icon name="logo" size="md" tone="primary" /></view>
        <view class="lesson-text">
          <text class="course-name">{{ store.courseName || '三元课堂' }}</text>
          <text v-if="store.totalSlides > 0" class="slide-info">
            第 {{ store.currentSlide }} / {{ store.totalSlides }} 页
          </text>
        </view>
      </view>
      <view class="header-right">
        <view class="conn-badge" :class="{ online: store.isOnline }">
          <Icon :name="store.isOnline ? 'wifi' : 'wifi-off'" size="xs" />
          <text>{{ store.isOnline ? '已连接' : '未连接' }}</text>
        </view>
        <view class="student-chip">
          <Icon name="user" size="xs" tone="muted" />
          <text class="student-name">{{ store.studentName }}</text>
        </view>
        <button
          v-if="store.viewState !== 'locked'"
          class="leave-btn"
          hover-class="leave-btn-hover"
          :hover-stay-time="80"
          aria-label="退出课堂"
          @tap="confirmLeaveClassroom"
        >
          <Icon name="x" size="xs" />
          <text class="leave-btn-text">退出</text>
        </button>
      </view>
    </view>

    <!-- ===== 主体 ===== -->
    <view class="main-area">
      <view class="content-pane">

        <!-- listening -->
        <view v-if="store.viewState === 'listening'" class="slide-sync">
          <view v-if="store.slides.length > 0 && store.slides[store.currentSlide - 1]" class="slide-image-wrap" id="anno-stage-wrap">
            <image
              :src="store.slides[store.currentSlide - 1].dataUrl"
              mode="aspectFit"
              class="slide-image"
              @load="onStudentSlideImageLoaded"
            />
            <canvas
              id="anno-canvas-student"
              canvas-id="anno-canvas-student"
              class="anno-canvas-overlay"
            ></canvas>
            <view class="slide-page-badge">
              {{ store.currentSlide }} / {{ store.totalSlides }}
            </view>
          </view>
          <view v-else class="slide-placeholder">
            <view class="ph-icon-wrap"><Icon name="tv" size="3xl" tone="muted" /></view>
            <text class="slide-title">{{ store.lessonTitle || '欢迎来到课堂' }}</text>
            <text class="slide-desc">
              {{ store.totalSlides > 0 ? '课件加载中…' : '等待教师导入课件…' }}
            </text>
          </view>
        </view>

        <!-- quiz -->
        <view v-else-if="store.viewState === 'quiz'" class="quiz-area">
          <view class="quiz-header">
            <view class="quiz-title-wrap">
              <Icon name="file-text" size="sm" tone="primary" />
              <text class="quiz-title">随堂测验</text>
            </view>
            <text class="quiz-progress">
              {{ store.currentQuestionIndex + 1 }} / {{ store.quizQuestions.length }}
            </text>
          </view>

          <view v-if="store.currentQuestion" class="quiz-body">
            <view class="quiz-grid">
              <view class="question-card">
                <Tag tone="primary" size="sm">{{ qTypeLabel(store.currentQuestion.type) }}</Tag>
                <text class="q-content">{{ store.currentQuestion.content }}</text>
              </view>

              <view class="answer-card">
                <view
                  v-if="store.currentQuestion.options && store.currentQuestion.options.length"
                  class="options"
                >
                  <view
                    v-for="opt in store.currentQuestion.options"
                    :key="opt.key"
                    class="option"
                    :class="{ selected: isOptionSelected(opt.key) }"
                    hover-class="option-hover"
                    :hover-stay-time="80"
                    @tap="selectOption(opt.key)"
                  >
                    <view class="opt-marker"><text>{{ opt.key }}</text></view>
                    <text class="opt-content">{{ opt.content }}</text>
                    <view v-if="isOptionSelected(opt.key)" class="opt-check">
                      <Icon name="check" size="xs" tone="inverse" />
                    </view>
                  </view>
                </view>

                <textarea
                  v-else
                  v-model="shortAnswerInput"
                  class="short-input"
                  placeholder="请在此输入你的回答…"
                  :auto-height="true"
                  :maxlength="500"
                  :adjust-position="false"
                />

                <view class="quiz-actions">
                  <Button
                    variant="secondary"
                    size="md"
                    icon-left="chevron-left"
                    :disabled="store.currentQuestionIndex === 0"
                    @tap="prevQuestion"
                  >
                    上一题
                  </Button>
                  <Button
                    v-if="store.currentQuestionIndex < store.quizQuestions.length - 1"
                    variant="primary"
                    size="md"
                    icon-right="chevron-right"
                    @tap="nextQuestion"
                  >
                    下一题
                  </Button>
                  <Button
                    v-else
                    variant="success"
                    size="md"
                    icon-left="check"
                    :loading="submitting"
                    @tap="submitQuiz"
                  >
                    {{ submitting ? '提交中' : '提交答卷' }}
                  </Button>
                </view>
              </view>
            </view>
          </view>
        </view>

        <!-- discussion -->
        <view v-else-if="store.viewState === 'discussion'" class="discussion-wrap">
          <GroupDiscussionPanel
            v-if="store.groupData"
            :group="store.groupData"
            :student-id="store.studentId"
            :student-name="store.studentName"
          />
          <view v-else class="empty-state">
            <view class="empty-icon"><Icon name="hourglass" size="2xl" tone="muted" /></view>
            <text class="empty-title">等待教师分组</text>
            <text class="empty-desc">老师将很快为你分配讨论小组</text>
          </view>
        </view>

        <!-- compete -->
        <view v-else-if="store.viewState === 'compete'" class="compete-stage">
          <Tag tone="warning" icon="flame" size="md">抢答进行中</Tag>
          <text class="compete-q">{{ store.competeQuestion }}</text>
          <button
            v-if="!hasCompeted"
            class="compete-btn"
            hover-class="compete-btn-hover"
            :hover-stay-time="100"
            @tap="grabCompete"
            aria-label="抢答"
          >
            <Icon name="send" size="xl" tone="inverse" />
            <text class="compete-btn-text">抢答</text>
          </button>
          <view v-else class="compete-done">
            <Icon name="check-circle" size="md" tone="success" />
            <text>已抢答，等待老师宣布结果</text>
          </view>
          <view v-if="store.competeResult" class="compete-result">
            <Icon
              :name="store.competeResult.winner ? 'trophy' : 'info'"
              size="lg"
              :tone="store.competeResult.winner ? 'warning' : 'muted'"
            />
            <text class="result-title">
              {{ store.competeResult.winner ? `${store.competeResult.winner.studentName} 胜出` : '本轮无人抢答' }}
            </text>
          </view>
        </view>

        <!-- ai_practice -->
        <view v-else-if="store.viewState === 'ai_practice'" class="ai-practice-stage">
          <view class="ap-icon-wrap"><Icon name="sparkles" size="3xl" tone="secondary" /></view>
          <text class="ap-title">AI 实践场景</text>
          <text class="ap-topic">{{ aiPracticeTopic }}</text>
          <Button variant="primary" size="lg" icon-right="arrow-right" @tap="openAiInteractive">
            开始探索
          </Button>
        </view>

      </view>

      <!-- 横屏右侧固定栏 -->
      <view v-if="isLandscape && store.viewState !== 'locked'" class="side-rail">
        <view class="rail-section">
          <text class="rail-label">课堂工具</text>
          <button
            class="rail-btn"
            :class="{ raised: store.isHandRaised }"
            hover-class="rail-btn-hover"
            :hover-stay-time="80"
            :aria-pressed="store.isHandRaised"
            aria-label="举手"
            @tap="toggleHand"
          >
            <Icon name="hand" size="md" :tone="store.isHandRaised ? 'warning' : ''" />
            <text class="rb-text">{{ store.isHandRaised ? '放下' : '举手' }}</text>
          </button>
          <button
            class="rail-btn"
            hover-class="rail-btn-hover"
            :hover-stay-time="80"
            aria-label="向老师提问"
            @tap="showQuestion = true"
          >
            <Icon name="help-circle" size="md" />
            <text class="rb-text">提问</text>
          </button>
          <button
            class="rail-btn"
            hover-class="rail-btn-hover"
            :hover-stay-time="80"
            aria-label="我的笔记"
            @tap="showNotes = true"
          >
            <Icon name="notebook" size="md" />
            <text class="rb-text">笔记</text>
          </button>
          <button
            class="rail-btn primary"
            hover-class="rail-btn-hover"
            :hover-stay-time="80"
            aria-label="AI 答疑"
            @tap="showAiChat = true"
          >
            <Icon name="sparkles" size="md" tone="inverse" />
            <text class="rb-text rb-text-inverse">AI 答疑</text>
          </button>
        </view>

        <view
          class="rail-section info"
          v-if="store.viewState === 'listening' && store.totalSlides > 0"
        >
          <text class="rail-label">课堂状态</text>
          <view class="rail-info">
            <view class="info-row">
              <Icon name="file-text" size="xs" tone="muted" />
              <text>第 {{ store.currentSlide }} / {{ store.totalSlides }} 页</text>
            </view>
            <view class="info-row">
              <Icon :name="store.isOnline ? 'wifi' : 'wifi-off'" size="xs" :tone="store.isOnline ? 'success' : 'danger'" />
              <text>{{ store.isOnline ? '已连接' : '未连接' }}</text>
            </view>
            <view v-if="store.broadcastHistory.length > 0" class="info-row">
              <Icon name="megaphone" size="xs" tone="muted" />
              <text>{{ store.broadcastHistory.length }} 条广播</text>
            </view>
          </view>
        </view>
      </view>
    </view>

    <!-- 竖屏 fallback：右下浮动按钮 -->
    <view
      v-if="!isLandscape && store.viewState !== 'locked' && store.viewState !== 'quiz'"
      class="float-actions"
      :style="{ bottom: `max(var(--space-8), var(--safe-bottom))` }"
    >
      <button
        class="fab"
        :class="{ raised: store.isHandRaised }"
        hover-class="fab-hover"
        :hover-stay-time="80"
        :aria-pressed="store.isHandRaised"
        aria-label="举手"
        @tap="toggleHand"
      >
        <Icon name="hand" size="md" :tone="store.isHandRaised ? 'warning' : ''" />
      </button>
      <button
        class="fab"
        hover-class="fab-hover"
        :hover-stay-time="80"
        aria-label="向老师提问"
        @tap="showQuestion = true"
      >
        <Icon name="help-circle" size="md" />
      </button>
      <button
        class="fab"
        hover-class="fab-hover"
        :hover-stay-time="80"
        aria-label="我的笔记"
        @tap="showNotes = true"
      >
        <Icon name="notebook" size="md" />
      </button>
      <button
        class="fab primary"
        hover-class="fab-hover"
        :hover-stay-time="80"
        aria-label="AI 答疑"
        @tap="showAiChat = true"
      >
        <Icon name="sparkles" size="md" tone="inverse" />
      </button>
    </view>

    <!-- 抽屉 / 弹窗 -->
    <AiChatDrawer v-if="showAiChat" @close="showAiChat = false" />
    <NotesPanel v-if="showNotes" @close="showNotes = false" />
    <AiInteractiveViewer
      v-if="showAiInteractive"
      :payload="aiInteractivePayload"
      @close="showAiInteractive = false"
    />

    <Overlay
      v-if="showQuestion"
      align="center"
      max-width="640rpx"
      :z-index="700"
      @close="showQuestion = false"
    >
      <view class="q-card">
        <view class="q-head">
          <text class="q-card-title">向老师提问</text>
          <IconButton icon="x" size="sm" aria-label="关闭提问框" @tap="showQuestion = false" />
        </view>
        <textarea
          v-model="questionText"
          class="q-textarea"
          placeholder="清晰描述你的问题，例如：第 3 页公式的推导我没看懂"
          :auto-height="true"
          :maxlength="200"
        />
        <view class="q-meta">
          <text class="q-meta-text">{{ questionText.length }} / 200</text>
        </view>
        <view class="q-actions">
          <Button variant="secondary" size="md" block @tap="showQuestion = false">取消</Button>
          <Button
            variant="primary"
            size="md"
            block
            icon-left="send"
            :disabled="!questionText.trim()"
            @tap="sendQuestion"
          >
            发送
          </Button>
        </view>
      </view>
    </Overlay>

    <SignInPopup
      v-if="store.showAttendance && !store.attendanceSigned"
      :mode="store.attendanceMode"
      :radius="store.attendanceConfig.radius"
      :teacher-location="store.attendanceConfig.teacherLocation"
      :require-photo="store.attendanceConfig.requirePhoto"
      :require-location="store.attendanceConfig.requireLocation"
      @sign="onSignIn"
      @close="store.showAttendance = false"
    />
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { onLoad, onShow, onHide } from '@dcloudio/uni-app'
import { useStudentStore } from '@/stores/student'
import { useSocket } from '@/sockets/useSocket'
import { useOrientation } from '@/composables/useOrientation'
import { RoomEvent } from '@/shared/wsEvents'
import GroupDiscussionPanel from '@/components/GroupDiscussionPanel.vue'
import AiChatDrawer from '@/components/AiChatDrawer.vue'
import NotesPanel from '@/components/NotesPanel.vue'
import SignInPopup from '@/components/SignInPopup.vue'
import AiInteractiveViewer from '@/components/AiInteractiveViewer.vue'
import { lockToCurrentApp, unlockApp } from '@/kiosk'
import { refreshFullscreenOnShow } from '@/composables/useAntiExit'
import Icon from '@/components/ui/Icon.vue'
import Button from '@/components/ui/Button.vue'
import IconButton from '@/components/ui/IconButton.vue'
import Tag from '@/components/ui/Tag.vue'
import Overlay from '@/components/ui/Overlay.vue'

const store = useStudentStore()
const { connect, getSocket, disconnect, reportFocusLost, reportFocusGained } = useSocket()
const { isLandscape } = useOrientation()

const lessonId = ref('')
const shortAnswerInput = ref('')
const submitting = ref(false)
const hasCompeted = ref(false)
const aiPracticeTopic = ref('')

const showAiChat = ref(false)
const showNotes = ref(false)
const showQuestion = ref(false)
const questionText = ref('')
const showAiInteractive = ref(false)
const aiInteractivePayload = ref<any>(null)

/* ===== 蒙版涂鸦（学生只读） ===== */
interface AnnoPoint { x: number; y: number }
interface AnnoStroke {
  id: string
  slideIndex: number
  color: string
  width: number
  points: AnnoPoint[]
  createdBy?: string
}

const studentAnnoCanvasSize = ref({ width: 1, height: 1 })
const studentAnnotationsByPage = new Map<number, AnnoStroke[]>()
const studentActiveStrokesById = new Map<string, AnnoStroke>()
let studentAnnoCtx: UniApp.CanvasContext | null = null

/**
 * 防御：canvas 只在 viewState === 'listening' 时才挂载（被 v-if 包裹）。
 * 离开 listening 后再调 uni.createCanvasContext 取到的句柄会指向"已销毁"的 canvas，
 * 后续 stroke 事件 .draw() 会让 native bridge 异常（在 App-Plus 上甚至能把进程拖死）。
 * 因此：只在 listening 且 ctx 已经被 measureStudentCanvasAndRedraw 显式建立时才返回。
 */
function getStudentAnnoCtx(): UniApp.CanvasContext | null {
  if (store.viewState !== 'listening') return null
  return studentAnnoCtx
}

function studentDrawStroke(ctx: UniApp.CanvasContext, stroke: AnnoStroke) {
  if (stroke.points.length === 0) return
  const w = studentAnnoCanvasSize.value.width
  const h = studentAnnoCanvasSize.value.height
  ctx.setStrokeStyle(stroke.color)
  ctx.setLineWidth(stroke.width)
  ctx.setLineCap('round')
  ctx.setLineJoin('round')
  ctx.beginPath()
  const p0 = stroke.points[0]
  ctx.moveTo(p0.x * w, p0.y * h)
  for (let i = 1; i < stroke.points.length; i++) {
    const p = stroke.points[i]
    ctx.lineTo(p.x * w, p.y * h)
  }
  if (stroke.points.length === 1) {
    ctx.lineTo(p0.x * w + 0.1, p0.y * h + 0.1)
  }
  ctx.stroke()
}

function studentRedrawAnnotations() {
  const ctx = getStudentAnnoCtx()
  if (!ctx) return
  ctx.clearRect(0, 0, studentAnnoCanvasSize.value.width, studentAnnoCanvasSize.value.height)
  const finished = studentAnnotationsByPage.get(store.currentSlide) || []
  finished.forEach(s => studentDrawStroke(ctx, s))
  for (const s of studentActiveStrokesById.values()) {
    if (s.slideIndex === store.currentSlide) studentDrawStroke(ctx, s)
  }
  ctx.draw(false)
}

function studentAppendStrokeSegment(stroke: AnnoStroke) {
  if (stroke.slideIndex !== store.currentSlide) return
  const ctx = getStudentAnnoCtx()
  if (!ctx) return
  const w = studentAnnoCanvasSize.value.width
  const h = studentAnnoCanvasSize.value.height
  ctx.setStrokeStyle(stroke.color)
  ctx.setLineWidth(stroke.width)
  ctx.setLineCap('round')
  ctx.setLineJoin('round')
  if (stroke.points.length < 2) {
    const p = stroke.points[0]
    if (!p) return
    ctx.beginPath()
    ctx.moveTo(p.x * w, p.y * h)
    ctx.lineTo(p.x * w + 0.1, p.y * h + 0.1)
    ctx.stroke()
  } else {
    const prev = stroke.points[stroke.points.length - 2]
    const cur = stroke.points[stroke.points.length - 1]
    ctx.beginPath()
    ctx.moveTo(prev.x * w, prev.y * h)
    ctx.lineTo(cur.x * w, cur.y * h)
    ctx.stroke()
  }
  ctx.draw(true)
}

function onStudentSlideImageLoaded() {
  setTimeout(() => measureStudentCanvasAndRedraw(), 20)
}

function measureStudentCanvasAndRedraw() {
  if (store.viewState !== 'listening') return
  uni.createSelectorQuery()
    .select('#anno-canvas-student')
    .boundingClientRect((rect: any) => {
      if (store.viewState !== 'listening') return
      const r = rect as { width?: number; height?: number } | null
      if (r && r.width && r.height) {
        studentAnnoCanvasSize.value = { width: r.width, height: r.height }
      }
      studentAnnoCtx = uni.createCanvasContext('anno-canvas-student')
      studentRedrawAnnotations()
    })
    .exec()
}

watch(() => store.viewState, (next, prev) => {
  if (prev === 'listening' && next !== 'listening') {
    studentAnnoCtx = null
  }
})

function studentAnnoApplyStart(data: any) {
  if (!data?.strokeId) return
  const stroke: AnnoStroke = {
    id: data.strokeId,
    slideIndex: data.slideIndex,
    color: data.color,
    width: data.width,
    points: data.point ? [data.point] : [],
    createdBy: data.createdBy,
  }
  studentActiveStrokesById.set(stroke.id, stroke)
  if (data.point && stroke.slideIndex === store.currentSlide) studentAppendStrokeSegment(stroke)
}
function studentAnnoApplyPoint(data: any) {
  const stroke = studentActiveStrokesById.get(data?.strokeId)
  if (!stroke || !data?.point) return
  stroke.points.push(data.point)
  if (stroke.slideIndex === store.currentSlide) studentAppendStrokeSegment(stroke)
}
function studentAnnoApplyEnd(data: any) {
  const stroke = studentActiveStrokesById.get(data?.strokeId)
  if (!stroke) return
  studentActiveStrokesById.delete(stroke.id)
  if (stroke.points.length === 0) return
  const list = studentAnnotationsByPage.get(stroke.slideIndex) || []
  list.push(stroke)
  studentAnnotationsByPage.set(stroke.slideIndex, list)
}
function studentAnnoApplyClear(data: any) {
  const slideIndex = Number(data?.slideIndex)
  if (slideIndex === -1) {
    studentAnnotationsByPage.clear()
    studentActiveStrokesById.clear()
  } else {
    studentAnnotationsByPage.delete(slideIndex)
    for (const [id, s] of studentActiveStrokesById.entries()) {
      if (s.slideIndex === slideIndex) studentActiveStrokesById.delete(id)
    }
  }
  if (slideIndex === -1 || slideIndex === store.currentSlide) studentRedrawAnnotations()
}
function studentAnnoApplyUndo(data: any) {
  const list = studentAnnotationsByPage.get(data?.slideIndex)
  if (!list || list.length === 0) return
  if (data?.strokeId) {
    const idx = list.findIndex(s => s.id === data.strokeId)
    if (idx >= 0) list.splice(idx, 1)
  } else {
    list.pop()
  }
  if (list.length === 0) studentAnnotationsByPage.delete(data.slideIndex)
  if (data.slideIndex === store.currentSlide) studentRedrawAnnotations()
}
function studentAnnoApplySnapshot(snapshot?: Record<string, AnnoStroke[]>) {
  studentAnnotationsByPage.clear()
  studentActiveStrokesById.clear()
  if (!snapshot) return
  for (const [k, list] of Object.entries(snapshot)) {
    const idx = Number(k)
    if (!Array.isArray(list)) continue
    studentAnnotationsByPage.set(idx, list.map(s => ({ ...s, points: s.points.slice() })))
  }
  setTimeout(() => studentRedrawAnnotations(), 60)
}

const headerPad = computed(() => '24rpx')

/**
 * Toast 统一封装：内部走 uni.showToast 原生气泡（中间浮层，不挤压课件画面），
 * 与教师端 `toast()` 一致。type → uni 内置 icon 映射：
 * - success → 'success'（绿色对勾）
 * - error   → 'error'（红色叉，uni-app 2.x+ 支持，旧版回退 'none'）
 * - info    → 'none'（无图标，纯文字气泡）
 */
function showToast(msg: string, type: 'info' | 'success' | 'error' = 'info', duration = 1800) {
  let icon: 'success' | 'error' | 'none' = 'none'
  if (type === 'success') icon = 'success'
  else if (type === 'error') icon = 'error'
  uni.showToast({
    title: msg,
    icon,
    duration,
    mask: false,
  })
}

function qTypeLabel(t: string) {
  switch (t) {
    case 'single_choice': return '单选'
    case 'multiple_choice': return '多选'
    case 'true_false': return '判断'
    case 'short_answer': return '简答'
    default: return '题目'
  }
}

function isOptionSelected(key: string): boolean {
  const q = store.currentQuestion
  if (!q) return false
  const ans = store.selectedAnswers[q.id] || ''
  if (q.type === 'multiple_choice') return ans.split(',').filter(Boolean).includes(key)
  return ans === key
}

function selectOption(key: string) {
  const q = store.currentQuestion
  if (!q) return
  if (q.type === 'multiple_choice') {
    const current = (store.selectedAnswers[q.id] || '').split(',').filter(Boolean)
    const idx = current.indexOf(key)
    if (idx >= 0) current.splice(idx, 1)
    else current.push(key)
    current.sort()
    store.selectedAnswers = { ...store.selectedAnswers, [q.id]: current.join(',') }
  } else {
    store.selectedAnswers = { ...store.selectedAnswers, [q.id]: key }
  }
}

function commitShortAnswer() {
  const q = store.currentQuestion
  if (!q || q.type !== 'short_answer') return
  store.selectedAnswers = { ...store.selectedAnswers, [q.id]: shortAnswerInput.value.trim() }
}

function prevQuestion() {
  commitShortAnswer()
  if (store.currentQuestionIndex > 0) {
    store.currentQuestionIndex--
    syncShortAnswerInput()
  }
}

function nextQuestion() {
  commitShortAnswer()
  if (store.currentQuestionIndex < store.quizQuestions.length - 1) {
    store.currentQuestionIndex++
    syncShortAnswerInput()
  }
}

function syncShortAnswerInput() {
  const q = store.currentQuestion
  if (q?.type === 'short_answer') {
    shortAnswerInput.value = store.selectedAnswers[q.id] || ''
  }
}

function submitQuiz() {
  commitShortAnswer()
  if (submitting.value) return
  submitting.value = true
  const s = getSocket()
  s?.emit(RoomEvent.AnswerSubmit, {
    taskId: store.activeTaskId,
    studentId: store.studentId,
    answers: store.selectedAnswers,
  })
  showToast('已提交，等待老师批阅', 'success')
}

function toggleHand() {
  const s = getSocket()
  if (!s) return
  if (store.isHandRaised) {
    s.emit(RoomEvent.HandLower)
    store.isHandRaised = false
  } else {
    s.emit(RoomEvent.HandRaise)
    store.isHandRaised = true
  }
}

function sendQuestion() {
  const text = questionText.value.trim()
  if (!text) return
  const s = getSocket()
  s?.emit(RoomEvent.QuestionAsk, { text, slideIndex: store.currentSlide })
  questionText.value = ''
  showQuestion.value = false
  showToast('问题已发送给老师', 'success')
}

function grabCompete() {
  const s = getSocket()
  s?.emit(RoomEvent.CompeteAnswer)
  hasCompeted.value = true
}

function onSignIn(payload: {
  photo?: string
  location?: { latitude: number; longitude: number; accuracy?: number }
  distance?: number
  verified: boolean
}) {
  const s = getSocket()
  if (!s || !store.isOnline) {
    showToast('网络未连接，签到失败', 'error', 3000)
    return
  }

  const ackHandler = (data: any) => {
    clearTimeout(timer)
    s.off(RoomEvent.AttendanceSignedAck, ackHandler)
    if (data?.error) {
      showToast(data.error, 'error', 3000)
    } else if (data?.duplicate) {
      store.attendanceSigned = true
      store.showAttendance = false
      showToast('你已签到过', 'info')
    }
  }
  const signedHandler = (data: any) => {
    if (data?.studentId === store.studentId) {
      clearTimeout(timer)
      s.off(RoomEvent.AttendanceSignedAck, ackHandler)
      s.off(RoomEvent.AttendanceSigned, signedHandler)
      store.attendanceSigned = true
      store.showAttendance = false
      showToast('签到成功', 'success')
    }
  }
  s.on(RoomEvent.AttendanceSignedAck, ackHandler)
  s.on(RoomEvent.AttendanceSigned, signedHandler)
  s.emit(RoomEvent.AttendanceSign, payload)

  const timer = setTimeout(() => {
    s.off(RoomEvent.AttendanceSignedAck, ackHandler)
    s.off(RoomEvent.AttendanceSigned, signedHandler)
    store.attendanceSigned = true
    store.showAttendance = false
    showToast('签到已提交（未收到确认）', 'info')
  }, 5000)
}

function openAiInteractive() {
  if (aiInteractivePayload.value) showAiInteractive.value = true
}

/**
 * 安全离开课堂页：先 try-catch 断 socket（避免 disconnect 抛错卡死跳转），
 * 然后用 reLaunch 而不是 redirectTo（reLaunch 清空整个页面栈，
 * 更能应付"栈深度异常 / 已经被锁住"的情况）。
 * 三层 fallback：reLaunch 目标 → reLaunch join → navigateTo join。
 */
function navigateAwayFromClassroom(targetUrl: string) {
  try {
    disconnect()
  } catch (e) {
    console.warn('[student] disconnect threw, ignoring', e)
  }
  uni.reLaunch({
    url: targetUrl,
    fail: (err1) => {
      console.error('[student] reLaunch target failed', targetUrl, err1)
      uni.reLaunch({
        url: '/pages/join/index',
        fail: (err2) => {
          console.error('[student] reLaunch join failed', err2)
          uni.navigateTo({
            url: '/pages/join/index',
            fail: (err3) => {
              console.error('[student] navigateTo join failed', err3)
              showToast('退出失败，请手动重启 App', 'error', 5000)
            },
          })
        },
      })
    },
  })
}

function confirmLeaveClassroom() {
  uni.showModal({
    title: '退出课堂',
    content: '确定要离开当前课堂吗？退出后教师将看到你已离开。',
    confirmText: '退出',
    cancelText: '取消',
    confirmColor: '#e23d3d',
    success: (res) => {
      if (!res.confirm) return
      const s = getSocket()
      try { s?.emit(RoomEvent.Leave) } catch { /* ignore */ }
      showToast('已退出课堂', 'info', 1500)
      setTimeout(() => navigateAwayFromClassroom('/pages/join/index'), 300)
    },
  })
}

function formatDeadline(s: string): string {
  try {
    const d = new Date(s)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
  } catch { return s }
}

onLoad((q: any = {}) => {
  lessonId.value = (q.room as string) || ''
  if (!lessonId.value) {
    uni.redirectTo({ url: '/pages/join/index' })
  }
})

function applyLessonStart(data: { courseName?: string; lessonTitle?: string; resetState?: boolean } = {}) {
  if (data.courseName) store.courseName = data.courseName
  if (data.lessonTitle) store.lessonTitle = data.lessonTitle
  if (data.resetState === false) return

  store.currentSlide = 1
  store.totalSlides = 0
  store.slides = []
  store.viewState = 'listening'
  store.previousViewState = 'listening'
  store.quizQuestions = []
  store.currentQuestionIndex = 0
  store.selectedAnswers = {}
  store.activeTaskId = ''
  store.showAttendance = false
  store.attendanceSigned = false
  store.groupData = null
  store.myGroupId = ''
  store.pendingGroups = null
  store.showBroadcast = false
  store.rolledStudent = null
  store.showRollCall = false
  store.competeQuestion = ''
  store.competeTimeLimit = 0
  store.competeStartTime = 0
  store.competeResult = null
  aiPracticeTopic.value = ''
  aiInteractivePayload.value = null
  showAiInteractive.value = false
}

onMounted(() => {
  if (!lessonId.value) return
  const s = connect({
    lessonId: lessonId.value,
    userId: store.studentId,
    userName: store.studentName,
    role: 'student',
    clientType: 'student-tablet',
  })

  s.on(RoomEvent.Joined, (data: any) => {
    store.isOnline = true
    store.currentSlide = data.currentSlide || 1
    store.totalSlides = data.totalSlides || 0
    if (data.lessonMeta) applyLessonStart({ ...data.lessonMeta, resetState: false })
    if (data.isLocked) store.lockScreen()
    if (data.activeQuiz?.taskId) {
      if (data.activeQuiz.randomMode) {
        store.activeTaskId = data.activeQuiz.taskId
        store.quizTimeLimit = data.activeQuiz.timeLimit || 300
      } else {
        store.setQuiz({
          id: data.activeQuiz.taskId,
          questions: data.activeQuiz.questions || [],
          timeLimit: data.activeQuiz.timeLimit,
        })
      }
    }
    if (data.aiPractice?.topic) {
      aiPracticeTopic.value = data.aiPractice.topic
      store.viewState = 'ai_practice'
    }
    studentAnnoApplySnapshot(data?.annotations)
  })

  s.on(RoomEvent.LessonStart, (data: any) => {
    applyLessonStart(data)
  })

  s.on(RoomEvent.JoinError, (data: { message?: string }) => {
    store.isOnline = false
    showToast(data?.message || '加入课堂失败', 'error', 3000)
    setTimeout(() => uni.redirectTo({ url: '/pages/join/index' }), 1200)
  })

  s.on(RoomEvent.SlidesLoaded, (data: any) => {
    store.slides = data.slides || []
    store.totalSlides = data.total || store.slides.length
  })
  s.on(RoomEvent.SlideGoto, (data: any) => {
    store.currentSlide = data.index
    store.totalSlides = data.total || store.totalSlides
    setTimeout(() => measureStudentCanvasAndRedraw(), 30)
  })
  s.on(RoomEvent.AnnotationStrokeStart, studentAnnoApplyStart)
  s.on(RoomEvent.AnnotationStrokePoint, studentAnnoApplyPoint)
  s.on(RoomEvent.AnnotationStrokeEnd, studentAnnoApplyEnd)
  s.on(RoomEvent.AnnotationClear, studentAnnoApplyClear)
  s.on(RoomEvent.AnnotationUndo, studentAnnoApplyUndo)

  s.on(RoomEvent.QuizStart, (task: any) => {
    if (task.randomMode) {
      store.activeTaskId = task.id || task.taskId || ''
      store.quizTimeLimit = task.timeLimit || 300
    } else {
      store.setQuiz(task)
    }
    hasCompeted.value = false
  })
  s.on(RoomEvent.QuizQuestions, (data: any) => {
    if (data.questions && data.questions.length > 0) {
      store.setQuiz({
        id: data.taskId || store.activeTaskId,
        questions: data.questions,
        timeLimit: store.quizTimeLimit,
      })
    }
  })
  s.on(RoomEvent.QuizStop, () => {
    showToast('测验已结束，等待老师批阅', 'info')
  })
  s.on(RoomEvent.QuizReport, () => store.endQuiz())

  s.on(RoomEvent.ScreenLock, () => {
    store.lockScreen()
    // 重档（需 UTS 插件 + Device Owner）：进入 startLockTask，HOME/RECENT/BACK 全禁
    lockToCurrentApp().catch(err => console.warn('[kiosk] lock failed', err))
    // 轻 + 中档（始终生效）：再刷一次沉浸式全屏，吃掉可能被用户 swipe 出的系统栏
    refreshFullscreenOnShow()
  })
  s.on(RoomEvent.ScreenUnlock, () => {
    store.unlockScreen()
    unlockApp().catch(err => console.warn('[kiosk] unlock failed', err))
  })

  s.on(RoomEvent.BroadcastMsg, (data: any) => {
    store.showBroadcastMsg(data.message, data.from)
  })

  s.on(RoomEvent.GroupCreate, (groups: any[]) => {
    if (store.viewState === 'quiz') {
      store.pendingGroups = { groups, studentId: store.studentId }
    } else {
      store.setGroups(groups, store.studentId)
    }
  })
  s.on(RoomEvent.GroupDissolve, () => store.dissolveGroups())

  s.on(RoomEvent.RollCall, (data: any) => {
    store.rolledStudent = data
    store.showRollCall = true
    setTimeout(() => { store.showRollCall = false }, 5000)
  })

  s.on(RoomEvent.CompeteStart, (data: any) => {
    hasCompeted.value = false
    store.startCompete({ question: data.question, timeLimit: data.timeLimit, startTime: data.startTime || Date.now() })
  })
  s.on(RoomEvent.CompeteStop, (data: any) => store.stopCompete(data))

  s.on(RoomEvent.AttendanceStart, (data: any) => {
    store.attendanceMode = data.mode || ''
    store.attendanceConfig = {
      requirePhoto: data.requirePhoto !== false,
      requireLocation: data.requireLocation !== false,
      radius: data.radius || 50,
      teacherLocation: data.teacherLocation,
    }
    store.showAttendance = true
    store.attendanceSigned = false
  })
  s.on(RoomEvent.AttendanceEnd, () => {
    store.showAttendance = false
  })

  s.on(RoomEvent.HomeworkPublish, (hw: any) => store.addHomework(hw))

  s.on(RoomEvent.AiPracticeStart, (data: any) => {
    aiPracticeTopic.value = data.topic
    if (store.viewState !== 'quiz' && store.viewState !== 'locked') {
      store.viewState = 'ai_practice'
    }
  })

  s.on(RoomEvent.AiInteractiveShow, (payload: any) => {
    if (payload?.error) {
      showToast('AI 实践生成失败：' + payload.error, 'error', 3500)
      return
    }
    if (!payload || typeof payload.html !== 'string') {
      showToast('AI 实践内容无效，已忽略', 'error', 3000)
      console.warn('[AiInteractive] invalid payload, missing html', payload)
      return
    }
    const len = payload.html.length
    if (len < 100) {
      showToast(`AI 实践内容过短（${len} 字节），已忽略`, 'error', 3000)
      return
    }
    if (len > 200 * 1024) {
      showToast(`AI 实践内容过大（${Math.round(len / 1024)}KB > 200KB），已忽略以保护设备`, 'error', 4500)
      console.warn('[AiInteractive] payload too large, refusing to open', len)
      return
    }
    aiInteractivePayload.value = payload
    showAiInteractive.value = true
  })

  s.on(RoomEvent.AiPracticeEnd, () => {
    showToast('教师已结束 AI 实践', 'info', 2500)
    aiPracticeTopic.value = ''
    aiInteractivePayload.value = null
    showAiInteractive.value = false
    store.endAiPractice()
  })

  s.on(RoomEvent.AiInteractiveHide, () => {
    aiInteractivePayload.value = null
    showAiInteractive.value = false
  })

  s.on(RoomEvent.LessonEnd, () => {
    showToast('本节课已结束', 'info', 4000)
    store.viewState = 'listening'
    store.isHandRaised = false
    store.showAttendance = false
    store.showBroadcast = false
    store.showRollCall = false
    store.groupData = null
    store.competeResult = null
    setTimeout(() => {
      navigateAwayFromClassroom('/pages/after-class/index')
    }, 1500)
  })

  s.on('quiz:submit:ack', () => { submitting.value = false })

  s.on('connect', () => { store.isOnline = true })
  s.on('disconnect', () => { store.isOnline = false })
})

onShow(() => { reportFocusGained() })
onHide(() => { reportFocusLost() })

/**
 * 卸载课堂页时清理所有 socket 事件监听器。
 *
 * 原 onMounted 用大量 `s.on(RoomEvent.X, anonymous fn)` 注册，没有名引用就 off 不掉。
 * 这里用 `s.off(eventName)` 一次性移除该事件**所有**监听器（Socket.IO v4 行为）；
 * 由于 useSocket 是单例 socket，且本页是唯一注册这些 RoomEvent 的页，全清安全。
 *
 * 不清理的话每次进出课堂页会叠加 N 倍 handler 导致 toast / setState 重复触发。
 */
onUnmounted(() => {
  uni.hideToast()
  const s = getSocket()
  if (!s) return
  const cleanupEvents = [
    RoomEvent.Joined,
    RoomEvent.LessonStart,
    RoomEvent.LessonEnd,
    RoomEvent.JoinError,
    RoomEvent.SlidesLoaded,
    RoomEvent.SlideGoto,
    RoomEvent.AnnotationStrokeStart,
    RoomEvent.AnnotationStrokePoint,
    RoomEvent.AnnotationStrokeEnd,
    RoomEvent.AnnotationClear,
    RoomEvent.AnnotationUndo,
    RoomEvent.QuizStart,
    RoomEvent.QuizQuestions,
    RoomEvent.QuizStop,
    RoomEvent.QuizReport,
    RoomEvent.ScreenLock,
    RoomEvent.ScreenUnlock,
    RoomEvent.BroadcastMsg,
    RoomEvent.GroupCreate,
    RoomEvent.GroupDissolve,
    RoomEvent.RollCall,
    RoomEvent.CompeteStart,
    RoomEvent.CompeteStop,
    RoomEvent.AttendanceStart,
    RoomEvent.AttendanceEnd,
    RoomEvent.HomeworkPublish,
    RoomEvent.AiPracticeStart,
    RoomEvent.AiPracticeEnd,
    RoomEvent.AiInteractiveShow,
    RoomEvent.AiInteractiveHide,
    'quiz:submit:ack',
    'connect',
    'disconnect',
  ] as const
  for (const evt of cleanupEvents) {
    try { s.off(evt) } catch { /* ignore */ }
  }
})
</script>

<style lang="scss" scoped>
@import '@/styles/variables.scss';

.student-main {
  width: 100vw;
  height: 100vh;
  background: var(--color-bg);
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* ===== 场景化背景层 ===== */
.scene-bg {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  overflow: hidden;
}

/* 显式给「需要盖在 .scene-bg 之上的子节点」加 z-index：
 * - 之前用 `.student-main > :not(.scene-bg) { position: relative }` 一刀切，
 *   特异度 (0,2,0) 高过 `.toast-host { position: fixed }` 的 (0,1,0)，
 *   会把 `<view>` 子里所有 fixed/absolute 都强制压回 relative，
 *   导致 toast、浮层 header 等掉回文档流挤压课件画面。
 * - 现在改为显式标记，且 lesson-header 走 absolute 浮层。 */
.student-main > .main-area { position: relative; z-index: 1; }
.student-main > .lesson-header { z-index: 20; }
.student-main > .float-actions { z-index: 50; }

/* —— listening: 极淡网格 —— */
.listening-grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(10, 13, 21, 0.02) 2rpx, transparent 2rpx),
    linear-gradient(90deg, rgba(10, 13, 21, 0.02) 2rpx, transparent 2rpx);
  background-size: 96rpx 96rpx;
  mask-image: radial-gradient(ellipse 60% 50% at center, black 30%, transparent 80%);
  -webkit-mask-image: radial-gradient(ellipse 60% 50% at center, black 30%, transparent 80%);
}

/* —— compete: 三重橙色脉冲环 —— */
.compete-aurora {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(ellipse 70% 50% at center, rgba(245, 166, 35, 0.18), transparent 60%);
}
.ring {
  position: absolute;
  border-radius: 50%;
  border: 4rpx solid rgba(226, 61, 61, 0.18);
  animation: ring-pulse 2.4s var(--ease-decelerate) infinite;
  will-change: transform, opacity;
}
.ring-1 { width: 480rpx; height: 480rpx; animation-delay: 0s; }
.ring-2 { width: 720rpx; height: 720rpx; animation-delay: 0.4s; border-color: rgba(245, 166, 35, 0.22); }
.ring-3 { width: 960rpx; height: 960rpx; animation-delay: 0.8s; border-color: rgba(226, 61, 61, 0.12); }

@keyframes ring-pulse {
  0%   { transform: scale(0.7); opacity: 0; }
  20%  { opacity: 0.9; }
  100% { transform: scale(1.6); opacity: 0; }
}

/* —— ai_practice: 紫色 aurora 三色团雾 —— */
.ai-aurora {
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, rgba(124, 77, 255, 0.06), rgba(47, 107, 255, 0.04));
}
.aurora-blob {
  position: absolute;
  border-radius: 50%;
  filter: blur(120rpx);
  opacity: 0.6;
  will-change: transform;
}
.blob-a { width: 800rpx; height: 800rpx; top: -160rpx; left: 10%;
  background: radial-gradient(circle, rgba(124, 77, 255, 0.55), transparent 70%);
  animation: blob-move-a 24s var(--ease-standard) infinite;
}
.blob-b { width: 720rpx; height: 720rpx; bottom: -120rpx; right: 10%;
  background: radial-gradient(circle, rgba(47, 107, 255, 0.45), transparent 70%);
  animation: blob-move-b 28s var(--ease-standard) infinite;
}
.blob-c { width: 560rpx; height: 560rpx; top: 30%; right: 35%;
  background: radial-gradient(circle, rgba(184, 153, 255, 0.4), transparent 70%);
  animation: blob-move-c 32s var(--ease-standard) infinite;
}
@keyframes blob-move-a {
  0%, 100% { transform: translate(0, 0) scale(1); }
  50%      { transform: translate(80rpx, 60rpx) scale(1.08); }
}
@keyframes blob-move-b {
  0%, 100% { transform: translate(0, 0) scale(1); }
  50%      { transform: translate(-100rpx, -60rpx) scale(1.05); }
}
@keyframes blob-move-c {
  0%, 100% { transform: translate(0, 0) scale(1); }
  33%      { transform: translate(60rpx, -80rpx) scale(0.95); }
  66%      { transform: translate(-80rpx, 40rpx) scale(1.1); }
}

@media (prefers-reduced-motion: reduce) {
  .ring, .aurora-blob { animation: none; }
}

/* Toast 已切到 uni.showToast 原生气泡，不再有页面级 .toast-host 样式 */

/* ============================================================================
 * 锁屏 · 全屏深底 + 多层 aurora + 中心卡片
 *
 * 设计要点（修复"白底白字看不清"问题）：
 * - .lock-screen 用 position: absolute; inset: 0; z-index: var(--z-lock)=2000，
 *   100% 不透明深底直接遮盖 lesson-header / scene-bg / 课件 view，
 *   不再依赖半透明 scrim 叠白课件方案。
 * - 用纯深色 #0a0f24 作为底，叠 3 个高斯模糊 aurora 球（mix-blend: screen），
 *   保持"锁定中但有活力"的视觉感，避免死黑屏被误以为是掉线 / 死机。
 * - 中央 lock-card 不带卡片背景，靠 aurora 衬底；标题字号 56rpx 大字距 + 副文淡蓝白色 + 底部
 *   "等待教师解锁" 胶囊带呼吸点，表明系统在线。
 * ========================================================================== */

.lock-screen {
  position: absolute;
  inset: 0;
  z-index: var(--z-lock);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: lock-screen-fade-in 320ms var(--ease-decelerate);
}

@keyframes lock-screen-fade-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}

.lock-base {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse 80% 60% at 50% 30%, #1b2548 0%, #0a0f24 55%, #050811 100%);
}

.lock-aurora {
  position: absolute;
  inset: 0;
  overflow: hidden;
  filter: blur(80rpx);
  opacity: 0.55;
  pointer-events: none;
}

.lock-aurora-blob {
  position: absolute;
  border-radius: 50%;
  mix-blend-mode: screen;
}

.lock-blob-a {
  top: -120rpx;
  left: -120rpx;
  width: 640rpx;
  height: 640rpx;
  background: radial-gradient(circle, rgba(91, 137, 255, 0.85) 0%, rgba(91, 137, 255, 0) 70%);
  animation: lock-blob-float-a 16s ease-in-out infinite;
}

.lock-blob-b {
  bottom: -140rpx;
  right: -120rpx;
  width: 680rpx;
  height: 680rpx;
  background: radial-gradient(circle, rgba(157, 110, 255, 0.7) 0%, rgba(157, 110, 255, 0) 70%);
  animation: lock-blob-float-b 20s ease-in-out infinite;
}

.lock-blob-c {
  top: 38%;
  right: 30%;
  width: 460rpx;
  height: 460rpx;
  background: radial-gradient(circle, rgba(80, 200, 220, 0.5) 0%, rgba(80, 200, 220, 0) 70%);
  animation: lock-blob-float-c 18s ease-in-out infinite;
}

@keyframes lock-blob-float-a {
  0%, 100% { transform: translate(0, 0) scale(1); }
  50%      { transform: translate(80rpx, 60rpx) scale(1.12); }
}
@keyframes lock-blob-float-b {
  0%, 100% { transform: translate(0, 0) scale(1); }
  50%      { transform: translate(-100rpx, -80rpx) scale(1.18); }
}
@keyframes lock-blob-float-c {
  0%, 100% { transform: translate(0, 0) scale(1); }
  50%      { transform: translate(-60rpx, -40rpx) scale(0.9); }
}

.lock-stars {
  position: absolute;
  inset: 0;
  background-image:
    radial-gradient(circle, rgba(255, 255, 255, 0.18) 1.5rpx, transparent 2rpx);
  background-size: 36rpx 36rpx;
  -webkit-mask-image: radial-gradient(ellipse 65% 55% at center, black 30%, transparent 90%);
  mask-image: radial-gradient(ellipse 65% 55% at center, black 30%, transparent 90%);
  opacity: 0.35;
  pointer-events: none;
}

.lock-card {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-6);
  padding: var(--space-9);
  text-align: center;
  max-width: 720rpx;
}

.lock-icon-wrap {
  position: relative;
  width: 200rpx;
  height: 200rpx;
  border-radius: var(--radius-full);
  background: rgba(255, 255, 255, 0.06);
  border: 2rpx solid rgba(255, 255, 255, 0.25);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow:
    0 0 60rpx rgba(91, 137, 255, 0.35),
    inset 0 0 24rpx rgba(255, 255, 255, 0.06);
}

.lock-icon-pulse-ring {
  position: absolute;
  inset: -16rpx;
  border-radius: 50%;
  border: 2rpx solid rgba(140, 180, 255, 0.55);
  animation: lock-icon-pulse 2.4s ease-out infinite;
  pointer-events: none;
}

.lock-icon-pulse-ring--delay {
  animation-delay: 1.2s;
}

@keyframes lock-icon-pulse {
  0%   { opacity: 0.85; transform: scale(1); }
  100% { opacity: 0;    transform: scale(1.5); }
}

.lock-title {
  font-size: 56rpx;
  font-weight: var(--font-weight-bold);
  color: #ffffff;
  letter-spacing: 8rpx;
  margin-top: var(--space-3);
}

.lock-sub {
  font-size: var(--font-body-lg);
  color: rgba(200, 215, 240, 0.85);
  max-width: 560rpx;
  line-height: 1.7;
  letter-spacing: 1rpx;
}

.lock-status {
  margin-top: var(--space-5);
  display: inline-flex;
  align-items: center;
  gap: var(--space-3);
  padding: 12rpx 28rpx;
  border-radius: var(--radius-pill);
  background: rgba(255, 255, 255, 0.06);
  border: 1rpx solid rgba(255, 255, 255, 0.16);
}

.lock-status-dot {
  width: 14rpx;
  height: 14rpx;
  border-radius: 50%;
  background: #5eead4;
  box-shadow: 0 0 14rpx rgba(94, 234, 212, 0.7);
  animation: lock-status-blink 1.6s ease-in-out infinite;
}

@keyframes lock-status-blink {
  0%, 100% { opacity: 1;   transform: scale(1); }
  50%      { opacity: 0.35; transform: scale(0.82); }
}

.lock-status-text {
  font-size: var(--font-caption);
  color: rgba(200, 215, 240, 0.78);
  letter-spacing: 1rpx;
}

@media (prefers-reduced-motion: reduce) {
  .lock-screen,
  .lock-aurora-blob,
  .lock-icon-pulse-ring,
  .lock-status-dot { animation: none; }
}

/* ===== 教师广播 ===== */
.bcast-card {
  padding: var(--space-6) var(--space-7);
  background: var(--color-surface-raised);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.bcast-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.bcast-label {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--font-label);
  font-weight: var(--font-weight-bold);
  color: var(--color-primary);
}

.bcast-body {
  font-size: var(--font-body-lg);
  color: var(--color-text-primary);
  line-height: var(--line-height-normal);
}

/* ===== 课后作业弹窗 ===== */
.hw-card {
  padding: var(--space-7);
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4);
}

.hw-icon-wrap {
  width: 128rpx;
  height: 128rpx;
  border-radius: var(--radius-2xl);
  background: var(--color-primary-container);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: var(--space-2);
}

.hw-title {
  font-size: var(--font-title);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
}

.hw-desc {
  font-size: var(--font-body);
  color: var(--color-text-secondary);
  line-height: var(--line-height-normal);
  max-width: 480rpx;
}

.hw-meta {
  display: flex;
  justify-content: center;
  gap: var(--space-3);
  flex-wrap: wrap;
}

/* ===== 点名 ===== */
.rollcall-card {
  padding: var(--space-7);
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4);
  border: 4rpx solid transparent;
  &.is-me {
    border-color: var(--color-warning);
    background:
      linear-gradient(var(--color-surface-raised), var(--color-surface-raised)) padding-box,
      var(--color-warning-container);
  }
}

.rc-icon-wrap {
  width: 128rpx;
  height: 128rpx;
  border-radius: var(--radius-full);
  background: var(--color-primary-container);
  display: flex;
  align-items: center;
  justify-content: center;
  .is-me & { background: var(--color-warning-container); }
}

.rc-title {
  font-size: var(--font-title-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-secondary);
}

.rolled-name {
  font-size: var(--font-display);
  font-weight: var(--font-weight-bold);
  color: var(--color-primary);
  letter-spacing: 4rpx;
  .is-me & { color: var(--color-warning); }
}

/* ===== Header（浮层版） =====
 * 关键改动：从「flex 在流」(flex-shrink: 0; min-height: 104rpx;) 改成「绝对浮层」，
 * 不再占据文档流的垂直空间，slide-image 现在能拿满 100vh，不再被 header 挤压。
 * 半透明 + 轻微毛玻璃；不支持 backdrop-filter 的旧版会优雅降级到 0.92 不透明白底，仍可读。 */
.lesson-header {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-3) var(--space-6);
  background: rgba(255, 255, 255, 0.78);
  backdrop-filter: blur(20rpx) saturate(180%);
  -webkit-backdrop-filter: blur(20rpx) saturate(180%);
  border-bottom: 2rpx solid rgba(0, 0, 0, 0.04);
  min-height: 104rpx;
  box-sizing: border-box;
}

/* 缺乏 backdrop-filter 时，回退到稍微不透明的纯白底，保证可读 */
@supports not ((backdrop-filter: blur(2rpx)) or (-webkit-backdrop-filter: blur(2rpx))) {
  .lesson-header {
    background: rgba(255, 255, 255, 0.92);
  }
}

.header-left {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.lesson-mark {
  width: 64rpx;
  height: 64rpx;
  border-radius: var(--radius-md);
  background: var(--color-primary-container);
  display: flex;
  align-items: center;
  justify-content: center;
}

.lesson-text { display: flex; flex-direction: column; gap: 2rpx; }

.course-name {
  font-size: var(--font-body-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.slide-info {
  font-size: var(--font-caption);
  color: var(--color-text-tertiary);
}

.header-right {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.conn-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: var(--color-danger-container);
  border-radius: var(--radius-pill);
  font-size: var(--font-caption);
  color: var(--color-on-danger-container);
  &.online {
    background: var(--color-success-container);
    color: var(--color-on-success-container);
  }
}

.student-chip {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: var(--color-surface-variant);
  border-radius: var(--radius-pill);
}

.student-name {
  font-size: var(--font-label);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-primary);
}

.leave-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: var(--color-surface);
  border: 2rpx solid var(--color-danger);
  color: var(--color-danger);
  border-radius: var(--radius-pill);
  font-size: var(--font-caption);
  font-weight: var(--font-weight-semibold);
  line-height: 1;
  min-height: 56rpx;
  margin: 0;
  transition: background-color var(--duration-fast) var(--ease-standard),
              transform var(--duration-fast) var(--ease-standard);
  &::after { border: 0 !important; }
}

.leave-btn-hover {
  background: var(--color-danger);
  color: var(--color-text-on-color);
  transform: scale(0.97);
}

.leave-btn-text {
  font-size: var(--font-caption);
}

/* ===== Main / content / side rail ===== */
.main-area {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.content-pane {
  flex: 1;
  padding: var(--space-5);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

/* 非 listening 的子视图（quiz / discussion / compete / ai_practice）显式给顶部留出 header 高度，
 * 避免在「lesson-header 改成 absolute 浮层」后被遮住。
 * listening (slide-sync) 故意不加，让幻灯片图像吃满整个 viewport，header 半透明浮在上面。 */
.content-pane > .quiz-area,
.content-pane > .discussion-wrap,
.content-pane > .compete-stage,
.content-pane > .ai-practice-stage {
  margin-top: calc(var(--safe-top) + 104rpx - var(--space-5));
}

.side-rail {
  width: 248rpx;
  flex-shrink: 0;
  /* padding-top 必须能让 side-rail 第一个按钮（举手）完整露在浮层 header 下方，
   * 不然「举手 / 提问 / 笔记 / AI 答疑」头一个会被半透明 header 盖住一截。 */
  padding: calc(var(--safe-top) + 104rpx + var(--space-3)) var(--space-3) var(--space-5);
  padding-bottom: max(var(--space-5), var(--safe-bottom));
  background: var(--color-surface);
  border-left: 2rpx solid var(--color-outline-variant);
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  overflow-y: auto;
}

.rail-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.rail-label {
  display: block;
  font-size: var(--font-overline);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-tertiary);
  padding: 0 var(--space-2);
  margin-bottom: var(--space-2);
  text-transform: uppercase;
  letter-spacing: 2rpx;
}

.rail-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 120rpx;
  padding: var(--space-3) var(--space-2);
  background: var(--color-surface-variant);
  border-radius: var(--radius-lg);
  border: 0;
  margin-bottom: var(--space-2);
  color: var(--color-text-primary);
  transition: background-color var(--duration-fast) var(--ease-standard),
              transform var(--duration-fast) var(--ease-standard);

  &::after { border: 0 !important; }

  .rb-text {
    font-size: var(--font-caption);
    color: inherit;
    margin-top: var(--space-2);
  }
  .rb-text-inverse { color: var(--color-text-on-color); }

  &.primary {
    background: var(--color-secondary);
    color: var(--color-text-on-color);
    box-shadow: var(--elevation-1);
  }
  &.raised {
    background: var(--color-warning-container);
    color: var(--color-on-warning-container);
  }
}

.rail-btn-hover {
  background: var(--color-state-overlay-press);
  transform: scale(0.96);
  &.primary { background: var(--color-secondary-hover); }
}

.rail-info {
  padding: var(--space-3);
  background: var(--color-surface-variant);
  border-radius: var(--radius-md);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.info-row {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--font-caption);
  color: var(--color-text-secondary);
}

/* ===== listening ===== */
.slide-sync {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.slide-image-wrap {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.slide-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
  border-radius: var(--radius-xl);
  box-shadow: var(--elevation-2);
}

.anno-canvas-overlay {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  border-radius: var(--radius-xl);
}

.slide-page-badge {
  position: absolute;
  right: var(--space-4);
  bottom: var(--space-4);
  background: rgba(10, 13, 21, 0.7);
  color: var(--color-text-on-color);
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-pill);
  font-size: var(--font-caption);
  font-weight: var(--font-weight-medium);
  font-variant-numeric: tabular-nums;
}

.slide-placeholder {
  text-align: center;
  padding: var(--space-9) 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
}

.ph-icon-wrap {
  width: 192rpx;
  height: 192rpx;
  border-radius: var(--radius-full);
  background: var(--color-surface-variant);
  display: flex;
  align-items: center;
  justify-content: center;
  animation: ph-icon-float 4s var(--ease-standard) infinite;
}

@keyframes ph-icon-float {
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(-12rpx); }
}

@media (prefers-reduced-motion: reduce) {
  .ph-icon-wrap { animation: none; }
}

.slide-title {
  font-size: var(--font-title);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
}

.slide-desc {
  font-size: var(--font-body);
  color: var(--color-text-tertiary);
}

/* ===== Empty state（讨论等） ===== */
.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
}

.empty-icon {
  width: 144rpx;
  height: 144rpx;
  border-radius: var(--radius-full);
  background: var(--color-surface-variant);
  display: flex;
  align-items: center;
  justify-content: center;
  animation: empty-icon-float 5s var(--ease-standard) infinite;
}

@keyframes empty-icon-float {
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(-8rpx); }
}

@media (prefers-reduced-motion: reduce) {
  .empty-icon { animation: none; }
}

.empty-title {
  font-size: var(--font-title-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.empty-desc {
  font-size: var(--font-body);
  color: var(--color-text-secondary);
}

/* ===== quiz ===== */
.quiz-area {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  height: 100%;
}

.quiz-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 var(--space-2);
}

.quiz-title-wrap {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
}

.quiz-title {
  font-size: var(--font-title-sm);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
}

.quiz-progress {
  font-size: var(--font-label);
  color: var(--color-text-secondary);
  font-variant-numeric: tabular-nums;
}

.quiz-body { flex: 1; overflow-y: auto; }

.landscape .quiz-grid {
  display: grid;
  grid-template-columns: 1.1fr 1fr;
  gap: var(--space-5);
  height: 100%;
}

.portrait .quiz-grid {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.question-card,
.answer-card {
  background: var(--color-surface);
  border-radius: var(--radius-xl);
  padding: var(--space-6);
  box-shadow: var(--elevation-1);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.q-content {
  display: block;
  font-size: var(--font-body-lg);
  line-height: var(--line-height-normal);
  color: var(--color-text-primary);
}

.options {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  flex: 1;
}

.option {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-4);
  border: 2rpx solid var(--color-outline);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  min-height: 96rpx;
  transition: background-color var(--duration-fast) var(--ease-standard),
              border-color var(--duration-fast) var(--ease-standard),
              transform var(--duration-fast) var(--ease-standard);

  &.selected {
    border-color: var(--color-primary);
    background: var(--color-primary-container);
  }
}

.option-hover {
  background: var(--color-state-overlay-press);
  transform: scale(0.99);
  &.selected { background: var(--color-primary-container); }
}

.opt-marker {
  width: 56rpx;
  height: 56rpx;
  border-radius: var(--radius-full);
  background: var(--color-surface-variant);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-label);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-secondary);
  flex-shrink: 0;
  .selected & { background: var(--color-primary); color: var(--color-text-on-color); }
}

.opt-content {
  flex: 1;
  font-size: var(--font-body);
  color: var(--color-text-primary);
  line-height: var(--line-height-snug);
}

.opt-check {
  width: 40rpx;
  height: 40rpx;
  border-radius: var(--radius-full);
  background: var(--color-primary);
  display: flex;
  align-items: center;
  justify-content: center;
}

.short-input {
  width: 100%;
  min-height: 240rpx;
  padding: var(--space-4);
  border: 2rpx solid var(--color-outline);
  border-radius: var(--radius-lg);
  font-size: var(--font-body);
  line-height: var(--line-height-normal);
  box-sizing: border-box;
  background: var(--color-surface-variant);
  color: var(--color-text-primary);
}

.quiz-actions {
  display: flex;
  gap: var(--space-3);
  margin-top: var(--space-3);
}

/* ===== compete ===== */
.compete-stage {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-7);
  gap: var(--space-6);
}

.compete-q {
  font-size: var(--font-title-lg);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
  text-align: center;
  max-width: 80%;
  line-height: var(--line-height-snug);
}

.compete-btn {
  position: relative;
  width: 280rpx;
  height: 280rpx;
  border-radius: var(--radius-full);
  background: linear-gradient(135deg, var(--p-amber-500), var(--p-red-500));
  color: var(--color-text-on-color);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  box-shadow: var(--elevation-3), 0 0 0 0 rgba(226, 61, 61, 0.5);
  transition: transform var(--duration-fast) var(--ease-standard),
              box-shadow var(--duration-base) var(--ease-standard);
  animation: compete-breathe 1.6s var(--ease-standard) infinite;

  &::after { border: 0 !important; }
}

@keyframes compete-breathe {
  0%, 100% {
    box-shadow: var(--elevation-3), 0 0 0 0 rgba(226, 61, 61, 0.45);
    transform: scale(1);
  }
  50% {
    box-shadow: var(--elevation-3), 0 0 0 32rpx rgba(226, 61, 61, 0);
    transform: scale(1.03);
  }
}

@media (prefers-reduced-motion: reduce) {
  .compete-btn { animation: none; }
}

.compete-btn-hover {
  transform: scale(0.94);
  box-shadow: var(--elevation-2);
}

.compete-btn-text {
  font-size: var(--font-title);
  font-weight: var(--font-weight-bold);
  letter-spacing: 4rpx;
}

.compete-done {
  display: inline-flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-7);
  background: var(--color-success-container);
  color: var(--color-on-success-container);
  border-radius: var(--radius-pill);
  font-size: var(--font-body);
  font-weight: var(--font-weight-medium);
}

.compete-result {
  display: inline-flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-6);
  background: var(--color-warning-container);
  border-radius: var(--radius-xl);
}

.result-title {
  font-size: var(--font-title-sm);
  font-weight: var(--font-weight-bold);
  color: var(--color-on-warning-container);
}

/* ===== ai_practice ===== */
.ai-practice-stage {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-7);
  gap: var(--space-5);
}

.ap-icon-wrap {
  position: relative;
  width: 192rpx;
  height: 192rpx;
  border-radius: var(--radius-2xl);
  background: var(--color-secondary-container);
  display: flex;
  align-items: center;
  justify-content: center;
  animation: ap-icon-float 4s var(--ease-standard) infinite;
}

.ap-icon-wrap::before {
  content: '';
  position: absolute;
  inset: -16rpx;
  border-radius: var(--radius-2xl);
  background: radial-gradient(circle, rgba(124, 77, 255, 0.32), transparent 70%);
  filter: blur(24rpx);
  z-index: -1;
  animation: ap-icon-glow 2.4s var(--ease-standard) infinite;
}

@keyframes ap-icon-float {
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(-12rpx); }
}

@keyframes ap-icon-glow {
  0%, 100% { opacity: 0.55; transform: scale(1); }
  50%      { opacity: 1;    transform: scale(1.12); }
}

@media (prefers-reduced-motion: reduce) {
  .ap-icon-wrap, .ap-icon-wrap::before { animation: none; }
}

.ap-title {
  font-size: var(--font-headline);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
}

.ap-topic {
  font-size: var(--font-body-lg);
  color: var(--color-secondary);
  text-align: center;
  max-width: 80%;
  line-height: var(--line-height-normal);
}

/* ===== 竖屏 FAB ===== */
.float-actions {
  position: fixed;
  right: max(var(--space-4), var(--safe-right));
  z-index: 50;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.fab {
  width: 104rpx;
  height: 104rpx;
  background: var(--color-surface);
  color: var(--color-text-primary);
  border-radius: var(--radius-full);
  border: 0;
  box-shadow: var(--elevation-3);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color var(--duration-fast) var(--ease-standard),
              transform var(--duration-fast) var(--ease-standard),
              box-shadow var(--duration-base) var(--ease-standard);

  &::after { border: 0 !important; }

  &.primary {
    background: var(--color-secondary);
    color: var(--color-text-on-color);
  }
  &.raised {
    background: var(--color-warning-container);
    color: var(--color-on-warning-container);
  }
}

.fab-hover {
  transform: scale(0.92);
  box-shadow: var(--elevation-2);
}

/* ===== 提问弹窗 ===== */
.q-card {
  padding: var(--space-7);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.q-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.q-card-title {
  font-size: var(--font-title);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
}

.q-textarea {
  width: 100%;
  min-height: 240rpx;
  padding: var(--space-4);
  border: 2rpx solid var(--color-outline);
  border-radius: var(--radius-lg);
  font-size: var(--font-body);
  line-height: var(--line-height-normal);
  box-sizing: border-box;
  background: var(--color-surface-variant);
  color: var(--color-text-primary);
}

.q-meta {
  display: flex;
  justify-content: flex-end;
}

.q-meta-text {
  font-size: var(--font-caption);
  color: var(--color-text-tertiary);
  font-variant-numeric: tabular-nums;
}

.q-actions {
  display: flex;
  gap: var(--space-3);
  margin-top: var(--space-2);
}
</style>
