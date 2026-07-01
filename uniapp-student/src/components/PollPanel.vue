<template>
  <view v-if="visible && poll" class="poll-overlay">
    <view class="poll-scrim" @tap="onScrimTap"></view>
    <view class="poll-card">
      <view class="poll-head">
        <view class="poll-head-left">
          <Tag :tone="kindTone" size="sm">{{ kindLabel }}</Tag>
          <view
            v-if="hasDuration && phase === 'answering' && !timeUp"
            class="poll-timer"
            :class="{ urgent: remaining <= 5 }"
          >
            <Icon name="clock" size="xs" :tone="remaining <= 5 ? 'danger' : 'primary'" />
            <text class="poll-timer-text">{{ countdownText }}</text>
          </view>
        </view>
        <IconButton
          v-if="phase !== 'answering' || timeUp"
          icon="x"
          size="sm"
          aria-label="\u5173\u95ed"
          @tap="close"
        />
      </view>

      <text class="poll-question">{{ poll.question }}</text>

      <!-- ===== 作答区 ===== -->
      <view v-if="phase === 'answering'" class="poll-answer">
        <!-- choice：单选 / 多选 -->
        <view v-if="poll.kind === 'choice'" class="poll-options">
          <text v-if="poll.maxSelect > 1" class="poll-hint">最多可选 {{ poll.maxSelect }} 项</text>
          <button
            v-for="(opt, idx) in poll.options"
            :key="idx"
            class="poll-option"
            :class="{ selected: isSelected(idx), disabled: timeUp }"
            hover-class="poll-option-hover"
            :hover-stay-time="80"
            @tap="toggleOption(idx)"
          >
            <view class="poll-opt-marker">
              <Icon v-if="isSelected(idx)" name="check" size="xs" tone="inverse" />
              <text v-else>{{ letter(idx) }}</text>
            </view>
            <text class="poll-opt-text">{{ opt }}</text>
          </button>
        </view>

        <!-- text：词云投稿 -->
        <textarea
          v-else-if="poll.kind === 'text'"
          v-model="textAnswer"
          class="poll-textarea"
          placeholder="\u8f93\u5165\u4f60\u7684\u7b54\u6848\uff0c\u63d0\u4ea4\u540e\u6c47\u5165\u8bcd\u4e91"
          :maxlength="60"
          :auto-height="true"
          :adjust-position="true"
          :disabled="timeUp"
        />

        <!-- rating：星级评分 -->
        <view v-else class="poll-rating">
          <view class="poll-stars">
            <text
              v-for="n in poll.max"
              :key="n"
              class="poll-star"
              :class="{ on: n <= ratingValue }"
              @tap="setRating(n)"
            >{{ n <= ratingValue ? '\u2605' : '\u2606' }}</text>
          </view>
          <text class="poll-rating-hint">{{ ratingValue > 0 ? `${ratingValue} \u5206` : '\u70b9\u51fb\u661f\u661f\u8bc4\u5206' }}</text>
        </view>

        <text v-if="timeUp" class="poll-timeup">\u23f0 \u4f5c\u7b54\u65f6\u95f4\u5df2\u622a\u6b62</text>
      </view>

      <!-- ===== 结果区 ===== -->
      <view v-else class="poll-result">
        <view class="poll-result-status">
          <Icon name="check-circle" size="sm" tone="success" />
          <text>{{ phase === 'closed' ? '\u6295\u7968\u5df2\u7ed3\u675f' : '\u5df2\u63d0\u4ea4\uff0c\u611f\u8c22\u53c2\u4e0e' }}</text>
          <text v-if="total > 0" class="poll-result-total">\u00b7 {{ total }} \u4eba\u53c2\u4e0e</text>
        </view>

        <!-- choice 结果 -->
        <view v-if="poll.kind === 'choice' && choiceResults.length" class="poll-bars">
          <view v-for="(r, idx) in choiceResults" :key="idx" class="poll-bar-row">
            <view class="poll-bar-head">
              <text class="poll-bar-label">{{ letter(idx) }}. {{ r.label }}</text>
              <text class="poll-bar-val">{{ r.count }} \u00b7 {{ r.pct }}%</text>
            </view>
            <view class="poll-bar-track">
              <view class="poll-bar-fill" :class="{ mine: isSelected(idx) }" :style="{ width: r.pct + '%' }"></view>
            </view>
          </view>
        </view>

        <!-- rating 结果 -->
        <view v-else-if="poll.kind === 'rating'" class="poll-rating-result">
          <view class="poll-rr-score">
            <text class="poll-rr-avg">{{ ratingResult.avg }}</text>
            <text class="poll-rr-max">/ {{ poll.max }}</text>
          </view>
          <view class="poll-rr-stars">
            <text
              v-for="n in poll.max"
              :key="n"
              class="poll-star sm"
              :class="{ on: n <= ratingAvgRounded }"
            >{{ n <= ratingAvgRounded ? '\u2605' : '\u2606' }}</text>
          </view>
          <text class="poll-rr-count">{{ ratingResult.count }} \u4eba\u8bc4\u5206</text>
        </view>

        <!-- text 词云 -->
        <view v-else-if="poll.kind === 'text'" class="poll-cloud">
          <text
            v-for="(w, idx) in wordCloud"
            :key="idx"
            class="poll-cloud-word"
            :class="`tone-${idx % 5}`"
            :style="{ fontSize: wordSize(w.count) + 'rpx' }"
          >{{ w.word }}</text>
          <text v-if="!wordCloud.length" class="poll-result-empty">\u7b49\u5f85\u66f4\u591a\u540c\u5b66\u63d0\u4ea4\u2026</text>
        </view>

        <view v-else class="poll-result-empty">
          <text>\u7b49\u5f85\u5b9e\u65f6\u7edf\u8ba1\u2026</text>
        </view>
      </view>

      <!-- ===== 底部 ===== -->
      <view class="poll-foot">
        <Button
          v-if="phase === 'answering' && !timeUp"
          variant="primary"
          size="md"
          block
          icon-left="check"
          :disabled="!canSubmit"
          :loading="submitting"
          @tap="submit"
        >
          {{ submitting ? '\u63d0\u4ea4\u4e2d' : '\u63d0\u4ea4' }}
        </Button>
        <Button v-else variant="secondary" size="md" block @tap="close">关闭</Button>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useSocket } from '@/sockets/useSocket'
