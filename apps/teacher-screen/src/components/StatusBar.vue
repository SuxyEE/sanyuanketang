<template>
  <header class="status-bar">
    <div class="status-bar__left">
      <div class="live-badge" v-if="store.isLive">
        <span class="live-dot"></span>
        <span>直播授课中</span>
      </div>
      <div class="course-name">{{ store.courseName }}</div>
      <div class="divider">|</div>
      <div class="lesson-time">{{ store.lessonDate }} {{ store.startTime }} - {{ store.endTime }}</div>
    </div>
    <div class="status-bar__right">
      <div class="attendance">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
        <span>实到 <strong>{{ store.onlineStudents }}</strong>/{{ store.totalStudents }} 人</span>
      </div>
      <div class="conn-status" :class="{ online: store.isConnected }">
        <span class="conn-dot-s"></span>
        {{ store.isConnected ? '已连接' : '未连接' }}
      </div>
      <button class="info-btn">信息教学</button>
    </div>
  </header>
</template>

<script setup lang="ts">
import { useClassroomStore } from '../stores/classroom'
const store = useClassroomStore()
</script>

<style scoped lang="scss">
.status-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  height: 52px;
  background: linear-gradient(135deg, rgba(10, 14, 39, 0.95), rgba(17, 22, 55, 0.95));
  border-bottom: 1px solid var(--border-color);
  backdrop-filter: var(--blur-sm);

  &__left {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  &__right {
    display: flex;
    align-items: center;
    gap: 20px;
  }
}

.live-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 14px;
  background: linear-gradient(135deg, rgba(255, 82, 82, 0.2), rgba(255, 82, 82, 0.1));
  border: 1px solid rgba(255, 82, 82, 0.35);
  border-radius: 20px;
  color: var(--accent-red);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.5px;
}

.live-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent-red);
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.course-name {
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 600;
}

.divider {
  color: var(--text-muted);
  font-size: 12px;
}

.lesson-time {
  color: var(--text-secondary);
  font-size: 13px;
}

.attendance {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--text-secondary);
  font-size: 13px;

  strong {
    color: var(--accent-cyan);
  }

  svg {
    color: var(--accent-cyan);
  }
}

.conn-status {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  color: var(--text-muted);
  padding: 3px 10px;
  border-radius: 12px;
  border: 1px solid var(--border-color);

  .conn-dot-s {
    width: 6px; height: 6px; border-radius: 50%;
    background: var(--accent-red);
  }

  &.online {
    color: var(--accent-green);
    border-color: rgba(0, 230, 118, 0.3);
    .conn-dot-s {
      background: var(--accent-green);
      animation: pulse 1.5s ease infinite;
    }
  }
}

.info-btn {
  padding: 6px 16px;
  background: linear-gradient(135deg, var(--accent-green), #00c853);
  border: none;
  border-radius: 20px;
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-fast);

  &:hover {
    box-shadow: var(--glow-green);
    transform: translateY(-1px);
  }
}
</style>
