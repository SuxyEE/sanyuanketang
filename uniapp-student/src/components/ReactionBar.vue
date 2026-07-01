<template>
  <view
    v-if="store.viewState !== 'locked'"
    class="reaction-bar"
    :style="{ bottom: `max(var(--space-3), var(--safe-bottom))` }"
  >
    <!-- 飘动反馈层（自己发的 + 收到 ReactionPush 的都在这飘） -->
    <view class="float-layer" aria-hidden="true">
      <text
        v-for="f in floats"
        :key="f.id"
        class="float-emoji"
        :style="{ left: f.left + '%', animationDuration: f.dur + 'ms' }"
      >{{ f.emoji }}</text>
    </view>

    <view class="bar">
      <button
        v-for="r in reactions"
        :key="r.type"
        class="reaction-btn"
        hover-class="reaction-btn-hover"
        :hover-stay-time="80"
        :aria-label="r.label"
        @tap="sendReaction(r)"
      >
        <text class="reaction-emoji">{{ r.emoji }}</text>
        <text class="reaction-label">{{ r.label }}</text>
      </button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useStudentStore } from '@/stores/student'
import { useSocket } from '@/sockets/useSocket'
import { RoomEvent } from '@/shared/wsEvents'

const store = useStudentStore()
const { getSocket } = useSocket()

interface ReactionDef { type: string; emoji: string; label: string }

const reactions: ReactionDef[] = [
  { type: 'got', emoji: '\u2705', label: '\u61c2\u4e86' },
  { type: 'confused', emoji: '\ud83d\ude15', label: '\u6ca1\u61c2' },
  { type: 'tooFast', emoji: '\ud83d\udc22', label: '\u592a\u5feb' },
  { type: 'like', emoji: '\ud83d\udc4d', label: '\u8d5e' },
  { type: 'applause', emoji: '\ud83d\udc4f', label: '\u9f13\u638c' },
]

const emojiByType: Record<string, string> = {
  got: '\u2705',
  confused: '\ud83d\ude15',
  tooFast: '\ud83d\udc22',
  like: '\ud83d\udc4d',
  applause: '\ud83d\udc4f',
}

// 全局节流：狂点也最多 ~1.6 次/秒，避免刷屏
let lastSent = 0
function sendReaction(r: ReactionDef) {
  const now = Date.now()
  if (now - lastSent < 600) {
    spawnFloat(r.emoji)
    return
  }
  lastSent = now
  getSocket()?.emit(RoomEvent.ReactionSend, { type: r.type })
  spawnFloat(r.emoji)
}

interface FloatItem { id: string; emoji: string; left: number; dur: number }
const floats = ref<FloatItem[]>([])

function spawnFloat(emoji: string) {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  const item: FloatItem = {
    id,
    emoji,
    left: 8 + Math.random() * 84,
    dur: 1400 + Math.random() * 700,
  }
  floats.value.push(item)
  if (floats.value.length > 30) floats.value.splice(0, floats.value.length - 30)
  setTimeout(() => {
    floats.value = floats.value.filter(f => f.id !== id)
  }, item.dur + 60)
}

function onReactionPush(data: any) {
  const emoji = emojiByType[data?.type] || '\ud83d\udc4d'
  spawnFloat(emoji)
}

// socket 单例由父页面 onMounted 才建立；本组件常驻挂载会早于父，故重试绑定
let retryTimer: ReturnType<typeof setInterval> | null = null
function bindSocket() {
  const s = getSocket()
  if (!s) return false
  s.on(RoomEvent.ReactionPush, onReactionPush)
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
  getSocket()?.off(RoomEvent.ReactionPush, onReactionPush)
})
</script>

<style lang="scss" scoped>
@import '@/styles/variables.scss';

.reaction-bar {
  position: fixed;
  left: 50%;
  transform: translateX(-50%);
  z-index: 55;
  display: flex;
  justify-content: center;
  pointer-events: none;
}

.float-layer {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 100%;
  height: 200rpx;
  pointer-events: none;
}

.float-emoji {
  position: absolute;
  bottom: 0;
  font-size: 44rpx;
  animation: float-up var(--dur, 1600ms) var(--ease-decelerate) forwards;
  will-change: transform, opacity;
}

@keyframes float-up {
  0%   { transform: translateY(0) scale(0.6); opacity: 0; }
  20%  { transform: translateY(-24rpx) scale(1.15); opacity: 1; }
  100% { transform: translateY(-180rpx) scale(1); opacity: 0; }
}

.bar {
  display: flex;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: rgba(255, 255, 255, 0.82);
  backdrop-filter: blur(20rpx) saturate(180%);
  -webkit-backdrop-filter: blur(20rpx) saturate(180%);
  border: 2rpx solid rgba(0, 0, 0, 0.05);
  border-radius: var(--radius-pill);
  box-shadow: var(--elevation-2);
  pointer-events: auto;
}

@supports not ((backdrop-filter: blur(2rpx)) or (-webkit-backdrop-filter: blur(2rpx))) {
  .bar { background: rgba(255, 255, 255, 0.95); }
}

.reaction-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2rpx;
  min-width: 96rpx;
  padding: var(--space-2) var(--space-2);
  background: transparent;
  border: 0;
  border-radius: var(--radius-lg);
  transition: background-color var(--duration-fast) var(--ease-standard),
              transform var(--duration-fast) var(--ease-standard);

  &::after { border: 0 !important; }
}

.reaction-btn-hover {
  background: var(--color-state-overlay-press);
  transform: scale(0.92);
}

.reaction-emoji {
  font-size: 40rpx;
  line-height: 1.1;
}

.reaction-label {
  font-size: var(--font-overline);
  color: var(--color-text-secondary);
}

@media (prefers-reduced-motion: reduce) {
  .float-emoji { animation-duration: 1ms; }
}
</style>