import { RoomEvent } from '@/shared/wsEvents'
import Icon from '@/components/ui/Icon.vue'
import Button from '@/components/ui/Button.vue'
import IconButton from '@/components/ui/IconButton.vue'
import Tag from '@/components/ui/Tag.vue'

const { getSocket } = useSocket()

type PollKind = 'choice' | 'text' | 'rating'
interface PollDef {
  pollId: string
  kind: PollKind
  question: string
  options: string[]
  maxSelect: number
  max: number
  durationSec: number
}

const visible = ref(false)
const poll = ref<PollDef | null>(null)
const phase = ref<'answering' | 'submitted' | 'closed'>('answering')
const submitting = ref(false)

const selectedOptions = ref<number[]>([])
const textAnswer = ref('')
const ratingValue = ref(0)

const total = ref(0)
const stats = ref<any>(null)

const remaining = ref(0)
let startedAt = 0
let ticker: ReturnType<typeof setInterval> | null = null
let ackTimer: ReturnType<typeof setTimeout> | null = null
let autoCloseTimer: ReturnType<typeof setTimeout> | null = null

/* ============ 展示辅助 ============ */
const kindLabel = computed(() => {
  const k = poll.value?.kind
  if (k === 'text') return '\u6295\u7a3f\u00b7\u8bcd\u4e91'
  if (k === 'rating') return '\u8bc4\u5206'
  return (poll.value?.maxSelect || 1) > 1 ? '\u591a\u9009\u6295\u7968' : '\u6295\u7968'
})
const kindTone = computed(() => {
  const k = poll.value?.kind
  if (k === 'rating') return 'warning'
  if (k === 'text') return 'secondary'
  return 'primary'
})
const hasDuration = computed(() => !!poll.value?.durationSec)
const timeUp = computed(() => (poll.value?.durationSec ? remaining.value <= 0 : false))
const countdownText = computed(() => {
  const t = Math.max(0, Math.ceil(remaining.value))
  const m = Math.floor(t / 60)
  const s = t % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
})
function letter(i: number) { return String.fromCharCode(65 + i) }

