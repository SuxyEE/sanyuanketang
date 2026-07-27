<template>
  <div class="monitor-page">
    <div class="monitor-header">
      <div class="header-left">
        <h2>实时课堂监控</h2>
        <el-tag :type="isConnected ? 'success' : 'danger'" effect="dark" round>
          <span class="live-dot-small"></span>
          {{ isConnected ? `已连接 · ${rooms.length} 个课堂` : '未连接' }}
        </el-tag>
      </div>
      <div class="header-actions">
        <el-button size="small" @click="refreshRooms" :icon="Refresh">刷新</el-button>
        <el-button size="small" type="primary" @click="showBroadcastDialog = true">全局广播</el-button>
      </div>
    </div>

    <el-row :gutter="16">
      <el-col :span="16">
        <div class="classroom-grid">
          <el-card
            v-for="room in allClassrooms"
            :key="room.id"
            shadow="hover"
            class="classroom-card"
          >
            <div class="room-header">
              <div class="room-status">
                <span class="status-dot" :class="{ live: room.live }"></span>
                <span class="room-name">{{ room.name }}</span>
              </div>
              <el-tag size="small" :type="room.activity === '随堂测验' ? 'warning' : 'primary'">
                {{ room.activity }}
              </el-tag>
            </div>
            <div class="room-body">
              <div class="room-info-row">
                <el-icon><User /></el-icon>
                <span>{{ room.teacher }}</span>
              </div>
              <div class="room-info-row">
                <el-icon><Collection /></el-icon>
                <span>{{ room.class }}</span>
              </div>
              <div class="room-stats">
                <div class="room-stat">
                  <span class="stat-num">{{ room.online }}</span>
                  <span class="stat-text">在线</span>
                </div>
                <div class="room-stat">
                  <span class="stat-num">{{ room.total }}</span>
                  <span class="stat-text">总人数</span>
                </div>
                <div class="room-stat">
                  <span class="stat-num">{{ room.completion }}%</span>
                  <span class="stat-text">完成率</span>
                </div>
              </div>
              <el-progress :percentage="room.completion" :stroke-width="8" />
            </div>
            <div class="room-footer">
              <el-button text size="small" type="primary" @click="viewDetail(room)">查看详情</el-button>
              <el-button text size="small" @click="sendNotification(room)">发送通知</el-button>
            </div>
          </el-card>
        </div>
      </el-col>

      <el-col :span="8">
        <el-card shadow="never" class="event-feed-card">
          <template #header>
            <div class="feed-header">
              <span>实时事件</span>
              <el-badge :value="liveEvents.length" :max="99" type="primary" />
            </div>
          </template>
          <div class="event-list">
            <div v-if="liveEvents.length === 0" class="empty-events">
              <p>暂无实时事件</p>
              <p class="sub">课堂中的操作会实时显示在这里</p>
            </div>
            <div v-for="(evt, idx) in liveEvents.slice(0, 20)" :key="idx" class="event-item" :class="evt.type">
              <span class="event-dot" :class="evt.type"></span>
              <div class="event-content">
                <span class="event-msg">{{ evt.message }}</span>
                <span class="event-time">{{ evt.time }}</span>
              </div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-dialog v-model="showBroadcastDialog" title="全局广播" width="400px">
      <el-input v-model="broadcastText" type="textarea" :rows="3" placeholder="输入广播内容..." />
      <template #footer>
        <el-button @click="showBroadcastDialog = false">取消</el-button>
        <el-button type="primary" @click="handleBroadcast">发送广播</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { Refresh } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { useAdminSocket } from '../composables/useAdminSocket'

const router = useRouter()
const { isConnected, rooms, liveEvents, sendBroadcast, refreshRooms } = useAdminSocket()

const showBroadcastDialog = ref(false)
const broadcastText = ref('')

const staticClassrooms = ref([
  { id: '1', name: '工业机器人编程实训', teacher: '李明', class: '机器人2401班', online: 42, total: 45, completion: 60, activity: '实操练习', live: true },
  { id: '2', name: '三维建模基础', teacher: '王芳', class: '数设2401班', online: 38, total: 40, completion: 45, activity: 'AI实践', live: true },
  { id: '3', name: 'PLC控制技术', teacher: '张伟', class: '智控2402班', online: 44, total: 48, completion: 75, activity: '随堂测验', live: true },
  { id: '4', name: '网络设备配置', teacher: '刘洋', class: '网络2401班', online: 35, total: 38, completion: 30, activity: '知识讲解', live: true },
  { id: '5', name: '新能源汽车电控', teacher: '陈磊', class: '新能源2401班', online: 40, total: 42, completion: 55, activity: '分组讨论', live: true },
  { id: '6', name: '化工单元操作', teacher: '赵敏', class: '化工2401班', online: 28, total: 30, completion: 82, activity: '案例分析', live: true },
])

