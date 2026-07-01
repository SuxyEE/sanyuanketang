<template>
  <view v-if="open" class="modal-mask" @tap="close">
    <view class="modal-card" @tap.stop>
      <view class="modal-head">
        <text class="modal-title">{{ activePoll ? (ended ? '投票结果' : '投票进行中') : '投票 / 词云 / 评分' }}</text>
        <button class="close-btn" @tap="close">
          <Icon name="x" size="md" />
        </button>
      </view>

      <!-- 发起阶段 -->
      <view v-if="!activePoll" class="form">
        <view class="kind-row">
          <button
            v-for="k in kinds"
            :key="k.value"
            class="kind-card"
            :class="{ active: kind === k.value }"
            @tap="kind = k.value"
          >
            <Icon :name="k.icon" size="lg" :tone="kind === k.value ? 'primary' : 'muted'" />
            <text class="kind-label">{{ k.label }}</text>
            <text class="kind-desc">{{ k.desc }}</text>
          </button>
        </view>

        <textarea v-model="question" class="textarea" placeholder="输入题干 / 问题，例如：这节课的难度如何？" />

        <template v-if="kind === 'choice'">
          <textarea
            v-model="optionsText"
            class="textarea small"
            placeholder="每行一个选项，至少 2 项，例如：&#10;偏难&#10;适中&#10;偏易"
          />
          <view class="segmented">
            <button :class="{ active: maxSelect === 1 }" @tap="maxSelect = 1">单选</button>
            <button :class="{ active: maxSelect > 1 }" @tap="maxSelect = 2">多选</button>
          </view>
          <view v-if="maxSelect > 1" class="stepper">
            <button @tap="maxSelect = Math.max(2, maxSelect - 1)"><Icon name="chevron-left" size="md" /></button>
            <text>最多可选 {{ maxSelect }} 项</text>
            <button @tap="maxSelect = Math.min(optionCount || 2, maxSelect + 1)"><Icon name="chevron-right" size="md" /></button>
          </view>
        </template>

        <template v-else-if="kind === 'rating'">
          <view class="option-row">
            <text class="option-label">评分上限：</text>
            <button
              v-for="m in [3, 5, 10]"
              :key="m"
              class="option-card compact"
              :class="{ active: ratingMax === m }"
              @tap="ratingMax = m"
            >
              <text>{{ m }} 星</text>
            </button>
          </view>
        </template>

        <view v-else class="hint-box">学生提交的短语/关键词会实时聚合成词云，适合课堂头脑风暴。</view>

        <view class="option-row">
          <text class="option-label">时长：</text>
          <button
            v-for="d in durationOptions"
            :key="d.value"
            class="option-card compact"
            :class="{ active: durationSec === d.value }"
            @tap="durationSec = d.value"
          >
            <text>{{ d.label }}</text>
          </button>
        </view>

        <Button block icon-left="send" @tap="startPoll">发起{{ kindLabel }}</Button>
      </view>

      <!-- 进行中 / 结果阶段 -->
      <view v-else class="form">
        <view class="live-head">
          <view class="live-dot" :class="{ ended }"></view>
          <text class="live-question">{{ activePoll.question }}</text>
        </view>
        <text class="live-total">{{ ended ? '最终 ' : '' }}{{ total }} 人参与{{ ended ? '（已结束）' : '' }}</text>

        <!-- 选择题柱状图 -->
        <view v-if="activePoll.kind === 'choice'" class="bars">
          <view v-for="(opt, i) in activePoll.options" :key="i" class="bar-row">
            <text class="bar-label">{{ opt }}</text>
            <view class="bar-track">
              <view class="bar-fill" :style="{ width: barPercent(i) + '%' }"></view>
            </view>
            <text class="bar-count">{{ counts[i] || 0 }}</text>
          </view>
        </view>

        <!-- 词云 -->
        <view v-else-if="activePoll.kind === 'text'" class="wordcloud">
          <text
            v-for="(w, i) in words"
            :key="i"
            class="word"
            :style="{ fontSize: wordSize(w.weight) + 'rpx', opacity: wordOpacity(w.weight) }"
          >{{ w.text }}</text>
          <text v-if="words.length === 0" class="wordcloud-empty">等待学生提交关键词…</text>
        </view>

        <!-- 评分 -->
        <view v-else class="rating-result">
          <view class="rating-hero">
            <text class="rating-avg">{{ ratingAvg.toFixed(1) }}</text>
            <view class="rating-stars">
              <text v-for="s in activePoll.max || 5" :key="s" class="star" :class="{ on: s <= Math.round(ratingAvg) }">★</text>
            </view>
          </view>
          <view class="rating-dist">
            <view v-for="(cnt, i) in distribution" :key="i" class="dist-row">
              <text class="dist-label">{{ i + 1 }}★</text>
              <view class="bar-track">
                <view class="bar-fill amber" :style="{ width: distPercent(cnt) + '%' }"></view>
              </view>
              <text class="bar-count">{{ cnt }}</text>
            </view>
          </view>
        </view>

        <view class="live-actions">
          <Button v-if="!ended" variant="danger" block icon-left="stop-circle" @tap="stopPoll">结束并公布</Button>
          <Button v-else block icon-left="plus" @tap="newPoll">新建投票</Button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import Icon from '@/components/ui/Icon.vue'
