<template>
  <div class="ai-whiteboard" role="dialog" aria-label="AI 板书">
    <div class="wb-header">
      <div class="wb-titles">
        <span class="badge">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
          AI 板书
        </span>
        <div class="title-line">
          <h2 class="title">{{ board.title }}</h2>
          <span v-if="board.subtitle" class="subtitle">{{ board.subtitle }}</span>
        </div>
      </div>
      <div class="wb-meta">
        <span class="time">{{ formattedTime }}</span>
        <button class="close-btn" @click="$emit('close')" aria-label="关闭板书">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
    </div>

    <div class="wb-body" ref="bodyRef">
      <component
        v-for="(item, idx) in board.items"
        :key="idx"
        :is="renderItem(item, idx)"
      />
    </div>

    <div class="wb-footer">
      <span class="dot"></span>
      AI 生成 · 共 {{ board.items.length }} 项 · 已自动安全清洗
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, h, type VNode } from 'vue'
import katex from 'katex'
import 'katex/dist/katex.min.css'

type WhiteboardItem =
  | { type: 'heading'; level?: number; text: string }
  | { type: 'text'; text: string }
  | { type: 'latex'; tex: string; display?: boolean }
  | { type: 'list'; ordered?: boolean; items: string[] }
  | { type: 'table'; headers: string[]; rows: string[][] }
  | { type: 'callout'; kind?: 'tip' | 'warning' | 'info' | 'note'; text: string }
  | { type: 'image'; svg: string }

const props = defineProps<{
  board: {
    topic?: string
    title: string
    subtitle?: string
    items: WhiteboardItem[]
    generatedAt?: string
  }
}>()

defineEmits<{ close: [] }>()

const bodyRef = ref<HTMLElement | null>(null)

