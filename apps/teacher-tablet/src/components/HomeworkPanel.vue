<template>
  <div class="homework-panel" role="dialog" aria-label="智能作业">
    <div class="panel-header">
      <h3>智能作业</h3>
      <button class="close-btn" @click="$emit('close')" aria-label="关闭">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>

    <div class="panel-body">
      <div class="tab-bar">
        <button :class="{ active: tab === 'create' }" @click="tab = 'create'">布置作业</button>
        <button :class="{ active: tab === 'review' }" @click="tab = 'review'">批改作业</button>
      </div>

      <div v-if="tab === 'create'" class="create-area">
        <div class="hw-form-col">
          <div class="ai-generate-card">
            <div class="ai-card-header">
              <span class="ai-badge" v-html="botIcon" aria-hidden="true"></span>
              <span>AI 智能出作业</span>
            </div>
            <p class="ai-card-desc">基于知识点描述，AI 自动生成 5 道针对性课后练习（单选 / 判断 / 简答）</p>
            <input
              v-model="homeworkTopic"
              class="topic-input"
              placeholder="知识点（默认按当前课程）..."
              :disabled="isGenerating"
            />
            <button class="ai-gen-btn" @click="generateHomework" :disabled="isGenerating">
              <span v-if="isGenerating" class="btn-spinner" aria-hidden="true"></span>
              {{ isGenerating ? 'AI 生成中…' : '一键生成作业' }}
            </button>
          </div>

          <div v-if="generatedHomework" class="hw-settings">
            <div class="setting-row">
              <label>截止时间</label>
              <select v-model="deadline">
                <option value="today">今天24:00</option>
                <option value="tomorrow">明天24:00</option>
                <option value="week">本周日</option>
              </select>
            </div>
            <button class="publish-btn" @click="publishHomework" :disabled="isPublishing">
              {{ isPublishing ? '发布中…' : '发布作业到学生端' }}
            </button>
          </div>

          <div class="manual-create">
            <h4>手动创建</h4>
            <div class="form-group">
              <label>作业标题</label>
              <input v-model="manualTitle" placeholder="输入作业标题" />
            </div>
            <div class="form-group">
              <label>作业描述</label>
              <textarea v-model="manualDesc" rows="3" placeholder="输入作业要求..."></textarea>
            </div>
            <button class="publish-btn outline" @click="publishManual">发布手动作业</button>
          </div>
        </div>

        <aside class="hw-preview-col">
          <QuestionPreviewList
            :questions="generatedHomework || []"
            title="作业题目预览"
            empty-text="点左侧「一键生成作业」生成题目"
            :removable="true"
            :with-tts="true"
            @remove="onRemoveHwQuestion"
          />
        </aside>
      </div>

      <div v-else class="review-area">
        <div class="review-summary">
          <div class="summary-stat">
            <span class="s-num">38</span><span class="s-label">已提交</span>
          </div>
          <div class="summary-stat">
            <span class="s-num">28</span><span class="s-label">AI已批</span>
          </div>
          <div class="summary-stat">
            <span class="s-num">10</span><span class="s-label">待复核</span>
          </div>
          <div class="summary-stat">
            <span class="s-num">82</span><span class="s-label">平均分</span>
          </div>
        </div>

        <div class="submission-list">
          <div v-for="s in submissions" :key="s.name" class="submission-item">
            <span class="sub-name">{{ s.name }}</span>
            <span class="sub-score" :class="s.status">{{ s.score !== null ? s.score + '分' : '待批' }}</span>
            <span class="sub-tag" :class="s.status">{{ s.status === 'ai' ? 'AI已批' : s.status === 'reviewed' ? '已复核' : '待批改' }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onUnmounted } from 'vue'
import { icons } from '@snyuan/shared'
import { useToast } from '../composables/useToast'
import { useSocket } from '../composables/useSocket'
import { useClassroomStore } from '../stores/classroom'
import QuestionPreviewList from './QuestionPreviewList.vue'

defineEmits<{ close: [] }>()

const { toastSuccess, toastInfo, toastError } = useToast()
const { socket } = useSocket()
const store = useClassroomStore()

const botIcon = icons.bot
const tab = ref<'create' | 'review'>('create')
const isGenerating = ref(false)
const isPublishing = ref(false)
const deadline = ref('tomorrow')
const manualTitle = ref('')
const manualDesc = ref('')
const homeworkTopic = ref('')

interface HwQuestion {
  id?: string
  type: string
  content: string
  options?: { key: string; content: string }[]
  answer?: string
  referenceAnswer?: string
  analysis?: string
  points?: number
  difficulty?: 'easy' | 'medium' | 'hard'
  knowledgePoints?: string[]
}

const generatedHomework = ref<HwQuestion[] | null>(null)

function onRemoveHwQuestion(idx: number) {
  if (!generatedHomework.value) return
  generatedHomework.value.splice(idx, 1)
  toastInfo('已删除题目')
  if (generatedHomework.value.length === 0) {
    generatedHomework.value = null
  }
}

