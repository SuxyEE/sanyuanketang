<template>
  <div class="danmaku-layer">
    <div
      v-for="d in items"
      :key="d.key"
      class="danmaku-item"
      :style="itemStyle(d)"
      @animationend="remove(d.key)"
    >
      <span class="dm-name">{{ d.studentName }}</span>
      <span class="dm-text">{{ d.text }}</span>
    </div>

    <transition name="dm-toggle">
      <div v-if="showToggleHint" class="danmaku-toggle-hint" :class="{ off: !enabled }">
        {{ enabled ? '弹幕已开启' : '弹幕已关闭' }}
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

interface Danmaku {
  id: string
  text: string
  studentName: string
  color?: string
}
interface DanmakuItem extends Danmaku {
  key: string
  track: number
  duration: number
}

const TRACK_COUNT = 12
const items = ref<DanmakuItem[]>([])
const enabled = ref(true)
const showToggleHint = ref(false)
let seq = 0
let nextTrack = 0
let toggleTimer: ReturnType<typeof setTimeout> | null = null

function push(d: Danmaku) {
  if (!enabled.value) return
  const track = nextTrack % TRACK_COUNT
  nextTrack++
  const duration = 9 + Math.random() * 4
  items.value.push({
    ...d,
    key: `${d.id || 'dm'}_${seq++}`,
    track,
    duration,
  })
  if (items.value.length > 120) items.value.splice(0, items.value.length - 120)
}

function clear() {
  items.value = []
}

function setEnabled(v: boolean) {
  enabled.value = v
  showToggleHint.value = true
  if (!v) items.value = []
  if (toggleTimer) clearTimeout(toggleTimer)
  toggleTimer = setTimeout(() => { showToggleHint.value = false }, 2500)
}

function remove(key: string) {
  const idx = items.value.findIndex(i => i.key === key)
  if (idx >= 0) items.value.splice(idx, 1)
}

function itemStyle(d: DanmakuItem) {
  return {
    top: `${6 + d.track * 7.2}%`,
    color: d.color || '#ffffff',
    animationDuration: `${d.duration}s`,
  }
}

defineExpose({ push, clear, setEnabled })
</script>

<style scoped lang="scss">
.danmaku-layer {
  position: fixed;
  inset: 0;
  z-index: 70;
  pointer-events: none;
  overflow: hidden;
}

.danmaku-item {
  position: absolute;
  left: 100%;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
  padding: 6px 16px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.32);
  backdrop-filter: blur(2px);
  font-size: 26px;
  font-weight: 600;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.55);
  will-change: transform;
  animation-name: dm-move;
  animation-timing-function: linear;
  animation-fill-mode: forwards;
}

.dm-name {
  font-size: 15px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.65);
  padding-right: 6px;
  border-right: 1px solid rgba(255, 255, 255, 0.25);
}

.dm-text { color: inherit; }

@keyframes dm-move {
  from { transform: translateX(0); }
  to { transform: translateX(calc(-100vw - 100%)); }
}

.danmaku-toggle-hint {
  position: absolute;
  top: 76px;
  left: 50%;
  transform: translateX(-50%);
  padding: 8px 22px;
  border-radius: 999px;
  background: rgba(82, 196, 26, 0.9);
  color: #fff;
  font-size: 15px;
  font-weight: 700;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.35);
  &.off { background: rgba(120, 120, 130, 0.9); }
}

.dm-toggle-enter-active, .dm-toggle-leave-active { transition: all 0.3s ease; }
.dm-toggle-enter-from, .dm-toggle-leave-to { opacity: 0; transform: translateX(-50%) translateY(-10px); }
</style>
