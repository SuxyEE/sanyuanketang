<template>
  <div class="course-select">
    <div v-if="!showRoomCode" class="select-view">
      <div class="select-header">
        <h1>选择课程</h1>
        <p>选择今天要上的课程，开启互动课堂</p>
      </div>

      <div class="today-label">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        今日课程 · {{ today }}
      </div>

      <div class="course-list">
        <button
          v-for="course in todayCourses"
          :key="course.id"
          class="course-card"
          @click="selectCourse(course)"
        >
          <div class="course-color" :style="{ background: course.color }"></div>
          <div class="course-info">
            <h3>{{ course.name }}</h3>
            <p class="course-meta">
              <span>{{ course.subject }}</span>
              <span class="dot">·</span>
              <span>{{ course.class }}</span>
            </p>
            <p class="course-time">{{ course.time }}</p>
          </div>
          <div class="course-arrow">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
          </div>
        </button>
      </div>
    </div>

    <div v-else class="room-code-view">
      <div class="room-header">
        <h2>{{ selectedCourse?.name }}</h2>
        <p>{{ selectedCourse?.subject }} · {{ selectedCourse?.class }}</p>
      </div>

      <div class="room-card">
        <h3>课堂入口码</h3>
        <div class="code-display">
          <span v-for="(c, i) in roomCode.split('')" :key="i" class="code-digit">{{ c }}</span>
        </div>
        <p class="code-hint">学生在平板端输入此码加入课堂</p>

        <div class="qr-area">
          <canvas ref="qrCanvas" class="qr-canvas"></canvas>
          <p class="qr-hint">或扫描二维码加入</p>
        </div>

        <div class="join-urls">
          <div class="url-item">
            <span class="url-label">学生端</span>
            <span class="url-val">{{ studentUrl }}</span>
          </div>
          <div class="url-item">
            <span class="url-label">大屏端</span>
            <span class="url-val">{{ screenUrl }}</span>
          </div>
        </div>
      </div>

      <div class="room-actions">
        <button class="back-btn" @click="showRoomCode = false">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
          返回选课
        </button>
        <button class="start-btn" @click="enterClassroom">
          进入课堂
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

const today = new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })
const showRoomCode = ref(false)
const roomCode = ref('')
const selectedCourse = ref<any>(null)
const qrCanvas = ref<HTMLCanvasElement | null>(null)

const hostname = window.location.hostname || 'localhost'
const studentUrl = ref('')
const screenUrl = ref('')

const todayCourses = ref([
  { id: '1', name: '工业机器人编程实训', subject: '工业机器人技术', class: '机器人2401班', time: '14:30 - 15:15', color: '#1677ff' },
  { id: '2', name: '三维建模与逆向工程', subject: '数字化设计与制造', class: '数设2401班', time: '15:30 - 16:15', color: '#52c41a' },
  { id: '3', name: 'PLC控制技术基础', subject: '智能控制技术', class: '智控2402班', time: '16:30 - 17:15', color: '#722ed1' },
])

function generateRoomCode() {
  return String(Math.floor(100000 + Math.random() * 900000))
}

async function selectCourse(course: any) {
  selectedCourse.value = course
  roomCode.value = generateRoomCode()
  showRoomCode.value = true

  studentUrl.value = `http://${hostname}:3003?room=${roomCode.value}`
  screenUrl.value = `http://${hostname}:3001?room=${roomCode.value}`

  await nextTick()
  drawQrCode()
}

function drawQrCode() {
  const canvas = qrCanvas.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')!
  const size = 160
  canvas.width = size
  canvas.height = size

  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, size, size)

  const url = studentUrl.value
  const cellSize = 4
  const offset = 16

  ctx.fillStyle = '#1677ff'
  ctx.fillRect(offset, offset, 28, 28)
  ctx.fillRect(size - offset - 28, offset, 28, 28)
  ctx.fillRect(offset, size - offset - 28, 28, 28)

  ctx.fillStyle = '#fff'
  ctx.fillRect(offset + 4, offset + 4, 20, 20)
  ctx.fillRect(size - offset - 24, offset + 4, 20, 20)
  ctx.fillRect(offset + 4, size - offset - 24, 20, 20)

  ctx.fillStyle = '#1677ff'
  ctx.fillRect(offset + 8, offset + 8, 12, 12)
  ctx.fillRect(size - offset - 20, offset + 8, 12, 12)
  ctx.fillRect(offset + 8, size - offset - 20, 12, 12)

  const hash = simpleHash(url)
  for (let i = 0; i < 20; i++) {
    for (let j = 0; j < 20; j++) {
      if ((hash * (i * 20 + j + 1)) % 3 === 0) {
        const x = 48 + j * cellSize
        const y = 48 + i * cellSize
        if (x < size - 48 && y < size - 48) {
          ctx.fillRect(x, y, cellSize - 1, cellSize - 1)
        }
      }
    }
  }

  ctx.fillStyle = '#1a1a2e'
  ctx.font = 'bold 14px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(roomCode.value, size / 2, size / 2 + 5)
}

