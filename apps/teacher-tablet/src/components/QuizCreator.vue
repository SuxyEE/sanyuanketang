<template>
  <div class="quiz-creator" role="dialog" aria-label="智能出题">
    <div class="panel-header">
      <h3>智能出题</h3>
      <button class="close-btn" @click="$emit('close')" aria-label="关闭">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>

    <div class="quiz-content">
      <div class="quiz-form-col">
        <section class="ai-gen-card">
        <div class="ai-gen-head">
          <span class="ai-gen-badge">AI 生成</span>
          <div>
            <h4>让 AI 帮你出题</h4>
            <p>输入知识点 + 题数 + 题型，AI 自动生成题目并填入列表</p>
          </div>
        </div>
        <div class="ai-gen-form">
          <input v-model="aiTopic" placeholder="知识点/主题，如：PLC梯形图编程基础" />
          <div class="ai-gen-row">
            <label>题数</label>
            <div class="num-selector">
              <button v-for="n in [3, 5, 8, 10]" :key="n" class="num-btn" :class="{ active: aiCount === n }" @click="aiCount = n">{{ n }}</button>
            </div>
          </div>
          <div class="ai-gen-row">
            <label>题型</label>
            <div class="type-chips">
              <button
                v-for="t in aiTypeOptions"
                :key="t.value"
                class="type-chip"
                :class="{ active: aiSelectedTypes.includes(t.value) }"
                @click="toggleAiType(t.value)"
              >{{ t.label }}</button>
            </div>
          </div>
          <div class="ai-gen-row">
            <label>难度</label>
            <div class="type-chips">
              <button v-for="d in difficultyOptions" :key="d.value" class="type-chip" :class="{ active: aiDifficulty === d.value }" @click="aiDifficulty = d.value">{{ d.label }}</button>
            </div>
          </div>
          <button class="ai-gen-btn" @click="aiGenerate" :disabled="!aiTopic.trim() || isGenerating">
            <span v-if="isGenerating" class="btn-spinner" aria-hidden="true"></span>
            <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
            {{ isGenerating ? `AI 生成中… (${genElapsed}s)` : 'AI 自动出题' }}
          </button>
        </div>
      </section>

      <div class="divider"><span>或手动添加</span></div>

      <div class="form-group">
        <label for="quiz-title">测验标题</label>
        <input id="quiz-title" v-model="quizTitle" placeholder="例如：三维建模基础测验" />
      </div>

      <div class="form-group">
        <label>题目类型</label>
        <div class="type-tabs">
          <button
            v-for="t in questionTypes"
            :key="t.value"
            class="type-tab"
            :class="{ active: selectedType === t.value }"
            @click="selectedType = t.value"
          >
            {{ t.label }}
          </button>
        </div>
      </div>

      <div class="form-group">
        <label for="quiz-question">题目内容</label>
        <textarea id="quiz-question" v-model="questionContent" rows="3" placeholder="输入题目内容..."></textarea>
      </div>

      <div v-if="selectedType !== 'true_false' && selectedType !== 'short_answer'" class="options-editor">
        <label>选项</label>
        <div v-for="(opt, idx) in options" :key="idx" class="option-row">
          <span class="option-letter">{{ String.fromCharCode(65 + idx) }}</span>
          <input v-model="options[idx]" :placeholder="`选项 ${String.fromCharCode(65 + idx)}`" />
          <button
            v-if="options.length > 2"
            class="remove-opt-btn"
            @click="options.splice(idx, 1)"
            aria-label="删除选项"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <button v-if="options.length < 6" class="add-opt-btn" @click="options.push('')">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          添加选项
        </button>
      </div>

      <div class="form-group" v-if="selectedType !== 'short_answer'">
        <label for="quiz-answer">正确答案</label>
        <input id="quiz-answer" v-model="correctAnswer" :placeholder="selectedType === 'true_false' ? '输入 对 或 错' : '输入选项字母，如 A 或 A,C（多选用逗号）'" />
      </div>

      <div class="form-group" v-else>
        <label for="quiz-ref">参考答案（用于 AI 批改）</label>
        <textarea id="quiz-ref" v-model="referenceAnswer" rows="2" placeholder="给 AI 看的标准答案，留空则按学生答案合理性评分..."></textarea>
      </div>

      <div class="form-group">
        <label for="quiz-time">答题时限（秒）</label>
        <div class="time-selector">
          <button
            v-for="t in timeLimits"
            :key="t"
            class="time-btn"
            :class="{ active: timeLimit === t }"
            @click="timeLimit = t"
          >
            {{ t }}s
          </button>
        </div>
      </div>

      <div class="form-group">
        <label for="quiz-kp">知识点标签（可选，用顿号或逗号分隔，1-3 个最佳）</label>
        <input id="quiz-kp" v-model="knowledgePointsInput" placeholder="例：PLC梯形图、定时器指令" />
        <div v-if="kpPreview.length > 0" class="kp-preview">
          <span v-for="kp in kpPreview" :key="kp" class="kp-chip">{{ kp }}</span>
        </div>
      </div>
      </div>

      <aside class="quiz-preview-col">
        <QuestionPreviewList
          :questions="questionsList"
          title="题目预览"
          :removable="true"
          :with-tts="true"
          @remove="onRemoveQuestion"
        />
      </aside>
    </div>

    <div class="panel-actions">
      <button class="btn-secondary" @click="addQuestion">添加到题目列表</button>
      <button class="btn-primary" @click="pushQuiz" :disabled="questionsList.length === 0">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        下发测验 ({{ questionsList.length }}题)
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onUnmounted } from 'vue'
import { useSocket } from '../composables/useSocket'
import { useToast } from '../composables/useToast'
import { useAiSettings } from '../composables/useAiSettings'
import QuestionPreviewList from './QuestionPreviewList.vue'

