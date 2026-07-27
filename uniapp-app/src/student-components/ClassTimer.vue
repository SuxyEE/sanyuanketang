<template>
  <view
    v-if="active && store.viewState !== 'locked'"
    class="class-timer"
    :class="{ urgent: remaining <= 10 && remaining > 0, ended: remaining <= 0 }"
    :style="{ top: `max(var(--space-3), var(--safe-top))` }"
  >
    <view class="timer-icon">
      <Icon
        :name="remaining <= 0 ? 'alert-circle' : 'clock'"
        size="sm"
        :tone="remaining <= 0 ? 'danger' : (remaining <= 10 ? 'warning' : 'primary')"
      />
    </view>
    <view class="timer-body">
      <text v-if="label" class="timer-label">{{ label }}</text>
      <text class="timer-value">{{ remaining > 0 ? formatted : '\u65f6\u95f4\u5230' }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useStudentStore } from '@/stores/student'
import { useSocket } from '@/student-sockets/useSocket'
import { RoomEvent } from '@/shared/wsEvents'
import Icon from '@/student-components/ui/Icon.vue'

const store = useStudentStore()
const { getSocket } = useSocket()

const active = ref(false)
const label = ref('')
const remaining = ref(0)

let currentTimerId = ''
let startedAt = 0
let duration = 0
let ticker: ReturnType<typeof setInterval> | null = null

const formatted = computed(() => {
  const total = Math.max(0, Math.ceil(remaining.value))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
})

function toMs(t: any): number {
  if (typeof t === 'number') return t
  const n = new Date(t).getTime()
  return isNaN(n) ? Date.now() : n
}

function recompute() {
  const elapsed = (Date.now() - startedAt) / 1000
  remaining.value = Math.max(0, duration - elapsed)
  if (remaining.value <= 0) stopTicker()
}

function startTicker() {
  stopTicker()
  recompute()
  ticker = setInterval(recompute, 250)
}

function stopTicker() {
  if (ticker) { clearInterval(ticker); ticker = null }
}

function applyStart(data: any) {
  if (!data) return
  currentTimerId = data.timerId || ''
  duration = Number(data.durationSec) || 0
  label.value = data.label || '\u8bfe\u5802\u8ba1\u65f6'
  startedAt = data.startedAt != null ? toMs(data.startedAt) : Date.now()
  active.value = true
  startTicker()
}

function onTimerStart(data: any) { applyStart(data) }

function onTimerSync(data: any) { applyStart(data?.timer || data) }

function onTimerStop(data: any) {
  // 只有携带匹配 timerId（或不带 id）才关闭，避免误关别的计时
  if (data?.timerId && currentTimerId && data.timerId !== currentTimerId) return
  stopTicker()
  active.value = false
}

// socket 单例由父页面 onMounted 才建立；本组件常驻挂载会早于父，故重试绑定
let retryTimer: ReturnType<typeof setInterval> | null = null
function bindSocket() {
  const s = getSocket()
  if (!s) return false
  s.on(RoomEvent.TimerStart, onTimerStart)
  s.on(RoomEvent.TimerSync, onTimerSync)
  s.on(RoomEvent.TimerStop, onTimerStop)
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
  stopTicker()
  const s = getSocket()
  s?.off(RoomEvent.TimerStart, onTimerStart)
  s?.off(RoomEvent.TimerSync, onTimerSync)
  s?.off(RoomEvent.TimerStop, onTimerStop)
})
</script>

<style lang="scss" scoped>
@import '@/styles/variables.scss';

.class-timer {
  position: fixed;
  left: 50%;
  transform: translateX(-50%);
  z-index: 60;
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(20rpx) saturate(180%);
  -webkit-backdrop-filter: blur(20rpx) saturate(180%);
  border: 2rpx solid var(--color-outline-variant);
  border-radius: var(--radius-pill);
  box-shadow: var(--elevation-2);

  &.urgent {
    border-color: var(--color-warning);
    animation: timer-pulse 1s ease-in-out infinite;
  }
  &.ended {
    border-color: var(--color-danger);
    background: var(--color-danger-container);
  }
}

@supports not ((backdrop-filter: blur(2rpx)) or (-webkit-backdrop-filter: blur(2rpx))) {
  .class-timer { background: rgba(255, 255, 255, 0.97); }
}

@keyframes timer-pulse {
  0%, 100% { transform: translateX(-50%) scale(1); }
  50%      { transform: translateX(-50%) scale(1.05); }
}

@media (prefers-reduced-motion: reduce) {
  .class-timer.urgent { animation: none; }
}

.timer-icon {
  display: flex;
  align-items: center;
}

.timer-body {
  display: flex;
  align-items: baseline;
  gap: var(--space-2);
}

.timer-label {
  font-size: var(--font-caption);
  color: var(--color-text-secondary);
}

.timer-value {
  font-size: var(--font-title-sm);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
  font-variant-numeric: tabular-nums;
  letter-spacing: 1rpx;

  .ended & { color: var(--color-danger); }
  .urgent & { color: var(--color-warning); }
}
</style>
