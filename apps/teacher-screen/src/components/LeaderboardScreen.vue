<template>
  <div class="lb-panel">
    <header class="lb-header">
      <div class="lb-title-wrap">
        <span class="lb-kicker">课堂积分 PK</span>
        <h2 class="lb-title">实时排行榜</h2>
      </div>
      <div class="lb-total">
        <span class="lb-total-num">{{ data?.totalStudents ?? 0 }}</span>
        <span class="lb-total-label">参与</span>
      </div>
      <button class="lb-close" type="button" aria-label="关闭排行榜" @click="emit('close')">×</button>
    </header>

    <!-- PointsAward 飘分提示 -->
    <transition-group name="lb-award" tag="div" class="lb-awards">
      <div v-for="a in awards" :key="a.id" class="lb-award">
        <span class="lb-award-name">{{ a.name }}</span>
        <span class="lb-award-delta">+{{ a.delta }}</span>
        <span v-if="a.reason" class="lb-award-reason">{{ a.reason }}</span>
      </div>
    </transition-group>

    <section class="lb-section lb-section-top">
      <h3 class="lb-sec-title">个人 Top {{ topList.length || TOP_N }}</h3>
      <div v-if="topList.length === 0" class="lb-empty">暂无积分，答题抢分即可上榜</div>
      <div v-else class="lb-list">
        <div
          v-for="item in topList"
          :key="item.studentId"
          class="lb-row"
          :class="rankClass(item.rank)"
        >
          <span class="lb-rank">
            <span v-if="item.rank <= 3" class="lb-medal">{{ medal(item.rank) }}</span>
            <span v-else class="lb-rank-num">{{ item.rank }}</span>
          </span>
          <span class="lb-name" :title="item.name">{{ item.name }}</span>
          <span class="lb-points">{{ item.points }}<i>分</i></span>
        </div>
      </div>
    </section>

    <section v-if="groupList.length > 0" class="lb-section lb-section-group">
      <h3 class="lb-sec-title">小组 PK</h3>
      <div class="lb-groups">
        <div
          v-for="g in groupList"
          :key="g.groupId"
          class="lb-group"
          :class="{ lead: g.rank === 1 }"
        >
          <div class="lb-group-head">
            <span class="lb-group-rank">{{ g.rank }}</span>
            <span class="lb-group-name" :title="g.groupName">{{ g.groupName }}</span>
            <span class="lb-group-members">{{ g.memberCount }}人</span>
            <span class="lb-group-points">{{ g.points }}</span>
          </div>
          <div class="lb-group-bar-wrap">
            <div class="lb-group-bar" :style="{ width: groupPct(g.points) + '%' }"></div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

interface LeaderEntry {
  studentId: string
  name: string
  points: number
  rank: number
}
interface LeaderGroup {
  groupId: string
  groupName: string
  points: number
  memberCount: number
  rank: number
}
interface LeaderboardData {
  top: LeaderEntry[]
  groups: LeaderGroup[]
  totalStudents: number
}
interface AwardToast {
  id: number
  name: string
  delta: number
  reason?: string
}

const props = defineProps<{ data: LeaderboardData | null }>()
const emit = defineEmits<{ close: [] }>()

const TOP_N = 10

const topList = computed(() => (props.data?.top || []).slice(0, TOP_N))
const groupList = computed(() => props.data?.groups || [])
const maxGroupPoints = computed(() => groupList.value.reduce((m, g) => Math.max(m, g.points), 1))

function groupPct(p: number) {
  return Math.max(4, Math.min(100, Math.round((p / maxGroupPoints.value) * 100)))
}
function medal(rank: number) {
  return rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉'
}
function rankClass(rank: number) {
  return rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : ''
}

/** PointsAward 事件驱动：屏上飘一个「姓名 +N」得分提示，3s 后淡出 */
const awards = ref<AwardToast[]>([])
let awardSeq = 0
function flashAward(payload: { studentId: string; delta: number; reason?: string; total?: number }) {
  if (!payload || !payload.delta) return
  const name = props.data?.top.find(t => t.studentId === payload.studentId)?.name || '学生'
  const id = ++awardSeq
  awards.value.push({ id, name, delta: payload.delta, reason: payload.reason })
  if (awards.value.length > 5) awards.value.shift()
  setTimeout(() => {
    awards.value = awards.value.filter(a => a.id !== id)
  }, 3000)
}

defineExpose({ flashAward })
</script>

<style scoped lang="scss">
.lb-panel {
  position: fixed;
  top: 72px;
  right: 16px;
  bottom: 18px;
  z-index: 44;
  width: 360px;
  display: flex;
  flex-direction: column;
  background: linear-gradient(160deg, rgba(24, 30, 66, 0.96), rgba(12, 16, 40, 0.96));
  border: 1px solid rgba(120, 170, 255, 0.24);
  border-radius: 22px;
  padding: 18px 18px 20px;
  box-shadow: 0 24px 70px -20px rgba(0, 0, 0, 0.65);
  animation: lb-slide-in 0.4s cubic-bezier(0.22, 1, 0.36, 1);
}
@keyframes lb-slide-in {
  from { opacity: 0; transform: translateX(40px); }
  to { opacity: 1; transform: translateX(0); }
}

.lb-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-bottom: 14px;
  margin-bottom: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}
