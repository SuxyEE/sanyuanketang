<template>
  <view class="page">
    <view class="topbar">
      <view class="brand">
        <view class="brand-mark"><Icon name="logo" size="lg" /></view>
        <view>
          <text class="brand-title">三元课堂</text>
          <text class="brand-subtitle">{{ today }}</text>
        </view>
      </view>
      <view class="status-pill">
        <Icon name="monitor" size="sm" />
        <text>平板授课</text>
      </view>
    </view>

    <view v-if="!selectedCourse" class="content">
      <view class="headline">
        <text class="headline-title">接管大屏并选择课程</text>
        <text class="headline-desc">先扫描大屏二维码建立课堂会话，再选择今天要上的课程。</text>
      </view>

      <view class="screen-bind-card" :class="{ bound: !!screenRoomCode }">
        <view class="screen-bind-main">
          <Icon :name="screenRoomCode ? 'check-circle' : 'tv'" size="xl" :tone="screenRoomCode ? 'success' : 'primary'" />
          <view>
            <text class="screen-bind-title">{{ screenRoomCode ? '已接管大屏' : '请先接管教室大屏' }}</text>
            <text class="screen-bind-desc">{{ screenRoomCode ? `会话码 ${screenRoomCode}` : '扫描大屏上的教师二维码，绑定本节课会话。' }}</text>
          </view>
        </view>
        <Button variant="secondary" size="md" icon-left="radio-tower" @tap="scanScreenQr">
          {{ screenRoomCode ? '重新扫码' : '扫码接管' }}
        </Button>
      </view>

      <view class="course-list">
        <button
          v-for="course in todayCourses"
          :key="course.id"
          class="course-card"
          hover-class="card-press"
          hover-stay-time="80"
          @tap="selectCourse(course)"
        >
          <view class="course-accent" :style="{ background: course.color }"></view>
          <view class="course-main">
            <text class="course-name">{{ course.name }}</text>
            <text class="course-meta">{{ course.subject }} · {{ course.className }}</text>
            <view class="course-foot">
              <view class="time-chip">
                <Icon name="clock" size="xs" />
                <text>{{ course.time }}</text>
              </view>
              <text class="course-room">{{ course.room }}</text>
            </view>
          </view>
          <Icon name="chevron-right" size="md" tone="muted" />
        </button>
      </view>
    </view>

    <view v-else class="content room-content">
      <view class="room-head">
        <button class="icon-btn" hover-class="icon-press" @tap="selectedCourse = null">
          <Icon name="arrow-left" size="md" />
        </button>
        <view>
          <text class="room-title">{{ selectedCourse.name }}</text>
          <text class="room-subtitle">{{ selectedCourse.subject }} · {{ selectedCourse.className }}</text>
        </view>
      </view>

      <view class="room-card">
        <text class="room-label">课堂入口码</text>
        <view class="code-row">
          <view v-for="(digit, idx) in roomCodeDigits" :key="idx" class="code-box">
            <text>{{ digit }}</text>
          </view>
        </view>
        <text class="room-hint">学生端可扫码加入，也可以输入上方 6 位数字。</text>

        <view class="qr-box">
          <image v-if="qrImage" class="qr-image" :src="qrImage" mode="aspectFit" />
          <view v-else class="qr-loading">
            <Icon name="radio-tower" size="lg" tone="muted" />
            <text>二维码生成中</text>
          </view>
        </view>
        <text class="qr-caption">扫码内容：{{ qrPayload }}</text>

        <view class="url-list">
          <view class="url-item">
            <text class="url-label">学生端</text>
            <text class="url-text">{{ studentUrl }}</text>
          </view>
          <view class="url-item">
            <text class="url-label">大屏端</text>
            <text class="url-text">{{ screenUrl }}</text>
          </view>
        </view>

        <view class="waiting-box">
          <view class="waiting-head">
            <view class="waiting-title">
              <Icon :name="connected ? 'wifi' : 'wifi-off'" size="sm" />
              <text>{{ connected ? '等待学生加入' : '课堂连接中' }}</text>
            </view>
            <text class="waiting-count">{{ store.onlineCount }}/{{ store.totalCount }} 在线</text>
          </view>
          <view v-if="store.students.length === 0" class="waiting-empty">
            <text>学生输入课堂码后会显示在这里</text>
          </view>
          <view v-else class="student-tags">
            <view v-for="student in store.students.slice(0, 12)" :key="student.id" class="student-tag">
              <Icon name="user" size="xs" tone="primary" />
              <text>{{ student.name }}</text>
            </view>
          </view>
        </view>
      </view>

      <view class="action-row">
        <Button variant="secondary" size="lg" icon-left="download" @tap="copyEntryInfo">复制入口</Button>
        <Button variant="primary" size="lg" icon-right="arrow-right" @tap="enterClassroom">进入课堂</Button>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import Button from '@/components/ui/Button.vue'
