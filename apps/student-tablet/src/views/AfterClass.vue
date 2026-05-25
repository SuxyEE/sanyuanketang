<template>
  <div class="after-class">
    <header class="page-header">
      <button class="back-btn" @click="$router.back()" aria-label="返回">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
      </button>
      <h2>课后学习</h2>
    </header>

    <div class="tab-bar">
      <button :class="{ active: tab === 'review' }" @click="tab = 'review'">课堂回顾</button>
      <button :class="{ active: tab === 'homework' }" @click="tab = 'homework'">我的作业</button>
      <button :class="{ active: tab === 'discuss' }" @click="tab = 'discuss'">课后讨论</button>
    </div>

    <div class="tab-content">
      <div v-if="tab === 'review'" class="review-tab">
        <div class="summary-card">
          <div class="summary-header">
            <span class="ai-tag" v-html="botIcon" aria-hidden="true"></span>
            <span>AI 课堂总结</span>
          </div>
          <div class="summary-body">
            <p>本节课主要学习了<strong>三维建模与逆向工程</strong>的核心流程：</p>
            <ul>
              <li>逆向工程扫描方式的选择与精度要求</li>
              <li>点云数据预处理的关键步骤</li>
              <li>NURBS曲面拟合方法及应用场景</li>
            </ul>
            <p class="mastery">你的掌握度：<strong>78%</strong></p>
          </div>
        </div>

        <div class="knowledge-map">
          <h4>知识点掌握</h4>
          <div class="kp-list">
            <div v-for="kp in knowledgePoints" :key="kp.name" class="kp-item">
              <span class="kp-name">{{ kp.name }}</span>
              <div class="kp-bar"><div class="kp-fill" :class="kp.status" :style="{ width: kp.percent + '%' }"></div></div>
              <span class="kp-pct" :class="kp.status">{{ kp.percent }}%</span>
            </div>
          </div>
        </div>

        <button class="practice-btn" @click="startPractice">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
          AI 针对薄弱点生成练习
        </button>
      </div>

      <div v-if="tab === 'homework'" class="homework-tab">
        <div v-if="store.homeworkList.length === 0 && homeworks.length === fallbackHomeworks.length" class="empty-hint">
          <p>暂无作业，等待老师布置</p>
        </div>
        <div v-for="hw in homeworks" :key="hw.id" class="hw-card" :class="hw.status">
          <div class="hw-info">
            <h4>{{ hw.title }}</h4>
            <p class="hw-meta">{{ hw.course }} · 截止{{ hw.deadline }}<span v-if="hw.questionCount > 0"> · {{ hw.questionCount }} 题</span></p>
          </div>
          <div class="hw-status-badge" :class="hw.status">
            {{ hw.status === 'submitted' ? '已提交' : hw.status === 'graded' ? hw.score + '分' : '待完成' }}
          </div>
        </div>
      </div>

      <div v-if="tab === 'discuss'" class="discuss-tab">
        <div class="discuss-list">
          <div v-for="d in discussions" :key="d.id" class="discuss-item">
            <div class="disc-author">{{ d.author }}</div>
            <p class="disc-content">{{ d.content }}</p>
            <div class="disc-footer">
              <span class="disc-time">{{ d.time }}</span>
              <span class="disc-replies">{{ d.replies }}条回复</span>
            </div>
          </div>
        </div>

        <div class="discuss-input">
          <input v-model="discussInput" placeholder="发表讨论..." @keyup.enter="postDiscussion" />
          <button class="send-btn" @click="postDiscussion" :disabled="!discussInput.trim()" aria-label="发送">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { icons } from '@snyuan/shared'
import { useStudentStore } from '../stores/student'

const botIcon = icons.bot
const tab = ref<'review' | 'homework' | 'discuss'>('homework')
const discussInput = ref('')
const router = useRouter()
const store = useStudentStore()