/* ============ 作答交互 ============ */
function isSelected(idx: number) { return selectedOptions.value.includes(idx) }

function toggleOption(idx: number) {
  const p = poll.value
  if (!p || phase.value !== 'answering' || timeUp.value) return
  if (p.maxSelect <= 1) {
    selectedOptions.value = [idx]
    return
  }
  const arr = selectedOptions.value.slice()
  const pos = arr.indexOf(idx)
  if (pos >= 0) {
    arr.splice(pos, 1)
  } else {
    if (arr.length >= p.maxSelect) {
      uni.showToast({ title: `\u6700\u591a\u9009 ${p.maxSelect} \u9879`, icon: 'none' })
      return
    }
    arr.push(idx)
  }
  selectedOptions.value = arr
}

function setRating(v: number) {
  if (phase.value !== 'answering' || timeUp.value) return
  ratingValue.value = v
}

const canSubmit = computed(() => {
  const p = poll.value
  if (!p || phase.value !== 'answering' || timeUp.value) return false
  if (p.kind === 'choice') return selectedOptions.value.length > 0
  if (p.kind === 'text') return textAnswer.value.trim().length > 0
  if (p.kind === 'rating') return ratingValue.value > 0
  return false
})

function submit() {
  const p = poll.value
  if (!p || !canSubmit.value || submitting.value) return
  submitting.value = true
  let value: any
  if (p.kind === 'choice') value = selectedOptions.value.slice().sort((a, b) => a - b)
  else if (p.kind === 'text') value = textAnswer.value.trim()
  else value = ratingValue.value
  getSocket()?.emit(RoomEvent.PollSubmit, { pollId: p.pollId, value })
  // ack 兜底：3s 未收到 ack 也切到"已提交"，避免卡在 loading
  clearAck()
  ackTimer = setTimeout(() => {
    if (phase.value === 'answering') {
      phase.value = 'submitted'
      submitting.value = false
    }
  }, 3000)
}

/* ============ 结果归一化（防御式，兼容多种 stats 结构） ============ */
// 权威结构（后端 · 总指挥确认）：stats.counts:number[]，下标对齐 options（0-based）
function normalizeChoiceCounts(s: any, n: number): number[] {
  const out = new Array(n).fill(0)
  if (!s) return out
  const counts = Array.isArray(s.counts) ? s.counts : (Array.isArray(s) ? s : null)
  if (counts) {
    counts.forEach((c: any, i: number) => { if (i < n) out[i] = Number(c) || 0 })
    return out
  }
  // 兜底：对象 {optionIndex: count}
  if (typeof s === 'object') {
    Object.keys(s).forEach(k => {
      const idx = Number(k)
      if (!isNaN(idx) && idx >= 0 && idx < n) out[idx] = Number(s[k]) || 0
    })
  }
  return out
}

const choiceResults = computed(() => {
  const p = poll.value
  if (!p || p.kind !== 'choice') return [] as Array<{ label: string; count: number; pct: number }>
  const counts = normalizeChoiceCounts(stats.value, p.options.length)
  const sum = counts.reduce((a, b) => a + b, 0)
  // 百分比基数优先用 total（参与人数），多选时更合理
  const base = total.value > 0 ? total.value : sum
  return p.options.map((opt, i) => ({
    label: opt,
    count: counts[i] || 0,
    pct: base > 0 ? Math.round(((counts[i] || 0) / base) * 100) : 0,
  }))
})

// 权威结构：stats.avg:number + stats.distribution:number[]（distribution[分-1]=人数）
const ratingResult = computed(() => {
  const p = poll.value
  if (!p || p.kind !== 'rating') return { avg: 0, count: 0 }
  const s = stats.value
  let avg = 0
  let count = total.value
  if (typeof s === 'number') avg = s
  else if (s && typeof s === 'object') {
    avg = Number(s.avg ?? s.average ?? s.mean ?? 0)
    if (Array.isArray(s.distribution)) {
      count = s.distribution.reduce((a: number, b: any) => a + (Number(b) || 0), 0)
    } else {
      count = Number(s.count ?? s.total ?? total.value ?? 0)
    }
  }
  return { avg: Math.round(avg * 10) / 10, count }
})
const ratingAvgRounded = computed(() => Math.round(ratingResult.value.avg))

