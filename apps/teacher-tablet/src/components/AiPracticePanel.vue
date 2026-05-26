<template>
  <div class="ai-practice-panel" role="dialog" aria-label="AI实践">
    <div class="panel-header">
      <h3>AI实践</h3>
      <button class="close-btn" @click="$emit('close')" aria-label="关闭">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>

    <div class="mode-bar" role="tablist">
      <button
        class="mode-btn"
        :class="{ active: mode === 'chat' }"
        @click="mode = 'chat'"
        role="tab"
      >
        <span v-html="icons.book" aria-hidden="true"></span>
        AI 答疑（聊天模式）
      </button>
      <button
        class="mode-btn"
        :class="{ active: mode === 'interactive' }"
        @click="mode = 'interactive'"
        role="tab"
      >
        <span v-html="icons.zap" aria-hidden="true"></span>
        AI 交互（HTML 沙盘）
      </button>
    </div>

    <div class="panel-body" v-if="mode === 'chat'">
      <div v-if="store.aiPractice" class="active-banner">
        <div class="active-banner-head">
          <span class="active-dot"></span>
          <span>正在进行 AI 实践</span>
        </div>
        <p class="active-banner-text">{{ store.aiPractice.topic }}</p>
        <button class="end-btn" @click="endPractice">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="6" width="12" height="12" rx="1"/></svg>
          结束 AI 实践（学生回到课件）
        </button>
      </div>
      <p v-else class="hint">开启后，学生端将切换到AI助手模式，学生可以自由向AI提问并进行实践探索。结束后学生会自动回到课件。</p>

      <div class="input-group">
        <label>实践主题</label>
        <input v-model="topic" :disabled="!!store.aiPractice" placeholder="例如：逆向工程扫描方法比较" />
      </div>

      <div class="input-group">
        <label>AI角色提示词</label>
        <textarea
          v-model="prompt"
          :disabled="!!store.aiPractice"
          placeholder="定义AI助手在本次实践中的角色和回答范围..."
          rows="4"
        ></textarea>
      </div>

      <div class="preset-section" v-if="!store.aiPractice">
        <h4>快捷模板</h4>
        <div class="preset-list">
          <button
            v-for="p in presets"
            :key="p.name"
            class="preset-card"
            @click="applyPreset(p)"
          >
            <span class="preset-icon" v-html="p.icon"></span>
            <span class="preset-name">{{ p.name }}</span>
          </button>
        </div>
      </div>

      <button v-if="!store.aiPractice" class="start-btn" :disabled="!topic.trim()" @click="startPractice">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a10 10 0 1 0 10 10"/><path d="M12 12l5-3"/></svg>
        下发AI实践任务
      </button>

      <div v-if="isSent" class="sent-feedback">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#52c41a" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
        已下发到所有学生端
      </div>
    </div>

    <div class="panel-body" v-else>
      <p class="hint">让 AI 现场生成一份「可触摸、可调参」的 HTML 沙盘，推到学生平板的 iframe 里。零外网依赖，自动安全清洗。</p>

      <div class="input-group">
        <label>知识点（必填）</label>
        <input v-model="interactiveTopic" placeholder="例：勾股定理、二次函数图像、PLC梯形图" />
      </div>

      <div class="input-group">
        <label>额外说明（可选）</label>
        <textarea
          v-model="interactiveHint"
          placeholder="例：要有一个角度滑块、要显示弧度与角度的换算..."
          rows="3"
        ></textarea>
      </div>

      <div class="interactive-preset-section">
        <h4>快捷主题</h4>
        <div class="interactive-presets">
          <button
            v-for="p in interactivePresets"
            :key="p.topic"
            class="interactive-chip"
            @click="interactiveTopic = p.topic; interactiveHint = p.hint"
          >{{ p.topic }}</button>
        </div>
      </div>

      <button class="start-btn" :disabled="!interactiveTopic.trim() || isGeneratingInteractive" @click="generateInteractive">
        <span v-if="isGeneratingInteractive" class="btn-spinner"></span>
        <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
        {{ isGeneratingInteractive ? `AI 生成中… (${genElapsed}s)` : '生成并推送给学生' }}
      </button>

      <div v-if="interactiveResult" class="interactive-preview">
        <div class="preview-head">
          <strong>{{ interactiveResult.title }}</strong>
          <span v-if="interactiveResult.error" class="err-chip">{{ interactiveResult.error }}</span>
          <span v-else class="preview-chip">预览仅教师可见 · 已清洗 {{ totalSanitizeRemoved }} 项不安全内容</span>
        </div>
        <p class="preview-desc">{{ interactiveResult.description }}</p>
        <div
          v-if="qualityIssues.length > 0"
          class="quality-warn"
          role="alert"
        >
          <strong>AI 生成质量警告：</strong>
          <ul>
            <li v-for="(msg, i) in qualityIssues" :key="i">{{ msg }}</li>
          </ul>
          <button class="regen-btn" @click="generateInteractive">重新生成</button>
        </div>
        <iframe
          class="preview-iframe"
          sandbox="allow-scripts"
          :srcdoc="interactiveResult.html"
          title="AI 实践预览"
        ></iframe>
        <p class="preview-hint">教师端本地预览。检查无误后点「推送给学生」才下发。</p>
        <div class="preview-action-row">
          <button class="push-btn" @click="pushInteractiveToStudents">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            推送给学生
          </button>
          <button class="discard-btn" @click="discardInteractivePreview">放弃预览</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue'