import Button from '@/components/ui/Button.vue'
import type { IconName } from '@/icons'
import { RoomEvent } from '@/shared/wsEvents'
import { useRoomSocket } from '@/composables/useRoomSocket'

type PollKind = 'choice' | 'text' | 'rating'

interface ActivePoll {
  pollId: string
  kind: PollKind
  question: string
  options: string[]
  max?: number
}

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ 'update:open': [boolean] }>()

const kinds: { value: PollKind; label: string; desc: string; icon: IconName }[] = [
  { value: 'choice', label: '投票', desc: '选项统计', icon: 'bar-chart' },
  { value: 'text', label: '词云', desc: '关键词聚合', icon: 'message-square' },
  { value: 'rating', label: '评分', desc: '星级打分', icon: 'sparkles' },
]
const durationOptions = [
  { label: '不限时', value: 0 },
  { label: '30 秒', value: 30 },
  { label: '60 秒', value: 60 },
  { label: '2 分钟', value: 120 },
]

const kind = ref<PollKind>('choice')
const question = ref('')
const optionsText = ref('')
const maxSelect = ref(1)
const ratingMax = ref(5)
const durationSec = ref(0)

const activePoll = ref<ActivePoll | null>(null)
const total = ref(0)
const counts = ref<number[]>([])
const words = ref<{ text: string; weight: number }[]>([])
const ratingAvg = ref(0)
const distribution = ref<number[]>([])
const ended = ref(false)

const optionCount = computed(() => optionsText.value.split('\n').map((s) => s.trim()).filter(Boolean).length)
const kindLabel = computed(() => kinds.find((k) => k.value === kind.value)?.label || '投票')

function toast(title: string, icon: 'success' | 'none' = 'none') {
  uni.showToast({ title, icon })
}

const { emit: wsEmit } = useRoomSocket({
  // 后端会回一个带权威 pollId 的 poll:start 广播，回填到本地进行中的投票；
  // late-join / 重连时也走这里，根据广播恢复进行中的投票。
  [RoomEvent.PollStart]: (data: any) => {
    if (!data || !data.pollId) return
    if (!activePoll.value) {
      activePoll.value = {
        pollId: data.pollId,
        kind: data.kind || 'choice',
        question: data.question || '',
        options: Array.isArray(data.options) ? data.options : [],
        max: typeof data.max === 'number' ? data.max : 5,
      }
      ended.value = false
      total.value = 0
      counts.value = []
      words.value = []
      ratingAvg.value = 0
      distribution.value = []
      return
    }
    if (activePoll.value.pollId) return
    activePoll.value.pollId = data.pollId
    if (Array.isArray(data.options) && data.options.length) activePoll.value.options = data.options
    if (data.kind) activePoll.value.kind = data.kind
    if (typeof data.max === 'number') activePoll.value.max = data.max
  },
  [RoomEvent.PollUpdate]: (data: any) => {
    if (!activePoll.value || !data) return
    if (activePoll.value.pollId && data.pollId !== activePoll.value.pollId) return
    if (!activePoll.value.pollId) activePoll.value.pollId = data.pollId
    total.value = data.total || 0
    applyStats(data.kind || activePoll.value.kind, data.stats)
  },
  // 后端结束广播：结果放在 finalStats 键
  [RoomEvent.PollStop]: (data: any) => {
    if (!activePoll.value || !data) return
    if (activePoll.value.pollId && data.pollId && data.pollId !== activePoll.value.pollId) return
    if (typeof data.total === 'number') total.value = data.total
    applyStats(data.kind || activePoll.value.kind, data.finalStats || data.stats)
    ended.value = true
  },
})