const formattedTime = computed(() => {
  const iso = props.board.generatedAt
  if (!iso) return ''
  try {
    const d = new Date(iso)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`
  } catch {
    return ''
  }
})

function renderLatex(tex: string, display: boolean): string {
  try {
    return katex.renderToString(tex, { throwOnError: false, displayMode: display })
  } catch (e: any) {
    return `<span class="latex-err">[LaTeX 错误：${(e?.message || '').slice(0, 80)}]</span>`
  }
}

function renderItem(item: WhiteboardItem, idx: number): () => VNode {
  return () => {
    switch (item.type) {
      case 'heading': {
        const level = Math.max(1, Math.min(3, item.level ?? 2))
        const tag = `h${level}`
        return h(tag as any, { class: ['wb-heading', `level-${level}`], key: idx }, item.text)
      }
      case 'text':
        return h('p', { class: 'wb-text', key: idx }, item.text)
      case 'latex':
        return h('div', {
          class: ['wb-latex', item.display ? 'display' : 'inline'],
          key: idx,
          innerHTML: renderLatex(item.tex, !!item.display),
        })
      case 'list': {
        const tag = item.ordered ? 'ol' : 'ul'
        return h(tag, { class: 'wb-list', key: idx }, item.items.map(t => h('li', t)))
      }
      case 'table': {
        return h('div', { class: 'wb-table-wrap', key: idx }, [
          h('table', { class: 'wb-table' }, [
            h('thead', {}, [h('tr', {}, item.headers.map(h2 => h('th', {}, h2)))]),
            h('tbody', {}, item.rows.map(r => h('tr', {}, r.map(c => h('td', {}, c))))),
          ]),
        ])
      }
      case 'callout': {
        const kind = item.kind || 'info'
        return h('div', { class: ['wb-callout', `kind-${kind}`], key: idx }, [
          h('span', { class: 'callout-icon' }, kindIcon(kind)),
          h('span', { class: 'callout-text' }, item.text),
        ])
      }
      case 'image':
        return h('div', { class: 'wb-image', key: idx, innerHTML: item.svg })
      default:
        return h('div', { class: 'wb-unknown', key: idx }, '未知 item 类型')
    }
  }
}

function kindIcon(kind: string): string {
  switch (kind) {
    case 'tip': return '💡'
    case 'warning': return '⚠️'
    case 'info': return 'ℹ️'
    case 'note': return '📝'
    default: return '·'
  }
}

onMounted(() => {
  bodyRef.value?.scrollTo({ top: 0, behavior: 'smooth' })
})
</script>

<style scoped lang="scss">
.ai-whiteboard {
  position: fixed;
  inset: 0;
  z-index: 200;
  background: linear-gradient(180deg, #fdfdfd 0%, #f5f7fa 100%);
  color: #262626;
  display: flex;
  flex-direction: column;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  animation: wbFadeIn 0.35s ease;
}

@keyframes wbFadeIn {
  from { opacity: 0; transform: scale(0.97); }
  to { opacity: 1; transform: scale(1); }
}

.wb-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24px 36px;
  border-bottom: 2px solid rgba(22, 119, 255, 0.12);
  background: linear-gradient(135deg, rgba(22, 119, 255, 0.04), rgba(114, 46, 209, 0.04));
}

.wb-titles { display: flex; align-items: center; gap: 20px; flex: 1; min-width: 0; }
.badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: 20px;
  background: linear-gradient(135deg, #1677ff, #722ed1);
  color: #fff;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.5px;
  flex-shrink: 0;
}

.title-line { display: flex; align-items: baseline; gap: 16px; min-width: 0; }
.title {
  font-size: 36px;
  font-weight: 800;
  margin: 0;
  color: #1a1a1a;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.subtitle {
  font-size: 16px;
  color: #8c8c8c;
  font-weight: 500;
}

.wb-meta { display: flex; align-items: center; gap: 14px; }
.time { font-size: 14px; color: #8c8c8c; font-family: 'Cascadia Code', 'Consolas', monospace; }
.close-btn {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: none;
  background: rgba(0, 0, 0, 0.05);
  color: #595959;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  &:hover { background: rgba(0, 0, 0, 0.1); }
}

.wb-body {
  flex: 1;
  overflow-y: auto;
  padding: 32px 60px;
  display: flex;
  flex-direction: column;
  gap: 22px;
  scroll-behavior: smooth;
}

:deep(.wb-heading) {
  margin: 0;
  font-weight: 700;
  color: #1a1a1a;
  &.level-1 { font-size: 32px; padding-bottom: 8px; border-bottom: 3px solid #1677ff; }
  &.level-2 { font-size: 26px; color: #1677ff; }
  &.level-3 { font-size: 20px; color: #722ed1; }
}

:deep(.wb-text) {
  font-size: 22px;
  line-height: 1.8;
  color: #262626;
  margin: 0;
}

:deep(.wb-latex) {
  font-size: 24px;
  color: #1a1a1a;
  &.display {
    text-align: center;
    padding: 20px;
    background: #f9f0ff;
    border-radius: 12px;
    border-left: 4px solid #722ed1;
  }
  &.inline { display: inline; padding: 0 6px; }
  .katex { color: #1a1a1a; font-size: 1.2em; }
  .katex-display { color: #1a1a1a; margin: 0; }
}

:deep(.wb-latex .latex-err) { color: #cf1322; font-size: 13px; font-family: monospace; }

:deep(.wb-list) {
  font-size: 20px;
  line-height: 2;
  color: #262626;
  padding-left: 32px;
  margin: 0;
  li { margin-bottom: 4px; }
}

:deep(.wb-table-wrap) {
  flex-shrink: 0;
  overflow-x: auto;
  background: #fff;
  border-radius: 12px;
  border: 1px solid #e5e5e5;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}
:deep(.wb-table) {
  width: 100%;
  border-collapse: collapse;
  font-size: 18px;
  color: #262626;
  th, td {
    padding: 14px 18px;
    text-align: left;
    border-bottom: 1px solid #f0f0f0;
    color: #262626;
  }
  th {
    background: linear-gradient(135deg, #e6f4ff, #f0f5ff);
    font-weight: 700;
    color: #1677ff;
  }
  tr:last-child td { border-bottom: none; }
  tr:hover td { background: #fafafa; }
}

:deep(.wb-callout) {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 18px 24px;
  border-radius: 14px;
  font-size: 20px;
  line-height: 1.7;
  border-left: 5px solid;
  .callout-icon { font-size: 24px; flex-shrink: 0; }
  .callout-text { color: #262626; }
  &.kind-tip { background: #f6ffed; border-left-color: #52c41a; }
  &.kind-warning { background: #fff7e6; border-left-color: #fa8c16; }
  &.kind-info { background: #e6f4ff; border-left-color: #1677ff; }
  &.kind-note { background: #fff0f6; border-left-color: #eb2f96; }
}

:deep(.wb-image) {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 18px;
  background: #fff;
  border-radius: 14px;
  border: 1px solid #e5e5e5;
  svg { max-width: 600px; max-height: 400px; }
}

:deep(.wb-unknown) {
  padding: 12px;
  background: #fff1f0;
  color: #cf1322;
  border-radius: 8px;
  font-size: 13px;
}

.wb-footer {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 14px;
  font-size: 13px;
  color: #8c8c8c;
  border-top: 1px solid #f0f0f0;
  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #52c41a;
    box-shadow: 0 0 0 4px rgba(82, 196, 26, 0.15);
  }
}
</style>
