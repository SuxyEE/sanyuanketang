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

      <div class="screen-bind-card" :class="{ bound: !!screenRoomCode }">
        <div class="screen-bind-main">
          <div class="screen-bind-icon">
            <svg v-if="screenRoomCode" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6 9 17l-5-5"/></svg>
            <svg v-else width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/></svg>
          </div>
          <div>
            <h2>{{ screenRoomCode ? '已绑定大屏' : '先绑定大屏会话' }}</h2>
            <p>{{ screenRoomCode ? `会话码 ${screenRoomCode}` : 'Web 模拟端请输入大屏显示的 6 位会话码，再选择课程。' }}</p>
          </div>
        </div>
        <div class="screen-bind-form">
          <input v-model="screenRoomInput" inputmode="numeric" maxlength="6" placeholder="6 位大屏码" @keydown.enter="bindScreenRoom" />
          <button @click="bindScreenRoom">{{ screenRoomCode ? '更新' : '绑定' }}</button>
        </div>
        <p v-if="screenBindError" class="screen-bind-error">{{ screenBindError }}</p>
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
          <img v-if="qrImage" :src="qrImage" class="qr-image" alt="学生加入二维码" />
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
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSocket } from '../composables/useSocket'

const router = useRouter()
const route = useRoute()
const { connect } = useSocket()

const today = new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })
const showRoomCode = ref(false)
const roomCode = ref('')
const selectedCourse = ref<any>(null)

const hostname = window.location.hostname || 'localhost'
const serverBase = import.meta.env.VITE_WS_URL || 'http://localhost:3000'
const initialRoomCode =
  typeof route.query.room === 'string' && /^\d{6}$/.test(route.query.room)
    ? route.query.room
    : typeof route.query.roomCode === 'string' && /^\d{6}$/.test(route.query.roomCode)
      ? route.query.roomCode
      : ''
const screenRoomCode = ref(initialRoomCode)
const screenRoomInput = ref(initialRoomCode)
const screenBindError = ref('')
const studentUrl = ref('')
const screenUrl = ref('')
const qrImage = computed(() =>
  roomCode.value ? `${serverBase}/api/v1/qr/classroom?room=${roomCode.value}&action=student&t=${roomCode.value}` : '',
)

const todayCourses = ref([
  { id: '1', name: '工业机器人编程实训', subject: '工业机器人技术', class: '机器人2401班', time: '14:30 - 15:15', color: '#1677ff' },
  { id: '2', name: '三维建模与逆向工程', subject: '数字化设计与制造', class: '数设2401班', time: '15:30 - 16:15', color: '#52c41a' },
  { id: '3', name: 'PLC控制技术基础', subject: '智能控制技术', class: '智控2402班', time: '16:30 - 17:15', color: '#722ed1' },
])

function bindScreenRoom() {
  const code = screenRoomInput.value.trim()
  if (!/^\d{6}$/.test(code)) {
    screenBindError.value = '请输入大屏上显示的 6 位会话码'
    return
  }
  screenRoomCode.value = code
  screenBindError.value = ''
  connectScreenPreview(code)
}

function connectScreenPreview(code: string) {
  const s = connect(code, 'teacher-001', '教师')
  s.off('room:join:error', handleJoinError)
  s.on('room:join:error', handleJoinError)
}

function handleJoinError(data: { message?: string }) {
  screenBindError.value = data?.message || '接管大屏失败，请确认大屏已打开该会话码'
}

if (initialRoomCode) {
  connectScreenPreview(initialRoomCode)
}

function selectCourse(course: any) {
  if (!screenRoomCode.value) {
    screenBindError.value = '请先绑定大屏会话码'
    return
  }
  selectedCourse.value = course
  roomCode.value = screenRoomCode.value
  showRoomCode.value = true

  studentUrl.value = `http://${hostname}:3003?room=${roomCode.value}`
  screenUrl.value = `http://${hostname}:3001?room=${roomCode.value}`
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

.screen-bind-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 16px;
  margin-bottom: 14px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.04);
}

.screen-bind-card.bound {
  border-color: rgba(82, 196, 26, 0.45);
  background: linear-gradient(180deg, rgba(82,196,26,0.08), var(--bg-card));
}

.screen-bind-main {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;

  h2 { font-size: 15px; font-weight: 700; color: var(--text-primary); margin: 0 0 3px; }
  p { font-size: 12px; color: var(--text-secondary); margin: 0; line-height: 1.5; }
}

.screen-bind-icon {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--primary);
  background: var(--primary-light);
  flex-shrink: 0;
}

.screen-bind-card.bound .screen-bind-icon {
  color: #389e0d;
  background: #f6ffed;
}

.screen-bind-form {
  display: flex;
  gap: 8px;

  input {
    flex: 1;
    min-width: 0;
    height: 42px;
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 0 12px;
    font-size: 15px;
    letter-spacing: 0;
    outline: none;
    background: var(--bg-page);

    &:focus { border-color: var(--primary); background: #fff; }
  }

  button {
    width: 76px;
    border: none;
    border-radius: 12px;
    color: #fff;
    background: var(--primary);
    font-weight: 700;
    cursor: pointer;
  }
}

.screen-bind-error {
  margin: 8px 0 0;
  font-size: 12px;
  color: var(--danger);
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

  .qr-image {
    width: 160px; height: 160px; border-radius: 12px;
    border: 1px solid var(--border);
    background: #fff;
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
