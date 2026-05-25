<template>
  <div class="ai-whiteboard-panel" role="dialog" aria-label="AI 板书">
    <div class="panel-header">
      <h3>AI 板书</h3>
      <button class="close-btn" @click="$emit('close')" aria-label="关闭">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>

    <div class="panel-body">
      <p class="hint">输入知识点，AI 现场生成结构化板书（含 LaTeX 公式 / 表格 / 流程图）并推送到大屏。</p>

      <div class="input-group">
        <label>知识点（必填）</label>
        <input v-model="topic" placeholder="例：勾股定理 / 欧姆定律 / PLC梯形图基础" />
      </div>

      <div class="input-group">
        <label>额外说明（可选）</label>
        <textarea
          v-model="extraHint"
          placeholder="例：要画一个 SVG 直角三角形示意 / 要列出 3 组验证数据..."
          rows="3"
        ></textarea>
      </div>

      <div class="preset-section">
        <h4>快捷主题</h4>
        <div class="preset-list">
          <button
            v-for="p in presets"
            :key="p.topic"
            class="preset-chip"
            @click="topic = p.topic; extraHint = p.hint"
          >{{ p.topic }}</button>
        </div>
      </div>

      <div class="action-row">
        <button class="btn-secondary" :disabled="!hasWb" @click="hideWb">
          下大屏
        </button>
        <button class="btn-primary" :disabled="!topic.trim() || isGenerating" @click="generate">
          <span v-if="isGenerating" class="btn-spinner"></span>
          <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
          {{ isGenerating ? `AI 生成中… (${genElapsed}s)` : '生成并推送大屏' }}
        </button>
      </div>

      <div v-if="result" class="preview-section">
        <div class="preview-head">
          <strong>{{ result.title }}</strong>
          <span v-if="result.subtitle" class="subtitle">{{ result.subtitle }}</span>
          <span v-if="result.error" class="err-chip">{{ result.error }}</span>
          <span v-else class="ok-chip">已推送 · {{ result.items.length }} 项</span>
        </div>
        <ul class="preview-items">
          <li v-for="(it, i) in result.items" :key="i" class="preview-item-row">
            <span class="item-no">{{ i + 1 }}</span>
            <span class="item-type" :class="`type-${it.type}`">{{ typeLabel(it.type) }}</span>
            <span class="item-snippet">{{ snippetOf(it) }}</span>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue'
import { useSocket } from '../composables/useSocket'
import { useToast } from '../composables/useToast'
import { useAiSettings } from '../composables/useAiSettings'

interface WhiteboardItem {
  type: string
  text?: string
  tex?: string
  items?: string[]
  headers?: string[]
  rows?: string[][]
  svg?: string
  kind?: string
}

defineEmits<{ close: [] }>()

const { socket } = useSocket()
const { toastSuccess, toastError } = useToast()
const { getRequestConfig: getAiConfig } = useAiSettings()

const topic = ref('')
const extraHint = ref('')
const isGenerating = ref(false)
const genElapsed = ref(0)
const result = ref<{ title: string; subtitle?: string; items: WhiteboardItem[]; error?: string } | null>(null)
const hasWb = computed(() => result.value != null && !result.value.error)

let genTimer: ReturnType<typeof setInterval> | null = null
let timeoutId: ReturnType<typeof setTimeout> | null = null
let handler: ((r: any) => void) | null = null

const presets = [
  { topic: '勾股定理', hint: '画出直角三角形 SVG + 给出 3 组验证数据表格' },
  { topic: '欧姆定律', hint: '公式 + 电路图 SVG + 串/并联对比表' },
  { topic: '二次函数与抛物线', hint: 'a 值不同的对比表 + 顶点公式' },
  { topic: '化学键类型', hint: '离子键 / 共价键 / 金属键 对比表 + 示意图' },
  { topic: 'PLC梯形图基础', hint: '基本逻辑符号表 + 简单梯形图 SVG' },
  { topic: '正态分布', hint: '钟形曲线 SVG + 3σ 法则' },
]

function cancelGen() {
  if (genTimer) { clearInterval(genTimer); genTimer = null }
  if (timeoutId) { clearTimeout(timeoutId); timeoutId = null }
  if (handler && socket.value) {
    socket.value.off('ai:whiteboard:gen', handler)
    handler = null
  }
  isGenerating.value = false
}

function generate() {
  const t = topic.value.trim()
  if (!t || isGenerating.value) return
  const s = socket.value
  if (!s?.connected) { toastError('未连接服务器'); return }

  cancelGen()
  isGenerating.value = true
  genElapsed.value = 0
  genTimer = setInterval(() => { genElapsed.value++ }, 1000)

  const h = (r: any) => {
    cancelGen()
    if (!r || r.error) {
      result.value = r ? { title: '', items: [], error: r.error } : null
      toastError(r?.error || 'AI 未返回有效内容')
      return
    }
    result.value = r
    toastSuccess(`已生成「${r.title}」并推送大屏`)
  }
  handler = h
  s.on('ai:whiteboard:gen', h)

  timeoutId = setTimeout(() => {
    cancelGen()
    toastError('AI 生成超时（>90s）')
  }, 90000)

  s.emit('ai:whiteboard:gen', {
    topic: t,
    extraHint: extraHint.value.trim() || undefined,
    broadcast: true,
    ...getAiConfig(),
  })
}