function applyStats(k: string, stats: any) {
  const s = stats || {}
  if (k === 'choice') counts.value = Array.isArray(s.counts) ? s.counts : []
  else if (k === 'text') words.value = Array.isArray(s.words) ? s.words : []
  else if (k === 'rating') {
    ratingAvg.value = typeof s.avg === 'number' ? s.avg : 0
    distribution.value = Array.isArray(s.distribution) ? s.distribution : []
  }
}

function startPoll() {
  const q = question.value.trim()
  if (!q) return toast('请输入题干')
  const options = optionsText.value.split('\n').map((s) => s.trim()).filter(Boolean)
  if (kind.value === 'choice' && options.length < 2) return toast('至少输入 2 个选项')

  // pollId 由后端分配（后端会回一个带 pollId 的 poll:start 广播）
  const payload: any = { kind: kind.value, question: q }
  if (kind.value === 'choice') {
    payload.options = options
    payload.maxSelect = maxSelect.value
  } else if (kind.value === 'rating') {
    payload.max = ratingMax.value
  }
  if (durationSec.value > 0) payload.durationSec = durationSec.value

  wsEmit(RoomEvent.PollStart, payload)
  ended.value = false
  activePoll.value = { pollId: '', kind: kind.value, question: q, options, max: ratingMax.value }
  total.value = 0
  counts.value = []
  words.value = []
  ratingAvg.value = 0
  distribution.value = []
  toast(`${kindLabel.value}已发起`, 'success')
}

function stopPoll() {
  if (!activePoll.value) return
  wsEmit(RoomEvent.PollStop, { pollId: activePoll.value.pollId })
  // 乐观进入“已结束”态并保留当前结果；后端回 poll:stop(finalStats) 会覆盖为权威最终值
  ended.value = true
  toast('已结束，正在公布结果')
}

function newPoll() {
  activePoll.value = null
  ended.value = false
}

function close() {
  emit('update:open', false)
}

function barPercent(i: number) {
  const max = Math.max(...counts.value, 1)
  return Math.round(((counts.value[i] || 0) / max) * 100)
}
function distPercent(cnt: number) {
  const max = Math.max(...distribution.value, 1)
  return Math.round((cnt / max) * 100)
}
function wordSize(weight: number) {
  const max = Math.max(...words.value.map((w) => w.weight), 1)
  return Math.round(22 + (weight / max) * 34)
}
function wordOpacity(weight: number) {
  const max = Math.max(...words.value.map((w) => w.weight), 1)
  return Math.round((0.55 + (weight / max) * 0.45) * 100) / 100
}
</script>

<style scoped lang="scss">
@import '@/styles/variables.scss';

.modal-mask {
  position: fixed;
  inset: 0;
  background: var(--color-scrim);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: var(--z-modal);
  padding: var(--space-5);
}
.modal-card {
  width: 92%;
  max-width: 720rpx;
  max-height: 84vh;
  overflow-y: auto;
  background: var(--color-surface-raised);
  border-radius: var(--radius-2xl);
  padding: var(--space-6);
  box-shadow: var(--elevation-4);
}
.modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-5);
}
.modal-title { font-size: var(--font-title-sm); font-weight: var(--font-weight-bold); color: var(--color-text-primary); }
.close-btn {
  width: 64rpx; height: 64rpx; min-height: 0; padding: 0;
  display: flex; align-items: center; justify-content: center;
  background: var(--color-surface-variant); border-radius: var(--radius-full);
  color: var(--color-text-secondary);
}
.form { display: flex; flex-direction: column; gap: var(--space-4); }

.kind-row { display: flex; gap: var(--space-3); }
.kind-card {
  flex: 1; display: flex; flex-direction: column; align-items: center; gap: var(--space-2);
  padding: var(--space-4) var(--space-2); background: var(--color-surface-variant);
  border: 2rpx solid transparent; border-radius: var(--radius-lg); min-height: 0; line-height: 1.3;
  &.active { border-color: var(--color-primary); background: var(--color-primary-container); }
}
.kind-label { font-size: var(--font-label); font-weight: var(--font-weight-semibold); color: var(--color-text-primary); }
.kind-desc { font-size: var(--font-overline); color: var(--color-text-tertiary); }