import Icon from '@/components/ui/Icon.vue'
import { API_BASE, WS_URL } from '@/shared/config'
import { RoomEvent } from '@/shared/wsEvents'
import { useSocket } from '@/sockets/useSocket'
import { useClassroomStore } from '@/stores/classroom'
import { useSessionStore } from '@/stores/session'

interface Course {
  id: string
  name: string
  subject: string
  className: string
  room: string
  time: string
  color: string
}

const today = new Date().toLocaleDateString('zh-CN', {
  month: 'long',
  day: 'numeric',
  weekday: 'long',
})

const todayCourses = ref<Course[]>([
  { id: 'ind-vfd', name: '传送带变频调速控制', subject: '现代工业控制技术', className: '智控2401班', room: '工业控制实训室 · YTMDK-1', time: '09:00 - 09:45', color: '#e6a23c' },
  { id: 'ind-servo', name: 'V90 伺服精确定位', subject: '运动控制技术', className: '智控2401班', room: '工业控制实训室 · YTMDK-1', time: '10:00 - 10:45', color: '#1c7293' },
  { id: '1', name: '工业机器人编程实训', subject: '工业机器人技术', className: '机器人2401班', room: '实训楼 A302', time: '14:30 - 15:15', color: '#2f6bff' },
  { id: '2', name: '三维建模与逆向工程', subject: '数字化设计与制造', className: '数设2401班', room: '数字工坊 206', time: '15:30 - 16:15', color: '#20a546' },
  { id: '3', name: 'PLC 控制技术基础', subject: '智能控制技术', className: '智控2402班', room: '自动化实训室', time: '16:30 - 17:15', color: '#7c4dff' },
])

const selectedCourse = ref<Course | null>(null)
const roomCode = ref('')
const screenRoomCode = ref('')
const pendingScreenRoomCode = ref('')
const store = useClassroomStore()
const session = useSessionStore()
const { connected, connect, disconnect, getSocket } = useSocket()
let takeoverTimer: ReturnType<typeof setTimeout> | null = null

onMounted(() => {
  session.hydrate()
  const activeRole = session.activeRole || (session.roles.length === 1 ? session.roles[0] : undefined)
  if (!session.user) {
    uni.reLaunch({ url: '/pages/login/index' })
    return
  }
  if (!activeRole) {
    uni.reLaunch({ url: '/pages/role-select/index' })
    return
  }
  if (activeRole !== 'teacher') {
    uni.reLaunch({ url: '/pages/student/join/index' })
    return
  }
})

const roomCodeDigits = computed(() => roomCode.value.split(''))
const qrPayload = computed(() => `snyuan-classroom://join?room=${roomCode.value}`)
const qrImage = computed(() => roomCode.value ? `${WS_URL}/api/v1/qr/classroom?room=${roomCode.value}&t=${roomCode.value}` : '')
const studentUrl = computed(() => `${WS_URL.replace(':3000', ':5174')}/#/pages/join/index?room=${roomCode.value}`)
const screenUrl = computed(() => `${WS_URL.replace(':3000', ':3001')}?room=${roomCode.value}`)

function selectCourse(course: Course) {
  if (!screenRoomCode.value) {
    uni.showToast({ title: '请先扫码接管大屏', icon: 'none' })
    return
  }
  selectedCourse.value = course
  roomCode.value = screenRoomCode.value
  store.courseName = course.name
  store.lessonTitle = course.subject
  store.roomCode = roomCode.value
  store.students = []
  connectRoomPreview()
}

function readRoomFromText(text: string): string {
  const raw = String(text || '').trim()
  const teacherMatch = raw.match(/^snyuan-classroom:\/\/teacher\?room=([0-9]{6})(?:&.*)?$/i)
  if (teacherMatch) return teacherMatch[1]
  return ''
}

function scanScreenQr() {
  uni.scanCode({
    onlyFromCamera: true,
    scanType: ['qrCode'],
    success: (res) => {
      const code = readRoomFromText(res.result || '')
      if (!code) {
        uni.showToast({ title: '请扫描大屏教师接管码', icon: 'none' })
        return
      }
      startTakeover(code)
    },
    fail: () => {
      uni.showToast({ title: '扫码失败，请检查相机权限', icon: 'none' })
    },
  })
}

