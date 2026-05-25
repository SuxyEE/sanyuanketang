<template>
  <div class="lesson-record" role="dialog" aria-label="课堂记录">
    <div class="panel-header">
      <h3>课堂记录</h3>
      <button class="close-btn" @click="$emit('close')" aria-label="关闭">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>

    <div class="panel-body">
      <div class="record-stats">
        <div class="stat-card">
          <span class="stat-num">45</span>
          <span class="stat-label">签到人数</span>
        </div>
        <div class="stat-card">
          <span class="stat-num">23</span>
          <span class="stat-label">互动次数</span>
        </div>
        <div class="stat-card">
          <span class="stat-num">12</span>
          <span class="stat-label">AI对话</span>
        </div>
        <div class="stat-card">
          <span class="stat-num">3</span>
          <span class="stat-label">测验发布</span>
        </div>
      </div>

      <div class="timeline-section">
        <h4>课堂时间线</h4>
        <div class="timeline">
          <div v-for="(event, idx) in timelineEvents" :key="idx" class="timeline-item" :class="event.type">
            <div class="timeline-dot"></div>
            <div class="timeline-content">
              <span class="timeline-time">{{ event.time }}</span>
              <span class="timeline-text">{{ event.text }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="ai-summary-section">
        <h4>AI课堂总结</h4>
        <div class="summary-card">
          <p>本节课主要讲授了<strong>三维建模与逆向工程</strong>的核心内容：</p>
          <ul>
            <li>逆向工程的基本流程：扫描→点云处理→曲面重构</li>
            <li>三维扫描仪的操作要点和精度要求</li>
            <li>NURBS曲面拟合方法的选择策略</li>
          </ul>
          <p>学生整体掌握度：<strong style="color: var(--primary)">72%</strong></p>
          <p>薄弱知识点：三维建模基础原理（42%掌握度）</p>
        </div>

        <button class="generate-btn" @click="generateQuiz">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
          基于课堂内容 AI 生成课后练习
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

defineEmits<{ close: [] }>()

const timelineEvents = ref([
  { time: '14:30', text: '课堂开始，45人签到', type: 'start' },
  { time: '14:32', text: '开始讲解"逆向工程基础"', type: 'teach' },
  { time: '14:38', text: '发起随堂测验（2道选择题）', type: 'quiz' },
  { time: '14:42', text: '测验结束，平均正确率 76%', type: 'result' },
  { time: '14:45', text: '发起分组讨论：6组 × 8人', type: 'discuss' },
  { time: '14:55', text: '讨论结束，AI生成讨论总结', type: 'ai' },
  { time: '15:00', text: '学生张同学举手提问', type: 'question' },
  { time: '15:05', text: '3名学生使用AI助手提问', type: 'ai' },
  { time: '15:10', text: '课堂结束', type: 'end' },
])

function generateQuiz() {
  console.log('Generate quiz from lesson content')
}
</script>

<style scoped lang="scss">
.lesson-record {
  position: fixed;
  inset: 0;
  z-index: 100;
  background: var(--bg-card);
  display: flex;
  flex-direction: column;
  animation: slideUp 0.25s ease-out;
}

@keyframes slideUp {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}

.panel-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 16px 20px; border-bottom: 1px solid var(--border);
  h3 { font-size: 17px; font-weight: 700; }
}

.close-btn {
  width: 44px; height: 44px; border-radius: 50%; border: none;
  background: var(--bg-page); color: var(--text-secondary);
  display: flex; align-items: center; justify-content: center; cursor: pointer;
}

.panel-body {
  flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 24px;
}

.record-stats {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px;
}

.stat-card {
  display: flex; flex-direction: column; align-items: center; gap: 4px;
  padding: 14px 8px; background: var(--bg-page); border-radius: 12px;
  .stat-num { font-size: 24px; font-weight: 700; color: var(--primary); }
  .stat-label { font-size: 11px; color: var(--text-muted); }
}

.timeline-section, .ai-summary-section {
  h4 { font-size: 15px; font-weight: 600; color: var(--text-primary); margin-bottom: 12px; }
}

.timeline {
  display: flex; flex-direction: column; gap: 0; padding-left: 12px;
}

.timeline-item {
  display: flex; align-items: flex-start; gap: 12px; padding: 8px 0;
  position: relative;

  &::before {
    content: '';
    position: absolute;
    left: 4px;
    top: 22px;
    bottom: -8px;
    width: 2px;
    background: var(--border);
  }

  &:last-child::before { display: none; }

  .timeline-dot {
    width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; margin-top: 4px;
    background: var(--primary);
  }

  &.quiz .timeline-dot { background: #faad14; }
  &.result .timeline-dot { background: #52c41a; }
  &.discuss .timeline-dot { background: #722ed1; }
  &.ai .timeline-dot { background: #1677ff; }
  &.question .timeline-dot { background: #ff4d4f; }
  &.end .timeline-dot { background: var(--text-muted); }

  .timeline-content {
    display: flex; flex-direction: column; gap: 2px;
  }

  .timeline-time { font-size: 11px; color: var(--text-muted); font-weight: 500; }
  .timeline-text { font-size: 13px; color: var(--text-primary); line-height: 1.5; }
}

.summary-card {
  padding: 16px;
  background: linear-gradient(135deg, rgba(22, 119, 255, 0.04), rgba(82, 196, 26, 0.04));
  border: 1px solid rgba(22, 119, 255, 0.12);
  border-radius: 12px;
  margin-bottom: 12px;

  p { font-size: 14px; color: var(--text-primary); line-height: 1.7; margin: 0 0 8px; }
  ul { padding-left: 20px; margin: 8px 0; }
  li { font-size: 13px; color: var(--text-secondary); line-height: 1.8; }
}

.generate-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 14px;
  border: none;
  border-radius: 12px;
  background: linear-gradient(135deg, var(--primary), #4096ff);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  min-height: 48px;
  transition: all 0.2s;

  &:active { transform: scale(0.98); }
}
</style>
