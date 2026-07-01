<template>
  <view v-if="store.viewState !== 'locked'" class="danmaku-root">
    <!-- 弹幕飘动层（pointer-events:none，不挡课件交互） -->
    <view class="danmaku-track-layer" aria-hidden="true">
      <text
        v-for="d in danmakus"
        :key="d.id"
        class="danmaku-item"
        :class="{ mine: d.mine }"
        :style="{ top: d.top + 'rpx', animationDuration: d.dur + 'ms', color: (!d.mine && d.color) ? d.color : '' }"
      >{{ d.text }}</text>
    </view>

    <!-- 发送入口：仅教师开启弹幕（DanmakuToggle enabled）时出现 -->
    <button
      v-if="enabled && !showInput"
      class="danmaku-fab"
      hover-class="danmaku-fab-hover"
      :hover-stay-time="80"
      aria-label="\u53d1\u5f39\u5e55"
      :style="{ bottom: `max(var(--space-8), var(--safe-bottom))` }"
      @tap="openInput"
    >
      <Icon name="message-circle" size="md" tone="inverse" />
    </button>

    <!-- 输入层 -->
    <view v-if="enabled && showInput" class="danmaku-input-mask" @tap.self="closeInput">
      <view class="danmaku-input-card" :style="{ paddingBottom: `max(var(--space-3), var(--safe-bottom))` }">
        <input
          v-model="inputText"
          class="danmaku-input"
          placeholder="\u53d1\u6761\u5f39\u5e55\uff0c\u548c\u5927\u5bb6\u4e92\u52a8\u4e00\u4e0b\uff5e"
          :maxlength="50"
          confirm-type="send"
          focus
          @confirm="send"
        />
        <Button variant="primary" size="md" icon-left="send" :disabled="!inputText.trim()" @tap="send">
          发送
        </Button>
        <IconButton icon="x" size="md" aria-label="\u5173\u95ed" @tap="closeInput" />
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useStudentStore } from '@/stores/student'
import { useSocket } from '@/sockets/useSocket'
import { RoomEvent } from '@/shared/wsEvents'
import Icon from '@/components/ui/Icon.vue'
import Button from '@/components/ui/Button.vue'
import IconButton from '@/components/ui/IconButton.vue'

const store = useStudentStore()
const { getSocket } = useSocket()

const enabled = ref(false)
const showInput = ref(false)
const inputText = ref('')

interface DanmakuItem { id: string; text: string; top: number; dur: number; mine?: boolean; color?: string }
const danmakus = ref<DanmakuItem[]>([])

const TRACK_COUNT = 5
const TRACK_TOP = 140 // rpx：避开顶部 header
const TRACK_H = 76 // rpx：每条轨道垂直间距
let trackCursor = 0

function spawn(text: string, mine = false, color?: string) {
  const t = String(text || '').trim()
  if (!t) return
  const track = trackCursor % TRACK_COUNT
  trackCursor++
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  const dur = 9000 + Math.random() * 3000
  danmakus.value.push({ id, text: t.slice(0, 50), top: TRACK_TOP + track * TRACK_H, dur, mine, color })
  if (danmakus.value.length > 60) danmakus.value.splice(0, danmakus.value.length - 60)
  setTimeout(() => {
    danmakus.value = danmakus.value.filter(d => d.id !== id)
  }, dur + 120)
}

function openInput() { showInput.value = true }
function closeInput() { showInput.value = false }

function send() {
  const t = inputText.value.trim()
  if (!t) return
  getSocket()?.emit(RoomEvent.DanmakuSend, { text: t })
  spawn(t, true) // 本地即时反馈
  inputText.value = ''
  showInput.value = false
}

function onToggle(data: any) {
  enabled.value = !!data?.enabled
  if (!enabled.value) showInput.value = false
}

function onPush(data: any) {
  // 去重：后端 DanmakuPush 带 studentId，本人弹幕忽略（本地已即时飘过）
  if (data?.self || data?.mine) return
  if (data?.studentId && data.studentId === store.studentId) return
  spawn(data?.text, false, data?.color)
}

function onClear() { danmakus.value = [] }

// socket 单例由父页面 onMounted 才建立；本组件常驻挂载会早于父，故重试绑定
let retryTimer: ReturnType<typeof setInterval> | null = null
function bindSocket() {
  const s = getSocket()
  if (!s) return false
  s.on(RoomEvent.DanmakuToggle, onToggle)
  s.on(RoomEvent.DanmakuPush, onPush)
  s.on(RoomEvent.DanmakuClear, onClear)
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
  const s = getSocket()
  s?.off(RoomEvent.DanmakuToggle, onToggle)
  s?.off(RoomEvent.DanmakuPush, onPush)
  s?.off(RoomEvent.DanmakuClear, onClear)
})
</script>

<style lang="scss" scoped>
@import '@/styles/variables.scss';

.danmaku-track-layer {
  position: fixed;
  inset: 0;
  z-index: 45;
  overflow: hidden;
  pointer-events: none;
}

.danmaku-item {
  position: absolute;
  left: 100%;
  white-space: nowrap;
  font-size: 34rpx;
  font-weight: var(--font-weight-semibold);
  color: #fff;
  padding: 4rpx 20rpx;
  border-radius: var(--radius-pill);
  text-shadow: 0 2rpx 6rpx rgba(0, 0, 0, 0.55), 0 0 2rpx rgba(0, 0, 0, 0.7);
  animation-name: danmaku-move;
  animation-timing-function: linear;
  animation-fill-mode: forwards;
  will-change: transform;
}

.danmaku-item.mine {
  background: rgba(47, 107, 255, 0.88);
  text-shadow: none;
  box-shadow: 0 2rpx 8rpx rgba(47, 107, 255, 0.4);
}

@keyframes danmaku-move {
  from { transform: translateX(0); }
  to   { transform: translateX(calc(-100vw - 100%)); }
}

.danmaku-fab {
  position: fixed;
  left: max(var(--space-4), var(--safe-left));
  z-index: 55;
  width: 104rpx;
  height: 104rpx;
  border-radius: var(--radius-full);
  background: var(--color-secondary);
  color: var(--color-text-on-color);
  border: 0;
  box-shadow: var(--elevation-3);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform var(--duration-fast) var(--ease-standard),
              box-shadow var(--duration-base) var(--ease-standard);

  &::after { border: 0 !important; }
}

.danmaku-fab-hover {
  transform: scale(0.92);
  box-shadow: var(--elevation-2);
}

.danmaku-input-mask {
  position: fixed;
  inset: 0;
  z-index: 720;
  background: var(--color-scrim);
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  animation: fade-in var(--duration-base) var(--ease-decelerate);
}

.danmaku-input-card {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-5);
  background: var(--color-surface);
  box-shadow: var(--elevation-4);
}

.danmaku-input {
  flex: 1;
  height: 88rpx;
  padding: 0 var(--space-5);
  background: var(--color-surface-variant);
  border: 2rpx solid var(--color-outline);
  border-radius: var(--radius-pill);
  font-size: var(--font-body);
  color: var(--color-text-primary);
}

@keyframes fade-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}
</style>