// 权威结构：stats.words:[{text, weight}]（已按 weight 降序，最多 100）
const wordCloud = computed(() => {
  const p = poll.value
  if (!p || p.kind !== 'text') return [] as Array<{ word: string; count: number }>
  const s = stats.value
  const rawWords = Array.isArray(s?.words) ? s.words : (Array.isArray(s) ? s : null)
  let arr: Array<{ word: string; count: number }> = []
  if (rawWords) {
    arr = rawWords.map((item: any) =>
      typeof item === 'string'
        ? { word: item, count: 1 }
        : { word: String(item?.text ?? item?.word ?? item?.label ?? ''), count: Number(item?.weight ?? item?.count ?? item?.value ?? 1) },
    ).filter((w: { word: string; count: number }) => w.word)
  } else if (s && typeof s === 'object') {
    arr = Object.keys(s).map(k => ({ word: k, count: Number(s[k]) || 0 }))
  }
  arr.sort((a, b) => b.count - a.count)
  return arr.slice(0, 40)
})

const maxWordCount = computed(() => wordCloud.value.reduce((m, w) => Math.max(m, w.count), 1))
function wordSize(count: number) {
  const min = 24
  const max = 52
  const ratio = maxWordCount.value > 0 ? count / maxWordCount.value : 0
  return Math.round(min + (max - min) * ratio)
}

/* ============ 倒计时 ============ */
function startCountdown() {
  stopCountdown()
  const p = poll.value
  if (!p || !p.durationSec) { remaining.value = 0; return }
  startedAt = Date.now()
  remaining.value = p.durationSec
  ticker = setInterval(() => {
    const elapsed = (Date.now() - startedAt) / 1000
    remaining.value = Math.max(0, p.durationSec - elapsed)
    if (remaining.value <= 0) stopCountdown()
  }, 250)
}
function stopCountdown() { if (ticker) { clearInterval(ticker); ticker = null } }
function clearAck() { if (ackTimer) { clearTimeout(ackTimer); ackTimer = null } }

/* ============ socket 事件 ============ */
function normalizeOptions(raw: any): string[] {
  if (!Array.isArray(raw)) return []
  return raw.map((o: any) => (typeof o === 'string' ? o : String(o?.content ?? o?.label ?? o?.text ?? o ?? '')))
}

function onPollStart(data: any) {
  if (!data?.pollId) return
  poll.value = {
    pollId: String(data.pollId),
    kind: (data.kind as PollKind) || 'choice',
    question: data.question || '\u8bf7\u4f5c\u7b54',
    options: normalizeOptions(data.options),
    maxSelect: Number(data.maxSelect) || 1,
    max: Number(data.max) || 5,
    durationSec: Number(data.durationSec) || 0,
  }
  selectedOptions.value = []
  textAnswer.value = ''
  ratingValue.value = 0
  total.value = 0
  stats.value = null
  submitting.value = false
  phase.value = 'answering'
  visible.value = true
  if (autoCloseTimer) { clearTimeout(autoCloseTimer); autoCloseTimer = null }
  startCountdown()
}

function onPollSubmitAck(data: any) {
  if (!poll.value || (data?.pollId && data.pollId !== poll.value.pollId)) return
  clearAck()
  submitting.value = false
  phase.value = 'submitted'
  if (data?.duplicate) uni.showToast({ title: '\u4f60\u5df2\u63d0\u4ea4\u8fc7', icon: 'none' })
  else uni.showToast({ title: '\u63d0\u4ea4\u6210\u529f', icon: 'success' })
}

function onPollUpdate(data: any) {
  if (!poll.value || (data?.pollId && data.pollId !== poll.value.pollId)) return
  total.value = Number(data.total) || total.value
  if (data.stats != null) stats.value = data.stats
}

function onPollStop(data: any) {
  if (!poll.value || (data?.pollId && data.pollId !== poll.value.pollId)) return
  if (data?.finalStats != null) stats.value = data.finalStats
  if (data?.total != null) total.value = Number(data.total) || total.value
  phase.value = 'closed'
  stopCountdown()
  if (autoCloseTimer) clearTimeout(autoCloseTimer)
  autoCloseTimer = setTimeout(() => close(), 8000)
}