const emit = defineEmits<{
  close: []
  push: [data: any]
}>()

const { socket } = useSocket()
const { toastSuccess, toastInfo, toastError } = useToast()
const { getRequestConfig: getAiConfig } = useAiSettings()

const quizTitle = ref('随堂测验')
const selectedType = ref('single_choice')
const questionContent = ref('')
const correctAnswer = ref('')
const referenceAnswer = ref('')
const timeLimit = ref(120)
const knowledgePointsInput = ref('')
const options = reactive(['', '', '', ''])

const kpPreview = computed(() => parseKp(knowledgePointsInput.value))

function parseKp(s: string): string[] {
  if (!s) return []
  return s
    .split(/[、,，;；\s]+/u)
    .map(x => x.trim())
    .filter(Boolean)
    .slice(0, 5)
}

const questionTypes = [
  { label: '单选题', value: 'single_choice' },
  { label: '多选题', value: 'multiple_choice' },
  { label: '判断题', value: 'true_false' },
  { label: '简答题', value: 'short_answer' },
]

const timeLimits = [60, 120, 180, 300]

const aiTopic = ref('')
const aiCount = ref(5)
const aiDifficulty = ref('medium')
const aiSelectedTypes = ref<string[]>(['single_choice', 'true_false'])
const isGenerating = ref(false)
const genElapsed = ref(0)
let genTimer: ReturnType<typeof setInterval> | null = null

const aiTypeOptions = [
  { label: '单选题', value: 'single_choice' },
  { label: '多选题', value: 'multiple_choice' },
  { label: '判断题', value: 'true_false' },
  { label: '简答题', value: 'short_answer' },
]

const difficultyOptions = [
  { label: '简单', value: 'easy' },
  { label: '中等', value: 'medium' },
  { label: '困难', value: 'hard' },
]

interface QuestionItem {
  id?: string
  type: string
  content: string
  options?: { key: string; content: string }[]
  answer?: string
  analysis?: string
  referenceAnswer?: string
  /** 分值（1-20，默认 10）*/
  points?: number
  /** 难度 */
  difficulty?: 'easy' | 'medium' | 'hard'
  /** 简答题评分细则 */
  commentPrompt?: string
  /** 知识点标签数组（中文/英文均可，建议 1-3 个） */
  knowledgePoints?: string[]
}

