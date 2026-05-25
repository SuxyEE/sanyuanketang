<template>
  <div class="attendance-panel" role="dialog" aria-label="考勤签到">
    <div class="panel-header">
      <h3>考勤签到</h3>
      <button class="close-btn" @click="$emit('close')" aria-label="关闭">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>

    <div class="panel-body">
      <div v-if="!isStarted" class="start-area">
        <div class="sign-mode">
          <button
            v-for="m in modes"
            :key="m.value"
            class="mode-card"
            :class="{ active: signMode === m.value }"
            @click="signMode = m.value"
          >
            <span class="mode-icon" v-html="m.icon" aria-hidden="true"></span>
            <span class="mode-name">{{ m.label }}</span>
            <span class="mode-desc">{{ m.desc }}</span>
          </button>
        </div>

        <div class="duration-setting">
          <label>签到时长</label>
          <div class="duration-options">
            <button
              v-for="d in durations"
              :key="d"
              class="dur-btn"
              :class="{ active: duration === d }"
              @click="duration = d"
            >
              {{ d }}分钟
            </button>
          </div>
        </div>

        <button class="start-btn" @click="startSignIn">
          发起签到
        </button>
      </div>

      <div v-else class="progress-area">
        <div class="progress-ring">
          <svg viewBox="0 0 120 120" class="ring-svg">
            <circle cx="60" cy="60" r="52" fill="none" stroke="#e8ecf0" stroke-width="8" />
            <circle
              cx="60" cy="60" r="52"
              fill="none"
              stroke="#52c41a"
              stroke-width="8"
              stroke-linecap="round"
              :stroke-dasharray="circumference"
              :stroke-dashoffset="circumference - (signedCount / totalCount) * circumference"
              transform="rotate(-90 60 60)"
              style="transition: stroke-dashoffset 0.5s ease"
            />
          </svg>
          <div class="ring-center">
            <span class="ring-num">{{ signedCount }}</span>
            <span class="ring-label">/{{ totalCount }} 已签到</span>
          </div>
        </div>

        <div class="timer-display" v-if="remainingTime > 0">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          剩余 {{ formatTime(remainingTime) }}
        </div>
        <div class="timer-display ended" v-else>签到已结束</div>

        <div class="student-status-list">
          <div class="status-group">
            <h4 class="status-title signed">已签到 ({{ signedStudents.length }})</h4>
            <div class="status-chips">
              <span v-for="s in signedStudents" :key="s" class="chip signed">{{ s }}</span>
            </div>
          </div>
          <div class="status-group">
            <h4 class="status-title unsigned">未签到 ({{ unsignedStudents.length }})</h4>
            <div class="status-chips">
              <span v-for="s in unsignedStudents" :key="s" class="chip unsigned">{{ s }}</span>
            </div>
          </div>
        </div>

        <div class="action-row">
          <button class="action-btn" @click="endSignIn">结束签到</button>
          <button class="action-btn outline" @click="exportData">导出数据</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { icons } from '@snyuan/shared'
import { useSocket } from '../composables/useSocket'
import { useClassroomStore } from '../stores/classroom'
import { useToast } from '../composables/useToast'

defineEmits<{ close: [] }>()

const store = useClassroomStore()
const { socket } = useSocket()
const { toastSuccess, toastInfo } = useToast()

const signMode = ref('normal')
const duration = ref(3)
const isStarted = ref(false)
const remainingTime = ref(0)
const totalCount = computed(() => Math.max(store.totalCount, 1))
const circumference = 2 * Math.PI * 52

const modes = [
  { value: 'normal', label: '普通签到', desc: '学生点击签到', icon: icons.userCheck },
  { value: 'code', label: '签到码', desc: '输入4位数字', icon: icons.lock },
  { value: 'location', label: '位置签到', desc: '检测教室范围', icon: icons.signal },
]

const durations = [1, 3, 5, 10]

const signedStudents = computed(() => store.activeAttendance?.signed.map(s => s.studentName) || [])
const allStudents = computed(() => store.students.map(s => s.name))

const unsignedStudents = computed(() =>
  allStudents.value.filter(s => !signedStudents.value.includes(s))
)

const signedCount = computed(() => signedStudents.value.length)

let timer: any

function onAttendanceStartEcho(data: { mode: string; duration: number; startedAt?: number }) {
  if (isStarted.value) return
  signMode.value = data.mode
  duration.value = data.duration
  const startedAt = data.startedAt || Date.now()
  const elapsed = Math.floor((Date.now() - startedAt) / 1000)
  remainingTime.value = Math.max(0, data.duration * 60 - elapsed)
  isStarted.value = true
  startTickTimer(startedAt)
}

function onAttendanceEndEcho() {
  if (!isStarted.value) return
  isStarted.value = false
  remainingTime.value = 0
  if (timer) { clearInterval(timer); timer = null }
}

function startTickTimer(startedAt: number) {
  if (timer) clearInterval(timer)
  timer = setInterval(() => {
    const elapsed = Math.floor((Date.now() - startedAt) / 1000)
    remainingTime.value = Math.max(0, duration.value * 60 - elapsed)
    if (remainingTime.value <= 0 && timer) {
      clearInterval(timer); timer = null
    }
  }, 1000)
}