function onScrimTap() {
  // 作答中防误触；已提交/已结束点遮罩可关
  if (phase.value !== 'answering' || timeUp.value) close()
}

function close() {
  visible.value = false
  poll.value = null
  stopCountdown()
  clearAck()
  if (autoCloseTimer) { clearTimeout(autoCloseTimer); autoCloseTimer = null }
}

// socket 单例由父页面 onMounted 才建立；本组件常驻挂载会早于父，故重试绑定
let retryTimer: ReturnType<typeof setInterval> | null = null
function bindSocket() {
  const s = getSocket()
  if (!s) return false
  s.on(RoomEvent.PollStart, onPollStart)
  s.on(RoomEvent.PollSubmitAck, onPollSubmitAck)
  s.on(RoomEvent.PollUpdate, onPollUpdate)
  s.on(RoomEvent.PollStop, onPollStop)
  return true
}

onMounted(() => {
  if (bindSocket()) return
  let tries = 0
  retryTimer = setInterval(() => {
    if (bindSocket() || ++tries > 30) {
      if (retryTimer) { clearInterval(retryTimer); retryTimer = null }
    }
  }, 100)
})

onUnmounted(() => {
  if (retryTimer) { clearInterval(retryTimer); retryTimer = null }
  stopCountdown()
  clearAck()
  if (autoCloseTimer) { clearTimeout(autoCloseTimer); autoCloseTimer = null }
  const s = getSocket()
  s?.off(RoomEvent.PollStart, onPollStart)
  s?.off(RoomEvent.PollSubmitAck, onPollSubmitAck)
  s?.off(RoomEvent.PollUpdate, onPollUpdate)
  s?.off(RoomEvent.PollStop, onPollStop)
})
</script>

<style lang="scss" scoped>
@import '@/styles/variables.scss';

.poll-overlay {
  position: fixed;
  inset: 0;
  z-index: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-5);
  box-sizing: border-box;
}

.poll-scrim {
  position: absolute;
  inset: 0;
  background: var(--color-scrim);
  animation: poll-fade var(--duration-base) var(--ease-decelerate);
}

.poll-card {
  position: relative;
  z-index: 1;
  width: min(760rpx, 94vw);
  max-height: 90vh;
  overflow-y: auto;
  background: var(--color-surface-raised);
  border-radius: var(--radius-2xl);
  padding: var(--space-6);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  box-shadow: var(--elevation-4);
  animation: poll-rise var(--duration-med) var(--ease-emphasized);
}

.poll-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.poll-head-left {
  display: inline-flex;
  align-items: center;
  gap: var(--space-3);
}

.poll-timer {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: 2rpx var(--space-3);
  background: var(--color-primary-container);
  color: var(--color-on-primary-container);
  border-radius: var(--radius-pill);

  &.urgent {
    background: var(--color-danger-container);
    color: var(--color-on-danger-container);
  }
}

.poll-timer-text {
  font-size: var(--font-caption);
  font-weight: var(--font-weight-bold);
  font-variant-numeric: tabular-nums;
}

.poll-question {
  font-size: var(--font-title-sm);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
  line-height: var(--line-height-normal);
}

/* ===== 作答 ===== */
.poll-answer { display: flex; flex-direction: column; gap: var(--space-3); }

.poll-hint {
  font-size: var(--font-caption);
  color: var(--color-text-tertiary);
}

.poll-options { display: flex; flex-direction: column; gap: var(--space-3); }

.poll-option {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-4);
  background: var(--color-surface);
  border: 2rpx solid var(--color-outline);
  border-radius: var(--radius-lg);
  min-height: 92rpx;
  text-align: left;
  transition: background-color var(--duration-fast) var(--ease-standard),
              border-color var(--duration-fast) var(--ease-standard),
              transform var(--duration-fast) var(--ease-standard);

  &::after { border: 0 !important; }

  &.selected {
    border-color: var(--color-primary);
    background: var(--color-primary-container);
  }
  &.disabled { opacity: 0.6; }
}