const questionsList = ref<QuestionItem[]>([])

function onRemoveQuestion(idx: number) {
  questionsList.value.splice(idx, 1)
  toastInfo('已删除题目')
}

function toggleAiType(v: string) {
  const idx = aiSelectedTypes.value.indexOf(v)
  if (idx === -1) aiSelectedTypes.value.push(v)
  else if (aiSelectedTypes.value.length > 1) aiSelectedTypes.value.splice(idx, 1)
}

function addQuestion() {
  if (!questionContent.value.trim()) {
    toastError('请输入题目内容')
    return
  }

  if (selectedType.value === 'single_choice' || selectedType.value === 'multiple_choice') {
    const filled = options.filter(o => o.trim())
    if (filled.length < 2) {
      toastError('选择题至少需要 2 个选项')
      return
    }
    if (!correctAnswer.value.trim()) {
      toastError('请填写正确答案（如 A 或 A,B）')
      return
    }
    const keys = filled.map((_, i) => String.fromCharCode(65 + i))
    const answerKeys = correctAnswer.value.toUpperCase().split(/[,，]/).map(s => s.trim()).filter(Boolean)
    const invalid = answerKeys.find(k => !keys.includes(k))
    if (invalid) {
      toastError(`答案 ${invalid} 超出选项范围`)
      return
    }
  } else if (selectedType.value === 'true_false') {
    if (!correctAnswer.value.trim()) {
      toastError('请填写「对」或「错」')
      return
    }
  }

  const q: QuestionItem = {
    type: selectedType.value,
    content: questionContent.value,
    options: selectedType.value === 'true_false'
      ? [{ key: 'A', content: '对' }, { key: 'B', content: '错' }]
      : selectedType.value === 'short_answer'
      ? undefined
      : options.filter(o => o.trim()).map((o, i) => ({ key: String.fromCharCode(65 + i), content: o })),
    answer: selectedType.value === 'short_answer' ? undefined : correctAnswer.value,
    referenceAnswer: selectedType.value === 'short_answer' ? referenceAnswer.value : undefined,
    knowledgePoints: kpPreview.value.length > 0 ? [...kpPreview.value] : undefined,
  }

  questionsList.value.push(q)
  questionContent.value = ''
  correctAnswer.value = ''
  referenceAnswer.value = ''
  knowledgePointsInput.value = ''
  options.splice(0, options.length, '', '', '', '')
  toastSuccess('题目已加入列表')
}

let aiTimeoutId: ReturnType<typeof setTimeout> | null = null
let currentAiHandler: ((result: any) => void) | null = null

function cancelAiGen() {
  if (genTimer) { clearInterval(genTimer); genTimer = null }
  if (aiTimeoutId) { clearTimeout(aiTimeoutId); aiTimeoutId = null }
  if (currentAiHandler && socket.value) {
    socket.value.off('ai:quiz-gen', currentAiHandler)
    currentAiHandler = null
  }
  isGenerating.value = false
}

function aiGenerate() {
  const topic = aiTopic.value.trim()
  if (!topic || isGenerating.value) return
  const s = socket.value
  if (!s?.connected) {
    toastError('未连接服务器，无法调用 AI')
    return
  }

  cancelAiGen()

  isGenerating.value = true
  genElapsed.value = 0
  genTimer = setInterval(() => { genElapsed.value++ }, 1000)
  toastInfo(`AI 正在生成 ${aiCount.value} 道题目…`)

  const handler = (result: any) => {
    cancelAiGen()
    if (!result || !Array.isArray(result.questions) || result.questions.length === 0) {
      toastError('AI 未返回有效题目，请尝试更具体的知识点')
      return
    }
    const generated: QuestionItem[] = result.questions.map((q: any, i: number) => ({
      id: `ai-${Date.now()}-${i}`,
      type: q.type || 'single_choice',
      content: q.content || '',
      options: q.options,
      answer: q.answer,
      analysis: q.analysis,
      referenceAnswer: q.referenceAnswer,
      points: typeof q.points === 'number' ? q.points : undefined,
      difficulty: q.difficulty,
      commentPrompt: q.commentPrompt,
      knowledgePoints: Array.isArray(q.knowledgePoints) ? q.knowledgePoints : (topic ? [topic] : undefined),
    }))
    questionsList.value.push(...generated)
    quizTitle.value = `${topic} · 随堂测验`
    toastSuccess(`AI 已生成 ${generated.length} 道题目`)
  }
  currentAiHandler = handler
  s.on('ai:quiz-gen', handler)

  aiTimeoutId = setTimeout(() => {
    cancelAiGen()
    toastError('AI 出题超时，请稍后重试')
  }, 60000)

  s.emit('ai:quiz-gen', {
    topic,
    count: aiCount.value,
    types: aiSelectedTypes.value,
    difficulty: aiDifficulty.value,
    courseContext: quizTitle.value,
    ...getAiConfig(),
  })
}