const knowledgePoints = ref([
  { name: '逆向工程扫描', percent: 88, status: 'mastered' },
  { name: '点云数据处理', percent: 72, status: 'practicing' },
  { name: '曲面拟合方法', percent: 65, status: 'practicing' },
  { name: '三维建模基础', percent: 42, status: 'weak' },
])

function formatDeadlineShort(iso?: string | null) {
  if (!iso) return '未设置'
  try {
    const d = new Date(iso)
    const now = new Date()
    const sameDay = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
    const hh = String(d.getHours()).padStart(2, '0')
    const mm = String(d.getMinutes()).padStart(2, '0')
    if (sameDay) return `今天 ${hh}:${mm}`
    return `${d.getMonth() + 1}月${d.getDate()}日 ${hh}:${mm}`
  } catch { return iso || '' }
}

const fallbackHomeworks = [
  { id: 'fallback-1', title: '逆向工程流程实操报告', course: '数字化设计与制造', deadline: '5月23日 23:59', status: 'pending', score: null, questionCount: 0 },
  { id: 'fallback-2', title: '三维建模基础测验', course: '数字化设计与制造', deadline: '5月22日 23:59', status: 'graded', score: 85, questionCount: 0 },
]

const homeworks = computed(() => {
  const live = store.homeworkList.map(hw => ({
    id: hw.id,
    title: hw.title,
    course: store.courseName,
    deadline: formatDeadlineShort(hw.deadline),
    status: 'pending',
    score: null as number | null,
    questionCount: hw.questions?.length || 0,
  }))
  return [...live, ...fallbackHomeworks]
})

const discussions = ref([
  { id: '1', author: '李同学', content: '关于今天讲的NURBS曲面拟合，有没有推荐的参考资料？', time: '16:30', replies: 3 },
  { id: '2', author: '王同学', content: '实操的时候扫描精度总是达不到0.02mm，有什么技巧吗？', time: '16:15', replies: 5 },
  { id: '3', author: 'AI助手', content: '同学们好！针对今天课堂中大家普遍薄弱的"三维建模基础原理"，我整理了一份练习清单，有需要的同学可以尝试。', time: '15:20', replies: 8 },
])

function startPractice() {
  router.push('/classroom')
}

function postDiscussion() {
  if (!discussInput.value.trim()) return
  discussions.value.unshift({
    id: String(Date.now()),
    author: '我',
    content: discussInput.value,
    time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
    replies: 0,
  })
  discussInput.value = ''
}
</script>

<style scoped lang="scss">
.after-class {
  min-height: 100vh; background: var(--bg-page); display: flex; flex-direction: column;
}

.page-header {
  display: flex; align-items: center; gap: 12px;
  padding: 14px 20px; background: var(--bg-card); border-bottom: 1px solid var(--border);
  h2 { font-size: 17px; font-weight: 700; }
}

.back-btn {
  width: 44px; height: 44px; border-radius: 50%; border: none; background: transparent;
  display: flex; align-items: center; justify-content: center; cursor: pointer; color: var(--text-primary);
}

.tab-bar {
  display: flex; gap: 4px; padding: 6px; margin: 12px 16px; background: var(--bg-card);
  border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.04);

  button {
    flex: 1; padding: 10px; border: none; border-radius: 10px; background: transparent;
    font-size: 13px; font-weight: 500; color: var(--text-secondary); cursor: pointer; min-height: 40px;
    &.active { background: var(--primary-light, #f6ffed); color: var(--primary); font-weight: 600; }
  }
}

.tab-content { flex: 1; padding: 0 16px 80px; }

.summary-card {
  background: var(--bg-card); border-radius: 16px; overflow: hidden;
  box-shadow: 0 1px 3px rgba(0,0,0,0.04); margin-bottom: 16px;

  .summary-header {
    display: flex; align-items: center; gap: 6px; padding: 12px 16px;
    background: linear-gradient(135deg, rgba(22,119,255,0.06), rgba(82,196,26,0.04));
    font-size: 13px; font-weight: 600; color: var(--primary);
    .ai-tag { display: flex; :deep(svg) { width: 16px; height: 16px; } }
  }

  .summary-body {
    padding: 16px;
    p { font-size: 14px; color: var(--text-primary); line-height: 1.7; margin: 0 0 6px; }
    ul { padding-left: 18px; margin: 6px 0; }
    li { font-size: 13px; color: var(--text-secondary); line-height: 1.7; }
    .mastery { margin-top: 10px; font-weight: 500; strong { color: var(--primary); font-size: 18px; } }
  }
}

.knowledge-map {
  background: var(--bg-card); border-radius: 16px; padding: 16px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.04); margin-bottom: 16px;
  h4 { font-size: 14px; font-weight: 600; margin-bottom: 12px; }
}