const submissions = ref([
  { name: '学生01', score: 92, status: 'reviewed' },
  { name: '学生02', score: 85, status: 'ai' },
  { name: '学生03', score: 78, status: 'ai' },
  { name: '学生04', score: null, status: 'pending' },
  { name: '学生05', score: 88, status: 'ai' },
  { name: '学生06', score: null, status: 'pending' },
])

let genTimeoutId: ReturnType<typeof setTimeout> | null = null
let currentHandler: ((result: any) => void) | null = null

function cleanupHandler() {
  if (genTimeoutId) { clearTimeout(genTimeoutId); genTimeoutId = null }
  if (currentHandler && socket.value) {
    socket.value.off('ai:quiz-gen', currentHandler)
    currentHandler = null
  }
}

function deadlineDate(): string {
  const now = new Date()
  if (deadline.value === 'today') {
    now.setHours(23, 59, 59, 0)
  } else if (deadline.value === 'tomorrow') {
    now.setDate(now.getDate() + 1)
    now.setHours(23, 59, 59, 0)
  } else {
    const dayOfWeek = now.getDay()
    const daysToSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek
    now.setDate(now.getDate() + daysToSunday)
    now.setHours(23, 59, 59, 0)
  }
  return now.toISOString()
}

function generateHomework() {
  if (isGenerating.value) return
  const s = socket.value
  if (!s?.connected) {
    toastError('未连接服务器')
    return
  }
  const topic = (homeworkTopic.value || store.lessonTitle || store.courseName || '本节课重点').trim()
  isGenerating.value = true
  toastInfo(`AI 正在生成作业（${topic}）…`)
  cleanupHandler()
  const handler = (result: any) => {
    cleanupHandler()
    isGenerating.value = false
    if (!result || !Array.isArray(result.questions) || result.questions.length === 0) {
      toastError('AI 未返回有效作业，请重试')
      return
    }
    generatedHomework.value = result.questions.map((q: any, i: number) => ({
      id: `hw-${Date.now()}-${i}`,
      type: q.type || 'single_choice',
      content: q.content,
      options: q.options,
      answer: q.answer,
      referenceAnswer: q.referenceAnswer || q.answer,
      analysis: q.analysis,
      points: typeof q.points === 'number' ? q.points : undefined,
      difficulty: q.difficulty,
      knowledgePoints: Array.isArray(q.knowledgePoints) ? q.knowledgePoints : (topic ? [topic] : undefined),
    }))
    toastSuccess(`AI 已生成 ${generatedHomework.value!.length} 道题目`)
  }
  currentHandler = handler
  s.on('ai:quiz-gen', handler)
  genTimeoutId = setTimeout(() => {
    cleanupHandler()
    isGenerating.value = false
    toastError('AI 组卷超时，请稍后重试')
  }, 60000)
  s.emit('ai:quiz-gen', {
    topic,
    count: 5,
    types: ['single_choice', 'true_false', 'short_answer'],
    difficulty: 'medium',
    courseContext: store.courseName,
  })
}

function publishHomework() {
  if (!generatedHomework.value?.length || isPublishing.value) return
  const s = socket.value
  if (!s?.connected) {
    toastError('未连接服务器')
    return
  }
  isPublishing.value = true
  s.emit('homework:publish', {
    title: `${homeworkTopic.value || store.lessonTitle || '本节'} · 课后作业`,
    description: '本次课的 AI 智能作业，请按时完成提交。',
    questions: generatedHomework.value.map(q => ({
      type: q.type,
      content: q.content,
      options: q.options,
      answer: q.answer,
      referenceAnswer: q.referenceAnswer,
      analysis: q.analysis,
    })),
    deadline: deadlineDate(),
    type: 'ai',
  })
  setTimeout(() => {
    isPublishing.value = false
    toastSuccess(`已发布 ${generatedHomework.value?.length || 0} 道题目作业`)
  }, 250)
}

function publishManual() {
  if (!manualTitle.value.trim()) return
  const s = socket.value
  if (!s?.connected) {
    toastError('未连接服务器')
    return
  }
  s.emit('homework:publish', {
    title: manualTitle.value.trim(),
    description: manualDesc.value.trim(),
    questions: [],
    deadline: deadlineDate(),
    type: 'manual',
  })
  toastSuccess(`作业「${manualTitle.value.trim()}」已发布`)
  manualTitle.value = ''
  manualDesc.value = ''
}

onUnmounted(() => {
  cleanupHandler()
})
</script>

<style scoped lang="scss">
.homework-panel {
  position: fixed; inset: 0; z-index: 100; background: var(--bg-card);
  display: flex; flex-direction: column; animation: slideUp 0.25s ease-out;
}

@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }

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

.panel-body { flex: 1; min-height: 0; display: flex; flex-direction: column; padding: 16px 20px; overflow: hidden; }

