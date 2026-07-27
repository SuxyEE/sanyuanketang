<template>
  <view
    v-if="visible && store.viewState !== 'locked'"
    class="points-badge"
    :class="{ bump }"
    :style="{ top: `max(var(--space-3), var(--safe-top))`, left: `max(var(--space-3), var(--safe-left))` }"
  >
    <!-- 得分飘字层（收到属于自己的 PointsAward 时飘一条「+N 得分」） -->
    <view class="float-layer" aria-hidden="true">
      <text
        v-for="f in floats"
        :key="f.id"
        class="float-item"
        :style="{ animationDuration: f.dur + 'ms' }"
      >+{{ f.delta }}<text v-if="f.reason" class="float-reason"> {{ f.reason }}</text></text>
    </view>

    <text class="badge-icon">🏆</text>
    <view class="badge-body">
      <text class="badge-points">{{ myPoints }}<text class="badge-unit">分</text></text>
      <text v-if="myRank > 0" class="badge-rank">第 {{ myRank }} 名</text>
      <text v-else class="badge-rank badge-rank-muted">未上榜</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useStudentStore } from '@/stores/student'
import { useSocket } from '@/student-sockets/useSocket'
import { RoomEvent } from '@/shared/wsEvents'

const store = useStudentStore()
const { getSocket } = useSocket()

const myPoints = ref(0)
const myRank = ref(0)
const bump = ref(false)

// 得过分（total>0）或已上榜才显示徽章，避免 0 分时打扰
const visible = computed(() => myPoints.value > 0 || myRank.value > 0)

interface FloatItem { id: string; delta: number; reason: string; dur: number }
const floats = ref<FloatItem[]>([])

let bumpTimer: ReturnType<typeof setTimeout> | null = null

function spawnFloat(delta: number, reason: string) {
  if (!delta) return
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  floats.value.push({ id, delta, reason, dur: 1600 })
  if (floats.value.length > 12) floats.value.splice(0, floats.value.length - 12)
  setTimeout(() => {
    floats.value = floats.value.filter(f => f.id !== id)
  }, 1700)
  // 徽章脉冲一下，强化「我得分了」反馈
  bump.value = true
  if (bumpTimer) clearTimeout(bumpTimer)
  bumpTimer = setTimeout(() => { bump.value = false }, 500)
}

/** 从排行榜快照里定位自己，得出排名与总分 */
function applyLeaderboard(lb: any) {
  if (!lb) return
  const top = Array.isArray(lb.top) ? lb.top : []
  const me = top.find((e: any) => e && e.studentId === store.studentId)
  if (me) {
    myPoints.value = Number(me.points) || 0
    myRank.value = Number(me.rank) || 0
  } else {
    // 不在 Top 榜内：保留已知总分，排名标记为未上榜
    myRank.value = 0
  }
}

function onPointsAward(data: any) {
  if (!data || data.studentId !== store.studentId) return
  const total = Number(data.total)
  if (Number.isFinite(total)) myPoints.value = total
  spawnFloat(Number(data.delta) || 0, String(data.reason || ''))
}

function onLeaderboard(lb: any) { applyLeaderboard(lb) }

// room:joined 快照含 leaderboard，进入 / 重连后据此恢复自己的分与名次
function onJoined(data: any) { applyLeaderboard(data?.leaderboard) }

// socket 单例由父页面 onMounted 才建立；本组件常驻挂载会早于父，故重试绑定
let retryTimer: ReturnType<typeof setInterval> | null = null
function bindSocket() {
  const s = getSocket()
  if (!s) return false
  s.on(RoomEvent.PointsAward, onPointsAward)
  s.on(RoomEvent.LeaderboardUpdate, onLeaderboard)
  s.on(RoomEvent.Joined, onJoined)
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
  if (bumpTimer) { clearTimeout(bumpTimer); bumpTimer = null }
  const s = getSocket()
  s?.off(RoomEvent.PointsAward, onPointsAward)
  s?.off(RoomEvent.LeaderboardUpdate, onLeaderboard)
  s?.off(RoomEvent.Joined, onJoined)
})
</script>

<style lang="scss" scoped>
@import '@/styles/variables.scss';

.points-badge {
  position: fixed;
  left: 0;
  z-index: 58;
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(20rpx) saturate(180%);
  -webkit-backdrop-filter: blur(20rpx) saturate(180%);
  border: 2rpx solid var(--color-warning);
  border-radius: var(--radius-pill);
  box-shadow: var(--elevation-2);

  &.bump { animation: pts-bump 0.5s var(--ease-emphasized); }
}

@supports not ((backdrop-filter: blur(2rpx)) or (-webkit-backdrop-filter: blur(2rpx))) {
  .points-badge { background: rgba(255, 255, 255, 0.97); }
}

@keyframes pts-bump {
  0%, 100% { transform: scale(1); }
  40%      { transform: scale(1.12); }
}

.float-layer {
  position: absolute;
  top: 100%;
  left: var(--space-3);
  margin-top: var(--space-1);
  pointer-events: none;
}

.float-item {
  position: absolute;
  top: 0;
  left: 0;
  white-space: nowrap;
  font-size: var(--font-caption);
  font-weight: var(--font-weight-bold);
  color: var(--color-warning);
  text-shadow: 0 1rpx 2rpx rgba(255, 255, 255, 0.8);
  animation: pts-float var(--dur, 1600ms) var(--ease-decelerate) forwards;
  will-change: transform, opacity;
}

.float-reason {
  font-weight: var(--font-weight-regular);
  color: var(--color-text-secondary);
}

@keyframes pts-float {
  0%   { transform: translateY(-12rpx); opacity: 0; }
  18%  { transform: translateY(0); opacity: 1; }
  100% { transform: translateY(48rpx); opacity: 0; }
}

.badge-icon {
  font-size: 34rpx;
  line-height: 1;
}

.badge-body {
  display: flex;
  flex-direction: column;
  line-height: 1.1;
}

.badge-points {
  font-size: var(--font-title-sm);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
  font-variant-numeric: tabular-nums;
}

.badge-unit {
  font-size: var(--font-caption);
  font-weight: var(--font-weight-regular);
  color: var(--color-text-secondary);
  margin-left: 2rpx;
}

.badge-rank {
  font-size: var(--font-overline);
  color: var(--color-on-warning-container);
}

.badge-rank-muted {
  color: var(--color-text-tertiary);
}

@media (prefers-reduced-motion: reduce) {
  .points-badge.bump { animation: none; }
  .float-item { animation-duration: 1ms; }
}
</style>