const allClassrooms = computed(() => {
  const wsRooms = rooms.value
    .filter(r => r.lessonId !== 'admin-monitor')
    .map(r => ({
      id: r.roomId,
      name: r.lessonId,
      teacher: r.members.find(m => m.role === 'teacher')?.userName || '教师',
      class: r.className || r.context?.className || r.schoolName || r.context?.schoolName || '-',
      online: r.studentCount,
      total: Math.max(r.studentCount, 1),
      completion: Math.round((r.currentSlide / Math.max(r.totalSlides, 1)) * 100),
      activity: r.isLocked ? '锁屏' : '授课中',
      live: true,
    }))

  return wsRooms.length > 0 ? [...wsRooms, ...staticClassrooms.value] : staticClassrooms.value
})

async function handleBroadcast() {
  if (!broadcastText.value.trim()) return
  const text = broadcastText.value
  broadcastText.value = ''
  showBroadcastDialog.value = false
  const result = await sendBroadcast(text)
  if (result.lessonsReached < 0) {
    ElMessage.warning('广播已发送，但未收到服务端确认')
  } else if (result.lessonsReached === 0) {
    ElMessage.info('暂无活动课堂可送达广播')
  } else {
    ElMessage.success(`广播已下发到 ${result.lessonsReached} 个课堂`)
  }
}

function viewDetail(room: any) {
  router.push({ name: 'ClassroomLive', params: { roomId: room.id } })
}

function sendNotification(room: any) {
  ElMessage.success(`已向「${room.name}」发送通知`)
}
</script>

<style scoped>
.monitor-page {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.monitor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.monitor-header h2 {
  font-size: 18px;
  margin: 0;
}

.live-dot-small {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #fff;
  margin-right: 4px;
  animation: blink 1.5s infinite;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

.classroom-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
}

.classroom-card {
  transition: transform 0.2s;
}

.classroom-card:hover {
  transform: translateY(-2px);
}

.room-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.room-status {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #999;
}

.status-dot.live {
  background: #52c41a;
  animation: blink 1.5s infinite;
}

.room-name {
  font-weight: 600;
  font-size: 15px;
}

.room-info-row {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #666;
  font-size: 13px;
  margin-bottom: 6px;
}

.room-stats {
  display: flex;
  gap: 20px;
  margin: 12px 0;
}

.room-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stat-num {
  font-size: 20px;
  font-weight: 700;
  color: #1a1a2e;
}

.stat-text {
  font-size: 11px;
  color: #999;
}

.room-footer {
  display: flex;
  justify-content: space-between;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #f0f0f0;
}

.event-feed-card {
  height: 100%;
}

.feed-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.event-list {
  max-height: 500px;
  overflow-y: auto;
}

.empty-events {
  text-align: center;
  padding: 40px 0;
  color: #999;
}

.empty-events .sub {
  font-size: 12px;
  margin-top: 4px;
}

.event-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px 0;
  border-bottom: 1px solid #f5f5f5;
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateX(-8px); }
  to { opacity: 1; transform: translateX(0); }
}

.event-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-top: 5px;
  flex-shrink: 0;
  background: #1677ff;
}

.event-dot.quiz { background: #faad14; }
.event-dot.attendance { background: #52c41a; }
.event-dot.broadcast { background: #1677ff; }
.event-dot.hand { background: #fa541c; }
.event-dot.question { background: #722ed1; }
.event-dot.answer { background: #13c2c2; }
.event-dot.lock { background: #ff4d4f; }
.event-dot.group { background: #52c41a; }
.event-dot.lesson { background: #eb2f96; }
.event-dot.member { background: #1677ff; }

.event-content {
  flex: 1;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
}

.event-msg {
  font-size: 13px;
  color: #333;
  line-height: 1.4;
}

.event-time {
  font-size: 11px;
  color: #999;
  white-space: nowrap;
  flex-shrink: 0;
}

</style>