.create-area {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.review-area { flex: 1; min-height: 0; overflow-y: auto; -webkit-overflow-scrolling: touch; }

/* 横屏 / 平板（≥900px）：左右分栏 */
@media (min-width: 900px) {
  .create-area {
    flex-direction: row;
    overflow: hidden;
    gap: 20px;
  }

  .hw-form-col {
    flex: 0 0 48%;
    max-width: 48%;
    overflow-y: auto;
    padding-right: 8px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    -webkit-overflow-scrolling: touch;
  }

  .hw-preview-col {
    flex: 1;
    min-width: 0;
    overflow-y: auto;
    padding-left: 12px;
    border-left: 1px dashed var(--border);
    -webkit-overflow-scrolling: touch;
  }
}

/* 竖屏 / 手机（<900px）：单列堆叠 */
@media (max-width: 899px) {
  .hw-form-col {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .hw-preview-col {
    margin-top: 8px;
    padding-top: 12px;
    border-top: 1px dashed var(--border);
  }
}

.tab-bar {
  display: flex; gap: 4px; padding: 3px; background: var(--bg-page);
  border-radius: 12px; margin-bottom: 16px;

  button {
    flex: 1; padding: 10px; border: none; border-radius: 10px;
    background: transparent; font-size: 14px; font-weight: 500;
    color: var(--text-secondary); cursor: pointer; min-height: 44px;
    transition: all 0.2s;
    &.active { background: var(--bg-card); color: var(--primary); font-weight: 600; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
  }
}

.ai-generate-card {
  padding: 20px; background: linear-gradient(135deg, rgba(22,119,255,0.06), rgba(82,196,26,0.04));
  border: 1px solid rgba(22,119,255,0.15); border-radius: 16px; margin-bottom: 16px;

  .ai-card-header {
    display: flex; align-items: center; gap: 8px; margin-bottom: 8px;
    font-size: 14px; font-weight: 600; color: var(--primary);
    .ai-badge { display: flex; :deep(svg) { width: 18px; height: 18px; } }
  }

  .ai-card-desc { font-size: 13px; color: var(--text-secondary); margin-bottom: 12px; }
}

.topic-input {
  width: 100%; padding: 10px 12px; border: 1px solid var(--border); border-radius: 10px;
  font-size: 13px; outline: none; background: #fff; margin-bottom: 10px;
  &:focus { border-color: var(--primary); }
  &:disabled { opacity: 0.6; }
}

.ai-gen-btn {
  display: flex; align-items: center; justify-content: center; gap: 6px;
  width: 100%; padding: 12px; border: none; border-radius: 12px;
  background: linear-gradient(135deg, var(--primary), #4096ff);
  color: #fff; font-size: 14px; font-weight: 600; cursor: pointer; min-height: 44px;
  &:disabled { opacity: 0.6; cursor: not-allowed; }
  &:not(:disabled):active { transform: scale(0.98); }
}

.btn-spinner {
  display: inline-block;
  width: 14px; height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.45);
  border-top-color: #fff;
  border-radius: 50%;
  animation: btn-spin 0.7s linear infinite;
}

@keyframes btn-spin {
  to { transform: rotate(360deg); }
}

.manual-create h4 {
  font-size: 14px; font-weight: 600; margin-bottom: 12px; color: var(--text-primary);
}

.hw-settings { margin: 12px 0; }
.setting-row {
  display: flex; align-items: center; gap: 10px;
  label { font-size: 13px; color: var(--text-secondary); }
  select { flex: 1; padding: 10px; border: 1px solid var(--border); border-radius: 8px; font-size: 14px; min-height: 44px; }
}

.publish-btn {
  width: 100%; padding: 14px; border: none; border-radius: 12px;
  background: linear-gradient(135deg, var(--primary), #4096ff);
  color: #fff; font-size: 14px; font-weight: 600; cursor: pointer; min-height: 48px;
  &.outline { background: var(--bg-card); border: 1px solid var(--border); color: var(--text-primary); }
  &:active { transform: scale(0.98); }
}

.manual-create {
  .form-group { display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px; }
  label { font-size: 13px; font-weight: 500; color: var(--text-primary); }
  input, textarea {
    padding: 12px; border: 1px solid var(--border); border-radius: 10px;
    font-size: 14px; outline: none; min-height: 44px;
    &:focus { border-color: var(--primary); }
  }
}

.review-summary {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 16px;
}

.summary-stat {
  display: flex; flex-direction: column; align-items: center; gap: 2px;
  padding: 12px 8px; background: var(--bg-page); border-radius: 10px;
  .s-num { font-size: 22px; font-weight: 700; color: var(--primary); }
  .s-label { font-size: 11px; color: var(--text-muted); }
}

.submission-list { display: flex; flex-direction: column; gap: 6px; }

.submission-item {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 12px; background: var(--bg-page); border-radius: 8px;
  .sub-name { flex: 1; font-size: 13px; color: var(--text-primary); }
  .sub-score {
    font-size: 14px; font-weight: 600;
    &.reviewed { color: var(--success, #52c41a); }
    &.ai { color: var(--primary); }
    &.pending { color: var(--text-muted); }
  }
  .sub-tag {
    padding: 2px 8px; border-radius: 10px; font-size: 10px; font-weight: 500;
    &.reviewed { background: #f6ffed; color: #52c41a; }
    &.ai { background: #e6f4ff; color: #1677ff; }
    &.pending { background: var(--bg-page); color: var(--text-muted); border: 1px solid var(--border); }
  }
}
</style>
