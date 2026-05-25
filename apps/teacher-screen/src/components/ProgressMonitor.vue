<template>
  <div class="progress-monitor">
    <div class="monitor-header">
      <div class="header-left">
        <span class="monitor-icon" v-html="signalIcon" aria-hidden="true"></span>
        <span class="monitor-title">【数字化设计智慧实训室】实时练习监控</span>
      </div>
      <div class="header-right">
        <button class="tab-btn active">实操进度</button>
        <button class="tab-btn">模型质量热力</button>
      </div>
    </div>
    <div class="progress-grid">
      <div
        v-for="student in store.students"
        :key="student.id"
        class="student-cell"
        :class="student.state"
        :title="`${student.name}: ${student.progress}%`"
      >
        <div class="cell-fill" :style="{ width: `${student.progress}%` }"></div>
      </div>
    </div>
    <div class="monitor-legend">
      <div class="legend-item">
        <span class="legend-dot submitted"></span>
        <span>随堂小测</span>
      </div>
      <div class="legend-item">
        <span class="legend-dot working"></span>
        <span>互动抢答</span>
      </div>
      <div class="legend-item">
        <span class="legend-dot online"></span>
        <span>优秀作业下发</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useClassroomStore } from '../stores/classroom'
import { icons } from '@snyuan/shared'
const store = useClassroomStore()
const signalIcon = icons.signal
</script>

<style scoped lang="scss">
.progress-monitor {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: 14px 20px;
  backdrop-filter: var(--blur-md);
}

.monitor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.monitor-icon {
  font-size: 14px;
}

.monitor-title {
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 500;
}

.header-right {
  display: flex;
  gap: 8px;
}

.tab-btn {
  padding: 4px 14px;
  border-radius: 14px;
  border: 1px solid var(--border-color);
  background: transparent;
  color: var(--text-secondary);
  font-size: 11px;
  cursor: pointer;
  transition: all var(--transition-fast);

  &.active {
    background: rgba(65, 120, 255, 0.15);
    border-color: var(--accent-blue);
    color: var(--accent-blue);
  }

  &:hover:not(.active) {
    border-color: var(--text-muted);
  }
}

.progress-grid {
  display: flex;
  gap: 3px;
  flex-wrap: wrap;
}

.student-cell {
  width: calc((100% - 47 * 3px) / 48);
  min-width: 12px;
  height: 20px;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.04);
  overflow: hidden;
  position: relative;
  transition: all var(--transition-fast);

  &:hover {
    transform: scaleY(1.5);
    z-index: 1;
  }

  .cell-fill {
    position: absolute;
    left: 0;
    top: 0;
    height: 100%;
    border-radius: 3px;
    transition: width 0.6s ease;
  }

  &.submitted .cell-fill {
    background: linear-gradient(90deg, var(--accent-green), #69f0ae);
  }

  &.working .cell-fill {
    background: linear-gradient(90deg, var(--accent-orange), #ffc107);
  }

  &.online .cell-fill {
    background: rgba(255, 255, 255, 0.1);
  }

  &.offline {
    opacity: 0.3;
  }
}

.monitor-legend {
  display: flex;
  gap: 20px;
  margin-top: 10px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--text-secondary);
  font-size: 11px;
}

.legend-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;

  &.submitted { background: var(--accent-green); }
  &.working { background: var(--accent-orange); }
  &.online { background: var(--text-muted); }
}
</style>
