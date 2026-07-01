<template>
  <div class="poll-overlay">
    <div class="poll-card" :class="`kind-${poll.kind}`">
      <div class="poll-head">
        <span class="poll-kind-badge">{{ kindLabel }}</span>
        <span v-if="ended" class="poll-status ended">已结束</span>
        <span v-else-if="remain !== null" class="poll-status">剩余 {{ remain }} 秒</span>
        <span v-else class="poll-status live">进行中</span>
        <span class="poll-total">{{ total }} 人已参与</span>
      </div>

      <h2 class="poll-question">{{ poll.question }}</h2>

      <!-- 选择题 / 问卷：柱状图 -->
      <div v-if="poll.kind === 'choice'" class="poll-choices">
        <div v-for="(opt, i) in poll.options" :key="i" class="choice-row">
          <div class="choice-label">
            <span class="choice-index">{{ letters[i] }}</span>
            <span class="choice-text">{{ opt }}</span>
          </div>
          <div class="choice-bar-wrap">
            <div class="choice-bar" :style="{ width: choicePct(i) + '%' }">
              <span class="choice-bar-glow"></span>
            </div>
          </div>
          <div class="choice-meta">
            <span class="choice-count">{{ choiceCount(i) }}</span>
            <span class="choice-pct">{{ Math.round(choicePct(i)) }}%</span>
          </div>
        </div>
      </div>

      <!-- 文字词云 -->
      <div v-else-if="poll.kind === 'text'" class="poll-wordcloud">
        <template v-if="words.length > 0">
          <span
            v-for="(w, i) in words"
            :key="w.text + i"
            class="word-item"
            :style="wordStyle(w)"
          >{{ w.text }}</span>
        </template>
        <div v-else class="poll-empty">等待学生提交…</div>
      </div>

      <!-- 评分 -->
      <div v-else class="poll-rating">
        <div class="rating-main">
          <span class="rating-avg">{{ ratingAvg }}</span>
          <span class="rating-avg-sub">平均分 / {{ ratingMax }}</span>
        </div>
        <div class="rating-dist">
          <div v-for="score in ratingScores" :key="score" class="rating-row">
            <span class="rating-score">{{ score }} 分</span>
            <div class="rating-bar-wrap">
              <div class="rating-bar" :style="{ width: ratingPct(score) + '%' }"></div>
            </div>
            <span class="rating-count">{{ ratingCount(score) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

interface PollInfo {
  pollId: string
  kind: 'choice' | 'text' | 'rating'
  question: string
  options: string[]
  maxSelect?: number
  max?: number
  startedAt: number
  durationSec?: number
}

const props = defineProps<{
  poll: PollInfo
  stats: any
  total: number
  ended: boolean
}>()

const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

const kindLabel = computed(() => {
  if (props.poll.kind === 'choice') return '投票 / 问卷'
  if (props.poll.kind === 'text') return '词云收集'
  return '评分'
})

/* ===== 倒计时（startedAt 为毫秒，durationSec 为秒；0 表示不限时） ===== */
const now = ref(Date.now())
let timer: ReturnType<typeof setInterval> | null = null
onMounted(() => { timer = setInterval(() => { now.value = Date.now() }, 1000) })
onUnmounted(() => { if (timer) clearInterval(timer) })

const remain = computed<number | null>(() => {
  const dur = props.poll.durationSec || 0
  if (!dur) return null
  const elapsed = Math.floor((now.value - props.poll.startedAt) / 1000)
  return Math.max(0, dur - elapsed)
})

/* ===== choice ===== */
function choiceCount(i: number): number {
  const counts = props.stats?.counts
  return Array.isArray(counts) ? Number(counts[i] || 0) : 0
}
function choicePct(i: number): number {
  if (!props.total) return 0
  return Math.min(100, (choiceCount(i) / props.total) * 100)
}

/* ===== text 词云 ===== */
const words = computed<{ text: string; weight: number }[]>(() => {
  const w = props.stats?.words
  return Array.isArray(w) ? w.slice(0, 40) : []
})
const maxWeight = computed(() => words.value.reduce((m, w) => Math.max(m, w.weight), 1))
const wordPalette = ['#4da3ff', '#52c41a', '#faad14', '#ff7d4d', '#b37feb', '#36cfc9', '#ff85c0']
function wordStyle(w: { text: string; weight: number }) {
  const ratio = w.weight / maxWeight.value
  const size = 20 + ratio * 52
  const idx = Math.abs(hash(w.text)) % wordPalette.length
  return {
    fontSize: `${size.toFixed(0)}px`,
    color: wordPalette[idx],
    opacity: String(0.55 + ratio * 0.45),
    fontWeight: ratio > 0.5 ? 800 : 600,
  }
}
function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i)
  return h
}

/* ===== rating ===== */
const ratingMax = computed(() => props.stats?.max || props.poll.max || 5)
const ratingAvg = computed(() => {
  const a = props.stats?.avg
  return typeof a === 'number' ? a.toFixed(1) : '0.0'
})
const ratingScores = computed(() => {
  const arr: number[] = []
  for (let s = ratingMax.value; s >= 1; s--) arr.push(s)
  return arr
})
function ratingCount(score: number): number {
  const dist = props.stats?.distribution
  return Array.isArray(dist) ? Number(dist[score] || 0) : 0
}
function ratingPct(score: number): number {
  if (!props.total) return 0
  return Math.min(100, (ratingCount(score) / props.total) * 100)
}
</script>

