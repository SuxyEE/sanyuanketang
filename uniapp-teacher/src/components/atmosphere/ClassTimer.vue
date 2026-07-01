<template>
  <view class="timer-root">
    <!-- 设置面板 -->
    <view v-if="open" class="modal-mask" @tap="close">
      <view class="modal-card" @tap.stop>
        <view class="modal-head">
          <text class="modal-title">课堂计时器</text>
          <button class="close-btn" @tap="close"><Icon name="x" size="md" /></button>
        </view>

        <view class="form">
          <input v-model="label" class="input" placeholder="计时标签，例如：小组讨论 / 实操练习" />
          <view class="preset-row">
            <button
              v-for="m in presets"
              :key="m"
              class="preset"
              :class="{ active: minutes === m }"
              @tap="minutes = m"
            >
              <text>{{ m }} 分</text>
            </button>
          </view>
          <view class="stepper">
            <button @tap="minutes = Math.max(1, minutes - 1)"><Icon name="chevron-left" size="md" /></button>
            <text>{{ minutes }} 分钟</text>
            <button @tap="minutes = Math.min(120, minutes + 1)"><Icon name="chevron-right" size="md" /></button>
          </view>

          <Button v-if="activeTimer" variant="danger" block icon-left="stop-circle" @tap="stopTimer">结束当前计时</Button>
          <Button v-else block icon-left="clock" @tap="startTimer">开始倒计时</Button>
        </view>
      </view>
    </view>

    <!-- 常驻悬浮倒计时条 -->
    <view v-if="activeTimer" class="timer-badge" :class="{ ending: remaining <= 10 && remaining > 0, done: remaining === 0 }">
      <Icon name="hourglass" size="md" :tone="remaining === 0 ? 'danger' : 'inverse'" />
      <view class="timer-badge-body">
        <text class="timer-badge-label">{{ activeTimer.label || '课堂计时' }}</text>
        <text class="timer-badge-time">{{ remaining === 0 ? '时间到' : formatted }}</text>
      </view>
      <view class="timer-badge-track">
        <view class="timer-badge-fill" :style="{ width: progress + '%' }"></view>
      </view>
      <button class="timer-badge-close" @tap="stopTimer"><Icon name="x" size="sm" tone="inverse" /></button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import Icon from '@/components/ui/Icon.vue'
import Button from '@/components/ui/Button.vue'
import { RoomEvent } from '@/shared/wsEvents'
import { useRoomSocket } from '@/composables/useRoomSocket'

interface ActiveTimer {
  timerId: string
  durationSec: number
  label: string
  startedAt: number
}

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ 'update:open': [boolean] }>()

const presets = [1, 3, 5, 10, 15]
const label = ref('')
const minutes = ref(5)
const activeTimer = ref<ActiveTimer | null>(null)
const nowTs = ref(Date.now())
let tick: ReturnType<typeof setInterval> | null = null

const { emit: wsEmit } = useRoomSocket({
  [RoomEvent.TimerStart]: (data: any) => applyTimer(data),
  [RoomEvent.TimerSync]: (data: any) => applyTimer(data?.timer || data),
  [RoomEvent.TimerStop]: () => clear(),
})

const remaining = computed(() => {
  if (!activeTimer.value) return 0
  const end = activeTimer.value.startedAt + activeTimer.value.durationSec * 1000
  return Math.max(0, Math.ceil((end - nowTs.value) / 1000))
})
const formatted = computed(() => {
  const s = remaining.value
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
})
const progress = computed(() => {
  if (!activeTimer.value || activeTimer.value.durationSec <= 0) return 0
  return Math.round((remaining.value / activeTimer.value.durationSec) * 100)
})

function ensureTick() {
  if (tick) return
  tick = setInterval(() => { nowTs.value = Date.now() }, 250)
}
function applyTimer(data: any) {
  if (!data || !data.timerId) return
  activeTimer.value = {
    timerId: data.timerId,
    durationSec: data.durationSec || 0,
    label: data.label || '',
    startedAt: data.startedAt || Date.now(),
  }
  nowTs.value = Date.now()
  ensureTick()
}
function clear() {
  activeTimer.value = null
  if (tick) { clearInterval(tick); tick = null }
}

