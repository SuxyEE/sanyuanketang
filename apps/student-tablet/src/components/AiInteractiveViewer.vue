<template>
  <div class="ai-interactive-viewer" role="dialog" aria-label="AI 实践沙盘">
    <div class="viewer-header">
      <div class="header-left">
        <span class="badge">AI 实践</span>
        <h3 class="title">{{ scene.title }}</h3>
      </div>
      <button class="close-btn" @click="$emit('close')" aria-label="关闭">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>

    <p class="description">{{ scene.description }}</p>

    <div v-if="qualityIssues.length > 0" class="quality-banner" role="status" aria-live="polite">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
      <span>AI 内容提示：{{ qualityIssues[0] }}{{ qualityIssues.length > 1 ? ` 等 ${qualityIssues.length} 项` : '' }}</span>
    </div>

    <div class="iframe-shell">
      <iframe
        class="sandbox-iframe"
        sandbox="allow-scripts"
        :srcdoc="scene.html"
        :title="scene.title"
      ></iframe>
    </div>

    <p class="footer-hint">
      <span class="dot"></span>
      已安全沙箱化 · 没有外网访问 · 内容由 AI 实时生成
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  scene: {
    topic?: string
    title: string
    description: string
    html: string
    generatedAt?: string
    sanitizeStats?: {
      qualityIssues?: string[]
      autoFixedCssClasses?: number
      removedExternalScripts?: number
    }
  }
}>()

defineEmits<{ close: [] }>()

const qualityIssues = computed(() => {
  const issues = props.scene.sanitizeStats?.qualityIssues || []
  return issues.filter(s => typeof s === 'string' && s.length > 0)
})
</script>

<style scoped lang="scss">
.ai-interactive-viewer {
  position: fixed;
  inset: 0;
  z-index: 120;
  background: var(--bg-card, #fff);
  display: flex;
  flex-direction: column;
  padding: 16px;
  gap: 12px;
  animation: slideUp 0.25s ease-out;
}

@keyframes slideUp {
  from { transform: translateY(100%); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

.viewer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
  .badge {
    padding: 3px 10px;
    border-radius: 12px;
    background: linear-gradient(135deg, #1677ff, #722ed1);
    color: #fff;
    font-size: 11px;
    font-weight: 700;
    flex-shrink: 0;
  }
  .title {
    font-size: 16px;
    font-weight: 700;
    color: var(--text-primary, #262626);
    margin: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.close-btn {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: none;
  background: var(--bg-page, #f5f7fa);
  color: var(--text-secondary, #595959);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
}

.description {
  font-size: 12px;
  color: var(--text-secondary, #595959);
  margin: 0;
  line-height: 1.6;
}

.quality-banner {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  padding: 8px 12px;
  border-radius: 10px;
  background: linear-gradient(135deg, #fffbe6, #fff7d6);
  border: 1px solid #ffe58f;
  color: #874d00;
  font-size: 12px;
  line-height: 1.5;

  svg {
    flex-shrink: 0;
    margin-top: 1px;
    color: #faad14;
  }
}

.iframe-shell {
  flex: 1;
  border-radius: 16px;
  overflow: hidden;
  background: #f5f7fa;
  border: 1px solid var(--border, #e5e5e5);
  min-height: 0;
}

.sandbox-iframe {
  display: block;
  width: 100%;
  height: 100%;
  border: 0;
  background: #fff;
}

.footer-hint {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 11px;
  color: var(--text-muted, #8c8c8c);
  margin: 0;
  padding: 4px 0;

  .dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #52c41a;
    box-shadow: 0 0 0 3px rgba(82, 196, 26, 0.15);
  }
}
</style>
