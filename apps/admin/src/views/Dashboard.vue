<template>
  <div class="dashboard">
    <div class="stat-cards">
      <el-card v-for="stat in computedStats" :key="stat.label" class="stat-card" shadow="hover">
        <div class="stat-icon" :style="{ background: stat.bg }">
          <el-icon :size="24" :color="stat.color"><component :is="stat.icon" /></el-icon>
        </div>
        <div class="stat-info">
          <div class="stat-value">{{ stat.value }}</div>
          <div class="stat-label">{{ stat.label }}</div>
        </div>
      </el-card>
    </div>

    <el-row :gutter="16" class="content-row">
      <el-col :span="16">
        <el-card shadow="never">
          <template #header>
            <div class="card-header">
              <span>当前进行中的课堂</span>
              <div class="header-right-area">
                <el-tag v-if="isConnected" type="success" size="small" effect="plain" round>
                  <span class="conn-dot"></span> 实时连接
                </el-tag>
                <el-tag v-else type="info" size="small" effect="plain" round>离线</el-tag>
                <el-button text type="primary" size="small" @click="$router.push('/monitor')">查看全部</el-button>
              </div>
            </div>
          </template>
          <div class="lesson-list">
            <div v-for="lesson in ongoingLessons" :key="lesson.id" class="lesson-item">
              <div class="lesson-status">
                <span class="live-dot"></span>
              </div>
              <div class="lesson-info">
                <h4>{{ lesson.name }}</h4>
                <p>{{ lesson.teacher }} · {{ lesson.class }}</p>
              </div>
              <div class="lesson-stats">
                <el-tag size="small" type="success">{{ lesson.online }}/{{ lesson.total }} 在线</el-tag>
                <el-progress :percentage="lesson.progress" :stroke-width="6" class="lesson-progress" />
              </div>
            </div>
          </div>
        </el-card>
      </el-col>

      <el-col :span="8">
        <el-card shadow="never">
          <template #header>
            <span>最近课堂动态</span>
          </template>
          <el-timeline>
            <el-timeline-item
              v-for="(item, idx) in computedTimeline"
              :key="idx"
              :timestamp="item.time"
              placement="top"
              :type="item.type"
            >
              {{ item.content }}
            </el-timeline-item>
          </el-timeline>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useAdminSocket } from '../composables/useAdminSocket'

const { isConnected, totalOnline, liveEvents } = useAdminSocket()

const ongoingLessons = [
  { id: '1', name: '工业机器人编程实训', teacher: '李老师', class: '机器人2401班', online: 42, total: 45, progress: 60 },
  { id: '2', name: '数字化设计基础', teacher: '王老师', class: '数设2401班', online: 38, total: 40, progress: 45 },
  { id: '3', name: 'PLC控制技术', teacher: '张老师', class: '智控2402班', online: 44, total: 48, progress: 75 },
  { id: '4', name: '计算机网络配置', teacher: '刘老师', class: '网络2401班', online: 35, total: 38, progress: 30 },
]

const computedStats = computed(() => [
  { label: '今日课堂数', value: 12, icon: 'Calendar', color: '#1677ff', bg: '#e6f4ff' },
  { label: '在线师生', value: totalOnline.value > 0 ? totalOnline.value : 386, icon: 'User', color: '#52c41a', bg: '#f6ffed' },
  { label: '课堂活跃率', value: '87%', icon: 'TrendCharts', color: '#faad14', bg: '#fffbe6' },
  { label: 'AI使用次数', value: 1240, icon: 'ChatDotRound', color: '#722ed1', bg: '#f9f0ff' },
])

const staticTimeline = [
  { time: '14:45', content: '张老师 在"PLC控制技术"课堂发起了随堂测验', type: 'primary' as const },
  { time: '14:32', content: '李老师 开始了"工业机器人编程实训"直播授课', type: 'success' as const },
  { time: '14:30', content: '4个课堂同时开课，386名师生在线', type: 'warning' as const },
  { time: '12:15', content: '上午课程全部结束，生成12份课堂报告', type: 'info' as const },
  { time: '10:30', content: '王老师的课堂AI助手使用次数达到50次', type: 'primary' as const },
]

const computedTimeline = computed(() => {
  const wsEvents = liveEvents.value.slice(0, 5).map(e => ({
    time: e.time,
    content: e.message,
    type: 'primary' as const,
  }))
  return wsEvents.length > 0 ? [...wsEvents, ...staticTimeline.slice(0, 3)] : staticTimeline
})
</script>

<style scoped>
.dashboard {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.stat-cards {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

@media (max-width: 1200px) {
  .stat-cards { grid-template-columns: repeat(2, 1fr); }
}

@media (max-width: 768px) {
  .stat-cards { grid-template-columns: 1fr; }
}

.stat-card {
  transition: transform 0.2s, box-shadow 0.2s;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
}

.stat-card :deep(.el-card__body) {
  display: flex;
  align-items: center;
  gap: 16px;
  width: 100%;
}

.stat-icon {
  width: 56px;
  height: 56px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.stat-value {
  font-size: 30px;
  font-weight: 700;
  color: #1a1a2e;
  line-height: 1.2;
}

.stat-label {
  font-size: 13px;
  color: #999;
  margin-top: 2px;
}

.content-row {
  margin-top: 0;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-right-area {
  display: flex;
  align-items: center;
  gap: 8px;
}

.conn-dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #52c41a;
  margin-right: 4px;
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.lesson-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.lesson-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: #fafbfc;
  border-radius: 8px;
  transition: background 0.2s;
}

.lesson-item:hover {
  background: #f0f5ff;
}

.lesson-status {
  flex-shrink: 0;
}

.live-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #52c41a;
  display: block;
  animation: pulse-ring 1.5s infinite;
}

@keyframes pulse-ring {
  0%, 100% { box-shadow: 0 0 0 0 rgba(82, 196, 26, 0.4); }
  50% { box-shadow: 0 0 0 6px rgba(82, 196, 26, 0); }
}

.lesson-info {
  flex: 1;
}

.lesson-info h4 {
  font-size: 14px;
  color: #1a1a2e;
  margin: 0 0 4px 0;
}

.lesson-info p {
  font-size: 12px;
  color: #999;
  margin: 0;
}

.lesson-stats {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 200px;
}

.lesson-progress {
  width: 100px;
}
</style>
