<template>
  <div class="ai-panel">
    <div class="ai-suggestion">
      <div class="suggestion-header">
        <span class="suggestion-icon" v-html="botIcon" aria-hidden="true"></span>
        <span class="suggestion-title">AI 临床助手</span>
        <span class="suggestion-time">{{ currentDate }} 实时分析中</span>
      </div>
      <div class="suggestion-body">
        <p class="suggestion-text">{{ store.aiSuggestion.content }}</p>
        <button class="suggestion-btn">
          {{ store.aiSuggestion.action }}
        </button>
      </div>
    </div>

    <div class="knowledge-section">
      <div class="section-header">
        <span class="section-icon" v-html="chartIcon" aria-hidden="true"></span>
        <span>核心知识点分布图</span>
      </div>
      <div class="knowledge-list">
        <div
          v-for="kp in store.knowledgePoints"
          :key="kp.name"
          class="knowledge-item"
        >
          <div class="kp-header">
            <span class="kp-name">{{ kp.name }}</span>
            <span class="kp-percent" :class="kp.status">{{ kp.percent }}%</span>
          </div>
          <div class="kp-bar-track">
            <div
              class="kp-bar-fill"
              :class="kp.status"
              :style="{ width: `${kp.percent}%` }"
            ></div>
          </div>
          <span class="kp-status-label" :class="kp.status">
            {{ statusLabel(kp.status) }}
          </span>
        </div>
      </div>
    </div>

    <div class="ai-hint-card">
      <p class="hint-text">点击生成"数字化仿真"案例</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useClassroomStore } from '../stores/classroom'
import { icons } from '@snyuan/shared'

const store = useClassroomStore()
const botIcon = icons.bot
const chartIcon = icons.barChart
const currentDate = new Date().toLocaleDateString('zh-CN')

function statusLabel(status: string) {
  const map: Record<string, string> = {
    mastered: '已掌握',
    practicing: '练习中',
    needs_improvement: '待提升',
  }
  return map[status] || status
}
</script>

<style scoped lang="scss">
.ai-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: 100%;
}

.ai-suggestion {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: 16px;
  backdrop-filter: var(--blur-md);
}

.suggestion-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.suggestion-icon {
  font-size: 16px;
}

.suggestion-title {
  color: var(--accent-green);
  font-size: 13px;
  font-weight: 600;
  flex: 1;
}

.suggestion-time {
  color: var(--text-muted);
  font-size: 10px;
}

.suggestion-text {
  color: var(--text-primary);
  font-size: 12px;
  line-height: 1.7;
  margin-bottom: 12px;
  padding: 10px;
  background: rgba(0, 230, 118, 0.05);
  border-radius: var(--radius-sm);
  border-left: 3px solid var(--accent-green);
}

.suggestion-btn {
  width: 100%;
  padding: 8px 16px;
  background: linear-gradient(135deg, rgba(0, 230, 118, 0.15), rgba(0, 212, 255, 0.1));
  border: 1px solid rgba(0, 230, 118, 0.3);
  border-radius: var(--radius-md);
  color: var(--accent-green);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);

  &:hover {
    background: linear-gradient(135deg, rgba(0, 230, 118, 0.25), rgba(0, 212, 255, 0.15));
    box-shadow: var(--glow-green);
  }
}

.knowledge-section {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: 16px;
  backdrop-filter: var(--blur-md);
  flex: 1;
}

.section-header {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 16px;
}

.section-icon {
  font-size: 14px;
}

.knowledge-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.knowledge-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.kp-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.kp-name {
  color: var(--text-primary);
  font-size: 12px;
}

.kp-percent {
  font-size: 12px;
  font-weight: 600;

  &.mastered { color: var(--accent-green); }
  &.practicing { color: var(--accent-orange); }
  &.needs_improvement { color: var(--accent-red); }
}

.kp-bar-track {
  width: 100%;
  height: 6px;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 3px;
  overflow: hidden;
}

.kp-bar-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.8s ease;

  &.mastered { background: linear-gradient(90deg, var(--accent-green), #69f0ae); }
  &.practicing { background: linear-gradient(90deg, var(--accent-orange), #ffc107); }
  &.needs_improvement { background: linear-gradient(90deg, var(--accent-red), #ff8a80); }
}

.kp-status-label {
  font-size: 10px;
  text-align: right;

  &.mastered { color: var(--accent-green); }
  &.practicing { color: var(--accent-orange); }
  &.needs_improvement { color: var(--accent-red); }
}

.ai-hint-card {
  background: var(--bg-card);
  border: 1px dashed var(--border-color);
  border-radius: var(--radius-lg);
  padding: 20px;
  text-align: center;
  backdrop-filter: var(--blur-sm);
}

.hint-text {
  color: var(--text-muted);
  font-size: 12px;
}
</style>
