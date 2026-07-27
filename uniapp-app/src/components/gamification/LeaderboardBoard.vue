<template>
  <view v-if="open" class="modal-mask" @tap="close">
    <view class="modal-card" @tap.stop>
      <view class="modal-head">
        <text class="modal-title">课堂排行榜</text>
        <button class="close-btn" @tap="close"><Icon name="x" size="md" /></button>
      </view>

      <view class="tabs">
        <button class="tab" :class="{ active: tab === 'individual' }" @tap="tab = 'individual'">
          <Icon name="trophy" size="sm" />
          <text>个人榜</text>
        </button>
        <button class="tab" :class="{ active: tab === 'group' }" @tap="tab = 'group'">
          <Icon name="users" size="sm" />
          <text>小组 PK</text>
        </button>
      </view>

      <!-- 个人排行榜 Top20 -->
      <view v-if="tab === 'individual'" class="panel">
        <view v-if="top.length === 0" class="state-box">
          <Icon name="trophy" size="2xl" tone="muted" />
          <text class="state-text">还没有学生积分，答题 / 签到后自动上榜</text>
        </view>
        <template v-else>
          <view class="stat-line">
            <text class="stat-strong">{{ totalStudents }}</text>
            <text class="stat-label">名学生参与积分</text>
          </view>

          <!-- 前三名领奖台 -->
          <view class="podium">
            <view
              v-for="p in podium"
              :key="p.entry.studentId"
              class="podium-col"
              :class="'rank-' + p.entry.rank"
            >
              <text class="podium-medal">{{ medal(p.entry.rank) }}</text>
              <text class="podium-name">{{ p.entry.name }}</text>
              <view class="podium-bar" :style="{ height: p.barH + 'rpx' }">
                <text class="podium-points">{{ p.entry.points }}</text>
              </view>
            </view>
          </view>

          <!-- 第 4 名起 -->
          <view v-if="rest.length > 0" class="rank-list">
            <view class="rank-row" v-for="e in rest" :key="e.studentId">
              <text class="rank-no">{{ e.rank }}</text>
              <text class="rank-name">{{ e.name }}</text>
              <text class="rank-points">{{ e.points }} 分</text>
            </view>
          </view>
        </template>
      </view>

      <!-- 小组 PK -->
      <view v-else class="panel">
        <view v-if="groups.length === 0" class="state-box">
          <Icon name="users" size="2xl" tone="muted" />
          <text class="state-text">尚未分组，发起分组讨论后小组积分自动汇总</text>
        </view>
        <template v-else>
          <view
            class="group-item"
            v-for="(g, i) in groups"
            :key="g.groupId"
            :class="{ leader: i === 0 }"
          >
            <view class="group-head">
              <view class="group-rank" :class="'rank-' + g.rank">{{ g.rank }}</view>
              <text class="group-name">{{ g.groupName }}</text>
              <text class="group-meta">{{ g.memberCount }} 人</text>
              <text class="group-points">{{ g.points }}</text>
            </view>
            <view class="group-track">
              <view
                class="group-fill"
                :class="'rank-' + g.rank"
                :style="{ width: groupPercent(g.points) + '%' }"
              ></view>
            </view>
          </view>
        </template>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import Icon from '@/components/ui/Icon.vue'
import { RoomEvent } from '@/shared/wsEvents'
import { useRoomSocket } from '@/composables/useRoomSocket'

interface TopEntry {
  studentId: string
  name: string
  points: number
  rank: number
}
interface GroupEntry {
  groupId: string
  groupName: string
  points: number
  memberCount: number
  rank: number
}
interface LeaderboardSnapshot {
  top?: TopEntry[]
  groups?: GroupEntry[]
  totalStudents?: number
}

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ 'update:open': [boolean] }>()

const tab = ref<'individual' | 'group'>('individual')
const top = ref<TopEntry[]>([])
const groups = ref<GroupEntry[]>([])
const totalStudents = ref(0)

function applySnapshot(data: LeaderboardSnapshot | null | undefined) {
  if (!data) return
  if (Array.isArray(data.top)) top.value = data.top
  if (Array.isArray(data.groups)) groups.value = data.groups
  if (typeof data.totalStudents === 'number') totalStudents.value = data.totalStudents
}

// 后端自动根据答题/签到加分并广播，late-join / 重连时从 room:joined 快照恢复
useRoomSocket({
  [RoomEvent.LeaderboardUpdate]: (data: any) => applySnapshot(data),
  [RoomEvent.Joined]: (data: any) => applySnapshot(data?.leaderboard),
})

// 前三名领奖台顺序：亚军(左) - 冠军(中,最高) - 季军(右)
const podium = computed(() => {
  const [first, second, third] = top.value.slice(0, 3)
  const cols: { entry: TopEntry; barH: number }[] = []
  if (second) cols.push({ entry: second, barH: 120 })
  if (first) cols.push({ entry: first, barH: 172 })
  if (third) cols.push({ entry: third, barH: 92 })
  return cols
})
const rest = computed(() => top.value.slice(3))
const maxGroupPoints = computed(() => Math.max(...groups.value.map((g) => g.points), 1))

function groupPercent(points: number) {
  return Math.max(4, Math.round((points / maxGroupPoints.value) * 100))
}

function medal(rank: number) {
  return rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : String(rank)
}

function close() {
  emit('update:open', false)
}
</script>

<style scoped lang="scss">
@import '@/styles/variables.scss';

