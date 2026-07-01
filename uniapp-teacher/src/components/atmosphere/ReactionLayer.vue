<template>
  <view class="reaction-root">
    <!-- 飘屏 emoji 层（不拦截点击） -->
    <view class="float-layer">
      <text
        v-for="f in floating"
        :key="f.id"
        class="float-emoji"
        :style="{ left: f.left + '%', animationDuration: f.duration + 'ms' }"
      >{{ f.emoji }}</text>
    </view>

    <!-- 情绪热度条 -->
    <view v-if="showStats" class="heat-card">
      <view class="heat-head">
        <Icon name="flame" size="sm" tone="warning" />
        <text class="heat-title">课堂情绪</text>
        <text v-if="windowSec" class="heat-window">近 {{ windowSec }}s</text>
      </view>
      <view v-for="r in reactionTypes" :key="r.type" class="heat-row">
        <text class="heat-emoji">{{ r.emoji }}</text>
        <view class="heat-track">
          <view class="heat-fill" :class="r.type" :style="{ width: heatPercent(r.type) + '%' }"></view>
        </view>
        <text class="heat-count">{{ counts[r.type] || 0 }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import Icon from '@/components/ui/Icon.vue'
import { RoomEvent } from '@/shared/wsEvents'
import { useRoomSocket } from '@/composables/useRoomSocket'

type ReactionType = 'got' | 'confused' | 'tooFast' | 'like' | 'applause'

const reactionTypes: { type: ReactionType; emoji: string }[] = [
  { type: 'got', emoji: '😀' },
  { type: 'confused', emoji: '😵' },
  { type: 'tooFast', emoji: '🚀' },
  { type: 'like', emoji: '👍' },
  { type: 'applause', emoji: '👏' },
]
const emojiMap: Record<ReactionType, string> = {
  got: '😀', confused: '😵', tooFast: '🚀', like: '👍', applause: '👏',
}

const floating = ref<{ id: number; emoji: string; left: number; duration: number }[]>([])
const counts = ref<Record<string, number>>({})
const windowSec = ref(0)
const showStats = ref(false)
let seq = 0
let hideTimer: ReturnType<typeof setTimeout> | null = null

useRoomSocket({
  [RoomEvent.ReactionPush]: (data: any) => {
    const emoji = emojiMap[data?.type as ReactionType]
    if (!emoji) return
    spawn(emoji)
  },
  [RoomEvent.ReactionStats]: (data: any) => {
    counts.value = data?.counts || {}
    windowSec.value = data?.windowSec || 0
    showStats.value = true
    if (hideTimer) clearTimeout(hideTimer)
    hideTimer = setTimeout(() => { showStats.value = false }, 15000)
  },
})

function spawn(emoji: string) {
  const id = ++seq
  const left = 8 + Math.round(Math.random() * 78)
  const duration = 2600 + Math.round(Math.random() * 1600)
  floating.value.push({ id, emoji, left, duration })
  if (floating.value.length > 40) floating.value.splice(0, floating.value.length - 40)
  setTimeout(() => {
    const idx = floating.value.findIndex((f) => f.id === id)
    if (idx >= 0) floating.value.splice(idx, 1)
  }, duration + 100)
}

const heatMax = computed(() => Math.max(...reactionTypes.map((r) => counts.value[r.type] || 0), 1))
function heatPercent(type: ReactionType) {
  return Math.round(((counts.value[type] || 0) / heatMax.value) * 100)
}
</script>

<style scoped lang="scss">
@import '@/styles/variables.scss';

.reaction-root { position: fixed; inset: 0; pointer-events: none; z-index: var(--z-overlay); }

.float-layer { position: absolute; inset: 0; overflow: hidden; }
.float-emoji {
  position: absolute;
  bottom: 140rpx;
  font-size: 56rpx;
  line-height: 1;
  animation-name: float-up;
  animation-timing-function: var(--ease-decelerate);
  animation-fill-mode: forwards;
}
@keyframes float-up {
  0% { transform: translateY(0) scale(0.6); opacity: 0; }
  15% { opacity: 1; transform: translateY(-40rpx) scale(1); }
  80% { opacity: 1; }
  100% { transform: translateY(-560rpx) scale(1.1); opacity: 0; }
}

.heat-card {
  position: absolute;
  right: var(--space-4);
  bottom: 200rpx;
  width: 300rpx;
  padding: var(--space-3) var(--space-4);
  background: var(--color-surface-raised);
  border-radius: var(--radius-lg);
  box-shadow: var(--elevation-3);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.heat-head { display: flex; align-items: center; gap: var(--space-2); }
.heat-title { font-size: var(--font-caption); font-weight: var(--font-weight-semibold); color: var(--color-text-primary); }
.heat-window { margin-left: auto; font-size: var(--font-overline); color: var(--color-text-tertiary); }
.heat-row { display: flex; align-items: center; gap: var(--space-2); }
.heat-emoji { font-size: 28rpx; width: 40rpx; }
.heat-track { flex: 1; height: 16rpx; background: var(--color-surface-variant); border-radius: var(--radius-pill); overflow: hidden; }
.heat-fill {
  height: 100%; border-radius: var(--radius-pill); transition: width var(--duration-base) var(--ease-standard);
  &.got { background: var(--color-success); }
  &.confused { background: var(--color-danger); }
  &.tooFast { background: var(--color-secondary); }
  &.like { background: var(--color-primary); }
  &.applause { background: var(--color-warning); }
}
.heat-count { width: 40rpx; text-align: right; font-size: var(--font-overline); color: var(--color-text-secondary); }
</style>