.poll-option-hover {
  background: var(--color-state-overlay-press);
  transform: scale(0.99);
  &.selected { background: var(--color-primary-container); }
}

.poll-opt-marker {
  width: 52rpx;
  height: 52rpx;
  flex-shrink: 0;
  border-radius: var(--radius-full);
  background: var(--color-surface-variant);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-label);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-secondary);

  .selected & { background: var(--color-primary); color: var(--color-text-on-color); }
}

.poll-opt-text {
  flex: 1;
  font-size: var(--font-body);
  color: var(--color-text-primary);
  line-height: var(--line-height-snug);
}

.poll-textarea {
  width: 100%;
  min-height: 180rpx;
  padding: var(--space-4);
  background: var(--color-surface-variant);
  border: 2rpx solid var(--color-outline);
  border-radius: var(--radius-lg);
  font-size: var(--font-body);
  line-height: var(--line-height-normal);
  color: var(--color-text-primary);
  box-sizing: border-box;
}

.poll-rating {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-5) 0;
}

.poll-stars { display: flex; gap: var(--space-2); }

.poll-star {
  font-size: 72rpx;
  color: var(--color-outline);
  line-height: 1;

  &.on { color: var(--p-amber-500, #f5a623); }
  &.sm { font-size: 40rpx; }
}

.poll-rating-hint {
  font-size: var(--font-body);
  color: var(--color-text-secondary);
}

.poll-timeup {
  font-size: var(--font-caption);
  color: var(--color-danger);
  text-align: center;
}

/* ===== 结果 ===== */
.poll-result { display: flex; flex-direction: column; gap: var(--space-4); }

.poll-result-status {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--font-label);
  color: var(--color-text-secondary);
}

.poll-result-total { color: var(--color-text-tertiary); }

.poll-bars { display: flex; flex-direction: column; gap: var(--space-3); }

.poll-bar-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: var(--space-1);
  gap: var(--space-2);
}

.poll-bar-label {
  font-size: var(--font-label);
  color: var(--color-text-primary);
  flex: 1;
  min-width: 0;
}

.poll-bar-val {
  font-size: var(--font-caption);
  color: var(--color-text-secondary);
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}

.poll-bar-track {
  height: 20rpx;
  background: var(--color-surface-variant);
  border-radius: var(--radius-pill);
  overflow: hidden;
}

.poll-bar-fill {
  height: 100%;
  background: var(--color-primary);
  border-radius: var(--radius-pill);
  transition: width var(--duration-med) var(--ease-decelerate);

  &.mine { background: linear-gradient(90deg, var(--color-primary), var(--color-secondary)); }
}

.poll-rating-result {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-4) 0;
}

.poll-rr-score { display: flex; align-items: baseline; gap: var(--space-1); }
.poll-rr-avg {
  font-size: var(--font-display);
  font-weight: var(--font-weight-bold);
  color: var(--p-amber-500, #f5a623);
  line-height: 1;
}
.poll-rr-max { font-size: var(--font-title-sm); color: var(--color-text-tertiary); }
.poll-rr-stars { display: flex; gap: 4rpx; }
.poll-rr-count { font-size: var(--font-caption); color: var(--color-text-secondary); }

.poll-cloud {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: var(--space-2) var(--space-4);
  padding: var(--space-4);
  background: var(--color-surface-variant);
  border-radius: var(--radius-lg);
  min-height: 200rpx;
}

.poll-cloud-word {
  font-weight: var(--font-weight-bold);
  line-height: 1.2;

  &.tone-0 { color: var(--color-primary); }
  &.tone-1 { color: var(--color-secondary); }
  &.tone-2 { color: var(--p-amber-500, #f5a623); }
  &.tone-3 { color: var(--p-green-500, #20a546); }
  &.tone-4 { color: var(--color-text-primary); }
}

.poll-result-empty {
  padding: var(--space-6);
  text-align: center;
  font-size: var(--font-body);
  color: var(--color-text-tertiary);
}

.poll-foot { margin-top: var(--space-2); }

@keyframes poll-fade {
  from { opacity: 0; }
  to   { opacity: 1; }
}

@keyframes poll-rise {
  from { opacity: 0; transform: translateY(20rpx) scale(0.96); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
</style>
