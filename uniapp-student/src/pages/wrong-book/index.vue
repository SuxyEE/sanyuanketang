<template>
  <view class="wrong-book" :class="{ landscape: isLandscape, portrait: !isLandscape }">
    <!-- ============ 1. 顶部条 ============ -->
    <view class="topbar" :style="{ paddingTop: `max(var(--space-3), var(--safe-top))` }">
      <IconButton icon="arrow-left" size="md" aria-label="返回" @tap="goBack" />
      <view class="topbar-title">
        <view class="topbar-icon-wrap">
          <Icon name="brain" size="md" tone="inverse" />
        </view>
        <view class="topbar-text">
          <text class="topbar-name">我的错题本</text>
          <text class="topbar-sub">AI 帮你逐题讲解，错过的题再也不会错</text>
        </view>
      </view>
    </view>

    <!-- ============ 2. 统计卡片 ============ -->
    <view class="stats-row">
      <view class="stat-card" data-tone="wrong">
        <view class="stat-icon-wrap">
          <Icon name="flame" size="sm" tone="danger" />
        </view>
        <view class="stat-info">
          <text class="stat-val">{{ wrongCount }}</text>
          <text class="stat-label">待复习</text>
        </view>
      </view>
      <view class="stat-card" data-tone="ai">
        <view class="stat-icon-wrap">
          <Icon name="sparkles" size="sm" tone="secondary" />
        </view>
        <view class="stat-info">
          <text class="stat-val">{{ aiExplainedCount }}</text>
          <text class="stat-label">AI 已讲解</text>
        </view>
      </view>
      <view class="stat-card" data-tone="ok">
        <view class="stat-icon-wrap">
          <Icon name="check-circle" size="sm" tone="success" />
        </view>
        <view class="stat-info">
          <text class="stat-val">{{ masteredCount }}</text>
          <text class="stat-label">已掌握</text>
        </view>
      </view>
    </view>

    <!-- ============ 3. 学科 tab ============ -->
    <scroll-view scroll-x show-scrollbar="false" class="tabs-scroll">
      <view class="tabs">
        <button
          v-for="t in tabs"
          :key="t.key"
          class="tab-btn"
          :class="{ active: currentTab === t.key }"
          hover-class="tab-hover"
          @tap="currentTab = t.key"
        >
          <text class="tab-label">{{ t.label }}</text>
          <text v-if="t.count > 0" class="tab-count">{{ t.count }}</text>
        </button>
      </view>
    </scroll-view>

    <!-- ============ 4. 错题列表 ============ -->
    <scroll-view scroll-y class="list-scroll" enable-back-to-top>
      <view class="list">
        <view v-if="loading && filteredList.length === 0" class="state-block">
          <view class="loading-typing">
            <view class="typing-dot"></view>
            <view class="typing-dot"></view>
            <view class="typing-dot"></view>
          </view>
          <text class="state-text">正在加载错题…</text>
        </view>

        <view v-else-if="loadError && filteredList.length === 0" class="state-block">
          <view class="empty-icon error">
            <Icon name="alert-circle" size="3xl" tone="danger" />
          </view>
          <text class="empty-title">加载失败</text>
          <text class="empty-desc">{{ loadError }}</text>
          <Button variant="tonal" size="md" icon-left="refresh-cw" @tap="loadWrongBook()">重试</Button>
        </view>

        <view v-else-if="filteredList.length === 0" class="empty-state">
          <view class="empty-icon">
            <Icon name="check-circle" size="3xl" tone="success" />
          </view>
          <text class="empty-title">这一项没有错题</text>
          <text class="empty-desc">继续保持，每一道弄懂的题都是进步</text>
        </view>

        <Card
          v-for="(q, i) in filteredList"
          :key="q.id"
          :elevation="1"
          padding="md"
          class="q-card fade-up"
          :style="{ animationDelay: 80 + i * 60 + 'ms' }"
        >
          <view class="q-head">
            <view class="q-num">第 {{ i + 1 }} 题</view>
            <view class="q-tags">
              <Tag tone="primary" icon="book-open">{{ q.subject }}</Tag>
              <Tag
                :tone="q.mastered ? 'success' : 'warning'"
                :icon="q.mastered ? 'check-circle' : 'alert-circle'"
              >{{ q.mastered ? '已掌握' : '待复习' }}</Tag>
              <Tag v-if="q.aiExplained" tone="secondary" icon="sparkles">已讲解</Tag>
            </view>
          </view>

          <text class="q-stem">{{ q.content }}</text>

          <view v-if="q.options && q.options.length > 0" class="q-options">
            <view
              v-for="(opt, idx) in q.options"
              :key="idx"
              class="q-option"
              :data-state="optionState(q, idx)"
            >
              <view class="opt-letter">{{ String.fromCharCode(65 + idx) }}</view>
              <text class="opt-text">{{ opt }}</text>
              <view v-if="optionState(q, idx) === 'mine'" class="opt-badge mine">
                <Icon name="x" size="xs" tone="inverse" />
              </view>
              <view v-else-if="optionState(q, idx) === 'correct'" class="opt-badge correct">
                <Icon name="check" size="xs" tone="inverse" />
              </view>
            </view>
          </view>

          <view v-else class="q-answer">
            <view class="q-answer-row wrong">
              <text class="q-answer-label">我的</text>
              <text class="q-answer-val">{{ q.myAnswer }}</text>
            </view>
            <view class="q-answer-row right">
              <text class="q-answer-label">正确</text>
              <text class="q-answer-val">{{ q.correctAnswer }}</text>
            </view>
          </view>

          <view class="q-meta">
            <view class="q-topic-chip">
              <view class="q-topic-dot"></view>
              <text class="q-topic-text">{{ q.topic }}</text>
            </view>
            <text class="q-time">{{ q.time }}</text>
          </view>

          <view class="q-actions">
            <Button
              variant="primary"
              size="md"
              icon-left="sparkles"
              block
              @tap="openExplain(q)"
            >AI 讲解</Button>
            <Button
              v-if="!q.mastered"
              variant="tonal"
              size="md"
              icon-left="check-circle"
              @tap="toggleMastered(q)"
            >标记掌握</Button>
            <Button
              v-else
              variant="ghost"
              size="md"
              icon-left="refresh-cw"
              @tap="toggleMastered(q)"
            >重新复习</Button>
          </view>
        </Card>
      </view>
      <view class="footer-spacer"></view>
    </scroll-view>

    <!-- ============ 5. AI 讲解 Overlay ============ -->
    <Overlay
      v-if="showExplain && current"
      align="bottom"
      :z-index="800"
      max-width="900rpx"
      @close="closeExplain"
    >
      <view class="explain-card" :style="{ paddingBottom: `max(var(--space-4), var(--safe-bottom))` }">
        <view class="explain-head">
          <view class="explain-title-wrap">
            <view class="explain-icon-wrap">
              <Icon name="sparkles" size="md" tone="inverse" />
            </view>
            <view class="explain-title-text">
              <text class="explain-title">AI 讲解</text>
              <text class="explain-sub">{{ current.subject }} · {{ current.topic }}</text>
            </view>
          </view>
          <IconButton icon="x" size="md" aria-label="关闭讲解" @tap="closeExplain" />
        </view>

        <scroll-view scroll-y class="explain-body" :scroll-top="explainScrollTop">
          <view class="explain-question">
            <text class="explain-q-label">原题</text>
            <text class="explain-q-text">{{ current.content }}</text>
          </view>

          <view class="explain-answers">
            <view class="explain-ans wrong">
              <text class="explain-ans-label">我的答案</text>
              <text class="explain-ans-val">{{ current.myAnswer }}</text>
            </view>
            <view class="explain-ans right">
              <text class="explain-ans-label">正确答案</text>
              <text class="explain-ans-val">{{ current.correctAnswer }}</text>
            </view>
          </view>

          <view v-if="explainStatus === 'loading' && !explainBuffer" class="explain-loading">
            <view class="loading-typing">
              <view class="typing-dot"></view>
              <view class="typing-dot"></view>
              <view class="typing-dot"></view>
            </view>
            <text class="explain-loading-text">AI 正在思考为什么这道题会错…</text>
          </view>

          <view v-else-if="explainStatus === 'error'" class="explain-error">
            <Icon name="alert-circle" size="md" tone="danger" />
            <text class="explain-error-text">{{ explainError || '抱歉，AI 暂时无法讲解，请稍后再试。' }}</text>
            <Button variant="tonal" size="sm" icon-left="refresh-cw" @tap="retryExplain">重试</Button>
          </view>

          <view v-if="explainBuffer" class="explain-answer-wrap">
            <view class="explain-answer-head">
              <Icon name="brain" size="sm" tone="secondary" />
              <text class="explain-answer-label">讲解</text>
              <view v-if="explainStatus === 'streaming'" class="typing-mini">
                <view class="typing-dot"></view>
                <view class="typing-dot"></view>
                <view class="typing-dot"></view>
              </view>
            </view>
            <rich-text class="explain-md" :nodes="renderMarkdown(explainBuffer)"></rich-text>
          </view>
        </scroll-view>

        <view v-if="explainStatus === 'done'" class="explain-foot">
          <Button
            variant="tonal"
            size="md"
            icon-left="check-circle"
            block
            @tap="confirmMastered"
          >我懂了，标记已掌握</Button>
        </view>
      </view>
    </Overlay>
  </view>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { useStudentStore } from '@/stores/student'