function startTimer() {
  const timerId = `timer-${Date.now()}`
  const durationSec = minutes.value * 60
  const lbl = label.value.trim()
  wsEmit(RoomEvent.TimerStart, { timerId, durationSec, label: lbl })
  applyTimer({ timerId, durationSec, label: lbl, startedAt: Date.now() })
  uni.showToast({ title: '倒计时已开始', icon: 'success' })
  close()
}
function stopTimer() {
  if (activeTimer.value) wsEmit(RoomEvent.TimerStop, { timerId: activeTimer.value.timerId })
  clear()
  uni.showToast({ title: '计时已结束', icon: 'none' })
}
function close() {
  emit('update:open', false)
}

onUnmounted(() => { if (tick) clearInterval(tick) })
</script>

<style scoped lang="scss">
@import '@/styles/variables.scss';

.modal-mask {
  position: fixed; inset: 0; background: var(--color-scrim);
  display: flex; align-items: center; justify-content: center; z-index: var(--z-modal); padding: var(--space-5);
}
.modal-card {
  width: 92%; max-width: 640rpx; background: var(--color-surface-raised);
  border-radius: var(--radius-2xl); padding: var(--space-6); box-shadow: var(--elevation-4);
}
.modal-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-5); }
.modal-title { font-size: var(--font-title-sm); font-weight: var(--font-weight-bold); color: var(--color-text-primary); }
.close-btn {
  width: 64rpx; height: 64rpx; min-height: 0; padding: 0; display: flex; align-items: center; justify-content: center;
  background: var(--color-surface-variant); border-radius: var(--radius-full); color: var(--color-text-secondary);
}
.form { display: flex; flex-direction: column; gap: var(--space-4); }
.input {
  width: 100%; box-sizing: border-box; padding: var(--space-3) var(--space-4); background: var(--color-surface-variant);
  border: 2rpx solid var(--color-outline); border-radius: var(--radius-md); font-size: var(--font-body); color: var(--color-text-primary);
}
.preset-row { display: flex; gap: var(--space-2); flex-wrap: wrap; }
.preset {
  flex: 1; min-width: 96rpx; min-height: 72rpx; background: var(--color-surface-variant); border: 2rpx solid transparent;
  border-radius: var(--radius-md); text { font-size: var(--font-caption); color: var(--color-text-secondary); }
  &.active { border-color: var(--color-primary); background: var(--color-primary-container); text { color: var(--color-primary); } }
}
.stepper {
  display: flex; align-items: center; justify-content: space-between; background: var(--color-surface-variant);
  border-radius: var(--radius-md); padding: var(--space-2) var(--space-4);
  text { font-size: var(--font-body); font-weight: var(--font-weight-semibold); color: var(--color-text-primary); }
  button { width: 72rpx; height: 72rpx; min-height: 0; padding: 0; background: var(--color-surface); border-radius: var(--radius-sm); display: flex; align-items: center; justify-content: center; }
}

.timer-badge {
  position: fixed; top: 120rpx; left: 50%; transform: translateX(-50%);
  display: flex; align-items: center; gap: var(--space-3);
  padding: var(--space-3) var(--space-4); min-width: 420rpx;
  background: var(--color-primary); color: var(--color-text-on-color);
  border-radius: var(--radius-xl); box-shadow: var(--elevation-4); z-index: var(--z-sticky);
  &.ending { background: var(--color-warning); animation: blink 1s ease-in-out infinite; }
  &.done { background: var(--color-danger); }
}
@keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.7; } }
.timer-badge-body { display: flex; flex-direction: column; }
.timer-badge-label { font-size: var(--font-overline); opacity: 0.85; }
.timer-badge-time { font-size: var(--font-title-sm); font-weight: var(--font-weight-bold); line-height: 1.1; font-variant-numeric: tabular-nums; }
.timer-badge-track {
  flex: 1; height: 12rpx; background: rgba(255, 255, 255, 0.3); border-radius: var(--radius-pill); overflow: hidden;
}
.timer-badge-fill { height: 100%; background: rgba(255, 255, 255, 0.9); border-radius: var(--radius-pill); transition: width var(--duration-base) linear; }
.timer-badge-close {
  width: 52rpx; height: 52rpx; min-height: 0; padding: 0; background: rgba(255, 255, 255, 0.2);
  border-radius: var(--radius-full); display: flex; align-items: center; justify-content: center;
}
</style>