onUnmounted(() => {
  cancelAiGen()
})

function pushQuiz() {
  emit('push', {
    title: quizTitle.value,
    type: 'quiz',
    questions: questionsList.value,
    timeLimit: timeLimit.value,
  })
  emit('close')
}
</script>

<style scoped lang="scss">
.quiz-creator {
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
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);

  h3 {
    font-size: 17px;
    font-weight: 700;
    color: var(--text-primary);
  }
}

.close-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: none;
  background: var(--bg-page);
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;

  &:active { background: var(--border); }
}

.quiz-content {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px 20px;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

/* 横屏 / 平板（≥900px）：左右分栏布局
   - 左侧：表单（AI 生成 / 手动出题 / 题型 / 时限 / 知识点）独立滚动
   - 右侧：题目预览列表 独立滚动，长内容展开不挤压左侧 */
@media (min-width: 900px) {
  .quiz-content {
    flex-direction: row;
    overflow: hidden;
    padding: 16px 20px;
    gap: 20px;
  }

  .quiz-form-col {
    flex: 0 0 52%;
    max-width: 52%;
    overflow-y: auto;
    padding-right: 8px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    -webkit-overflow-scrolling: touch;
  }

  .quiz-preview-col {
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
  .quiz-form-col {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .quiz-preview-col {
    margin-top: 8px;
    padding-top: 12px;
    border-top: 1px dashed var(--border);
  }
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;

  label {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-primary);
  }

  input, textarea {
    padding: 12px 14px;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    font-size: 14px;
    outline: none;
    background: var(--bg-card);
    color: var(--text-primary);
    min-height: 44px;
    transition: border-color 0.2s;

    &:focus { border-color: var(--primary); }
  }

  textarea { resize: vertical; line-height: 1.5; }
}

.type-tabs {
  display: flex;
  gap: 8px;
}

.type-tab {
  flex: 1;
  padding: 10px;
  border: 2px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--bg-card);
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
  cursor: pointer;
  min-height: 44px;
  transition: all 0.2s;

  &.active {
    border-color: var(--primary);
    color: var(--primary);
    background: var(--primary-light);
  }
}

.options-editor {
  display: flex;
  flex-direction: column;
  gap: 8px;

  label {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-primary);
  }
}

.option-row {
  display: flex;
  align-items: center;
  gap: 8px;

  .option-letter {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: var(--primary-light);
    color: var(--primary);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: 700;
    flex-shrink: 0;
  }

  input {
    flex: 1;
    padding: 10px 12px;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    font-size: 14px;
    outline: none;
    min-height: 44px;

    &:focus { border-color: var(--primary); }
  }
}

.remove-opt-btn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: none;
  background: transparent;
  color: var(--danger, #ff4d4f);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  min-width: 44px;
  min-height: 44px;

  &:active { background: rgba(255, 77, 79, 0.08); }
}

.add-opt-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px;
  border: 1px dashed var(--border);
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--primary);
  font-size: 13px;
  cursor: pointer;
  min-height: 44px;
  transition: all 0.2s;

  &:active { background: var(--primary-light); }
}

