<template>
  <view v-if="open" class="modal-mask" @tap="close">
    <view class="modal-card" @tap.stop>
      <view class="modal-head">
        <text class="modal-title">随机点名</text>
        <button class="close-btn" @tap="close"><Icon name="x" size="md" /></button>
      </view>

      <view class="wheel-stage">
        <view class="wheel-window" :class="{ rolling, landed: !!result && !rolling }">
          <text class="wheel-name">{{ displayName || '准备开始' }}</text>
        </view>
        <text v-if="result && !rolling" class="wheel-tip">🎉 请 {{ result.studentName }} 回答</text>
        <text v-else-if="rolling" class="wheel-tip muted">正在抽取…</text>
        <text v-else class="wheel-tip muted">点击下方按钮随机抽取一名学生</text>
      </view>

      <view v-if="pool.length > 0" class="pool">
        <text
          v-for="(n, i) in pool.slice(0, 30)"
          :key="i"
          class="pool-chip"
          :class="{ hot: n === displayName }"
        >{{ n }}</text>
      </view>

      <Button block :loading="rolling" icon-left="users" @tap="startRoll">
        {{ result ? '再抽一次' : '开始抽取' }}
      </Button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onUnmounted } from 'vue'
import Icon from '@/components/ui/Icon.vue'
import Button from '@/components/ui/Button.vue'
import { RoomEvent } from '@/shared/wsEvents'
import { useRoomSocket } from '@/composables/useRoomSocket'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ 'update:open': [boolean] }>()

const rolling = ref(false)
const displayName = ref('')
const result = ref<{ studentId: string; studentName: string } | null>(null)
const pool = ref<string[]>([])

let rollTimer: ReturnType<typeof setInterval> | null = null
let stopTimer: ReturnType<typeof setTimeout> | null = null
let guardTimer: ReturnType<typeof setTimeout> | null = null

const { emit: wsEmit } = useRoomSocket({
  [RoomEvent.RollCallResult]: (data: any) => onResult(data),
})

function startRoll() {
  if (rolling.value) return
  rolling.value = true
  result.value = null
  displayName.value = pool.value.length ? pool.value[0] : '🎲'
  wsEmit(RoomEvent.RollCall, { mode: 'random' })

  clearTimers()
  rollTimer = setInterval(() => {
    if (pool.value.length) {
      displayName.value = pool.value[Math.floor(Math.random() * pool.value.length)]
    }
  }, 80)
  guardTimer = setTimeout(() => {
    if (rolling.value && !result.value) {
      stopRolling()
      uni.showToast({ title: '未收到点名结果，请重试', icon: 'none' })
    }
  }, 8000)
}

function onResult(data: any) {
  if (!data) return
  // 契约：candidates = [{ id, name }]（兼容旧的 string[]）
  const cands: { id?: string; name?: string }[] = Array.isArray(data.candidates)
    ? data.candidates.map((c: any) => (typeof c === 'string' ? { name: c } : c))
    : []
  const names = cands.map((c) => c?.name).filter((n): n is string => !!n)
  if (names.length) pool.value = names
  // 命中者：优先 studentName，兜底用 candidate.id 匹配 studentId 取 name
  const matched = cands.find((c) => c?.id === data.studentId)
  const finalName = data.studentName || matched?.name
  if (!finalName) return
  const landed = { studentId: data.studentId, studentName: finalName }
  const settle = () => {
    stopRolling()
    displayName.value = landed.studentName
    result.value = landed
    try { uni.vibrateShort?.({}) } catch { /* ignore */ }
  }
  if (rolling.value) {
    if (stopTimer) clearTimeout(stopTimer)
    stopTimer = setTimeout(settle, 1400)
  } else {
    settle()
  }
}

function stopRolling() {
  rolling.value = false
  clearTimers()
}
function clearTimers() {
  if (rollTimer) { clearInterval(rollTimer); rollTimer = null }
  if (stopTimer) { clearTimeout(stopTimer); stopTimer = null }
  if (guardTimer) { clearTimeout(guardTimer); guardTimer = null }
}
function close() {
  emit('update:open', false)
}

onUnmounted(clearTimers)
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
  display: flex; flex-direction: column; gap: var(--space-5);
}
.modal-head { display: flex; align-items: center; justify-content: space-between; }
.modal-title { font-size: var(--font-title-sm); font-weight: var(--font-weight-bold); color: var(--color-text-primary); }
.close-btn {
  width: 64rpx; height: 64rpx; min-height: 0; padding: 0; display: flex; align-items: center; justify-content: center;
  background: var(--color-surface-variant); border-radius: var(--radius-full); color: var(--color-text-secondary);
}

.wheel-stage { display: flex; flex-direction: column; align-items: center; gap: var(--space-3); }
.wheel-window {
  width: 100%; height: 200rpx; display: flex; align-items: center; justify-content: center;
  background: var(--color-primary-container); border-radius: var(--radius-xl); border: 4rpx solid transparent;
  &.rolling { animation: shake 0.24s linear infinite; }
  &.landed { border-color: var(--color-primary); background: var(--color-primary); .wheel-name { color: var(--color-text-on-color); } }
}
@keyframes shake { 0%, 100% { transform: translateY(-4rpx); } 50% { transform: translateY(4rpx); } }
.wheel-name {
  font-size: var(--font-headline); font-weight: var(--font-weight-bold); color: var(--color-on-primary-container);
  line-height: 1.1; text-align: center;
}
.wheel-tip { font-size: var(--font-body); color: var(--color-primary); font-weight: var(--font-weight-semibold); &.muted { color: var(--color-text-tertiary); font-weight: var(--font-weight-regular); } }

.pool { display: flex; flex-wrap: wrap; gap: var(--space-2); justify-content: center; max-height: 200rpx; overflow-y: auto; }
.pool-chip {
  padding: 6rpx var(--space-3); background: var(--color-surface-variant); border-radius: var(--radius-pill);
  font-size: var(--font-caption); color: var(--color-text-secondary);
  &.hot { background: var(--color-primary-container); color: var(--color-primary); font-weight: var(--font-weight-semibold); }
}
</style>