.textarea, .input {
  width: 100%; box-sizing: border-box; padding: var(--space-3) var(--space-4);
  background: var(--color-surface-variant); border: 2rpx solid var(--color-outline);
  border-radius: var(--radius-md); font-size: var(--font-body); color: var(--color-text-primary);
}
.textarea { min-height: 132rpx; }
.textarea.small { min-height: 96rpx; }

.segmented {
  display: flex; background: var(--color-surface-variant); border-radius: var(--radius-md); padding: 4rpx;
  button {
    flex: 1; min-height: 64rpx; line-height: 64rpx; background: transparent; border-radius: var(--radius-sm);
    font-size: var(--font-caption); color: var(--color-text-secondary);
    &.active { background: var(--color-surface); color: var(--color-primary); font-weight: var(--font-weight-semibold); box-shadow: var(--elevation-1); }
  }
}
.stepper {
  display: flex; align-items: center; justify-content: space-between;
  background: var(--color-surface-variant); border-radius: var(--radius-md); padding: var(--space-2) var(--space-4);
  text { font-size: var(--font-caption); color: var(--color-text-secondary); }
  button { width: 64rpx; height: 64rpx; min-height: 0; padding: 0; background: var(--color-surface); border-radius: var(--radius-sm); display: flex; align-items: center; justify-content: center; }
}
.option-row { display: flex; align-items: center; flex-wrap: wrap; gap: var(--space-2); }
.option-label { font-size: var(--font-caption); color: var(--color-text-secondary); }
.option-card {
  display: flex; align-items: center; gap: var(--space-2); padding: var(--space-2) var(--space-4);
  background: var(--color-surface-variant); border: 2rpx solid transparent; border-radius: var(--radius-md);
  min-height: 0; line-height: 1.4;
  text { font-size: var(--font-caption); color: var(--color-text-secondary); }
  &.compact { padding: var(--space-2) var(--space-3); }
  &.active { border-color: var(--color-primary); background: var(--color-primary-container); text { color: var(--color-primary); } }
}
.hint-box {
  padding: var(--space-3) var(--space-4); background: var(--color-primary-container);
  border-radius: var(--radius-md); font-size: var(--font-caption); color: var(--color-on-primary-container); line-height: 1.5;
}

.live-head { display: flex; align-items: center; gap: var(--space-3); }
.live-dot {
  width: 20rpx; height: 20rpx; border-radius: 50%; background: var(--color-danger); flex-shrink: 0;
  animation: pulse 1.2s ease-in-out infinite;
  &.ended { background: var(--color-text-tertiary); animation: none; }
}
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
.live-question { font-size: var(--font-body); font-weight: var(--font-weight-semibold); color: var(--color-text-primary); }
.live-total { font-size: var(--font-caption); color: var(--color-text-tertiary); }

.bars, .rating-dist { display: flex; flex-direction: column; gap: var(--space-3); }
.bar-row, .dist-row { display: flex; align-items: center; gap: var(--space-3); }
.bar-label { width: 180rpx; font-size: var(--font-caption); color: var(--color-text-primary); }
.dist-label { width: 60rpx; font-size: var(--font-caption); color: var(--color-text-secondary); }
.bar-track { flex: 1; height: 28rpx; background: var(--color-surface-variant); border-radius: var(--radius-pill); overflow: hidden; }
.bar-fill {
  height: 100%; background: var(--color-primary); border-radius: var(--radius-pill);
  transition: width var(--duration-med) var(--ease-standard);
  &.amber { background: var(--color-warning); }
}
.bar-count { width: 56rpx; text-align: right; font-size: var(--font-caption); font-weight: var(--font-weight-semibold); color: var(--color-text-primary); }

.wordcloud {
  display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: var(--space-3);
  padding: var(--space-5); background: var(--color-surface-variant); border-radius: var(--radius-lg); min-height: 200rpx;
}
.word { color: var(--color-primary); font-weight: var(--font-weight-semibold); line-height: 1.2; }
.wordcloud-empty { font-size: var(--font-caption); color: var(--color-text-tertiary); }

.rating-hero { display: flex; flex-direction: column; align-items: center; gap: var(--space-2); padding: var(--space-4) 0; }
.rating-avg { font-size: 96rpx; font-weight: var(--font-weight-bold); color: var(--color-warning); line-height: 1; }
.rating-stars { display: flex; gap: 4rpx; }
.star { font-size: 40rpx; color: var(--color-outline); &.on { color: var(--color-warning); } }

.live-actions { margin-top: var(--space-2); }
</style>
