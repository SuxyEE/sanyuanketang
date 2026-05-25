<template>
  <div class="teacher-video">
    <div class="video-placeholder">
      <div class="avatar-circle">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor" opacity="0.6">
          <circle cx="12" cy="7" r="4"/>
          <path d="M5.5 21a6.5 6.5 0 0 1 13 0"/>
        </svg>
      </div>
      <div class="teacher-label">教师</div>
    </div>
    <div class="video-status">
      <div class="wave-bars">
        <span v-for="i in 5" :key="i" class="bar" :style="{ animationDelay: `${i * 0.1}s` }"></span>
      </div>
      <span class="status-text">正在讲课中...</span>
    </div>
    <div class="video-controls" role="toolbar" aria-label="视频控制">
      <button class="ctrl-btn" aria-label="暂停"><span v-html="pauseIcon" aria-hidden="true"></span></button>
      <button class="ctrl-btn" aria-label="消息"><span v-html="msgIcon" aria-hidden="true"></span></button>
      <button class="ctrl-btn" aria-label="麦克风"><span v-html="micIcon" aria-hidden="true"></span></button>
      <button class="ctrl-btn record" aria-label="录制"><span v-html="circleIcon" aria-hidden="true"></span></button>
    </div>
    <div class="student-count">
      <span class="count-num">{{ onlineCount }}</span>
      <span class="count-label">/ {{ totalCount }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { icons } from '@snyuan/shared'

defineProps<{
  onlineCount: number
  totalCount: number
}>()

const pauseIcon = icons.pause
const msgIcon = icons.messageCircle
const micIcon = icons.mic
const circleIcon = icons.circle
</script>

<style scoped lang="scss">
.teacher-video {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: 16px;
  backdrop-filter: var(--blur-md);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.video-placeholder {
  width: 100%;
  aspect-ratio: 4/3;
  background: linear-gradient(180deg, rgba(15, 20, 50, 0.9), rgba(10, 15, 35, 0.95));
  border-radius: var(--radius-md);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 1px solid rgba(255, 255, 255, 0.04);
}

.avatar-circle {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background: linear-gradient(135deg, rgba(65, 120, 255, 0.2), rgba(0, 212, 255, 0.1));
  border: 2px solid rgba(65, 120, 255, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--accent-cyan);
}

.teacher-label {
  color: var(--text-secondary);
  font-size: 12px;
}

.video-status {
  display: flex;
  align-items: center;
  gap: 8px;
}

.wave-bars {
  display: flex;
  align-items: center;
  gap: 2px;
  height: 16px;
}

.bar {
  width: 3px;
  height: 8px;
  background: var(--accent-green);
  border-radius: 2px;
  animation: wave 0.8s ease-in-out infinite alternate;
}

@keyframes wave {
  from { height: 4px; }
  to { height: 14px; }
}

.status-text {
  color: var(--text-secondary);
  font-size: 11px;
}

.video-controls {
  display: flex;
  gap: 8px;
}

.ctrl-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 1px solid var(--border-color);
  background: rgba(17, 25, 66, 0.6);
  color: var(--text-primary);
  font-size: 14px;
  cursor: pointer;
  transition: all var(--transition-fast);
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    border-color: var(--accent-blue);
    background: rgba(65, 120, 255, 0.15);
  }

  &.record {
    color: var(--accent-red);
    border-color: rgba(255, 82, 82, 0.3);
  }
}

.student-count {
  color: var(--accent-cyan);
  font-size: 14px;

  .count-num {
    font-weight: 700;
    font-size: 18px;
  }

  .count-label {
    color: var(--text-muted);
    font-weight: 400;
  }
}
</style>