import { icons } from '@snyuan/shared'
import { useSocket } from '../composables/useSocket'
import { useToast } from '../composables/useToast'
import { useAiSettings } from '../composables/useAiSettings'
import { useClassroomStore } from '../stores/classroom'

const emit = defineEmits<{ close: []; start: [data: { topic: string; prompt: string }] }>()

const { socket } = useSocket()
const { toastSuccess, toastError, toastInfo } = useToast()
const { getRequestConfig: getAiConfig } = useAiSettings()
const store = useClassroomStore()

const mode = ref<'chat' | 'interactive'>('chat')

const topic = ref('')
const prompt = ref('')
const isSent = ref(false)

const presets = [
  {
    name: '专业知识问答',
    icon: icons.book,
    topic: '本节课知识点答疑',
    prompt: '你是一位专业课教师助手，根据今天课堂的内容帮助学生答疑。回答要结合实际案例，语言通俗易懂。',
  },
  {
    name: '实操指导',
    icon: icons.tool,
    topic: '实操步骤指导',
    prompt: '你是一位实训指导老师，帮助学生完成实操任务。提供分步骤的操作指导，注意安全规范提醒。',
  },
  {
    name: '知识拓展',
    icon: icons.search,
    topic: '知识拓展探索',
    prompt: '你是一位知识拓展引导者，引导学生探索课程相关的前沿技术和行业应用。鼓励学生提出问题并深入思考。',
  },
  {
    name: '问题诊断',
    icon: icons.zap,
    topic: '故障诊断练习',
    prompt: '你是一位设备故障诊断专家。模拟一个设备故障场景，让学生通过向你提问来逐步排查并诊断故障原因。',
  },
]

function applyPreset(p: typeof presets[0]) {
  topic.value = p.topic
  prompt.value = p.prompt
}

function startPractice() {
  if (!topic.value.trim()) return
  emit('start', { topic: topic.value.trim(), prompt: prompt.value.trim() })
  isSent.value = true
  setTimeout(() => { isSent.value = false }, 3000)
}

function endPractice() {
  const s = socket.value
  if (!s?.connected) {
    toastError('未连接服务器')
    return
  }
  s.emit('ai:practice:end', {})
  store.setAiPractice(null)
  toastInfo('已结束 AI 实践')
}

// === HTML interactive 模式 ===
const interactiveTopic = ref('')
const interactiveHint = ref('')
const isGeneratingInteractive = ref(false)
const genElapsed = ref(0)
let genTimer: ReturnType<typeof setInterval> | null = null
const interactiveResult = ref<{
  title: string
  description: string
  html: string
  error?: string
  sanitizeStats?: {
    removedInlineEvents: number
    removedExternalScripts: number
    removedExternalLinks: number
    removedNestedIframes: number
    warnings: string[]
    qualityIssues?: string[]
    autoFixedCssClasses?: number
  }
} | null>(null)

const totalSanitizeRemoved = computed(() => {
  const s = interactiveResult.value?.sanitizeStats
  if (!s) return 0
  return s.removedInlineEvents + s.removedExternalScripts + s.removedExternalLinks + s.removedNestedIframes
})

const qualityIssues = computed(() => interactiveResult.value?.sanitizeStats?.qualityIssues ?? [])