function hideWb() {
  socket.value?.emit('ai:whiteboard:hide')
  result.value = null
  toastSuccess('已通知大屏关闭板书')
}

function typeLabel(t: string): string {
  const m: Record<string, string> = {
    heading: '标题', text: '正文', latex: '公式', list: '列表',
    table: '表格', callout: '强调', image: '配图',
  }
  return m[t] || t
}

function snippetOf(it: WhiteboardItem): string {
  if (it.text) return it.text.slice(0, 60) + (it.text.length > 60 ? '…' : '')
  if (it.tex) return it.tex.slice(0, 60)
  if (it.headers) return `表格 ${it.headers.length}列 × ${(it.rows?.length || 0)}行`
  if (it.items) return `列表 ${it.items.length}项`
  if (it.svg) return `SVG 配图`
  return '(空)'
}

onUnmounted(() => {
  cancelGen()
})
</script>

<style scoped lang="scss">
.ai-whiteboard-panel {
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
  width: 36px; height: 36px; border-radius: 50%; border: none;
  background: var(--bg-page); color: var(--text-secondary);
  display: flex; align-items: center; justify-content: center; cursor: pointer;
}

.panel-body {
  flex: 1; overflow-y: auto; padding: 16px 20px;
  display: flex; flex-direction: column; gap: 16px;
}

.hint { font-size: 12px; color: var(--text-secondary); margin: 0; line-height: 1.6; }

.input-group {
  display: flex; flex-direction: column; gap: 6px;
  label { font-size: 13px; font-weight: 600; color: var(--text-primary); }
  input, textarea {
    padding: 10px 12px;
    border: 1px solid var(--border);
    border-radius: 10px;
    font-size: 13px;
    font-family: inherit;
    &:focus { outline: none; border-color: var(--primary); }
  }
  textarea { resize: vertical; line-height: 1.5; }
}

.preset-section {
  h4 { font-size: 13px; font-weight: 600; margin: 0 0 8px; }
}
.preset-list { display: flex; flex-wrap: wrap; gap: 6px; }
.preset-chip {
  font-size: 12px;
  padding: 6px 12px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: #fff;
  color: var(--text-secondary);
  cursor: pointer;
  &:active { border-color: var(--primary); background: var(--primary-light); color: var(--primary); }
}

.action-row { display: flex; gap: 8px; }

.btn-primary, .btn-secondary {
  flex: 1; padding: 12px; border: none; border-radius: 12px;
  font-size: 13px; font-weight: 700; cursor: pointer; min-height: 44px;
  display: flex; align-items: center; justify-content: center; gap: 6px;
}
.btn-primary { background: linear-gradient(135deg, var(--primary), #722ed1); color: #fff; }
.btn-secondary { background: var(--bg-page); color: var(--text-secondary); border: 1px solid var(--border); }
.btn-primary:disabled, .btn-secondary:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-spinner {
  width: 14px; height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.4);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.preview-section {
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 12px;
  background: #fff;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.preview-head {
  display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap;
  strong { font-size: 14px; }
  .subtitle { font-size: 11px; color: var(--text-muted); }
}
.ok-chip {
  font-size: 11px; padding: 2px 8px;
  background: #f6ffed; color: #389e0d;
  border: 1px solid #b7eb8f; border-radius: 8px;
}
.err-chip {
  font-size: 11px; padding: 2px 8px;
  background: #fff1f0; color: #cf1322;
  border: 1px solid #ffa39e; border-radius: 8px;
}

.preview-items { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 4px; }
.preview-item-row {
  display: flex; align-items: center; gap: 6px;
  font-size: 12px; padding: 6px 8px;
  border-radius: 6px;
  background: var(--bg-page);

  .item-no {
    flex-shrink: 0;
    width: 18px; height: 18px;
    background: var(--primary); color: #fff;
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-weight: 700; font-size: 10px;
  }
  .item-type {
    flex-shrink: 0; padding: 1px 6px; border-radius: 6px;
    font-size: 10px; font-weight: 600;
    &.type-heading { background: #fff7e6; color: #d46b08; }
    &.type-text { background: #f5f7fa; color: #595959; }
    &.type-latex { background: #f9f0ff; color: #722ed1; }
    &.type-list { background: #e6fffb; color: #08979c; }
    &.type-table { background: #e6f4ff; color: #1677ff; }
    &.type-callout { background: #fff0f6; color: #c41d7f; }
    &.type-image { background: #f6ffed; color: #389e0d; }
  }
  .item-snippet { flex: 1; min-width: 0; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
}
</style>
