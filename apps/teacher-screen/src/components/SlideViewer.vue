<template>
  <div class="slide-viewer">
    <div class="slide-header">
      <span class="section-tag">实时互动</span>
      <span class="section-title">{{ store.sectionTitle }}</span>
      <span class="slide-count" v-if="store.totalSlides > 0">{{ store.currentSlide }}/{{ store.totalSlides }}</span>
    </div>

    <div class="slide-main">
      <div v-if="store.slides.length > 0 && currentSlideData" class="slide-image-container">
        <img :src="currentSlideData.dataUrl" alt="课件" class="slide-img" />
      </div>
      <div v-else class="slide-empty">
        <div class="chat-area">
          <div
            v-for="(msg, idx) in store.aiMessages"
            :key="idx"
            class="chat-bubble"
            :class="msg.role"
          >
            <div class="chat-avatar" v-if="msg.role === 'user'">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="7" r="4"/><path d="M5.5 21a6.5 6.5 0 0 1 13 0"/></svg>
            </div>
            <div class="chat-avatar ai" v-else>AI</div>
            <div class="chat-content">
              <div class="chat-role">{{ msg.role === 'user' ? '教师提问' : 'AI 课堂助手' }}</div>
              <div class="chat-text">{{ msg.content }}</div>
              <div class="chat-time">{{ msg.time }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useClassroomStore } from '../stores/classroom'

const store = useClassroomStore()

const currentSlideData = computed(() => {
  if (store.slides.length === 0) return null
  return store.slides[store.currentSlide - 1] || null
})
</script>

<style scoped lang="scss">
.slide-viewer {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: 16px;
  backdrop-filter: var(--blur-md);
  height: 100%;
  display: flex;
  flex-direction: column;
}

.slide-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}

.section-tag {
  padding: 3px 10px;
  background: linear-gradient(135deg, var(--accent-blue), var(--accent-cyan));
  border-radius: 12px;
  color: #fff;
  font-size: 11px;
  font-weight: 600;
}

.section-title {
  color: var(--text-primary);
  font-size: 15px;
  font-weight: 600;
  flex: 1;
}

.slide-count {
  color: var(--text-muted);
  font-size: 12px;
  padding: 2px 10px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 10px;
  border: 1px solid var(--border-color);
}

.slide-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.slide-image-container {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-md);
  overflow: hidden;
  background: #000;

  .slide-img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
}

.slide-empty { flex: 1; display: flex; flex-direction: column; }

.chat-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 14px;
  overflow-y: auto;
  padding-right: 4px;

  &::-webkit-scrollbar { width: 3px; }
  &::-webkit-scrollbar-thumb { background: var(--border-color); border-radius: 3px; }
}

.chat-bubble {
  display: flex;
  gap: 10px;
  animation: fadeIn 0.4s ease;

  &.user .chat-content {
    background: linear-gradient(135deg, rgba(65, 120, 255, 0.2), rgba(0, 212, 255, 0.1));
    border: 1px solid rgba(65, 120, 255, 0.25);
  }

  &.assistant .chat-content {
    background: rgba(20, 28, 58, 0.8);
    border: 1px solid rgba(255, 255, 255, 0.06);
  }
}

.chat-avatar {
  width: 32px; height: 32px; border-radius: 50%;
  background: linear-gradient(135deg, var(--accent-blue), var(--accent-cyan));
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; color: #fff; font-size: 10px; font-weight: 700;
  &.ai { background: linear-gradient(135deg, var(--accent-green), var(--accent-cyan)); }
}

.chat-content { flex: 1; padding: 12px 14px; border-radius: var(--radius-md); }
.chat-role { color: var(--text-muted); font-size: 11px; margin-bottom: 6px; }
.chat-text { color: var(--text-primary); font-size: 13px; line-height: 1.6; }
.chat-time { color: var(--text-muted); font-size: 10px; margin-top: 6px; text-align: right; }

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