function resetTakeoverState() {
  pendingScreenRoomCode.value = ''
  screenRoomCode.value = ''
  roomCode.value = ''
  store.roomCode = ''
}

function probeClassroomService(code: string) {
  return new Promise<void>((resolve, reject) => {
    uni.request({
      url: `${API_BASE}/qr/classroom?room=${code}&action=teacher&probe=${Date.now()}`,
      method: 'GET',
      timeout: 5000,
      success: (res) => {
        const status = Number(res.statusCode || 0)
        if (status >= 200 && status < 400) resolve()
        else reject(new Error(`HTTP ${status}`))
      },
      fail: reject,
    })
  })
}

async function startTakeover(code: string) {
  if (takeoverTimer) { clearTimeout(takeoverTimer); takeoverTimer = null }
  pendingScreenRoomCode.value = code
  roomCode.value = code
  store.roomCode = code
  uni.showLoading({ title: '正在接管大屏' })
  try {
    await probeClassroomService(code)
    connectRoomPreview()
  } catch (err: any) {
    uni.hideLoading()
    resetTakeoverState()
    disconnect()
    uni.showModal({
      title: '无法连接课堂服务',
      content: `教师端访问不到 ${WS_URL}\n房间：${code}\n请确认手机和电脑在同一 Wi-Fi，或重新安装最新教师端。`,
      showCancel: false,
    })
    console.warn('[teacher takeover] service probe failed', err?.message || err)
  }
}

function copyEntryInfo() {
  const text = `课堂入口码：${roomCode.value}\n学生端：${studentUrl.value}\n大屏端：${screenUrl.value}`
  uni.setClipboardData({
    data: text,
    success: () => uni.showToast({ title: '入口已复制', icon: 'success' }),
  })
}

function enterClassroom() {
  if (!selectedCourse.value) return
  const query = [
    ['courseId', selectedCourse.value.id],
    ['courseName', selectedCourse.value.name],
    ['subject', selectedCourse.value.subject],
    ['roomCode', roomCode.value],
  ]
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join('&')
  uni.navigateTo({ url: `/pages/classroom/index?${query}` })
}

function connectRoomPreview() {
  if (takeoverTimer) clearTimeout(takeoverTimer)
  const s = connect({
    lessonId: roomCode.value,
    userId: session.user?.id || 'teacher-001',
    userName: session.user?.name || '教师',
  })
  s.off(RoomEvent.Joined, handleRoomJoined)
  s.off(RoomEvent.MemberUpdate, handleMemberUpdate)
  s.off(RoomEvent.JoinError, handleJoinError)
  s.off('connect_error', handleConnectError)
  s.on(RoomEvent.Joined, handleRoomJoined)
  s.on(RoomEvent.MemberUpdate, handleMemberUpdate)
  s.on(RoomEvent.JoinError, handleJoinError)
  s.on('connect_error', handleConnectError)
  if (!pendingScreenRoomCode.value) {
    takeoverTimer = null
    return
  }
  takeoverTimer = setTimeout(() => {
    const code = pendingScreenRoomCode.value
    if (!code) return
    uni.hideLoading()
    resetTakeoverState()
    uni.showModal({
      title: '接管超时',
      content: `已能访问课堂服务，但没有收到接管确认。\n服务：${WS_URL}\n房间：${code}\n请重新扫码；如果仍超时，请重新运行最新教师端。`,
      showCancel: false,
    })
  }, 8000)
}

function handleRoomJoined(data: any) {
  if (takeoverTimer) { clearTimeout(takeoverTimer); takeoverTimer = null }
  uni.hideLoading()
  if (pendingScreenRoomCode.value) {
    screenRoomCode.value = pendingScreenRoomCode.value
    pendingScreenRoomCode.value = ''
    uni.showToast({ title: '已接管大屏', icon: 'success' })
  }
  if (data?.members) store.updateMembers(data)
}

function handleMemberUpdate(data: any) {
  store.updateMembers(data)
}

function handleJoinError(data: { message?: string }) {
  if (takeoverTimer) { clearTimeout(takeoverTimer); takeoverTimer = null }
  uni.hideLoading()
  resetTakeoverState()
  disconnect()
  uni.showToast({ title: data?.message || '接管大屏失败', icon: 'none' })
}

