<template>
  <div v-if="detail" class="cl-page">
    <!-- ============ 顶部返回栏 ============ -->
    <div class="back-row card-rise">
      <router-link to="/monitor" class="back-link">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M19 12H5M12 19l-7-7 7-7"/>
        </svg>
        返回实时监控
      </router-link>
      <div class="back-actions">
        <button class="ghost-btn" @click="refresh">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>
          刷新
        </button>
      </div>
    </div>

    <!-- ============ Hero ============ -->
    <header class="hero card-rise" :style="{ animationDelay: '40ms' }">
      <div class="hero-main">
        <div class="hero-icon" :data-locked="detail.isLocked">
          <svg v-if="!detail.isLocked" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>
          <svg v-else width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        </div>
        <div class="hero-text">
          <div class="hero-title-row">
            <h1>{{ detail.name }}</h1>
            <span class="hero-live-chip">
              <span class="hero-live-dot"></span>
              直播中 · 已上 {{ elapsedMinutes }} 分钟
            </span>
          </div>
          <p class="hero-meta">
            <strong>{{ detail.teacherName }}</strong> · {{ detail.className }} ·
            当前章节：<strong>{{ detail.currentTopic }}</strong>
          </p>
        </div>
      </div>

      <div class="hero-actions">
        <button class="hero-action" @click="openBroadcast">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/></svg>
          广播
        </button>
        <button class="hero-action" @click="toggleLock">
          <svg v-if="!detail.isLocked" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>
          {{ detail.isLocked ? '解锁屏幕' : '锁定屏幕' }}
        </button>
        <button class="hero-action" @click="startQuiz">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          发测验
        </button>
        <button class="hero-action" @click="startCompete">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
          抢答
        </button>
      </div>
    </header>

    <!-- ============ KPI ============ -->
    <section class="kpi-grid">
      <article class="kpi-card card-rise">
        <div class="kpi-head">
          <div class="kpi-icon kpi-icon--success">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </div>
          <span class="kpi-label">在线 / 总数</span>
        </div>
        <div class="kpi-value-row">
          <span class="kpi-value num-tabular">{{ detail.online }}<small> / {{ detail.total }}</small></span>
        </div>
        <div class="kpi-subtext">{{ Math.round(detail.online / detail.total * 100) }}% 在线率</div>
      </article>

      <article class="kpi-card card-rise" :style="{ animationDelay: '50ms' }">
        <div class="kpi-head">
          <div class="kpi-icon kpi-icon--brand">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
          </div>
          <span class="kpi-label">课件进度</span>
        </div>
        <div class="kpi-value-row">
          <span class="kpi-value num-tabular">{{ detail.currentSlide }}<small> / {{ detail.totalSlides }}</small></span>
        </div>
        <div class="kpi-progress-bar">
          <div class="kpi-progress-fill" :style="{ width: progressPct + '%' }"></div>
        </div>
      </article>

      <article class="kpi-card card-rise" :style="{ animationDelay: '100ms' }">
        <div class="kpi-head">
          <div class="kpi-icon kpi-icon--warning">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          </div>
          <span class="kpi-label">本节互动</span>
        </div>
        <div class="kpi-value-row">
          <span class="kpi-value num-tabular">{{ interactionCount }}</span>
          <span class="kpi-unit">次</span>
        </div>
        <div class="kpi-subtext">{{ raiseCount }} 举手 / {{ questionCount }} 提问</div>
      </article>

      <article class="kpi-card card-rise" :style="{ animationDelay: '150ms' }">
        <div class="kpi-head">
          <div class="kpi-icon kpi-icon--ai">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l1.5 4.5L18 8l-4.5 1.5L12 14l-1.5-4.5L6 8l4.5-1.5z"/></svg>
          </div>
          <span class="kpi-label">AI 调用</span>
        </div>
        <div class="kpi-value-row">
          <span class="kpi-value num-tabular">{{ detail.aiCalls.length }}</span>
          <span class="kpi-unit">次</span>
        </div>
        <div class="kpi-subtext">学习氛围 {{ detail.vibeScore }} / 100</div>
      </article>
    </section>

    <!-- ============ 主体：左主 + 右侧 ============ -->
    <section class="main-split">
      <div class="main-col">
        <!-- 当前活动卡 -->
        <div class="surface-card activity-card card-rise" :style="{ animationDelay: '160ms' }" :data-kind="detail.activity.kind">
          <header class="surface-header">
            <div>
              <div class="activity-kind-row">
                <span class="activity-pulse"></span>
                <h2>当前活动：{{ detail.activity.label }}</h2>
              </div>
              <p class="surface-sub">{{ activitySub }}</p>
            </div>
            <span class="activity-clock num-tabular">{{ nowClock }}</span>
          </header>

          <!-- 1) 测验 -->
          <div v-if="detail.activity.kind === 'quiz'" class="quiz-panel">
            <p class="quiz-question">{{ detail.activity.question }}</p>
            <div class="quiz-progress">
              <span class="quiz-progress-label">提交进度</span>
              <div class="quiz-progress-bar">
                <div class="quiz-progress-fill" :style="{ width: submittedPct + '%' }"></div>
              </div>
              <span class="quiz-progress-num num-tabular">{{ detail.activity.submitted }} / {{ detail.activity.total }}</span>
            </div>
            <ul class="quiz-choices">
              <li
                v-for="(c, i) in detail.activity.choices"
                :key="i"
                class="quiz-choice"
                :data-correct="String.fromCharCode(65 + i) === detail.activity.correct"
              >
                <span class="choice-letter">{{ String.fromCharCode(65 + i) }}</span>
                <span class="choice-text">{{ c }}</span>
                <div class="choice-bar">
                  <div class="choice-bar-fill" :style="{ width: choicePct(String.fromCharCode(65 + i) as 'A' | 'B' | 'C' | 'D') + '%' }"></div>
                </div>
                <span class="choice-count num-tabular">{{ choiceCount(String.fromCharCode(65 + i) as 'A' | 'B' | 'C' | 'D') }}</span>
              </li>
            </ul>
          </div>

          <!-- 2) 抢答 -->
          <div v-else-if="detail.activity.kind === 'compete'" class="compete-panel">
            <p class="compete-question">{{ detail.activity.question }}</p>
            <div class="compete-body">
              <div class="compete-winner">
                <span class="compete-winner-avatar">{{ detail.activity.winnerName?.charAt(0) || '?' }}</span>
                <div class="compete-winner-text">
                  <span class="compete-winner-label">抢答最快</span>
                  <span class="compete-winner-name">{{ detail.activity.winnerName || '等待中…' }}</span>
                </div>
              </div>
              <div class="compete-countdown">
                <svg viewBox="0 0 100 100" class="countdown-ring">
                  <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(239,68,68,0.15)" stroke-width="6" />
                  <circle
                    cx="50" cy="50" r="44" fill="none"
                    stroke="var(--color-danger-500)" stroke-width="6" stroke-linecap="round"
                    :stroke-dasharray="276.46"
                    :stroke-dashoffset="276.46 - (detail.activity.secondsLeft / 10) * 276.46"
                    transform="rotate(-90 50 50)"
                  />
                </svg>
                <span class="countdown-num num-tabular">{{ detail.activity.secondsLeft }}s</span>
              </div>
            </div>
          </div>

          <!-- 3) 分组 -->
          <div v-else-if="detail.activity.kind === 'group'" class="group-panel">
            <div class="group-grid">
              <article v-for="g in detail.activity.groups" :key="g.id" class="group-item">
                <div class="group-head">
                  <h3 class="group-name">{{ g.name }}</h3>
                  <span class="group-msg-count num-tabular">{{ g.messages }} 条</span>
                </div>
                <p class="group-topic">{{ g.topic }}</p>
                <div class="group-members">
                  <span v-for="i in Math.min(g.members, 5)" :key="i" class="group-avatar">{{ i }}</span>
                  <span v-if="g.members > 5" class="group-avatar group-avatar-more">+{{ g.members - 5 }}</span>
                </div>
              </article>
            </div>
          </div>

          <!-- 4) AI 实践 -->
          <div v-else-if="detail.activity.kind === 'practice'" class="practice-panel">
            <div class="practice-row">
              <span class="practice-label">练习主题</span>
              <span class="practice-topic">{{ detail.activity.topic }}</span>
            </div>
            <div class="practice-stats">
              <div class="practice-stat">
                <span class="practice-stat-val num-tabular">{{ detail.activity.completed }}</span>
                <span class="practice-stat-label">已完成</span>
              </div>
              <div class="practice-stat">
                <span class="practice-stat-val num-tabular">{{ detail.activity.participants }}</span>
                <span class="practice-stat-label">参与人数</span>
              </div>
              <div class="practice-stat">
                <span class="practice-stat-val num-tabular">{{ Math.round(detail.activity.completed / detail.activity.participants * 100) }}<small>%</small></span>
                <span class="practice-stat-label">完成率</span>
              </div>
            </div>
            <div class="practice-bar">
              <div class="practice-bar-fill" :style="{ width: (detail.activity.completed / detail.activity.participants * 100) + '%' }"></div>
            </div>
          </div>

          <!-- 5) 签到 -->
          <div v-else-if="detail.activity.kind === 'attendance'" class="practice-panel">
            <div class="practice-row">
              <span class="practice-label">签到方式</span>
              <span class="practice-topic">{{ detail.activity.mode }}</span>
            </div>
            <div class="practice-stats">
              <div class="practice-stat">
                <span class="practice-stat-val num-tabular">{{ detail.activity.signed }}</span>
                <span class="practice-stat-label">已签到</span>
              </div>
              <div class="practice-stat">
                <span class="practice-stat-val num-tabular">{{ detail.activity.total }}</span>
                <span class="practice-stat-label">总人数</span>
              </div>
              <div class="practice-stat">
                <span class="practice-stat-val num-tabular">{{ Math.round(detail.activity.signed / detail.activity.total * 100) }}<small>%</small></span>
                <span class="practice-stat-label">签到率</span>
              </div>
            </div>
            <div class="practice-bar">
              <div class="practice-bar-fill" :style="{ width: (detail.activity.signed / detail.activity.total * 100) + '%' }"></div>
            </div>
          </div>

          <!-- 6) 锁屏 -->
          <div v-else-if="detail.activity.kind === 'locked'" class="locked-panel">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            <p class="locked-text">教师已锁定全员屏幕，学生当前只能看到锁屏页</p>
            <button class="primary-btn" @click="toggleLock">解锁屏幕</button>
          </div>

          <!-- 7) 授课中（默认） -->
          <div v-else class="idle-panel">
            <p class="idle-text">课堂正常进行中，等待教师下一步操作…</p>
          </div>
        </div>

        <!-- 学生网格 -->
        <div class="surface-card students-card card-rise" :style="{ animationDelay: '200ms' }">
          <header class="surface-header">
            <div>
              <h2>学生 ({{ detail.online }} 在线 / {{ detail.total }} 总人数)</h2>
              <p class="surface-sub">悬停可查看每位学生的最近互动</p>
            </div>
            <div class="status-legend">
              <span><span class="leg-dot" data-status="online"></span>在线</span>
              <span><span class="leg-dot" data-status="raised"></span>举手</span>
              <span><span class="leg-dot" data-status="submitted"></span>已答</span>
              <span><span class="leg-dot" data-status="ai-asking"></span>问 AI</span>
              <span><span class="leg-dot" data-status="offline"></span>离线</span>
            </div>
          </header>

          <div class="stu-grid">
            <button
              v-for="stu in detail.students"
              :key="stu.id"
              class="stu-tile"
              :data-status="stu.status"
              :title="`${stu.name} · ${STATUS_LABEL[stu.status]}${stu.lastInteraction ? ' · ' + stu.lastInteraction : ''}`"
            >
              <span class="stu-avatar" :data-gender="stu.gender">{{ stu.name.charAt(0) }}</span>
              <span class="stu-status-dot" :data-status="stu.status"></span>
              <span v-if="stu.currentChoice" class="stu-choice-badge">{{ stu.currentChoice }}</span>
              <span v-else-if="stu.status === 'raised'" class="stu-icon-badge">
                <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor"><path d="M11 17.5h2v-9h-2zm1-13a1 1 0 1 0 0 2 1 1 0 0 0 0-2z"/></svg>
              </span>
              <span class="stu-name">{{ stu.name }}</span>
            </button>
          </div>
        </div>
      </div>

      <div class="side-col">
        <!-- 互动 timeline -->
        <div class="surface-card timeline-card card-rise" :style="{ animationDelay: '180ms' }">
          <header class="surface-header">
            <div>
              <h2>课堂互动</h2>
              <p class="surface-sub">从课堂开始至今的关键事件</p>
            </div>
            <span class="badge-count num-tabular">{{ detail.timeline.length }}</span>
          </header>
          <ol class="timeline">
            <li
              v-for="(t, idx) in detail.timeline"
              :key="t.id"
              class="tl-item"
              :data-tone="TIMELINE_TONE[t.type]"
              :style="{ animationDelay: 200 + idx * 40 + 'ms' }"
            >
              <span class="tl-dot"></span>
              <div class="tl-body">
                <div class="tl-head">
                  <span class="tl-title">{{ t.title }}</span>
                  <span class="tl-time num-tabular">{{ t.time }}</span>
                </div>
                <p v-if="t.detail" class="tl-detail">{{ t.detail }}</p>
                <span v-if="t.actor" class="tl-actor">触发者：{{ t.actor }}</span>
              </div>
            </li>
          </ol>
        </div>

        <!-- AI 调用流水 -->
        <div class="surface-card ai-card card-rise" :style="{ animationDelay: '240ms' }">
          <header class="surface-header">
            <div>
              <h2>AI 助手调用</h2>
              <p class="surface-sub">本节课最近 {{ detail.aiCalls.length }} 次</p>
            </div>
            <span class="ai-badge">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l1.5 4.5L18 8l-4.5 1.5L12 14l-1.5-4.5L6 8l4.5-1.5z"/></svg>
              {{ detail.aiCalls.reduce((s, c) => s + c.tokens, 0).toLocaleString() }} tokens
            </span>
          </header>
          <ul class="ai-list">
            <li v-for="(a, idx) in detail.aiCalls" :key="a.id" class="ai-item" :data-status="a.status" :style="{ animationDelay: 260 + idx * 40 + 'ms' }">
              <div class="ai-head">
                <span class="ai-feature-pill" :data-feat="a.feature">{{ FEATURE_LABEL[a.feature] }}</span>
                <span class="ai-actor">
                  <span class="ai-actor-name">{{ a.actorName }}</span>
                  <span class="ai-actor-role">{{ a.actorRole }}</span>
                </span>
                <span class="ai-time num-tabular">{{ a.time }}</span>
              </div>
              <p class="ai-prompt">{{ a.prompt }}</p>
              <div class="ai-meta">
                <span class="num-tabular">{{ a.tokens }} tokens</span>
                <span class="num-tabular">{{ a.durationMs }}ms</span>
                <span class="ai-status" :data-status="a.status">
                  {{ a.status === 'success' ? '成功' : a.status === 'streaming' ? '流式中' : '已拦截' }}
                </span>
              </div>
            </li>
          </ul>
        </div>
      </div>
    </section>

    <!-- ============ 广播对话框 ============ -->
    <div v-if="showBroadcast" class="modal-mask" @click.self="showBroadcast = false">
      <div class="modal-card">
        <header class="modal-head">
          <h3>向 {{ detail.name }} 广播</h3>
          <button class="ghost-btn" @click="showBroadcast = false">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </header>
        <textarea v-model="broadcastText" class="modal-textarea" placeholder="输入广播内容，回车换行…" rows="4"></textarea>
        <footer class="modal-foot">
          <button class="ghost-btn" @click="showBroadcast = false">取消</button>
          <button class="primary-btn" @click="confirmBroadcast">发送广播</button>
        </footer>
      </div>
    </div>
  </div>

  <div v-else class="not-found">
    <h2>课堂不存在或已结束</h2>
    <router-link to="/monitor" class="back-link">返回实时监控</router-link>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  FEATURE_LABEL,
  STATUS_LABEL,
  TIMELINE_TONE,
  getLiveClassroomDetail,
} from '../mocks/liveClassroom'
import { useAdminSocket } from '../composables/useAdminSocket'