.modal-mask {
  position: fixed; inset: 0; background: var(--color-scrim);
  display: flex; align-items: center; justify-content: center; z-index: var(--z-modal); padding: var(--space-5);
}
.modal-card {
  width: 92%; max-width: 720rpx; max-height: 86vh; overflow-y: auto; background: var(--color-surface-raised);
  border-radius: var(--radius-2xl); padding: var(--space-6); box-shadow: var(--elevation-4);
}
.modal-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-5); }
.modal-title { font-size: var(--font-title-sm); font-weight: var(--font-weight-bold); color: var(--color-text-primary); }
.close-btn {
  width: 64rpx; height: 64rpx; min-height: 0; padding: 0; display: flex; align-items: center; justify-content: center;
  background: var(--color-surface-variant); border-radius: var(--radius-full); color: var(--color-text-secondary);
}

.tabs {
  display: flex; background: var(--color-surface-variant); border-radius: var(--radius-md); padding: 4rpx; margin-bottom: var(--space-5);
}
.tab {
  flex: 1; min-height: 68rpx; display: flex; align-items: center; justify-content: center; gap: var(--space-2);
  background: transparent; border-radius: var(--radius-sm); font-size: var(--font-caption); color: var(--color-text-secondary);
  &.active { background: var(--color-surface); color: var(--color-primary); font-weight: var(--font-weight-semibold); box-shadow: var(--elevation-1); }
}

.panel { display: flex; flex-direction: column; gap: var(--space-4); }

.state-box { display: flex; flex-direction: column; align-items: center; gap: var(--space-3); padding: var(--space-9) var(--space-4); }
.state-text { font-size: var(--font-caption); color: var(--color-text-tertiary); text-align: center; }

.stat-line { display: flex; align-items: baseline; gap: var(--space-2); justify-content: center; }
.stat-strong { font-size: var(--font-title-lg); font-weight: var(--font-weight-bold); color: var(--color-primary); line-height: 1.1; }
.stat-label { font-size: var(--font-caption); color: var(--color-text-tertiary); }

.podium { display: flex; align-items: flex-end; justify-content: center; gap: var(--space-3); padding: var(--space-3) 0 var(--space-2); }
.podium-col { flex: 1; max-width: 200rpx; display: flex; flex-direction: column; align-items: center; gap: var(--space-2); }
.podium-medal { font-size: 44rpx; line-height: 1; }
.podium-name {
  font-size: var(--font-caption); font-weight: var(--font-weight-semibold); color: var(--color-text-primary);
  max-width: 100%; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; text-align: center;
}
.podium-bar {
  width: 100%; border-radius: var(--radius-lg) var(--radius-lg) 0 0; box-shadow: var(--elevation-1);
  display: flex; align-items: flex-start; justify-content: center; padding-top: var(--space-2);
}
.podium-points { font-size: var(--font-title-sm); font-weight: var(--font-weight-bold); color: var(--color-text-on-color); }
.podium-col.rank-1 .podium-bar { background: linear-gradient(180deg, #ffd75e, #f5b942); }
.podium-col.rank-2 .podium-bar { background: linear-gradient(180deg, #dde3ea, #b8c2cc); }
.podium-col.rank-3 .podium-bar { background: linear-gradient(180deg, #e6a86b, #cd7f32); }

.rank-list { display: flex; flex-direction: column; gap: var(--space-2); }
.rank-row {
  display: flex; align-items: center; gap: var(--space-3);
  padding: var(--space-3) var(--space-4); background: var(--color-surface-variant); border-radius: var(--radius-lg);
}
.rank-no { width: 48rpx; text-align: center; font-size: var(--font-caption); font-weight: var(--font-weight-bold); color: var(--color-text-tertiary); flex-shrink: 0; }
.rank-name { flex: 1; font-size: var(--font-body); color: var(--color-text-primary); overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.rank-points { font-size: var(--font-caption); font-weight: var(--font-weight-semibold); color: var(--color-primary); flex-shrink: 0; }

.group-item {
  display: flex; flex-direction: column; gap: var(--space-3);
  padding: var(--space-4); background: var(--color-surface-variant); border-radius: var(--radius-lg);
  &.leader { background: var(--color-primary-container); }
}
.group-head { display: flex; align-items: center; gap: var(--space-3); }
.group-rank {
  width: 44rpx; height: 44rpx; border-radius: 50%; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center; font-size: var(--font-caption); font-weight: var(--font-weight-bold);
  background: var(--color-surface); color: var(--color-text-secondary);
  &.rank-1 { background: #f5b942; color: #fff; }
  &.rank-2 { background: #b8c2cc; color: #fff; }
  &.rank-3 { background: #cd7f32; color: #fff; }
}
.group-name { flex: 1; font-size: var(--font-body); font-weight: var(--font-weight-semibold); color: var(--color-text-primary); overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.group-meta { font-size: var(--font-overline); color: var(--color-text-tertiary); flex-shrink: 0; }
.group-points { font-size: var(--font-title-sm); font-weight: var(--font-weight-bold); color: var(--color-primary); flex-shrink: 0; }
.group-track { height: 20rpx; background: var(--color-surface); border-radius: var(--radius-pill); overflow: hidden; }
.group-fill {
  height: 100%; background: var(--color-primary); border-radius: var(--radius-pill);
  transition: width var(--duration-med) var(--ease-standard);
  &.rank-1 { background: #f5b942; }
}
</style>