import { useOrientation } from '@/composables/useOrientation'
import { useMarkdown } from '@/composables/useMarkdown'
import { API_BASE } from '@/shared/config'
import Icon from '@/components/ui/Icon.vue'
import IconButton from '@/components/ui/IconButton.vue'
import Button from '@/components/ui/Button.vue'
import Card from '@/components/ui/Card.vue'
import Tag from '@/components/ui/Tag.vue'
import Overlay from '@/components/ui/Overlay.vue'

const { isLandscape } = useOrientation()
const { renderMarkdown } = useMarkdown()

/* ============ 错题数据（真实接口） ============ */
const studentStore = useStudentStore()

interface ApiWrongOption {
  key: string
  content: string
}

interface ApiWrongQuestion {
  id: string
  studentId: string
  lessonId: string
  taskId: string
  questionId: string
  subject: string
  questionContent: string
  questionType: string
  options?: ApiWrongOption[]
  correctAnswer: string
  analysis: string
  wrongAnswer: string
  knowledgePoints: string[]
  score: number
  mastered: boolean
  createdAt: string
}

interface WrongStats {
  total: number
  mastered: number
  unmastered: number
  subjects: { subject: string; count: number }[]
}

// 视图模型（模板渲染使用）
interface WrongQuestion {
  id: string
  subject: string
  topic: string
  content: string
  options?: string[]            // 选择题的选项；若无即为主观/填空
  myAnswerIndex?: number        // 选择题对应索引
  correctAnswerIndex?: number
  myAnswer: string              // 显示文本（选择题为字母+内容、填空题为答案）
  correctAnswer: string
  time: string
  mastered: boolean
  aiExplained: boolean
}