const interactivePresets = [
  { topic: '勾股定理可视化', hint: '直角三角形两边可拖动改变长度，实时显示 a²+b²=c² 的等式与图形' },
  { topic: '二次函数图像', hint: 'a/b/c 三个滑块，实时显示抛物线' },
  { topic: '欧姆定律实验', hint: '电压/电阻滑块，实时显示电流读数和电路图' },
  { topic: 'PLC 梯形图模拟', hint: '点击按钮模拟启停信号，灯泡亮灭' },
  { topic: '化学反应配平演示', hint: '调系数滑块，原子守恒高亮' },
  { topic: '弹簧振子运动', hint: '调振幅/质量/劲度系数，实时画出振动曲线' },
]

let interactiveHandler: ((result: any) => void) | null = null
let interactiveTimeoutId: ReturnType<typeof setTimeout> | null = null

function cancelInteractiveGen() {
  if (genTimer) { clearInterval(genTimer); genTimer = null }
  if (interactiveTimeoutId) { clearTimeout(interactiveTimeoutId); interactiveTimeoutId = null }
  if (interactiveHandler && socket.value) {
    socket.value.off('ai:interactive:gen', interactiveHandler)
    interactiveHandler = null
  }
  isGeneratingInteractive.value = false
}

function generateInteractive() {
  const t = interactiveTopic.value.trim()
  if (!t || isGeneratingInteractive.value) return
  const s = socket.value
  if (!s?.connected) { toastError('未连接服务器'); return }

  cancelInteractiveGen()
  isGeneratingInteractive.value = true
  genElapsed.value = 0
  genTimer = setInterval(() => { genElapsed.value++ }, 1000)

  const handler = (result: any) => {
    cancelInteractiveGen()
    if (!result || result.error) {
      interactiveResult.value = null
      toastError(result?.error || 'AI 未返回有效结果')
      return
    }
    interactiveResult.value = result
    toastSuccess(`已生成「${result.title}」预览，请检查后推送给学生`)
  }
  interactiveHandler = handler
  s.on('ai:interactive:gen', handler)

  interactiveTimeoutId = setTimeout(() => {
    cancelInteractiveGen()
    toastError('AI 生成超时（>180s），请检查 AI 设置或稍后重试')
  }, 180000)

  s.emit('ai:interactive:gen', {
    topic: t,
    extraHint: interactiveHint.value.trim() || undefined,
    broadcast: false,
    ...getAiConfig(),
  })
}

function pushInteractiveToStudents() {
  if (!interactiveResult.value?.html) {
    toastError('当前无可推送的预览，请先生成')
    return
  }
  const s = socket.value
  if (!s?.connected) {
    toastError('未连接服务器')
    return
  }
  const topic = interactiveResult.value.title || interactiveTopic.value.trim()
  s.emit('ai:practice:start', {
    topic,
    prompt: interactiveHint.value.trim(),
    startedAt: new Date().toISOString(),
  })
  s.emit('ai:interactive:show', interactiveResult.value)
  toastSuccess(`已下发「${topic}」到所有学生平板`)
}

function discardInteractivePreview() {
  interactiveResult.value = null
}

onUnmounted(() => {
  cancelInteractiveGen()
})
</script>

<style scoped lang="scss">
.ai-practice-panel {
  position: fixed; inset: 0; z-index: 100;
  background: var(--bg-card); display: flex; flex-direction: column;
  animation: slideUp 0.25s ease-out;
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

.panel-body { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 16px; }

.hint { font-size: 13px; color: var(--text-muted); line-height: 1.6; }

.active-banner {
  padding: 14px 16px;
  background: linear-gradient(135deg, rgba(207, 19, 34, 0.05), rgba(207, 19, 34, 0.02));
  border: 1px solid rgba(207, 19, 34, 0.18);
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.active-banner-head {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  font-weight: 600;
  color: #cf1322;
}

.active-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #cf1322;
  animation: pulse 1.4s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.4; transform: scale(0.85); }
}

.active-banner-text {
  font-size: 14px;
  color: var(--text-primary);
  margin: 0;
  font-weight: 500;
  word-break: break-word;
}

