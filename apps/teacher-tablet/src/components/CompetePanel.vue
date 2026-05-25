<template>
  <div class="compete-panel" role="dialog" aria-label="抢答">
    <div class="panel-header">
      <h3>抢答</h3>
      <button class="close-btn" @click="$emit('close')" aria-label="关闭">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>

    <div class="panel-body">
      <div v-if="!isStarted" class="setup-area">
        <div class="input-group">
          <label>抢答题目</label>
          <textarea v-model="question" placeholder="输入抢答问题..." rows="3"></textarea>
        </div>

        <div class="input-group">
          <label>抢答时间</label>
          <div class="time-options">
            <button
              v-for="t in timeOptions"
              :key="t"
              class="time-btn"
              :class="{ active: timeLimit === t }"
              @click="timeLimit = t"
            >{{ t }}秒</button>
          </div>
        </div>

        <button class="start-btn" :disabled="!question.trim()" @click="startCompete">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          开始抢答
        </button>
      </div>

      <div v-else class="compete-area">
        <div class="question-display">
          <p>{{ question }}</p>
        </div>

        <div class="timer-ring">
          <svg viewBox="0 0 100 100" class="ring-svg">
            <circle cx="50" cy="50" r="42" fill="none" stroke="#e8ecf0" stroke-width="6" />
            <circle
              cx="50" cy="50" r="42"
              fill="none" stroke="#fa541c" stroke-width="6" stroke-linecap="round"
              :stroke-dasharray="circumference"
              :stroke-dashoffset="circumference - (countdown / timeLimit) * circumference"
              transform="rotate(-90 50 50)"
              style="transition: stroke-dashoffset 1s linear"
            />
          </svg>
          <span class="timer-num">{{ countdown }}</span>
        </div>

        <div class="responders">
          <h4>抢答排名</h4>
          <div v-if="responders.length === 0" class="waiting-text">
            等待学生抢答...
          </div>
          <div v-for="(r, i) in responders" :key="r.studentId" class="responder-item">
            <span class="rank" :class="{ gold: i === 0, silver: i === 1, bronze: i === 2 }">{{ i + 1 }}</span>
            <span class="name">{{ r.studentName }}</span>
            <span class="time-tag">{{ r.responseTime }}ms</span>
          </div>
        </div>

        <button class="stop-btn" @click="stopCompete">结束抢答</button>
      </div>

      <div class="history" v-if="history.length > 0">
        <h4>历史记录</h4>
        <div v-for="(h, i) in history" :key="i" class="history-item">
          <span class="h-question">{{ h.question }}</span>
          <span class="h-winner">{{ h.winner }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onUnmounted, onMounted } from 'vue'
import { useSocket } from '../composables/useSocket'
import { useToast } from '../composables/useToast'
import { useClassroomStore } from '../stores/classroom'

const emit = defineEmits<{ close: [] }>()
const { socket } = useSocket()
const { toastSuccess, toastInfo } = useToast()
const store = useClassroomStore()

const question = ref('')
const timeLimit = ref(15)
const isStarted = ref(false)
const countdown = ref(0)
const circumference = 2 * Math.PI * 42
const timeOptions = [10, 15, 20, 30]

interface Responder {
  studentId: string
  studentName: string
  responseTime: number
}

const responders = ref<Responder[]>([])
const history = ref<{ question: string; winner: string }[]>([])
const startTimestamp = ref(0)

let timer: ReturnType<typeof setInterval> | null = null

function onCompeteAnswer(data: { studentId: string; studentName: string; responseTime: number }) {
  if (!isStarted.value) return
  if (responders.value.find(r => r.studentId === data.studentId)) return
  responders.value.push({
    studentId: data.studentId,
    studentName: data.studentName,
    responseTime: data.responseTime,
  })
  responders.value.sort((a, b) => a.responseTime - b.responseTime)
}

function onCompeteStartEcho(data: { question: string; timeLimit: number; startTime?: number }) {
  if (isStarted.value) return
  isStarted.value = true
  question.value = data.question
  timeLimit.value = data.timeLimit
  startTimestamp.value = data.startTime || Date.now()
  responders.value = []
  const elapsed = Math.floor((Date.now() - startTimestamp.value) / 1000)
  countdown.value = Math.max(0, data.timeLimit - elapsed)
  ensureTimer()
}

function onCompeteStopEcho(data: { winner: any; ranking: any[] }) {
  if (!isStarted.value) return
  if (timer) { clearInterval(timer); timer = null }
  isStarted.value = false
  if (Array.isArray(data?.ranking) && data.ranking.length > 0) {
    responders.value = data.ranking.map((r: any) => ({
      studentId: r.studentId,
      studentName: r.studentName,
      responseTime: r.responseTime,
    }))
  }
  if (data?.winner) {
    history.value.unshift({ question: question.value, winner: data.winner.studentName })
  }
}

onMounted(() => {
  socket.value?.on('compete:answer', onCompeteAnswer)
  socket.value?.on('compete:start', onCompeteStartEcho)
  socket.value?.on('compete:stop', onCompeteStopEcho)
  const cur = store.activeCompete
  if (cur && cur.active) {
    isStarted.value = true
    question.value = cur.question
    timeLimit.value = cur.timeLimit
    startTimestamp.value = cur.startTime
    responders.value = cur.responders.map(r => ({ ...r }))
    const elapsed = Math.floor((Date.now() - cur.startTime) / 1000)
    countdown.value = Math.max(0, cur.timeLimit - elapsed)
    ensureTimer()
  }
})

