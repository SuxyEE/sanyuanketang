<template>
  <div class="activity-buttons" role="toolbar" aria-label="课堂活动工具栏">
    <button
      v-for="item in activities"
      :key="item.label"
      class="activity-btn"
      :aria-label="item.label"
      @click="$emit('select', item.key)"
    >
      <span class="activity-icon" v-html="item.icon" aria-hidden="true"></span>
      <span class="activity-label">{{ item.label }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { icons } from '@snyuan/shared'

defineEmits<{
  select: [key: string]
}>()

const activities = [
  { key: 'knowledge', icon: icons.play, label: '知识讲解' },
  { key: 'smart_quiz', icon: icons.zap, label: '智能出题' },
  { key: 'smart_paper', icon: icons.clipboard, label: '智能组卷' },
  { key: 'group_discuss', icon: icons.users, label: '分组讨论' },
  { key: 'case_extend', icon: icons.search, label: '案例扩展' },
  { key: 'ai_practice', icon: icons.bot, label: 'AI实践' },
  { key: 'report', icon: icons.barChart, label: '分析报告' },
]
</script>

<style scoped lang="scss">
.activity-buttons {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.activity-btn {
  flex: 1;
  min-width: 100px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 16px 12px;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  backdrop-filter: var(--blur-sm);
  cursor: pointer;
  transition: all var(--transition-normal);
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, rgba(65, 120, 255, 0.08), transparent);
    opacity: 0;
    transition: opacity var(--transition-normal);
  }

  &:hover {
    border-color: var(--border-active);
    transform: translateY(-2px);
    box-shadow: var(--glow-blue);

    &::before {
      opacity: 1;
    }

    .activity-icon {
      transform: scale(1.15);
    }
  }
}

.activity-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform var(--transition-normal);
  color: var(--accent-cyan);

  :deep(svg) {
    width: 24px;
    height: 24px;
  }
}

.activity-label {
  color: var(--text-primary);
  font-size: 12px;
  font-weight: 500;
}
</style>
