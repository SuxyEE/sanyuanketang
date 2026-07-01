<template>
  <div class="reaction-layer">
    <!-- 飘升 emoji -->
    <div
      v-for="r in floats"
      :key="r.key"
      class="reaction-float"
      :style="floatStyle(r)"
      @animationend="remove(r.key)"
    >{{ emojiOf(r.type) }}</div>

    <!-- 角落情绪热度条 -->
    <transition name="rs-fade">
      <div v-if="hasStats" class="reaction-stats">
        <div class="rs-title">课堂情绪 · 近 {{ stats!.windowSec }}s</div>
        <div class="rs-rows">
          <div v-for="k in order" :key="k" class="rs-row">
            <span class="rs-emoji">{{ emojiOf(k) }}</span>
            <div class="rs-bar-wrap">
              <div class="rs-bar" :class="k" :style="{ width: pct(k) + '%' }"></div>
            </div>
            <span class="rs-count">{{ countOf(k) }}</span>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

type ReactionType = 'got' | 'confused' | 'tooFast' | 'like' | 'applause'
interface ReactionStats {
  counts: Record<ReactionType, number>
  windowSec: number
}
interface FloatItem {
  key: string
  type: string
  left: number
  drift: number
  duration: number
  size: number
}

const props = defineProps<{ stats: ReactionStats | null }>()

const EMOJI: Record<string, string> = {
  got: '😀',
  confused: '😵',
  tooFast: '🚀',
  like: '👍',
  applause: '👏',
}
const order: ReactionType[] = ['got', 'confused', 'tooFast', 'like', 'applause']

function emojiOf(t: string): string {
  return EMOJI[t] || '👍'
}

/* ===== 飘升动画 ===== */
const floats = ref<FloatItem[]>([])
let seq = 0

function push(type: string) {
  floats.value.push({
    key: `rx_${seq++}`,
    type,
    left: 4 + Math.random() * 44,
    drift: (Math.random() - 0.5) * 120,
    duration: 3 + Math.random() * 1.6,
    size: 38 + Math.random() * 26,
  })
  if (floats.value.length > 80) floats.value.splice(0, floats.value.length - 80)
}

function remove(key: string) {
  const idx = floats.value.findIndex(f => f.key === key)
  if (idx >= 0) floats.value.splice(idx, 1)
}

function floatStyle(r: FloatItem) {
  return {
    left: `${r.left}%`,
    fontSize: `${r.size}px`,
    animationDuration: `${r.duration}s`,
    '--drift': `${r.drift}px`,
  } as Record<string, string>
}

/* ===== 热度条 ===== */
const hasStats = computed(() => {
  if (!props.stats?.counts) return false
  return order.some(k => (props.stats!.counts[k] || 0) > 0)
})
function countOf(k: ReactionType): number {
  return props.stats?.counts?.[k] || 0
}
const maxCount = computed(() => order.reduce((m, k) => Math.max(m, countOf(k)), 1))
function pct(k: ReactionType): number {
  return Math.min(100, (countOf(k) / maxCount.value) * 100)
}

defineExpose({ push })
</script>

<style scoped lang="scss">
.reaction-layer {
  position: fixed;
  inset: 0;
  z-index: 65;
  pointer-events: none;
  overflow: hidden;
}

.reaction-float {
  position: absolute;
  bottom: 4%;
  will-change: transform, opacity;
  animation-name: rx-rise;
  animation-timing-function: ease-out;
  animation-fill-mode: forwards;
  filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.35));
}

@keyframes rx-rise {
  0% { transform: translate(0, 0) scale(0.5); opacity: 0; }
  15% { opacity: 1; transform: translate(0, -10vh) scale(1); }
  100% { transform: translate(var(--drift), -78vh) scale(1.1); opacity: 0; }
}

.reaction-stats {
  position: absolute;
  right: 20px;
  bottom: 20px;
  width: 220px;
  padding: 14px 16px;
  border-radius: 16px;
  background: rgba(10, 14, 34, 0.82);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
}

.rs-title {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.55);
  margin-bottom: 10px;
  font-weight: 600;
}

.rs-rows { display: flex; flex-direction: column; gap: 8px; }

.rs-row { display: grid; grid-template-columns: 28px 1fr 28px; gap: 8px; align-items: center; }
.rs-emoji { font-size: 20px; text-align: center; }

.rs-bar-wrap { height: 10px; background: rgba(255, 255, 255, 0.08); border-radius: 5px; overflow: hidden; }
.rs-bar {
  height: 100%; min-width: 2px; border-radius: 5px;
  transition: width 0.5s ease;
  &.got { background: #52c41a; }
  &.confused { background: #faad14; }
  &.tooFast { background: #ff7d4d; }
  &.like { background: #1677ff; }
  &.applause { background: #b37feb; }
}

.rs-count { font-size: 13px; font-weight: 700; color: #fff; text-align: right; font-variant-numeric: tabular-nums; }

.rs-fade-enter-active, .rs-fade-leave-active { transition: all 0.3s ease; }
.rs-fade-enter-from, .rs-fade-leave-to { opacity: 0; transform: translateY(10px); }
</style>