// 视图列表 / 统计 / 加载状态
const wrongList = ref<WrongQuestion[]>([])
const statsState = reactive<WrongStats>({ total: 0, mastered: 0, unmastered: 0, subjects: [] })
const loading = ref(false)
const loadError = ref('')

/** 本会话内被 AI 讲解过的题目 id（后端不返回该状态，前端本地维护） */
const aiExplainedIds = reactive(new Set<string>())

function markAiExplained(q: WrongQuestion) {
  aiExplainedIds.add(q.id)
  q.aiExplained = true
}

function formatTime(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** 后端错题 → 视图模型（推断选项高亮索引、拼装展示文本） */
function toView(w: ApiWrongQuestion): WrongQuestion {
  const opts = Array.isArray(w.options) && w.options.length ? w.options : undefined
  let myAnswerIndex: number | undefined
  let correctAnswerIndex: number | undefined
  let myAnswerText = w.wrongAnswer || ''
  let correctAnswerText = w.correctAnswer || ''

  if (opts) {
    const ci = opts.findIndex(o => o.key === w.correctAnswer)
    const mi = opts.findIndex(o => o.key === w.wrongAnswer)
    if (ci >= 0) { correctAnswerIndex = ci; correctAnswerText = `${opts[ci].key} · ${opts[ci].content}` }
    if (mi >= 0) { myAnswerIndex = mi; myAnswerText = `${opts[mi].key} · ${opts[mi].content}` }
  }

  return {
    id: w.id,
    subject: w.subject || '',
    topic: (w.knowledgePoints && w.knowledgePoints.length)
      ? w.knowledgePoints.join('、')
      : (w.questionType || ''),
    content: w.questionContent || '',
    options: opts ? opts.map(o => o.content) : undefined,
    myAnswerIndex,
    correctAnswerIndex,
    myAnswer: myAnswerText,
    correctAnswer: correctAnswerText,
    time: formatTime(w.createdAt),
    mastered: !!w.mastered,
    aiExplained: aiExplainedIds.has(w.id),
  }
}

function normalizeStats(s: any): WrongStats {
  return {
    total: Number(s?.total) || 0,
    mastered: Number(s?.mastered) || 0,
    unmastered: Number(s?.unmastered) || 0,
    subjects: Array.isArray(s?.subjects)
      ? s.subjects.map((x: any) => ({ subject: String(x?.subject ?? ''), count: Number(x?.count) || 0 }))
      : [],
  }
}

/* ============ Tab / 筛选 ============ */
type TabKey = 'all' | 'unmastered' | 'mastered' | string
const currentTab = ref<TabKey>('unmastered')

const tabs = computed(() => {
  const baseTabs = [
    { key: 'unmastered', label: '待复习', count: statsState.unmastered },
    { key: 'mastered',   label: '已掌握', count: statsState.mastered },
    { key: 'all',        label: '全部',   count: statsState.total },
  ]
  const subjectTabs = statsState.subjects.map(s => ({
    key: `subject:${s.subject}`,
    label: s.subject,
    count: s.count,
  }))
  return [...baseTabs, ...subjectTabs]
})

// 列表由服务端按 currentTab 过滤后返回，此处直接透传
const filteredList = computed(() => wrongList.value)

/* ============ 统计 ============ */
const wrongCount        = computed(() => statsState.unmastered)
const masteredCount     = computed(() => statsState.mastered)
const aiExplainedCount  = computed(() => aiExplainedIds.size)

/* ============ 数据加载 ============ */
function tabToQuery(tab: string): { subject?: string; mastered?: boolean } {
  if (tab === 'mastered') return { mastered: true }
  if (tab === 'unmastered') return { mastered: false }
  if (tab.startsWith('subject:')) return { subject: tab.slice('subject:'.length) }
  return {}
}

function buildWrongBookUrl(q: { subject?: string; mastered?: boolean }): string {
  const params: string[] = [`studentId=${encodeURIComponent(studentStore.studentId)}`]
  if (q.subject) params.push(`subject=${encodeURIComponent(q.subject)}`)
  if (typeof q.mastered === 'boolean') params.push(`mastered=${q.mastered}`)
  return `${API_BASE}/wrong-book?${params.join('&')}`
}

function loadWrongBook(q: { subject?: string; mastered?: boolean } = tabToQuery(currentTab.value)) {
  loading.value = true
  loadError.value = ''
  uni.request({
    url: buildWrongBookUrl(q),
    method: 'GET',
    timeout: 15_000,
    success: res => {
      if (res.statusCode < 200 || res.statusCode >= 300) {
        loadError.value = `加载失败（${res.statusCode}）`
        return
      }
      const body: any = res.data
      const data = body?.data ?? body
      if (!data || !Array.isArray(data.items)) {
        loadError.value = '数据格式异常'
        return
      }
      wrongList.value = (data.items as ApiWrongQuestion[]).map(toView)
      if (data.stats) Object.assign(statsState, normalizeStats(data.stats))
    },
    fail: err => {
      loadError.value = err?.errMsg || '网络异常，请稍后再试'
    },
    complete: () => {
      loading.value = false
    },
  })
}

watch(currentTab, tab => loadWrongBook(tabToQuery(tab)))

/* ============ 标记掌握（乐观更新 + 失败回滚） ============ */
function adjustStats(from: boolean, to: boolean) {
  if (from === to) return
  if (to) {
    statsState.mastered += 1
    statsState.unmastered = Math.max(0, statsState.unmastered - 1)
  } else {
    statsState.mastered = Math.max(0, statsState.mastered - 1)
    statsState.unmastered += 1
  }
}

function setMastered(q: WrongQuestion, mastered: boolean) {
  const prev = q.mastered
  if (prev !== mastered) {
    q.mastered = mastered
    adjustStats(prev, mastered)
  }
  uni.showToast({
    title: mastered ? '已掌握' : '重新复习',
    icon: mastered ? 'success' : 'none',
    duration: 1000,
  })

  const rollback = () => {
    if (q.mastered !== prev) {
      q.mastered = prev
      adjustStats(mastered, prev)
    }
    uni.showToast({ title: '保存失败，请重试', icon: 'none', duration: 1500 })
  }

  uni.request({
    url: `${API_BASE}/wrong-book/${q.id}/mastered`,
    method: 'POST',
    data: { mastered },
    timeout: 15_000,
    success: res => {
      const body: any = res.data
      const ok = res.statusCode >= 200 && res.statusCode < 300 && body?.success !== false
      if (!ok) rollback()
    },
    fail: () => rollback(),
  })
}

function toggleMastered(q: WrongQuestion) {
  setMastered(q, !q.mastered)
}

/* ============ 选项状态 ============ */
function optionState(q: WrongQuestion, idx: number): 'mine' | 'correct' | 'normal' {
  if (q.myAnswerIndex === idx && q.correctAnswerIndex !== idx) return 'mine'
  if (q.correctAnswerIndex === idx) return 'correct'
  return 'normal'
}

/* ============ AI 讲解 ============ */
const showExplain = ref(false)
const current = ref<WrongQuestion | null>(null)
const explainStatus = ref<'idle' | 'loading' | 'streaming' | 'done' | 'error'>('idle')
const explainBuffer = ref('')
const explainError = ref('')
const explainScrollTop = ref(0)

function buildPrompt(q: WrongQuestion): string {
  const optionsBlock = q.options
    ? `选项：\n${q.options.map((o, i) => `${String.fromCharCode(65 + i)}. ${o}`).join('\n')}\n\n我选了：${q.myAnswer}\n正确答案：${q.correctAnswer}`
    : `我的回答：${q.myAnswer}\n正确答案：${q.correctAnswer}`
  return `我做错了一道关于「${q.subject} · ${q.topic}」的题目，请你像一位耐心的老师那样：
1. 用 1-2 句话点出我为什么会错（命中我的认知误区）
2. 用通俗易懂的语言讲清楚正确的原理（可适当用例子）
3. 总结 1 个可以避免再错的小诀窍

题目：${q.content}

${optionsBlock}

请用 Markdown 输出，结构清晰，必要时用列表。讲解长度控制在 200-400 字。`
}

function openExplain(q: WrongQuestion) {
  current.value = q
  showExplain.value = true
  startExplain(q)
}

function closeExplain() {
  showExplain.value = false
  current.value = null
  explainStatus.value = 'idle'
  explainBuffer.value = ''
  explainError.value = ''
}

function retryExplain() {
  if (current.value) startExplain(current.value)
}

function confirmMastered() {
  if (current.value) {
    markAiExplained(current.value)
    setMastered(current.value, true)
    setTimeout(closeExplain, 600)
  }
}

let typewriterTimer: ReturnType<typeof setTimeout> | null = null

function clearTypewriter() {
  if (typewriterTimer) { clearTimeout(typewriterTimer); typewriterTimer = null }
}

/** typewriter 效果：把整段 content 一段一段推到 explainBuffer，模拟流式 */
function typewriterPush(full: string) {
  const chunkSize = 4
  let pos = 0
  explainBuffer.value = ''
  explainStatus.value = 'streaming'

  const step = () => {
    if (pos >= full.length) {
      explainStatus.value = 'done'
      typewriterTimer = null
      if (current.value) markAiExplained(current.value)
      return
    }
    pos = Math.min(full.length, pos + chunkSize)
    explainBuffer.value = full.slice(0, pos)
    nextTick(() => { explainScrollTop.value = 999_999 })
    typewriterTimer = setTimeout(step, 16)
  }
  step()
}

function startExplain(q: WrongQuestion) {
  clearTypewriter()
  explainBuffer.value = ''
  explainError.value = ''
  explainStatus.value = 'loading'

  uni.request({
    url: `${API_BASE}/ai/chat`,
    method: 'POST',
    data: {
      message: buildPrompt(q),
      source: 'student-wrong-book',
    },
    timeout: 30_000,
    success: res => {
      if (res.statusCode < 200 || res.statusCode >= 300) {
        explainStatus.value = 'error'
        explainError.value = `服务返回 ${res.statusCode}`
        return
      }
      const d: any = res.data
      const content = d?.data?.content || d?.content || ''
      if (!content) {
        explainStatus.value = 'error'
        explainError.value = 'AI 没有返回有效内容'
        return
      }
      typewriterPush(content)
    },
    fail: err => {
      explainStatus.value = 'error'
      explainError.value = err?.errMsg || '网络异常，请稍后再试'
    },
  })
}

/* ============ 返回 ============ */
function goBack() {
  // 优先返回，否则回到加入页
  const pages = (typeof getCurrentPages === 'function' ? getCurrentPages() : []) as any[]
  if (pages.length > 1) {
    uni.navigateBack({})
  } else {
    uni.reLaunch({ url: '/pages/join/index' })
  }
}

onMounted(() => {
  loadWrongBook(tabToQuery(currentTab.value))
})
</script>

<style lang="scss" scoped>
@import '@/styles/variables.scss';

.wrong-book {
  min-height: 100vh;
  background:
    radial-gradient(ellipse 60% 50% at 50% -10%, rgba(114, 46, 209, 0.12), transparent 70%),
    radial-gradient(ellipse 60% 50% at 100% 20%, rgba(47, 107, 255, 0.08), transparent 70%),
    var(--color-bg);
  display: flex;
  flex-direction: column;
  padding: 0;
  padding-left: max(var(--space-4), var(--safe-left));
  padding-right: max(var(--space-4), var(--safe-right));
  box-sizing: border-box;
}

/* ===== 顶部 ===== */
.topbar {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) 0;
}
.topbar-title {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex: 1;
  min-width: 0;
}
.topbar-icon-wrap {
  width: 72rpx;
  height: 72rpx;
  border-radius: var(--radius-full);
  background: linear-gradient(135deg, #722ed1 0%, #a370f7 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8rpx 24rpx rgba(114, 46, 209, 0.32);
  flex-shrink: 0;
}
.topbar-text {
  display: flex;
  flex-direction: column;
  gap: 4rpx;
  min-width: 0;
}
.topbar-name {
  font-size: var(--font-title);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
}
.topbar-sub {
  font-size: var(--font-caption);
  color: var(--color-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ===== 统计卡 ===== */
.stats-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-3);
  margin-top: var(--space-3);
}
.stat-card {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  box-shadow: var(--elevation-1);
  border: 2rpx solid transparent;
  animation: fade-up var(--duration-slow) var(--ease-decelerate) both;
}
.stat-card[data-tone='wrong'] { border-color: rgba(239, 68, 68, 0.18); }
.stat-card[data-tone='ai']    { border-color: rgba(114, 46, 209, 0.18); }
.stat-card[data-tone='ok']    { border-color: rgba(22, 163, 74, 0.18); }

.stat-icon-wrap {
  width: 64rpx;
  height: 64rpx;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.stat-card[data-tone='wrong'] .stat-icon-wrap { background: rgba(239, 68, 68, 0.10); }
.stat-card[data-tone='ai']    .stat-icon-wrap { background: rgba(114, 46, 209, 0.10); }
.stat-card[data-tone='ok']    .stat-icon-wrap { background: rgba(22, 163, 74, 0.10); }

.stat-info { display: flex; flex-direction: column; gap: 0; min-width: 0; }
.stat-val {
  font-size: var(--font-title);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
  font-variant-numeric: tabular-nums;
  line-height: 1.1;
}
.stat-label {
  font-size: var(--font-caption);
  color: var(--color-text-secondary);
}

/* ===== Tab ===== */
.tabs-scroll {
  white-space: nowrap;
  margin: var(--space-4) calc(-1 * max(var(--space-4), var(--safe-left))) 0 calc(-1 * max(var(--space-4), var(--safe-right)));
  padding: 0 max(var(--space-4), var(--safe-left));
}
.tabs {
  display: inline-flex;
  gap: var(--space-2);
  padding-right: var(--space-4);
}
.tab-btn {
  appearance: none;
  background: var(--color-surface);
  border: 2rpx solid var(--color-outline-variant);
  padding: 12rpx 24rpx;
  border-radius: var(--radius-pill);
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  white-space: nowrap;
  transition: all var(--duration-fast) var(--ease-standard);
}
.tab-btn::after { display: none; }
.tab-btn.tab-hover { opacity: 0.85; }
.tab-btn.active {
  background: linear-gradient(135deg, #2f6bff 0%, #722ed1 100%);
  border-color: transparent;
  box-shadow: 0 4rpx 16rpx rgba(114, 46, 209, 0.32);
}
.tab-label {
  font-size: var(--font-label);
  color: var(--color-text-primary);
  font-weight: var(--font-weight-medium);
}
.tab-btn.active .tab-label { color: #fff; }
.tab-count {
  font-size: var(--font-caption);
  color: var(--color-text-tertiary);
  font-variant-numeric: tabular-nums;
  background: var(--color-surface-variant);
  padding: 2rpx 12rpx;
  border-radius: var(--radius-pill);
}
.tab-btn.active .tab-count {
  background: rgba(255, 255, 255, 0.24);
  color: #fff;
}

/* ===== 列表 ===== */
.list-scroll {
  flex: 1;
  min-height: 0;
  margin: 0 calc(-1 * max(var(--space-4), var(--safe-left))) 0 calc(-1 * max(var(--space-4), var(--safe-right)));
  padding: var(--space-4) max(var(--space-4), var(--safe-left)) 0 max(var(--space-4), var(--safe-right));
}
.list {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
.landscape .list {
  display: grid;
  grid-template-columns: 1fr 1fr;
}

.q-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.q-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--space-2);
}
.q-num {
  font-size: var(--font-caption);
  color: var(--color-text-tertiary);
  font-weight: var(--font-weight-bold);
  padding: 4rpx 16rpx;
  background: var(--color-surface-variant);
  border-radius: var(--radius-pill);
  flex-shrink: 0;
}
.q-tags {
  display: flex;
  gap: var(--space-1);
  flex-wrap: wrap;
  justify-content: flex-end;
  flex: 1;
}

.q-stem {
  font-size: var(--font-body);
  color: var(--color-text-primary);
  line-height: var(--line-height-normal);
  font-weight: var(--font-weight-medium);
}

/* ===== 选项 ===== */
.q-options {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.q-option {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3);
  background: var(--color-surface-variant);
  border-radius: var(--radius-md);
  border: 2rpx solid transparent;
  position: relative;
}
.q-option[data-state='mine'] {
  background: rgba(239, 68, 68, 0.06);
  border-color: rgba(239, 68, 68, 0.32);
}
.q-option[data-state='correct'] {
  background: rgba(22, 163, 74, 0.08);
  border-color: rgba(22, 163, 74, 0.32);
}
.opt-letter {
  width: 48rpx;
  height: 48rpx;
  border-radius: var(--radius-full);
  background: var(--color-surface);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: var(--font-weight-bold);
  font-size: var(--font-label);
  color: var(--color-text-secondary);
  flex-shrink: 0;
}
.q-option[data-state='mine'] .opt-letter {
  background: var(--color-danger);
  color: var(--color-text-on-color);
}
.q-option[data-state='correct'] .opt-letter {
  background: var(--color-success);
  color: var(--color-text-on-color);
}
.opt-text {
  flex: 1;
  font-size: var(--font-label);
  color: var(--color-text-primary);
  line-height: var(--line-height-snug);
}
.opt-badge {
  width: 40rpx;
  height: 40rpx;
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.opt-badge.mine    { background: var(--color-danger);  }
.opt-badge.correct { background: var(--color-success); }

/* ===== 主观答案（无选项时） ===== */
.q-answer {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3);
  background: var(--color-surface-variant);
  border-radius: var(--radius-md);
}
.q-answer-row {
  display: flex;
  gap: var(--space-3);
  align-items: flex-start;
}
.q-answer-label {
  font-size: var(--font-caption);
  font-weight: var(--font-weight-bold);
  padding: 2rpx 14rpx;
  border-radius: var(--radius-pill);
  flex-shrink: 0;
  line-height: 1.8;
}
.q-answer-row.wrong .q-answer-label { background: rgba(239, 68, 68, 0.10); color: var(--color-danger);  }
.q-answer-row.right .q-answer-label { background: rgba(22, 163, 74, 0.12); color: var(--color-success); }

.q-answer-val {
  font-size: var(--font-label);
  color: var(--color-text-primary);
  line-height: var(--line-height-normal);
  flex: 1;
}

/* ===== 元信息 ===== */
.q-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}
.q-topic-chip {
  display: inline-flex;
  align-items: center;
  gap: 8rpx;
  font-size: var(--font-caption);
  color: var(--color-text-secondary);
}
.q-topic-dot {
  width: 8rpx;
  height: 8rpx;
  border-radius: 50%;
  background: var(--color-primary);
}
.q-topic-text {
  font-size: var(--font-caption);
  color: var(--color-text-secondary);
}
.q-time {
  font-size: var(--font-caption);
  color: var(--color-text-tertiary);
  font-variant-numeric: tabular-nums;
}

/* ===== 操作 ===== */
.q-actions {
  display: grid;
  grid-template-columns: 1.4fr 1fr;
  gap: var(--space-2);
  padding-top: var(--space-2);
  border-top: 2rpx solid var(--color-outline-variant);
}

/* ===== 空状态 ===== */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-9) var(--space-4);
  text-align: center;
  gap: var(--space-3);
}
.empty-icon {
  width: 160rpx;
  height: 160rpx;
  border-radius: var(--radius-full);
  background: var(--color-success-container);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: var(--space-3);
}
.empty-title {
  font-size: var(--font-title-sm);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
}
.empty-desc {
  font-size: var(--font-body);
  color: var(--color-text-secondary);
}