const route = useRoute()

const detail = ref(getLiveClassroomDetail(route.params.roomId as string))

const { sendBroadcast } = useAdminSocket()

/* 时间 */
const nowClock = ref('')
let timer: ReturnType<typeof setInterval> | null = null
function tick() {
  const d = new Date()
  nowClock.value = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`
}

/* 计算 */
const elapsedMinutes = computed(() => {
  if (!detail.value) return 0
  const [h, m] = detail.value.startedAt.split(':').map(Number)
  const now = new Date()
  return Math.max(0, (now.getHours() - h) * 60 + (now.getMinutes() - m))
})

const progressPct = computed(() => detail.value
  ? Math.round(detail.value.currentSlide / detail.value.totalSlides * 100)
  : 0)

const activitySub = computed(() => {
  if (!detail.value) return ''
  const a = detail.value.activity
  switch (a.kind) {
    case 'quiz':       return '学生答题中，进度持续滚动'
    case 'compete':    return '抢答中，倒计时进行'
    case 'group':      return `${a.groups.length} 个讨论组同时进行`
    case 'practice':   return 'AI 实践沙盒正在使用'
    case 'attendance': return '正在采集签到'
    case 'locked':     return '学生屏幕已锁定'
    case 'idle':       return '常规授课，无特殊活动'
    default:           return ''
  }
})

const interactionCount = computed(() => detail.value
  ? detail.value.timeline.filter(t => t.type === 'hand:raise' || t.type === 'student:question' || t.type === 'quiz:submit' || t.type === 'compete:answer' || t.type === 'attendance:sign').length
  : 0)

const raiseCount = computed(() => detail.value
  ? detail.value.timeline.filter(t => t.type === 'hand:raise').length
  : 0)

const questionCount = computed(() => detail.value
  ? detail.value.timeline.filter(t => t.type === 'student:question').length
  : 0)

/* 测验工具 */
const submittedPct = computed(() => {
  const a = detail.value?.activity
  if (a?.kind !== 'quiz') return 0
  return Math.round(a.submitted / a.total * 100)
})
function choiceCount(c: 'A' | 'B' | 'C' | 'D'): number {
  const a = detail.value?.activity
  if (a?.kind !== 'quiz') return 0
  return a.distribution[c]
}
function choicePct(c: 'A' | 'B' | 'C' | 'D'): number {
  const a = detail.value?.activity
  if (a?.kind !== 'quiz') return 0
  const total = a.distribution.A + a.distribution.B + a.distribution.C + a.distribution.D
  return total > 0 ? Math.round(a.distribution[c] / total * 100) : 0
}

/* 操作按钮（mock 反馈，不真实触发后端） */
const showBroadcast = ref(false)
const broadcastText = ref('')

function openBroadcast() {
  broadcastText.value = ''
  showBroadcast.value = true
}
async function confirmBroadcast() {
  const text = broadcastText.value.trim()
  if (!text) {
    ElMessage.warning('请输入广播内容')
    return
  }
  showBroadcast.value = false
  const result = await sendBroadcast(text)
  if (result.lessonsReached < 0) {
    ElMessage.info('广播已发送（演示环境模拟，未收到服务端确认）')
  } else if (result.lessonsReached === 0) {
    ElMessage.success('广播已发出（当前演示环境无真实在线课堂）')
  } else {
    ElMessage.success(`广播已下发到 ${result.lessonsReached} 个真实课堂`)
  }
}

function toggleLock() {
  if (!detail.value) return
  detail.value.isLocked = !detail.value.isLocked
  if (detail.value.isLocked) {
    detail.value.activity = { kind: 'locked', label: '屏幕已锁定' } as any
    ElMessage.success('已锁定全员屏幕')
  } else {
    detail.value.activity = { kind: 'idle', label: '授课中' } as any
    ElMessage.success('已解锁全员屏幕')
  }
}

function startQuiz() {
  ElMessage.info('请前往教师端发起随堂测验（演示环境此处仅占位）')
}
function startCompete() {
  ElMessage.info('请前往教师端发起抢答（演示环境此处仅占位）')
}

function refresh() {
  detail.value = getLiveClassroomDetail(route.params.roomId as string)
  ElMessage.success('课堂数据已刷新')
}

onMounted(() => {
  tick()
  timer = setInterval(tick, 1000)
})
onUnmounted(() => {
  if (timer) clearInterval(timer)
})
</script>

<style scoped>
.cl-page {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  padding-bottom: var(--space-5);
}

.back-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.back-link {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  text-decoration: none;
  font-weight: var(--font-weight-medium);
  transition: color var(--duration-fast);
}
.back-link:hover { color: var(--color-brand-600); }
.back-actions { display: flex; gap: var(--space-2); }
.ghost-btn {
  appearance: none;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px var(--space-3);
  border-radius: var(--radius-md);
  background: var(--color-bg-soft);
  border: 1px solid var(--color-border-default);
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  transition: background var(--duration-fast), color var(--duration-fast);
}
.ghost-btn:hover {
  background: var(--color-bg-elevated);
  color: var(--color-text-primary);
}
.primary-btn {
  appearance: none;
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: 8px var(--space-4);
  border-radius: var(--radius-md);
  background: var(--color-brand-500);
  color: #fff;
  border: 0;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  transition: background var(--duration-fast);
}
.primary-btn:hover { background: var(--color-brand-600); }

/* ============ Hero ============ */
.hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-5);
  padding: var(--space-6);
  background: linear-gradient(135deg, #0e2c8a 0%, #2f54eb 60%, #06b6d4 100%);
  border-radius: var(--radius-xl);
  color: #fff;
  box-shadow: var(--shadow-lg);
  overflow: hidden;
  position: relative;
}
.hero::before {
  content: '';
  position: absolute;
  inset: -40% -10% auto auto;
  width: 380px;
  height: 380px;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.22) 0%, transparent 60%);
  pointer-events: none;
}
.hero-main {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  z-index: 1;
  min-width: 0;
  flex: 1;
}
.hero-icon {
  width: 64px;
  height: 64px;
  border-radius: var(--radius-lg);
  background: rgba(255, 255, 255, 0.18);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  flex-shrink: 0;
  backdrop-filter: blur(8px);
  transition: background var(--duration-base);
}
.hero-icon[data-locked='true'] { background: rgba(239, 68, 68, 0.3); }

.hero-text { flex: 1; min-width: 0; }
.hero-title-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
}
.hero-title-row h1 {
  margin: 0;
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  letter-spacing: 0.02em;
}
.hero-live-chip {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: 4px var(--space-3);
  border-radius: var(--radius-full);
  background: rgba(255, 255, 255, 0.18);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  backdrop-filter: blur(8px);
}
.hero-live-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-success-500);
  box-shadow: 0 0 0 4px rgba(22, 163, 74, 0.25);
  animation: live-pulse 1.5s infinite;
}
@keyframes live-pulse {
  0%, 100% { box-shadow: 0 0 0 4px rgba(22, 163, 74, 0.25); }
  50%      { box-shadow: 0 0 0 8px rgba(22, 163, 74, 0); }
}
.hero-meta {
  margin: var(--space-2) 0 0 0;
  font-size: var(--font-size-base);
  color: rgba(255, 255, 255, 0.85);
}
.hero-meta strong {
  color: #fff;
  font-weight: var(--font-weight-bold);
}

.hero-actions {
  display: flex;
  gap: var(--space-2);
  flex-shrink: 0;
  z-index: 1;
  flex-wrap: wrap;
}
.hero-action {
  appearance: none;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 8px var(--space-3);
  background: rgba(255, 255, 255, 0.18);
  border-radius: var(--radius-md);
  border: 0;
  color: #fff;
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  backdrop-filter: blur(8px);
  transition: background var(--duration-fast);
}
.hero-action:hover { background: rgba(255, 255, 255, 0.3); }

/* ============ KPI ============ */
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-4);
}
.kpi-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-5);
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
}
.kpi-head { display: flex; align-items: center; gap: var(--space-3); }
.kpi-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: var(--radius-md);
}
.kpi-icon--brand   { background: var(--color-brand-50);   color: var(--color-brand-600);   }
.kpi-icon--success { background: var(--color-success-50); color: var(--color-success-600); }
.kpi-icon--warning { background: var(--color-warning-50); color: var(--color-warning-600); }
.kpi-icon--ai      { background: var(--color-ai-50);      color: var(--color-ai-600);      }
.kpi-label {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  font-weight: var(--font-weight-medium);
}
.kpi-value-row { display: flex; align-items: baseline; gap: var(--space-2); }
.kpi-value {
  font-size: var(--font-size-3xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
  line-height: var(--line-height-tight);
  letter-spacing: -0.02em;
  display: inline-flex;
  align-items: baseline;
  gap: 4px;
}
.kpi-value small {
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-regular);
  color: var(--color-text-tertiary);
}
.kpi-unit {
  font-size: var(--font-size-sm);
  color: var(--color-text-tertiary);
  font-weight: var(--font-weight-medium);
}
.kpi-subtext {
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
}
.kpi-progress-bar {
  height: 4px;
  background: var(--color-border-subtle);
  border-radius: var(--radius-full);
  overflow: hidden;
}
.kpi-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--color-brand-500), var(--color-ai-500));
  transition: width var(--duration-slow) var(--ease-out);
}

/* ============ Main Split ============ */
.main-split {
  display: grid;
  grid-template-columns: 1.5fr 1fr;
  gap: var(--space-4);
  align-items: start;
}
.main-col, .side-col {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.surface-card {
  display: flex;
  flex-direction: column;
  padding: var(--space-5);
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
}
.surface-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
  margin-bottom: var(--space-4);
  flex-wrap: wrap;
}
.surface-header h2 {
  margin: 0;
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semi);
  color: var(--color-text-primary);
}
.surface-sub {
  margin: 4px 0 0 0;
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
}
.badge-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  height: 24px;
  padding: 0 var(--space-2);
  border-radius: var(--radius-full);
  background: var(--color-brand-50);
  color: var(--color-brand-600);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semi);
}

/* ============ Activity Card ============ */
.activity-card {
  position: relative;
  overflow: hidden;
  background: linear-gradient(180deg, var(--color-bg-elevated) 0%, var(--color-bg-soft) 100%);
}
.activity-card::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 3px;
  background: var(--color-brand-500);
}
.activity-card[data-kind='quiz']::before    { background: var(--color-warning-500); }
.activity-card[data-kind='compete']::before { background: var(--color-danger-500); }
.activity-card[data-kind='group']::before   { background: var(--color-success-500); }
.activity-card[data-kind='practice']::before { background: var(--color-info-500); }
.activity-card[data-kind='attendance']::before { background: var(--color-success-500); }
.activity-card[data-kind='locked']::before  { background: var(--color-text-tertiary); }

.activity-kind-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
.activity-pulse {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-brand-500);
  box-shadow: 0 0 0 3px rgba(47, 84, 235, 0.2);
  animation: live-pulse-sm 1.5s infinite;
}
.activity-card[data-kind='quiz']    .activity-pulse { background: var(--color-warning-500); box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.2); }
.activity-card[data-kind='compete'] .activity-pulse { background: var(--color-danger-500);  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.2); }
.activity-card[data-kind='group']   .activity-pulse { background: var(--color-success-500); box-shadow: 0 0 0 3px rgba(22, 163, 74, 0.2); }
.activity-card[data-kind='practice'] .activity-pulse { background: var(--color-info-500);   box-shadow: 0 0 0 3px rgba(6, 182, 212, 0.2); }
@keyframes live-pulse-sm {
  0%, 100% { box-shadow: 0 0 0 3px rgba(47, 84, 235, 0.2); }
  50%      { box-shadow: 0 0 0 6px rgba(47, 84, 235, 0); }
}
.activity-clock {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
  letter-spacing: 0.02em;
}

/* —— Quiz —— */
.quiz-panel { display: flex; flex-direction: column; gap: var(--space-4); }
.quiz-question {
  margin: 0;
  font-size: var(--font-size-base);
  color: var(--color-text-primary);
  padding: var(--space-3) var(--space-4);
  background: var(--color-bg-elevated);
  border-radius: var(--radius-md);
}
.quiz-progress {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}
.quiz-progress-label {
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
  flex-shrink: 0;
}
.quiz-progress-bar {
  flex: 1;
  height: 8px;
  background: var(--color-border-subtle);
  border-radius: var(--radius-full);
  overflow: hidden;
}
.quiz-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--color-warning-500), var(--color-warning-600));
  transition: width var(--duration-slow) var(--ease-out);
}
.quiz-progress-num {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semi);
  color: var(--color-text-primary);
  flex-shrink: 0;
}
.quiz-choices {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.quiz-choice {
  display: grid;
  grid-template-columns: 28px 1fr 100px 40px;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-3);
  background: var(--color-bg-elevated);
  border-radius: var(--radius-md);
  border: 1px solid transparent;
}
.quiz-choice[data-correct='true'] {
  background: var(--color-success-50);
  border-color: rgba(22, 163, 74, 0.3);
}
.choice-letter {
  width: 24px;
  height: 24px;
  border-radius: var(--radius-full);
  background: var(--color-bg-soft);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: var(--font-weight-bold);
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
}
.quiz-choice[data-correct='true'] .choice-letter {
  background: var(--color-success-500);
  color: #fff;
}
.choice-text { font-size: var(--font-size-sm); color: var(--color-text-primary); }
.choice-bar {
  height: 8px;
  background: var(--color-border-subtle);
  border-radius: var(--radius-full);
  overflow: hidden;
}
.choice-bar-fill {
  height: 100%;
  background: var(--color-warning-500);
  transition: width var(--duration-slow);
}
.quiz-choice[data-correct='true'] .choice-bar-fill { background: var(--color-success-500); }
.choice-count {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semi);
  color: var(--color-text-primary);
  text-align: right;
}

/* —— Compete —— */
.compete-panel { display: flex; flex-direction: column; gap: var(--space-4); }
.compete-question {
  margin: 0;
  font-size: var(--font-size-base);
  color: var(--color-text-primary);
  padding: var(--space-3) var(--space-4);
  background: var(--color-bg-elevated);
  border-radius: var(--radius-md);
}
.compete-body {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  padding: var(--space-4);
  background: var(--color-bg-elevated);
  border-radius: var(--radius-md);
}
.compete-winner {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}
.compete-winner-avatar {
  width: 56px;
  height: 56px;
  border-radius: var(--radius-full);
  background: linear-gradient(135deg, var(--color-danger-500), #fa541c);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-bold);
  box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
}
.compete-winner-text { display: flex; flex-direction: column; gap: 2px; }
.compete-winner-label {
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.compete-winner-name {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
}
.compete-countdown {
  position: relative;
  width: 72px;
  height: 72px;
}
.countdown-ring {
  width: 100%;
  height: 100%;
}
.countdown-num {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
  color: var(--color-danger-600);
}

/* —— Group —— */
.group-panel { display: flex; flex-direction: column; gap: var(--space-3); }
.group-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: var(--space-3);
}
.group-item {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3);
  background: var(--color-bg-elevated);
  border-radius: var(--radius-md);
  border-left: 3px solid var(--color-success-500);
}
.group-head { display: flex; justify-content: space-between; align-items: baseline; }
.group-name {
  margin: 0;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semi);
  color: var(--color-text-primary);
}
.group-msg-count {
  font-size: var(--font-size-xs);
  color: var(--color-success-600);
  font-weight: var(--font-weight-semi);
}
.group-topic {
  margin: 0;
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
}
.group-members {
  display: flex;
  gap: -2px;
  align-items: center;
}
.group-avatar {
  width: 22px;
  height: 22px;
  border-radius: var(--radius-full);
  background: var(--color-bg-soft);
  border: 2px solid var(--color-bg-elevated);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  color: var(--color-text-secondary);
  font-weight: var(--font-weight-semi);
  margin-left: -6px;
}
.group-avatar:first-child { margin-left: 0; }
.group-avatar-more {
  background: var(--color-brand-100);
  color: var(--color-brand-700);
}

/* —— Practice / Attendance —— */
.practice-panel { display: flex; flex-direction: column; gap: var(--space-3); }
.practice-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}
.practice-label {
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
  padding: 2px 8px;
  background: var(--color-bg-soft);
  border-radius: var(--radius-xs);
}
.practice-topic {
  font-size: var(--font-size-base);
  color: var(--color-text-primary);
  font-weight: var(--font-weight-medium);
}
.practice-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-3);
}
.practice-stat {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: var(--space-3);
  background: var(--color-bg-elevated);
  border-radius: var(--radius-md);
}
.practice-stat-val {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
}
.practice-stat-val small {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-regular);
  color: var(--color-text-tertiary);
}
.practice-stat-label {
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
}
.practice-bar {
  height: 8px;
  background: var(--color-border-subtle);
  border-radius: var(--radius-full);
  overflow: hidden;
}
.practice-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--color-info-500), var(--color-brand-500));
  transition: width var(--duration-slow);
}

/* —— Locked —— */
.locked-panel {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-7) var(--space-4);
  text-align: center;
  color: var(--color-text-tertiary);
}
.locked-text {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

/* —— Idle —— */
.idle-panel {
  padding: var(--space-5) var(--space-4);
  text-align: center;
}
.idle-text {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-tertiary);
}

/* ============ Students Grid ============ */
.students-card { padding-bottom: var(--space-5); }
.status-legend {
  display: flex;
  gap: var(--space-3);
  flex-wrap: wrap;
}
.status-legend span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
}
.leg-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
.leg-dot[data-status='online']    { background: var(--color-success-500); }
.leg-dot[data-status='raised']    { background: var(--color-warning-500); }
.leg-dot[data-status='submitted'] { background: var(--color-info-500); }
.leg-dot[data-status='ai-asking'] { background: var(--color-ai-500); }
.leg-dot[data-status='offline']   { background: var(--color-text-tertiary); }

.stu-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(74px, 1fr));
  gap: var(--space-3);
}
.stu-tile {
  appearance: none;
  background: transparent;
  border: 0;
  padding: 0;
  cursor: help;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  position: relative;
  transition: transform var(--duration-fast);
}
.stu-tile:hover { transform: translateY(-2px); }

.stu-avatar {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: var(--font-weight-bold);
  color: var(--color-brand-700);
  background: var(--color-brand-100);
  position: relative;
  transition: opacity var(--duration-fast);
}
.stu-avatar[data-gender='女'] {
  background: #fce7f3;
  color: #be185d;
}
.stu-tile[data-status='offline'] .stu-avatar {
  opacity: 0.4;
  filter: grayscale(0.6);
}
.stu-status-dot {
  position: absolute;
  bottom: 18px;
  right: calc(50% - 24px);
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid var(--color-bg-elevated);
  z-index: 1;
}
.stu-status-dot[data-status='online']      { background: var(--color-success-500); }
.stu-status-dot[data-status='answering']   { background: var(--color-warning-500); animation: ping 1.5s infinite; }
.stu-status-dot[data-status='submitted']   { background: var(--color-info-500); }
.stu-status-dot[data-status='raised']      { background: var(--color-warning-500); animation: ping 1s infinite; }
.stu-status-dot[data-status='ai-asking']   { background: var(--color-ai-500); animation: ping 1.5s infinite; }
.stu-status-dot[data-status='compete-fast']{ background: var(--color-danger-500); animation: ping 0.8s infinite; }
.stu-status-dot[data-status='offline']     { background: var(--color-text-tertiary); }
@keyframes ping {
  0%   { box-shadow: 0 0 0 0 currentColor; opacity: 1; }
  100% { box-shadow: 0 0 0 8px transparent; opacity: 1; }
}
.stu-choice-badge {
  position: absolute;
  top: -4px;
  right: calc(50% - 28px);
  width: 20px;
  height: 20px;
  border-radius: var(--radius-full);
  background: var(--color-warning-500);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: var(--font-weight-bold);
  z-index: 2;
}
.stu-icon-badge {
  position: absolute;
  top: -4px;
  right: calc(50% - 28px);
  width: 20px;
  height: 20px;
  border-radius: var(--radius-full);
  background: var(--color-warning-500);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2;
}
.stu-name {
  font-size: 11px;
  color: var(--color-text-secondary);
  text-align: center;
  max-width: 70px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ============ Timeline ============ */
.timeline {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0;
  max-height: 480px;
  overflow-y: auto;
  position: relative;
}
.timeline::before {
  content: '';
  position: absolute;
  left: 6px;
  top: 8px;
  bottom: 8px;
  width: 2px;
  background: var(--color-border-subtle);
}
.tl-item {
  display: grid;
  grid-template-columns: 16px 1fr;
  gap: var(--space-3);
  padding: var(--space-3) 0;
  border-bottom: 1px solid var(--color-border-subtle);
  position: relative;
  animation: card-rise-in var(--duration-slow) var(--ease-out) both;
}
.tl-item:last-child { border-bottom: none; }
.tl-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  margin-top: 4px;
  background: var(--color-brand-500);
  border: 2px solid var(--color-bg-elevated);
  box-shadow: 0 0 0 2px var(--color-border-subtle);
  z-index: 1;
}
.tl-item[data-tone='brand']   .tl-dot { background: var(--color-brand-500);   }
.tl-item[data-tone='warning'] .tl-dot { background: var(--color-warning-500); }
.tl-item[data-tone='success'] .tl-dot { background: var(--color-success-500); }
.tl-item[data-tone='danger']  .tl-dot { background: var(--color-danger-500);  }
.tl-item[data-tone='info']    .tl-dot { background: var(--color-info-500);    }
.tl-item[data-tone='ai']      .tl-dot { background: var(--color-ai-500);      }

.tl-body { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.tl-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: var(--space-2);
}
.tl-title {
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
  font-weight: var(--font-weight-medium);
}
.tl-time {
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
  flex-shrink: 0;
}
.tl-detail {
  margin: 0;
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  line-height: var(--line-height-base);
}
.tl-actor {
  font-size: 11px;
  color: var(--color-text-tertiary);
}

/* ============ AI Card ============ */
.ai-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: var(--radius-full);
  background: var(--color-ai-50);
  color: var(--color-ai-600);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semi);
}
.ai-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  max-height: 480px;
  overflow-y: auto;
}
.ai-item {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3);
  background: var(--color-bg-soft);
  border-radius: var(--radius-md);
  border-left: 3px solid var(--color-ai-500);
  animation: card-rise-in var(--duration-slow) var(--ease-out) both;
}
.ai-item[data-status='flagged'] { border-left-color: var(--color-warning-500); }
.ai-item[data-status='streaming'] { border-left-color: var(--color-info-500); }

.ai-head {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}
.ai-feature-pill {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: var(--radius-xs);
  font-weight: var(--font-weight-semi);
}
.ai-feature-pill[data-feat='chat']       { background: var(--color-brand-100);   color: var(--color-brand-700);   }
.ai-feature-pill[data-feat='whiteboard'] { background: var(--color-ai-100);      color: var(--color-ai-600);      }
.ai-feature-pill[data-feat='practice']   { background: var(--color-info-100);    color: var(--color-info-600);    }
.ai-feature-pill[data-feat='courseware'] { background: var(--color-warning-100); color: var(--color-warning-600); }
.ai-feature-pill[data-feat='quiz']       { background: var(--color-success-100); color: var(--color-success-600); }
.ai-actor { flex: 1; display: flex; align-items: baseline; gap: 4px; min-width: 0; }
.ai-actor-name {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semi);
  color: var(--color-text-primary);
}
.ai-actor-role {
  font-size: 11px;
  color: var(--color-text-tertiary);
}
.ai-time { font-size: var(--font-size-xs); color: var(--color-text-tertiary); }

.ai-prompt {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  line-height: var(--line-height-base);
  font-style: italic;
}
.ai-meta {
  display: flex;
  gap: var(--space-3);
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
  align-items: center;
}
.ai-status {
  padding: 2px 8px;
  border-radius: var(--radius-xs);
  font-weight: var(--font-weight-medium);
  margin-left: auto;
}
.ai-status[data-status='success']   { background: var(--color-success-50); color: var(--color-success-600); }
.ai-status[data-status='streaming'] { background: var(--color-info-50);    color: var(--color-info-600);    }
.ai-status[data-status='flagged']   { background: var(--color-warning-50); color: var(--color-warning-600); }

/* ============ 广播弹窗 ============ */
.modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fade var(--duration-base) var(--ease-out);
}
@keyframes fade {
  from { opacity: 0; }
  to   { opacity: 1; }
}
.modal-card {
  width: 90%;
  max-width: 480px;
  background: var(--color-bg-elevated);
  border-radius: var(--radius-lg);
  padding: var(--space-5);
  box-shadow: var(--shadow-xl);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  animation: rise var(--duration-slow) var(--ease-out);
}
@keyframes rise {
  from { opacity: 0; transform: translateY(20px); }
  to   { opacity: 1; transform: translateY(0); }
}
.modal-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.modal-head h3 {
  margin: 0;
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semi);
  color: var(--color-text-primary);
}
.modal-textarea {
  width: 100%;
  padding: var(--space-3);
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-md);
  font-family: var(--font-sans);
  font-size: var(--font-size-sm);
  resize: vertical;
  outline: none;
  transition: border-color var(--duration-fast), box-shadow var(--duration-fast);
}
.modal-textarea:focus {
  border-color: var(--color-brand-500);
  box-shadow: var(--shadow-focus);
}
.modal-foot {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
}

/* ============ Not Found ============ */
.not-found {
  text-align: center;
  padding: var(--space-9) var(--space-5);
}
.not-found h2 {
  margin: 0 0 var(--space-3) 0;
  color: var(--color-text-secondary);
}

/* ============ 响应式 ============ */
@media (max-width: 1280px) {
  .main-split { grid-template-columns: 1fr; }
  .quiz-choice { grid-template-columns: 28px 1fr 80px 36px; }
}
@media (max-width: 1024px) {
  .kpi-grid { grid-template-columns: repeat(2, 1fr); }
  .hero { flex-direction: column; align-items: flex-start; }
  .hero-actions { width: 100%; }
}
@media (max-width: 640px) {
  .kpi-grid { grid-template-columns: 1fr; }
  .stu-grid { grid-template-columns: repeat(auto-fill, minmax(64px, 1fr)); }
  .compete-body { flex-direction: column; align-items: flex-start; }
}
</style>