.kp-list { display: flex; flex-direction: column; gap: 10px; }

.kp-item {
  display: flex; align-items: center; gap: 10px;
  .kp-name { width: 90px; font-size: 12px; color: var(--text-primary); flex-shrink: 0; }
  .kp-bar { flex: 1; height: 8px; background: var(--bg-page); border-radius: 4px; overflow: hidden; }
  .kp-fill {
    height: 100%; border-radius: 4px; transition: width 0.6s ease;
    &.mastered { background: var(--primary); }
    &.practicing { background: #faad14; }
    &.weak { background: #ff4d4f; }
  }
  .kp-pct {
    width: 36px; text-align: right; font-size: 12px; font-weight: 600;
    &.mastered { color: var(--primary); }
    &.practicing { color: #faad14; }
    &.weak { color: #ff4d4f; }
  }
}

.practice-btn {
  width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px;
  padding: 14px; border: none; border-radius: 12px;
  background: linear-gradient(135deg, var(--primary), #73d13d);
  color: #fff; font-size: 14px; font-weight: 600; cursor: pointer; min-height: 48px;
  &:active { transform: scale(0.98); }
}

.hw-card {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 16px; background: var(--bg-card); border-radius: 12px;
  margin-bottom: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.04);
  h4 { font-size: 14px; font-weight: 600; color: var(--text-primary); margin: 0 0 4px; }
  .hw-meta { font-size: 12px; color: var(--text-muted); margin: 0; }
}

.hw-status-badge {
  padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; white-space: nowrap;
  &.pending { background: #fff7e6; color: #d46b08; }
  &.submitted { background: #e6f4ff; color: #1677ff; }
  &.graded { background: #f6ffed; color: #52c41a; }
}

.discuss-list { display: flex; flex-direction: column; gap: 10px; padding-bottom: 70px; }

.discuss-item {
  padding: 14px 16px; background: var(--bg-card); border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.04);
  .disc-author { font-size: 13px; font-weight: 600; color: var(--primary); margin-bottom: 6px; }
  .disc-content { font-size: 14px; color: var(--text-primary); line-height: 1.6; margin: 0 0 8px; }
  .disc-footer { display: flex; gap: 12px; font-size: 11px; color: var(--text-muted); }
}

.discuss-input {
  position: fixed; bottom: 0; left: 0; right: 0;
  display: flex; gap: 8px; padding: 12px 16px;
  padding-bottom: calc(12px + var(--safe-bottom));
  background: var(--bg-card); border-top: 1px solid var(--border);

  input {
    flex: 1; padding: 12px 16px; border: 1px solid var(--border);
    border-radius: 24px; font-size: 14px; outline: none; background: var(--bg-page); min-height: 44px;
    &:focus { border-color: var(--primary); }
  }
  .send-btn {
    width: 44px; height: 44px; border-radius: 50%; border: none;
    background: var(--primary); color: #fff;
    display: flex; align-items: center; justify-content: center; cursor: pointer;
    &:disabled { opacity: 0.3; }
  }
}
</style>