function handleConnectError(err?: any) {
  if (!pendingScreenRoomCode.value) return
  if (takeoverTimer) { clearTimeout(takeoverTimer); takeoverTimer = null }
  uni.hideLoading()
  const code = pendingScreenRoomCode.value
  resetTakeoverState()
  disconnect()
  uni.showModal({
    title: '课堂连接失败',
    content: `服务：${WS_URL}\n房间：${code}\n${err?.message || '请检查教师端网络后重试。'}`,
    showCancel: false,
  })
}

onUnmounted(() => {
  if (takeoverTimer) { clearTimeout(takeoverTimer); takeoverTimer = null }
  const s = getSocket()
  if (!s) return
  s.off(RoomEvent.Joined, handleRoomJoined)
  s.off(RoomEvent.MemberUpdate, handleMemberUpdate)
  s.off(RoomEvent.JoinError, handleJoinError)
  s.off('connect_error', handleConnectError)
})
</script>

<style scoped lang="scss">
@import '@/styles/variables.scss';

.page {
  min-height: 100vh;
  padding: var(--space-5) var(--space-5) var(--space-8);
  background: var(--color-bg);
}

.topbar,
.brand,
.status-pill,
.course-card,
.course-foot,
.time-chip,
.room-head,
.action-row,
.url-item {
  display: flex;
  align-items: center;
}

.topbar {
  justify-content: space-between;
  margin-bottom: var(--space-7);
}

.brand {
  gap: var(--space-3);
}

.brand-mark {
  width: 72rpx;
  height: 72rpx;
  border-radius: var(--radius-lg);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-primary);
  background: var(--color-primary-container);
}

.brand-title,
.brand-subtitle,
.headline-title,
.headline-desc,
.course-name,
.course-meta,
.course-room,
.room-title,
.room-subtitle,
.room-label,
.room-hint,
.url-label,
.url-text {
  display: block;
}

.brand-title {
  font-size: var(--font-title-sm);
  font-weight: var(--font-weight-bold);
}

.brand-subtitle {
  font-size: var(--font-caption);
  color: var(--color-text-secondary);
}

.status-pill {
  min-height: 64rpx;
  gap: var(--space-2);
  padding: 0 var(--space-4);
  border-radius: var(--radius-pill);
  color: var(--color-on-primary-container);
  background: var(--color-primary-container);
  font-size: var(--font-caption);
  font-weight: var(--font-weight-semibold);
}

.content {
  max-width: 1040rpx;
  margin: 0 auto;
}

.headline {
  margin-bottom: var(--space-5);
}

.headline-title {
  font-size: var(--font-title-lg);
  font-weight: var(--font-weight-bold);
  line-height: var(--line-height-tight);
}

.headline-desc {
  margin-top: var(--space-2);
  color: var(--color-text-secondary);
  font-size: var(--font-body);
}

.screen-bind-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  margin-bottom: var(--space-5);
  padding: var(--space-4);
  border: 2rpx solid var(--color-outline);
  border-radius: var(--radius-xl);
  background: var(--color-surface);
  box-shadow: var(--elevation-1);
}

.screen-bind-card.bound {
  border-color: var(--color-success);
  background: var(--color-success-container);
}

.screen-bind-main {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.screen-bind-title,
.screen-bind-desc {
  display: block;
}

.screen-bind-title {
  color: var(--color-text-primary);
  font-size: var(--font-title-sm);
  font-weight: var(--font-weight-bold);
}

.screen-bind-desc {
  color: var(--color-text-secondary);
  font-size: var(--font-caption);
}

.course-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.course-card {
  width: 100%;
  min-height: 148rpx;
  gap: var(--space-4);
  padding: var(--space-4);
  border: 2rpx solid var(--color-outline);
  border-radius: var(--radius-xl);
  background: var(--color-surface);
  box-shadow: var(--elevation-1);
  text-align: left;
}

.card-press {
  transform: scale(0.985);
  background: var(--color-primary-container);
}

.course-accent {
  width: 8rpx;
  height: 92rpx;
  border-radius: var(--radius-pill);
  flex-shrink: 0;
}

.course-main {
  flex: 1;
}

.course-name {
  font-size: var(--font-title-sm);
  font-weight: var(--font-weight-bold);
}

.course-meta {
  margin-top: var(--space-1);
  color: var(--color-text-secondary);
  font-size: var(--font-label);
}

.course-foot {
  gap: var(--space-3);
  margin-top: var(--space-3);
}

.time-chip {
  gap: var(--space-1);
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-pill);
  background: var(--color-surface-variant);
  color: var(--color-primary);
  font-size: var(--font-caption);
  font-weight: var(--font-weight-semibold);
}