function ensureTimer() {
  if (timer) return
  timer = setInterval(() => {
    const elapsed = Math.floor((Date.now() - startTimestamp.value) / 1000)
    countdown.value = Math.max(0, timeLimit.value - elapsed)
    if (countdown.value <= 0) {
      stopCompete()
    }
  }, 500)
}

function startCompete() {
  if (isStarted.value) return
  isStarted.value = true
  countdown.value = timeLimit.value
  startTimestamp.value = Date.now()
  responders.value = []

  socket.value?.emit('compete:start', {
    question: question.value,
    timeLimit: timeLimit.value,
  })
  toastSuccess(`抢答已开启（${timeLimit.value} 秒）`)
  ensureTimer()
}

function stopCompete() {
  if (timer) { clearInterval(timer); timer = null }
  if (!isStarted.value) return
  isStarted.value = false

  const winner = responders.value[0]
  socket.value?.emit('compete:stop', {
    winner: winner ? { studentId: winner.studentId, studentName: winner.studentName, responseTime: winner.responseTime } : null,
    ranking: responders.value.slice(0, 5),
  })

  if (responders.value.length > 0) {
    history.value.unshift({
      question: question.value,
      winner: responders.value[0].studentName,
    })
    toastInfo(`抢答结束，${responders.value[0].studentName} 拔得头筹`)
  } else {
    toastInfo('抢答已结束，无人响应')
  }

  question.value = ''
}

onUnmounted(() => {
  if (timer) clearInterval(timer)
  socket.value?.off('compete:answer', onCompeteAnswer)
  socket.value?.off('compete:start', onCompeteStartEcho)
  socket.value?.off('compete:stop', onCompeteStopEcho)
})
</script>

<style scoped lang="scss">
.compete-panel {
  position: fixed; inset: 0; z-index: 100;
  background: var(--bg-card); display: flex; flex-direction: column;
  animation: slideUp 0.25s ease-out;
}

@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }

.panel-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 16px 20px; border-bottom: 1px solid var(--border);
  h3 { font-size: 17px; font-weight: 700; }
}

.close-btn {
  width: 44px; height: 44px; border-radius: 50%; border: none;
  background: var(--bg-page); color: var(--text-secondary);
  display: flex; align-items: center; justify-content: center; cursor: pointer;
}

.panel-body { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 20px; }

.input-group {
  label { font-size: 13px; font-weight: 600; color: var(--text-primary); margin-bottom: 8px; display: block; }
  textarea {
    width: 100%; padding: 12px; border: 2px solid var(--border); border-radius: 12px;
    font-size: 14px; resize: none; outline: none; font-family: inherit;
    &:focus { border-color: var(--primary); }
  }
}

.time-options { display: flex; gap: 8px; }

.time-btn {
  flex: 1; padding: 10px; border: 2px solid var(--border); border-radius: 12px;
  background: var(--bg-card); font-size: 13px; color: var(--text-secondary);
  cursor: pointer; min-height: 44px; transition: all 0.2s;
  &.active { border-color: #fa541c; color: #fa541c; background: #fff2e8; }
}

.start-btn {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  width: 100%; padding: 16px; border: none; border-radius: 16px;
  background: linear-gradient(135deg, #fa541c, #ff7a45);
  color: #fff; font-size: 16px; font-weight: 700; cursor: pointer; min-height: 52px;
  &:disabled { opacity: 0.4; }
  &:active:not(:disabled) { transform: scale(0.98); }
}

.compete-area { display: flex; flex-direction: column; align-items: center; gap: 20px; }

.question-display {
  width: 100%; padding: 20px; background: #fff2e8; border: 2px solid #ffbb96;
  border-radius: 16px; text-align: center;
  p { font-size: 18px; font-weight: 600; color: #ad2102; line-height: 1.6; }
}

.timer-ring {
  position: relative; width: 120px; height: 120px;
  .ring-svg { width: 100%; height: 100%; }
  .timer-num {
    position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
    font-size: 36px; font-weight: 700; color: #fa541c;
  }
}

.responders {
  width: 100%;
  h4 { font-size: 14px; color: var(--text-primary); font-weight: 600; margin-bottom: 10px; }
  .waiting-text { text-align: center; color: var(--text-muted); font-size: 13px; padding: 20px; }
}

.responder-item {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 14px; background: var(--bg-page); border-radius: 12px; margin-bottom: 6px;
  .rank {
    width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
    font-size: 13px; font-weight: 700; background: var(--border); color: var(--text-secondary);
    &.gold { background: #ffd666; color: #874d00; }
    &.silver { background: #d9d9d9; color: #434343; }
    &.bronze { background: #ffbb96; color: #871400; }
  }
  .name { flex: 1; font-size: 14px; font-weight: 500; color: var(--text-primary); }
  .time-tag { font-size: 12px; color: var(--text-muted); }
}

.stop-btn {
  width: 100%; padding: 14px; border: 2px solid #fa541c; border-radius: 12px;
  background: transparent; color: #fa541c; font-size: 15px; font-weight: 600;
  cursor: pointer; min-height: 48px;
  &:active { background: #fff2e8; }
}

.history {
  h4 { font-size: 13px; color: var(--text-primary); font-weight: 600; margin-bottom: 8px; }
}

.history-item {
  display: flex; justify-content: space-between; padding: 8px 12px;
  background: var(--bg-page); border-radius: 8px; margin-bottom: 4px;
  .h-question { font-size: 12px; color: var(--text-secondary); flex: 1; }
  .h-winner { font-size: 12px; color: var(--success); font-weight: 500; }
}
</style>