function simpleHash(s: string) {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

function enterClassroom() {
  router.push({
    name: 'TeacherControl',
    query: {
      courseId: selectedCourse.value.id,
      courseName: selectedCourse.value.name,
      subject: selectedCourse.value.subject,
      roomCode: roomCode.value,
    },
  })
}
</script>

<style scoped lang="scss">
.course-select {
  min-height: 100vh;
  background: var(--bg-page);
  padding: 24px 20px;
  padding-bottom: 40px;
}

.select-header {
  margin-bottom: 24px;
  h1 { font-size: 24px; font-weight: 700; color: var(--text-primary); margin-bottom: 4px; }
  p { font-size: 14px; color: var(--text-secondary); }
}

.today-label {
  display: flex; align-items: center; gap: 6px;
  font-size: 13px; font-weight: 600; color: var(--text-secondary); margin-bottom: 12px;
}

.course-list { display: flex; flex-direction: column; gap: 10px; margin-bottom: 32px; }

.course-card {
  display: flex; align-items: center; gap: 14px; padding: 16px;
  background: var(--bg-card); border: 1px solid var(--border); border-radius: 16px;
  cursor: pointer; transition: all 0.2s; text-align: left;
  box-shadow: 0 1px 3px rgba(0,0,0,0.04);
  &:active { transform: scale(0.99); background: var(--bg-hover, #f0f5ff); }

  .course-color { width: 4px; height: 48px; border-radius: 2px; flex-shrink: 0; }

  .course-info {
    flex: 1;
    h3 { font-size: 15px; font-weight: 600; color: var(--text-primary); margin: 0 0 4px; }
    .course-meta { font-size: 12px; color: var(--text-secondary); margin: 0 0 2px; .dot { margin: 0 4px; } }
    .course-time { font-size: 12px; color: var(--primary); margin: 0; font-weight: 500; }
  }

  .course-arrow { color: var(--text-muted); flex-shrink: 0; }
}

.room-code-view { animation: fadeIn 0.3s ease; }

@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

.room-header {
  margin-bottom: 24px;
  h2 { font-size: 20px; font-weight: 700; color: var(--text-primary); margin-bottom: 4px; }
  p { font-size: 13px; color: var(--text-secondary); }
}

.room-card {
  background: var(--bg-card); border-radius: 20px; padding: 32px 24px;
  text-align: center; box-shadow: 0 4px 16px rgba(0,0,0,0.06);

  h3 { font-size: 14px; color: var(--text-secondary); margin-bottom: 16px; }
}

.code-display {
  display: flex; justify-content: center; gap: 8px; margin-bottom: 8px;

  .code-digit {
    width: 44px; height: 56px; display: flex; align-items: center; justify-content: center;
    background: var(--primary-light); border: 2px solid var(--primary);
    border-radius: 12px; font-size: 28px; font-weight: 700; color: var(--primary);
    letter-spacing: 0;
  }
}

.code-hint { font-size: 12px; color: var(--text-muted); margin-bottom: 24px; }

.qr-area {
  display: flex; flex-direction: column; align-items: center; gap: 8px;
  padding: 16px 0; border-top: 1px solid var(--border);

  .qr-canvas {
    width: 160px; height: 160px; border-radius: 12px;
    border: 1px solid var(--border);
  }
  .qr-hint { font-size: 11px; color: var(--text-muted); }
}

.join-urls {
  margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--border);
  display: flex; flex-direction: column; gap: 8px;
}

.url-item {
  display: flex; align-items: center; gap: 8px; text-align: left;
  padding: 8px 12px; background: var(--bg-page); border-radius: 10px;

  .url-label {
    font-size: 11px; color: var(--text-muted); width: 50px; flex-shrink: 0; font-weight: 500;
  }
  .url-val {
    font-size: 11px; color: var(--primary); word-break: break-all; font-family: monospace;
  }
}

.room-actions {
  display: flex; gap: 12px; margin-top: 24px;
}

.back-btn {
  display: flex; align-items: center; gap: 4px;
  padding: 14px 20px; border: 1px solid var(--border); border-radius: 14px;
  background: var(--bg-card); color: var(--text-primary); font-size: 14px; font-weight: 500;
  cursor: pointer; min-height: 48px;
  &:active { background: var(--bg-page); }
}

.start-btn {
  flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px;
  padding: 14px; border: none; border-radius: 14px;
  background: linear-gradient(135deg, var(--primary), #4096ff);
  color: #fff; font-size: 16px; font-weight: 700; cursor: pointer; min-height: 48px;
  &:active { transform: scale(0.98); }
}
</style>