<style scoped lang="scss">
.poll-overlay {
  position: fixed;
  inset: 0;
  z-index: 45;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48px;
  background: radial-gradient(circle at 50% 30%, rgba(22, 63, 140, 0.45), rgba(6, 10, 31, 0.82));
  animation: poll-fade 0.35s ease;
}

@keyframes poll-fade { from { opacity: 0; } to { opacity: 1; } }

.poll-card {
  width: min(1100px, 100%);
  max-height: 100%;
  overflow-y: auto;
  background: rgba(15, 20, 48, 0.94);
  border: 1px solid rgba(120, 170, 255, 0.24);
  border-radius: 28px;
  padding: 40px 48px;
  box-shadow: 0 30px 90px -20px rgba(0, 0, 0, 0.6);

  &::-webkit-scrollbar { width: 5px; }
  &::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.15); border-radius: 4px; }
}

.poll-head {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 20px;
}

.poll-kind-badge {
  padding: 6px 16px;
  border-radius: 999px;
  background: rgba(65, 120, 255, 0.18);
  color: #7fb0ff;
  font-size: 15px;
  font-weight: 700;
}

.poll-status {
  padding: 4px 14px;
  border-radius: 999px;
  font-size: 14px;
  font-weight: 600;
  background: rgba(82, 196, 26, 0.16);
  color: #86e05a;
  &.live { background: rgba(82, 196, 26, 0.16); color: #86e05a; }
  &.ended { background: rgba(255, 255, 255, 0.1); color: rgba(255, 255, 255, 0.6); }
}

.poll-total {
  margin-left: auto;
  font-size: 15px;
  color: rgba(255, 255, 255, 0.6);
  font-variant-numeric: tabular-nums;
}

.poll-question {
  margin: 0 0 28px;
  font-size: 34px;
  font-weight: 800;
  line-height: 1.35;
  color: #fff;
}

/* ---- choice ---- */
.poll-choices { display: flex; flex-direction: column; gap: 16px; }

.choice-row {
  display: grid;
  grid-template-columns: minmax(180px, 320px) 1fr 96px;
  gap: 18px;
  align-items: center;
}

.choice-label { display: flex; align-items: center; gap: 12px; min-width: 0; }

.choice-index {
  flex-shrink: 0;
  width: 36px; height: 36px;
  display: flex; align-items: center; justify-content: center;
  border-radius: 10px;
  background: rgba(65, 120, 255, 0.2);
  color: #7fb0ff;
  font-size: 18px; font-weight: 800;
}

.choice-text {
  font-size: 20px;
  color: rgba(255, 255, 255, 0.92);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}

.choice-bar-wrap {
  height: 30px;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 15px;
  overflow: hidden;
}

.choice-bar {
  position: relative;
  height: 100%;
  min-width: 2px;
  border-radius: 15px;
  background: linear-gradient(90deg, #1677ff, #52c41a);
  transition: width 0.6s cubic-bezier(0.22, 1, 0.36, 1);
}

.choice-bar-glow {
  position: absolute; right: 0; top: 0; bottom: 0; width: 40px;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.35));
}

.choice-meta { display: flex; flex-direction: column; align-items: flex-end; }
.choice-count { font-size: 22px; font-weight: 800; color: #fff; font-variant-numeric: tabular-nums; }
.choice-pct { font-size: 13px; color: rgba(255, 255, 255, 0.5); }

/* ---- wordcloud ---- */
.poll-wordcloud {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 14px 24px;
  min-height: 240px;
  padding: 24px;
}

.word-item {
  line-height: 1.1;
  transition: all 0.4s ease;
  animation: word-pop 0.4s ease;
}

@keyframes word-pop { from { transform: scale(0.6); opacity: 0; } to { transform: scale(1); } }

.poll-empty { color: rgba(255, 255, 255, 0.4); font-size: 18px; }

/* ---- rating ---- */
.poll-rating { display: grid; grid-template-columns: 240px 1fr; gap: 36px; align-items: center; }

.rating-main {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  padding: 24px;
  background: linear-gradient(135deg, rgba(250, 173, 20, 0.16), rgba(255, 125, 77, 0.1));
  border: 1px solid rgba(250, 173, 20, 0.3);
  border-radius: 20px;
}

.rating-avg { font-size: 88px; font-weight: 800; color: #ffd666; line-height: 1; font-variant-numeric: tabular-nums; }
.rating-avg-sub { margin-top: 8px; font-size: 15px; color: rgba(255, 255, 255, 0.6); }

.rating-dist { display: flex; flex-direction: column; gap: 12px; }

.rating-row { display: grid; grid-template-columns: 60px 1fr 56px; gap: 14px; align-items: center; }
.rating-score { font-size: 16px; color: rgba(255, 255, 255, 0.75); }
.rating-bar-wrap { height: 22px; background: rgba(255, 255, 255, 0.06); border-radius: 11px; overflow: hidden; }
.rating-bar {
  height: 100%; min-width: 2px; border-radius: 11px;
  background: linear-gradient(90deg, #faad14, #ff7d4d);
  transition: width 0.6s cubic-bezier(0.22, 1, 0.36, 1);
}
.rating-count { font-size: 16px; font-weight: 700; color: #fff; text-align: right; font-variant-numeric: tabular-nums; }

@media (max-width: 1024px) {
  .poll-card { padding: 28px; }
  .poll-question { font-size: 26px; }
  .choice-row { grid-template-columns: minmax(120px, 200px) 1fr 72px; gap: 12px; }
  .choice-text { font-size: 16px; }
  .poll-rating { grid-template-columns: 1fr; gap: 20px; }
}
</style>