.time-selector {
  display: flex;
  gap: 8px;
}

.time-btn {
  flex: 1;
  padding: 10px;
  border: 2px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--bg-card);
  font-size: 13px;
  color: var(--text-secondary);
  cursor: pointer;
  min-height: 44px;
  transition: all 0.2s;

  &.active {
    border-color: var(--primary);
    color: var(--primary);
    background: var(--primary-light);
  }
}

.panel-actions {
  display: flex;
  gap: 10px;
  padding: 12px 20px;
  padding-bottom: calc(12px + var(--safe-bottom));
  border-top: 1px solid var(--border);
  background: var(--bg-card);
}

.btn-secondary {
  flex: 1;
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--bg-card);
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  min-height: 48px;
  transition: all 0.2s;

  &:active { background: var(--bg-page); }
}

.btn-primary {
  flex: 1.5;
  padding: 14px;
  border: none;
  border-radius: var(--radius-md);
  background: linear-gradient(135deg, var(--primary), #4096ff);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  min-height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: all 0.2s;

  &:disabled { opacity: 0.4; cursor: not-allowed; }
  &:not(:disabled):active { transform: scale(0.98); }
}

.ai-gen-card {
  background: linear-gradient(135deg, rgba(22, 119, 255, 0.06), rgba(82, 196, 26, 0.04));
  border: 1px solid rgba(22, 119, 255, 0.2);
  border-radius: 14px;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.ai-gen-head {
  display: flex;
  align-items: center;
  gap: 10px;
  h4 { font-size: 14px; font-weight: 700; color: var(--text-primary); margin: 0; }
  p { font-size: 11px; color: var(--text-muted); margin: 2px 0 0; }
}

.ai-gen-badge {
  flex-shrink: 0;
  padding: 4px 10px;
  background: linear-gradient(135deg, var(--primary), #52c41a);
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  border-radius: 12px;
}

.ai-gen-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
  input {
    padding: 10px 12px;
    border: 1px solid var(--border);
    border-radius: 10px;
    font-size: 14px;
    background: #fff;
    outline: none;
    &:focus { border-color: var(--primary); }
  }
}

.ai-gen-row {
  display: flex;
  align-items: center;
  gap: 10px;
  label { font-size: 12px; font-weight: 600; color: var(--text-secondary); width: 36px; flex-shrink: 0; }
}

.num-selector {
  display: flex;
  gap: 6px;
  flex: 1;
}

.num-btn {
  flex: 1;
  padding: 6px 0;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: #fff;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  cursor: pointer;
  min-height: 32px;
  &.active { border-color: var(--primary); color: var(--primary); background: var(--primary-light); }
}

.type-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  flex: 1;
}

.type-chip {
  padding: 5px 12px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: #fff;
  font-size: 12px;
  color: var(--text-secondary);
  cursor: pointer;
  min-height: 28px;
  &.active { border-color: var(--primary); color: var(--primary); background: var(--primary-light); }
}

.ai-gen-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 11px;
  border: none;
  border-radius: 12px;
  background: linear-gradient(135deg, var(--primary), #52c41a);
  color: #fff;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  min-height: 42px;
  box-shadow: 0 4px 12px -4px rgba(22, 119, 255, 0.35);
  &:disabled { opacity: 0.55; cursor: not-allowed; box-shadow: none; }
  &:not(:disabled):active { transform: scale(0.98); }
}

.btn-spinner {
  display: inline-block;
  width: 14px; height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.4);
  border-top-color: #fff;
  border-radius: 50%;
  animation: btn-spin 0.7s linear infinite;
}

@keyframes btn-spin {
  to { transform: rotate(360deg); }
}

.divider {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--text-muted);
  font-size: 11px;
  &::before, &::after {
    content: '';
    flex: 1;
    height: 1px;
    background: var(--border);
  }
}

.kp-preview { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; }
.kp-chip {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 10px;
  background: linear-gradient(135deg, #f9f0ff, #f3e8ff);
  color: #722ed1;
  border: 1px solid rgba(114, 46, 209, 0.18);
}
</style>
