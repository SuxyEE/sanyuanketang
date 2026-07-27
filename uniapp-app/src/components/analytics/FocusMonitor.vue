<template>
  <view class="focus-root">
    <!-- 收起态：悬浮胶囊入口 -->
    <view
      v-if="!expanded"
      class="focus-pill"
      :class="{ alarm: offCount > 0, pulse }"
      @tap="expanded = true"
    >
      <Icon :name="offCount > 0 ? 'wifi-off' : 'monitor'" size="sm" :tone="offCount > 0 ? 'inverse' : 'primary'" />
      <text class="pill-text">{{ offCount > 0 ? offCount + ' 人离屏' : '专注监控' }}</text>
    </view>

    <!-- 展开态：监控面板 -->
    <view v-else class="focus-card" :class="{ alarm: offCount > 0 }">
      <view class="card-head">
        <Icon name="monitor" size="sm" :tone="offCount > 0 ? 'danger' : 'primary'" />
        <text class="card-title">专注度监控</text>
        <view class="collapse-btn" @tap="expanded = false">
          <Icon name="chevron-down" size="sm" tone="muted" />
        </view>
      </view>

      <!-- 汇总统计 -->
      <view class="stat-row">
        <view class="stat-item" :class="{ danger: offCount > 0 }">
          <text class="stat-num">{{ offCount }}</text>
          <text class="stat-label">当前离屏</text>
        </view>
        <view class="stat-item">
          <text class="stat-num">{{ totalLostCount }}</text>
          <text class="stat-label">累计次数</text>
        </view>
      </view>

      <!-- 离屏学生列表 -->
      <view v-if="offScreenList.length > 0" class="list">
        <view v-for="r in offScreenList" :key="r.studentId" class="list-row">
          <Icon name="user" size="xs" tone="danger" />
          <text class="row-name">{{ r.studentName }}</text>
          <text class="row-dur">{{ durationText(r.lostAt) }}</text>
          <text v-if="r.lostCount > 1" class="row-count">×{{ r.lostCount }}</text>
        </view>
      </view>

      <!-- 空态：全员专注 -->
      <view v-else class="empty-box">
        <Icon name="check-circle" size="lg" tone="success" />
        <text class="empty-text">当前全员专注</text>
        <text v-if="hasHistory" class="empty-sub">本堂累计离屏 {{ totalLostCount }} 人次</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import Icon from '@/components/ui/Icon.vue'
import { RoomEvent } from '@/shared/wsEvents'
import { useRoomSocket } from '@/composables/useRoomSocket'

interface FocusRecord {
  studentId: string
  studentName: string
  lostCount: number
  offScreen: boolean
  lostAt: number
}

const records = ref<Record<string, FocusRecord>>({})
const now = ref(Date.now())
const expanded = ref(false)
const pulse = ref(false)

let ticker: ReturnType<typeof setInterval> | null = null
let pulseTimer: ReturnType<typeof setTimeout> | null = null

function onFocusLost(data: any) {
  const id = String(data?.studentId ?? '')
  if (!id) return
  const name = data?.studentName || `学生${id.slice(-4)}`
  const cur = records.value[id]
  if (cur) {
    cur.lostCount += 1
    cur.offScreen = true
    cur.lostAt = Date.now()
    cur.studentName = name
  } else {
    records.value[id] = {
      studentId: id,
      studentName: name,
      lostCount: 1,
      offScreen: true,
      lostAt: Date.now(),
    }
  }
  triggerPulse()
}

function onFocusGained(data: any) {
  const id = String(data?.studentId ?? '')
  if (!id) return
  const cur = records.value[id]
  if (cur) cur.offScreen = false
}

function triggerPulse() {
  pulse.value = true
  if (pulseTimer) clearTimeout(pulseTimer)
  pulseTimer = setTimeout(() => { pulse.value = false }, 1200)
}