.empty-icon.error {
  background: rgba(239, 68, 68, 0.12);
}

.state-block {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  padding: var(--space-9) var(--space-4);
  text-align: center;
}
.state-text {
  font-size: var(--font-body);
  color: var(--color-text-secondary);
}

.footer-spacer {
  height: max(var(--space-4), var(--safe-bottom));
}

/* ===== fade-up ===== */
.fade-up {
  opacity: 0;
  animation: fade-up var(--duration-slow) var(--ease-decelerate) forwards;
}
@keyframes fade-up {
  from { opacity: 0; transform: translateY(20rpx); }
  to   { opacity: 1; transform: translateY(0); }
}
@media (prefers-reduced-motion: reduce) {
  .fade-up { opacity: 1; animation: none; transform: none; }
}

/* ===== AI 讲解 抽屉 ===== */
.explain-card {
  display: flex;
  flex-direction: column;
  max-height: 100%;
  width: 100%;
}
.explain-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-4) var(--space-5);
  border-bottom: 2rpx solid var(--color-outline-variant);
  background: linear-gradient(135deg, rgba(114, 46, 209, 0.06), rgba(47, 107, 255, 0.04));
}
.explain-title-wrap {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex: 1;
  min-width: 0;
}
.explain-icon-wrap {
  width: 72rpx;
  height: 72rpx;
  border-radius: var(--radius-full);
  background: linear-gradient(135deg, #722ed1, #a370f7);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 6rpx 20rpx rgba(114, 46, 209, 0.32);
}
.explain-title-text { display: flex; flex-direction: column; gap: 2rpx; min-width: 0; }
.explain-title {
  font-size: var(--font-title-sm);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
}
.explain-sub {
  font-size: var(--font-caption);
  color: var(--color-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.explain-body {
  flex: 1;
  min-height: 0;
  padding: var(--space-4) var(--space-5);
}

.explain-question {
  padding: var(--space-3) var(--space-4);
  background: var(--color-surface-variant);
  border-radius: var(--radius-md);
  margin-bottom: var(--space-3);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.explain-q-label {
  font-size: var(--font-caption);
  color: var(--color-text-tertiary);
  font-weight: var(--font-weight-bold);
  letter-spacing: 0.05em;
}
.explain-q-text {
  font-size: var(--font-body);
  color: var(--color-text-primary);
  line-height: var(--line-height-normal);
}

.explain-answers {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin-bottom: var(--space-4);
}
.explain-ans {
  display: flex;
  gap: var(--space-3);
  align-items: flex-start;
}
.explain-ans-label {
  font-size: var(--font-caption);
  font-weight: var(--font-weight-bold);
  padding: 2rpx 14rpx;
  border-radius: var(--radius-pill);
  flex-shrink: 0;
  line-height: 1.8;
}
.explain-ans.wrong .explain-ans-label { background: rgba(239, 68, 68, 0.10); color: var(--color-danger);  }
.explain-ans.right .explain-ans-label { background: rgba(22, 163, 74, 0.12); color: var(--color-success); }
.explain-ans-val {
  font-size: var(--font-label);
  color: var(--color-text-primary);
  line-height: var(--line-height-normal);
  flex: 1;
}

.explain-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-7) var(--space-4);
}
.loading-typing {
  display: flex;
  gap: 8rpx;
  align-items: center;
}
.typing-dot {
  width: 14rpx;
  height: 14rpx;
  border-radius: 50%;
  background: var(--color-secondary);
  animation: typing-bounce 1s infinite ease-in-out;
}
.typing-dot:nth-child(2) { animation-delay: 0.16s; }
.typing-dot:nth-child(3) { animation-delay: 0.32s; }
@keyframes typing-bounce {
  0%, 80%, 100% { opacity: 0.3; transform: translateY(0); }
  40%           { opacity: 1;   transform: translateY(-6rpx); }
}
.explain-loading-text {
  font-size: var(--font-body);
  color: var(--color-text-secondary);
}

.explain-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-6) var(--space-4);
  text-align: center;
}
.explain-error-text {
  font-size: var(--font-body);
  color: var(--color-text-secondary);
}