.end-btn {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  padding: 12px 16px;
  border: none;
  border-radius: 12px;
  background: #cf1322;
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  min-height: 44px;
  &:hover { background: #a8071a; }
}

.input-group {
  label { font-size: 13px; font-weight: 600; color: var(--text-primary); margin-bottom: 8px; display: block; }
  input, textarea {
    width: 100%; padding: 12px; border: 2px solid var(--border); border-radius: 12px;
    font-size: 14px; outline: none; font-family: inherit;
    &:focus { border-color: var(--primary); }
  }
  textarea { resize: none; }
}

.preset-section {
  h4 { font-size: 13px; font-weight: 600; color: var(--text-primary); margin-bottom: 10px; }
}

.preset-list { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }

.preset-card {
  display: flex; align-items: center; gap: 8px;
  padding: 12px; border: 1px solid var(--border); border-radius: 12px;
  background: var(--bg-page); cursor: pointer; transition: all 0.2s;
  &:active { border-color: var(--primary); background: var(--primary-light); }

  .preset-icon { display: flex; color: var(--primary); :deep(svg) { width: 18px; height: 18px; } }
  .preset-name { font-size: 12px; color: var(--text-primary); font-weight: 500; }
}

.start-btn {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  width: 100%; padding: 16px; border: none; border-radius: 16px;
  background: linear-gradient(135deg, #1677ff, #4096ff);
  color: #fff; font-size: 16px; font-weight: 700; cursor: pointer; min-height: 52px;
  &:disabled { opacity: 0.4; }
  &:active:not(:disabled) { transform: scale(0.98); }
}

.sent-feedback {
  display: flex; align-items: center; justify-content: center; gap: 6px;
  color: #52c41a; font-size: 14px; font-weight: 500;
}

.mode-bar {
  display: flex;
  padding: 8px 12px 0;
  gap: 6px;
}
.mode-btn {
  flex: 1;
  display: flex; align-items: center; justify-content: center; gap: 6px;
  padding: 9px 8px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--bg-page);
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  min-height: 38px;
  transition: all 0.15s;
  :deep(svg) { width: 14px; height: 14px; }
  &.active {
    background: linear-gradient(135deg, var(--primary), #4096ff);
    color: #fff;
    border-color: transparent;
  }
}

.interactive-preset-section {
  margin-top: 4px;
  h4 { font-size: 13px; font-weight: 600; color: var(--text-primary); margin: 0 0 8px; }
}
.interactive-presets {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.interactive-chip {
  font-size: 12px;
  padding: 6px 12px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: #fff;
  color: var(--text-secondary);
  cursor: pointer;
  min-height: 32px;
  &:active { border-color: var(--primary); background: var(--primary-light); color: var(--primary); }
}

.interactive-preview {
  border: 1px solid var(--border);
  border-radius: 14px;
  background: #fff;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.preview-head {
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
  strong { font-size: 14px; }
}
.ok-chip {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 8px;
  background: #f6ffed; color: #389e0d;
  border: 1px solid #b7eb8f;
}
.preview-chip {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 8px;
  background: rgba(22, 119, 255, 0.08);
  color: var(--primary);
  border: 1px solid rgba(22, 119, 255, 0.25);
}
.err-chip {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 8px;
  background: #fff1f0; color: #cf1322;
  border: 1px solid #ffa39e;
}
.quality-warn {
  background: #fffbe6;
  border: 1px solid #ffe58f;
  border-radius: 10px;
  padding: 10px 12px;
  font-size: 12px;
  color: #874d00;
  line-height: 1.6;
  strong { color: #ad6800; }
  ul { margin: 4px 0 8px 18px; padding: 0; }
  li { margin: 2px 0; }
  .regen-btn {
    padding: 6px 12px;
    border-radius: 8px;
    border: 1px solid #faad14;
    background: #fff;
    color: #ad6800;
    font-size: 12px;
    cursor: pointer;
    &:active { background: #fff7e6; }
  }
}
.preview-desc { font-size: 12px; color: var(--text-secondary); margin: 0; }
.preview-iframe {
  width: 100%;
  height: 420px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: #fff;
}
.preview-hint {
  font-size: 11px; color: var(--text-muted); margin: 0;
  text-align: center;
}

.preview-action-row {
  display: flex;
  gap: 10px;
  margin-top: 6px;
}

.push-btn {
  flex: 1.6;
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  padding: 12px;
  border: none;
  border-radius: 12px;
  background: linear-gradient(135deg, var(--primary), #4096ff);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  min-height: 44px;
  &:hover { transform: translateY(-1px); box-shadow: 0 6px 16px -8px rgba(22, 119, 255, 0.4); }
  &:active { transform: scale(0.98); }
}

.discard-btn {
  flex: 1;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: #fff;
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
  min-height: 44px;
  &:hover { border-color: var(--primary); color: var(--primary); }
}

.btn-spinner {
  display: inline-block;
  width: 14px; height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.4);
  border-top-color: #fff;
  border-radius: 50%;
  animation: panel-spin 0.7s linear infinite;
}
@keyframes panel-spin { to { transform: rotate(360deg); } }
</style>