useRoomSocket({
  [RoomEvent.StudentFocusLost]: onFocusLost,
  [RoomEvent.StudentFocusGained]: onFocusGained,
})

const offScreenList = computed(() =>
  Object.values(records.value)
    .filter((r) => r.offScreen)
    .sort((a, b) => b.lostAt - a.lostAt),
)
const offCount = computed(() => offScreenList.value.length)
const totalLostCount = computed(() =>
  Object.values(records.value).reduce((sum, r) => sum + r.lostCount, 0),
)
const hasHistory = computed(() => Object.keys(records.value).length > 0)

function durationText(lostAt: number) {
  const sec = Math.max(0, Math.floor((now.value - lostAt) / 1000))
  if (sec < 60) return `${sec}s`
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}m${s.toString().padStart(2, '0')}s`
}

onMounted(() => {
  ticker = setInterval(() => { now.value = Date.now() }, 1000)
})
onUnmounted(() => {
  if (ticker) clearInterval(ticker)
  if (pulseTimer) clearTimeout(pulseTimer)
})
</script>

<style scoped lang="scss">
@import '@/styles/variables.scss';

.focus-root {
  position: fixed;
  left: var(--space-4);
  bottom: 200rpx;
  z-index: var(--z-overlay);
}

/* 收起胶囊 */
.focus-pill {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  background: var(--color-surface-raised);
  border-radius: var(--radius-pill);
  box-shadow: var(--elevation-3);
  &.alarm {
    background: var(--color-danger);
    .pill-text { color: var(--color-text-on-color); }
  }
  &.pulse { animation: focus-pulse 1200ms var(--ease-standard); }
}
.pill-text {
  font-size: var(--font-caption);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

/* 展开面板 */
.focus-card {
  width: 360rpx;
  padding: var(--space-3) var(--space-4);
  background: var(--color-surface-raised);
  border-radius: var(--radius-lg);
  box-shadow: var(--elevation-3);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  &.alarm { box-shadow: 0 0 0 2rpx var(--color-danger), var(--elevation-3); }
}
.card-head { display: flex; align-items: center; gap: var(--space-2); }
.card-title {
  font-size: var(--font-caption);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}
.collapse-btn {
  margin-left: auto;
  width: 44rpx;
  height: 44rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-full);
  background: var(--color-surface-variant);
}

.stat-row { display: flex; gap: var(--space-2); }
.stat-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2rpx;
  padding: var(--space-2);
  background: var(--color-surface-variant);
  border-radius: var(--radius-md);
  &.danger {
    background: var(--color-danger-container);
    .stat-num { color: var(--color-danger); }
  }
}
.stat-num {
  font-size: var(--font-title-sm);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
  line-height: 1.1;
}
.stat-label { font-size: var(--font-overline); color: var(--color-text-tertiary); }

.list { display: flex; flex-direction: column; gap: 6rpx; max-height: 420rpx; overflow-y: auto; }
.list-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: 8rpx var(--space-2);
  background: var(--color-danger-container);
  border-radius: var(--radius-sm);
}
.row-name {
  flex: 1;
  font-size: var(--font-caption);
  color: var(--color-text-primary);
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.row-dur { font-size: var(--font-overline); color: var(--color-danger); font-variant-numeric: tabular-nums; }
.row-count {
  padding: 0 10rpx;
  font-size: var(--font-overline);
  font-weight: var(--font-weight-semibold);
  color: var(--color-on-danger-container);
  background: var(--color-surface-raised);
  border-radius: var(--radius-pill);
}

.empty-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6rpx;
  padding: var(--space-4) var(--space-2);
}
.empty-text { font-size: var(--font-caption); color: var(--color-text-secondary); }
.empty-sub { font-size: var(--font-overline); color: var(--color-text-tertiary); }

@keyframes focus-pulse {
  0% { transform: scale(1); }
  30% { transform: scale(1.08); }
  60% { transform: scale(0.98); }
  100% { transform: scale(1); }
}
</style>