.course-room {
  color: var(--color-text-tertiary);
  font-size: var(--font-caption);
}

.room-content {
  max-width: 900rpx;
}

.room-head {
  gap: var(--space-3);
  margin-bottom: var(--space-5);
}

.icon-btn {
  width: var(--touch-min);
  height: var(--touch-min);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-pill);
  background: var(--color-surface);
  color: var(--color-text-primary);
  box-shadow: var(--elevation-1);
}

.icon-press {
  background: var(--color-state-overlay-press);
}

.room-title {
  font-size: var(--font-title);
  font-weight: var(--font-weight-bold);
}

.room-subtitle {
  color: var(--color-text-secondary);
  font-size: var(--font-label);
}

.room-card {
  padding: var(--space-6);
  border-radius: var(--radius-2xl);
  background: var(--color-surface);
  box-shadow: var(--elevation-2);
}

.room-label,
.room-hint {
  text-align: center;
}

.room-label {
  color: var(--color-text-secondary);
  font-size: var(--font-label);
  font-weight: var(--font-weight-semibold);
}

.code-row {
  display: flex;
  justify-content: center;
  gap: var(--space-2);
  margin: var(--space-4) 0 var(--space-3);
}

.code-box {
  width: 84rpx;
  height: 104rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 4rpx solid var(--color-primary);
  border-radius: var(--radius-lg);
  background: var(--color-primary-container);
  color: var(--color-primary);
  font-size: 56rpx;
  font-weight: var(--font-weight-bold);
  line-height: 1;
}

.room-hint {
  color: var(--color-text-tertiary);
  font-size: var(--font-caption);
}

.qr-box {
  width: 264rpx;
  height: 264rpx;
  margin: var(--space-5) auto;
  padding: 12rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2rpx solid var(--color-outline);
  border-radius: var(--radius-xl);
  background: var(--color-surface);
}

.qr-image {
  width: 100%;
  height: 100%;
}

.qr-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  color: var(--color-text-tertiary);
  font-size: var(--font-caption);
}

.qr-caption {
  display: block;
  margin: calc(-1 * var(--space-3)) 0 var(--space-4);
  color: var(--color-text-tertiary);
  font-size: var(--font-overline);
  text-align: center;
  word-break: break-all;
}

.url-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.url-item {
  gap: var(--space-3);
  min-height: 72rpx;
  padding: var(--space-3);
  border-radius: var(--radius-md);
  background: var(--color-surface-variant);
}

.url-label {
  width: 104rpx;
  color: var(--color-text-secondary);
  font-size: var(--font-caption);
  font-weight: var(--font-weight-semibold);
}

.url-text {
  flex: 1;
  color: var(--color-primary);
  font-size: var(--font-caption);
  word-break: break-all;
}

.waiting-box {
  margin-top: var(--space-4);
  padding: var(--space-3);
  border-radius: var(--radius-lg);
  background: var(--color-surface-variant);
}

.waiting-head,
.waiting-title,
.student-tag {
  display: flex;
  align-items: center;
}

.waiting-head {
  justify-content: space-between;
  gap: var(--space-3);
  margin-bottom: var(--space-3);
}

.waiting-title {
  gap: var(--space-2);
  color: var(--color-text-primary);
  font-size: var(--font-label);
  font-weight: var(--font-weight-bold);
}

.waiting-count {
  color: var(--color-primary);
  font-size: var(--font-caption);
  font-weight: var(--font-weight-semibold);
}

.waiting-empty {
  min-height: 72rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-tertiary);
  font-size: var(--font-caption);
}

.student-tags {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.student-tag {
  gap: var(--space-1);
  min-height: 56rpx;
  padding: 0 var(--space-3);
  border-radius: var(--radius-pill);
  background: var(--color-surface);
  color: var(--color-text-primary);
  font-size: var(--font-caption);
  font-weight: var(--font-weight-semibold);
}

.action-row {
  gap: var(--space-3);
  margin-top: var(--space-5);
}

.action-row :deep(.btn) {
  flex: 1;
}

@media (min-width: 900px) {
  .page {
    padding-left: var(--space-8);
    padding-right: var(--space-8);
  }

  .course-list {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .course-card {
    min-height: 240rpx;
    align-items: flex-start;
  }

  .course-foot {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