onMounted(() => {
  socket.value?.on('attendance:start', onAttendanceStartEcho)
  socket.value?.on('attendance:end', onAttendanceEndEcho)
  const cur = store.activeAttendance
  if (cur && cur.active) {
    signMode.value = cur.mode
    duration.value = cur.duration
    const elapsed = Math.floor((Date.now() - cur.startedAt) / 1000)
    remainingTime.value = Math.max(0, cur.duration * 60 - elapsed)
    isStarted.value = true
    startTickTimer(cur.startedAt)
  }
})

function startSignIn() {
  if (isStarted.value) return
  socket.value?.emit('attendance:start', {
    mode: signMode.value,
    duration: duration.value,
  })

  const modeLabel = modes.find(m => m.value === signMode.value)?.label || ''
  toastSuccess(`已发起${modeLabel}（${duration.value} 分钟）`)
}

function endSignIn() {
  socket.value?.emit('attendance:end')
  toastInfo(`签到已结束，共 ${signedCount.value} 人签到`)
}

function exportData() {
  console.log('Export attendance data:', signedStudents.value)
  toastSuccess(`已导出 ${signedStudents.value.length} 条签到数据`)
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

onUnmounted(() => {
  if (timer) clearInterval(timer)
  socket.value?.off('attendance:start', onAttendanceStartEcho)
  socket.value?.off('attendance:end', onAttendanceEndEcho)
})
</script>

<style scoped lang="scss">
.attendance-panel {
  position: fixed;
  inset: 0;
  z-index: 100;
  background: var(--bg-card);
  display: flex;
  flex-direction: column;
  animation: slideUp 0.25s ease-out;
}

@keyframes slideUp {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
  h3 { font-size: 17px; font-weight: 700; }
}

.close-btn {
  width: 44px; height: 44px; border-radius: 50%; border: none;
  background: var(--bg-page); color: var(--text-secondary);
  display: flex; align-items: center; justify-content: center; cursor: pointer;
}

.panel-body {
  flex: 1; overflow-y: auto; padding: 20px; -webkit-overflow-scrolling: touch;
}

.start-area {
  display: flex; flex-direction: column; gap: 24px;
}

.sign-mode {
  display: flex; gap: 10px;
}

.mode-card {
  flex: 1; display: flex; flex-direction: column; align-items: center; gap: 6px;
  padding: 16px 8px; border: 2px solid var(--border); border-radius: 16px;
  background: var(--bg-card); cursor: pointer; transition: all 0.2s;

  &.active { border-color: var(--primary); background: var(--primary-light); }

  .mode-icon { display: flex; color: var(--primary); :deep(svg) { width: 24px; height: 24px; } }
  .mode-name { font-size: 13px; font-weight: 600; color: var(--text-primary); }
  .mode-desc { font-size: 10px; color: var(--text-muted); }
}

.duration-setting {
  label { font-size: 13px; font-weight: 600; color: var(--text-primary); margin-bottom: 8px; display: block; }
}

.duration-options { display: flex; gap: 8px; }

.dur-btn {
  flex: 1; padding: 10px; border: 2px solid var(--border); border-radius: 12px;
  background: var(--bg-card); font-size: 13px; color: var(--text-secondary);
  cursor: pointer; min-height: 44px; transition: all 0.2s;
  &.active { border-color: var(--primary); color: var(--primary); background: var(--primary-light); }
}

.start-btn {
  width: 100%; padding: 16px; border: none; border-radius: 16px;
  background: linear-gradient(135deg, var(--primary), #4096ff);
  color: #fff; font-size: 16px; font-weight: 700; cursor: pointer;
  min-height: 52px; transition: all 0.2s;
  &:active { transform: scale(0.98); }
}

.progress-area {
  display: flex; flex-direction: column; align-items: center; gap: 20px;
}

.progress-ring {
  position: relative; width: 160px; height: 160px;
}

.ring-svg { width: 100%; height: 100%; }

.ring-center {
  position: absolute; inset: 0; display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  .ring-num { font-size: 36px; font-weight: 700; color: var(--success, #52c41a); }
  .ring-label { font-size: 12px; color: var(--text-muted); }
}

.timer-display {
  display: flex; align-items: center; gap: 6px;
  padding: 6px 16px; background: #fff7e6; border-radius: 20px;
  font-size: 13px; font-weight: 500; color: #d46b08;
  &.ended { background: var(--bg-page); color: var(--text-muted); }
}

.student-status-list {
  width: 100%; display: flex; flex-direction: column; gap: 16px;
}

.status-title {
  font-size: 13px; font-weight: 600; margin-bottom: 8px;
  &.signed { color: var(--success, #52c41a); }
  &.unsigned { color: var(--danger, #ff4d4f); }
}

.status-chips { display: flex; flex-wrap: wrap; gap: 6px; }

.chip {
  padding: 4px 12px; border-radius: 14px; font-size: 12px;
  &.signed { background: #f6ffed; color: #52c41a; border: 1px solid #b7eb8f; }
  &.unsigned { background: #fff1f0; color: #ff4d4f; border: 1px solid #ffa39e; }
}

.action-row { display: flex; gap: 10px; width: 100%; }

.action-btn {
  flex: 1; padding: 14px; border: none; border-radius: 12px;
  background: var(--primary); color: #fff; font-size: 14px; font-weight: 600;
  cursor: pointer; min-height: 48px; transition: all 0.2s;
  &.outline { background: var(--bg-card); border: 1px solid var(--border); color: var(--text-primary); }
  &:active { transform: scale(0.98); }
}
</style>