.explain-answer-wrap {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding-bottom: var(--space-4);
}
.explain-answer-head {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
.explain-answer-label {
  font-size: var(--font-label);
  font-weight: var(--font-weight-bold);
  color: var(--color-secondary);
}
.typing-mini {
  display: inline-flex;
  gap: 4rpx;
  margin-left: var(--space-1);
}
.typing-mini .typing-dot {
  width: 10rpx;
  height: 10rpx;
}

.explain-md {
  display: block;
  font-size: var(--font-body);
  color: var(--color-text-primary);
  line-height: var(--line-height-normal);
}
.explain-md :deep(h1),
.explain-md :deep(h2),
.explain-md :deep(h3) {
  font-weight: var(--font-weight-bold);
  margin: var(--space-3) 0 var(--space-2);
}
.explain-md :deep(p)  { margin: var(--space-2) 0; }
.explain-md :deep(ul),
.explain-md :deep(ol) { padding-left: var(--space-5); margin: var(--space-2) 0; }
.explain-md :deep(li) { margin-bottom: var(--space-1); }
.explain-md :deep(strong) { color: var(--color-primary); font-weight: var(--font-weight-bold); }
.explain-md :deep(code) {
  background: var(--color-surface-variant);
  padding: 2rpx 8rpx;
  border-radius: var(--radius-xs);
  font-family: var(--font-mono, monospace);
  font-size: 0.95em;
}
.explain-md :deep(pre) {
  background: var(--color-surface-variant);
  padding: var(--space-3);
  border-radius: var(--radius-sm);
  overflow-x: auto;
  margin: var(--space-2) 0;
}
.explain-md :deep(blockquote) {
  border-left: 4rpx solid var(--color-primary);
  padding-left: var(--space-3);
  color: var(--color-text-secondary);
  margin: var(--space-2) 0;
}

.explain-foot {
  padding: var(--space-3) var(--space-5);
  border-top: 2rpx solid var(--color-outline-variant);
}
</style>