.lb-title-wrap { flex: 1; display: flex; flex-direction: column; gap: 2px; }
.lb-kicker { font-size: 12px; font-weight: 600; color: #7fb0ff; letter-spacing: 1px; }
.lb-title { margin: 0; font-size: 24px; font-weight: 800; color: #fff; }
.lb-total { display: flex; flex-direction: column; align-items: center; line-height: 1.1; }
.lb-total-num { font-size: 26px; font-weight: 800; color: #ffd666; font-variant-numeric: tabular-nums; }
.lb-total-label { font-size: 11px; color: rgba(255, 255, 255, 0.5); }
.lb-close {
  width: 28px; height: 28px; flex-shrink: 0;
  border: none; border-radius: 8px; cursor: pointer;
  background: rgba(255, 255, 255, 0.08); color: rgba(255, 255, 255, 0.7);
  font-size: 20px; line-height: 1;
  transition: background 0.15s ease;
  &:hover { background: rgba(255, 255, 255, 0.18); color: #fff; }
}

.lb-awards {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-height: 0;
  margin-bottom: 8px;
}
.lb-award {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: linear-gradient(90deg, rgba(82, 196, 26, 0.22), rgba(82, 196, 26, 0.06));
  border: 1px solid rgba(82, 196, 26, 0.3);
  border-radius: 10px;
}
.lb-award-name { font-size: 14px; color: #fff; font-weight: 600; }
.lb-award-delta { font-size: 16px; font-weight: 800; color: #95de64; font-variant-numeric: tabular-nums; }
.lb-award-reason { margin-left: auto; font-size: 12px; color: rgba(255, 255, 255, 0.55); }
.lb-award-enter-active { transition: all 0.35s ease; }
.lb-award-leave-active { transition: all 0.4s ease; position: absolute; }
.lb-award-enter-from { opacity: 0; transform: translateY(-8px) scale(0.96); }
.lb-award-leave-to { opacity: 0; transform: translateX(24px); }

.lb-section { display: flex; flex-direction: column; min-height: 0; }
.lb-section-top { flex: 1; margin-bottom: 14px; }
.lb-sec-title {
  margin: 0 0 10px;
  font-size: 15px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.9);
}
.lb-empty {
  padding: 24px 12px;
  text-align: center;
  color: rgba(255, 255, 255, 0.45);
  font-size: 14px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 12px;
}

.lb-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 7px;
  padding-right: 4px;
  &::-webkit-scrollbar { width: 4px; }
  &::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.15); border-radius: 4px; }
}
.lb-row {
  display: grid;
  grid-template-columns: 40px 1fr auto;
  gap: 10px;
  align-items: center;
  padding: 9px 12px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 12px;
  transition: background 0.25s ease;
  &.gold { background: linear-gradient(90deg, rgba(255, 214, 102, 0.2), rgba(255, 214, 102, 0.05)); border-color: rgba(255, 214, 102, 0.4); }
  &.silver { background: linear-gradient(90deg, rgba(217, 217, 217, 0.18), rgba(217, 217, 217, 0.04)); border-color: rgba(217, 217, 217, 0.34); }
  &.bronze { background: linear-gradient(90deg, rgba(255, 187, 150, 0.18), rgba(255, 187, 150, 0.04)); border-color: rgba(255, 187, 150, 0.34); }
}
.lb-rank {
  display: flex; align-items: center; justify-content: center;
  width: 40px;
}
.lb-medal { font-size: 22px; line-height: 1; }
.lb-rank-num {
  width: 28px; height: 28px; border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  background: rgba(65, 120, 255, 0.18); color: #7fb0ff;
  font-size: 14px; font-weight: 800;
}
.lb-name {
  font-size: 17px; color: rgba(255, 255, 255, 0.94); font-weight: 600;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.lb-points {
  font-size: 20px; font-weight: 800; color: #ffd666;
  font-variant-numeric: tabular-nums;
  i { font-size: 12px; font-style: normal; font-weight: 500; color: rgba(255, 255, 255, 0.5); margin-left: 2px; }
}

.lb-section-group {
  flex-shrink: 0;
  max-height: 42%;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  padding-top: 14px;
}
.lb-groups {
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow-y: auto;
  &::-webkit-scrollbar { width: 4px; }
  &::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.15); border-radius: 4px; }
}
.lb-group {
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 12px;
  &.lead { border-color: rgba(255, 125, 77, 0.4); background: rgba(255, 125, 77, 0.08); }
}
.lb-group-head {
  display: flex; align-items: center; gap: 8px; margin-bottom: 8px;
}
.lb-group-rank {
  width: 22px; height: 22px; border-radius: 6px;
  display: flex; align-items: center; justify-content: center;
  background: rgba(250, 173, 20, 0.18); color: #ffd666;
  font-size: 12px; font-weight: 800;
}
.lb-group-name {
  font-size: 15px; color: #fff; font-weight: 600;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.lb-group-members { font-size: 12px; color: rgba(255, 255, 255, 0.5); }
.lb-group-points { margin-left: auto; font-size: 17px; font-weight: 800; color: #ff9b6b; font-variant-numeric: tabular-nums; }
.lb-group-bar-wrap { height: 12px; background: rgba(255, 255, 255, 0.06); border-radius: 6px; overflow: hidden; }
.lb-group-bar {
  height: 100%; min-width: 4px; border-radius: 6px;
  background: linear-gradient(90deg, #ff7d4d, #faad14);
  transition: width 0.7s cubic-bezier(0.22, 1, 0.36, 1);
}

@media (max-width: 1024px) {
  .lb-panel { width: 300px; top: 64px; }
  .lb-title { font-size: 20px; }
}
</style>
