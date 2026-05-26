<template>
  <div class="qp-list">
    <div class="qp-list-head">
      <span class="qp-list-title">{{ title }} ({{ questions.length }})</span>
      <div class="qp-list-tools">
        <button
          v-if="questions.length > 0"
          class="qp-tool-btn"
          :class="{ active: allExpanded }"
          @click="toggleAll"
        >
          {{ allExpanded ? '全部折叠' : '全部展开' }}
        </button>
      </div>
    </div>

    <div v-if="questions.length === 0" class="qp-empty">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
        <line x1="12" y1="17" x2="12.01" y2="17"/>
        <circle cx="12" cy="12" r="10"/>
      </svg>
      <span>{{ emptyText }}</span>
    </div>

    <div v-else class="qp-items">
      <div
        v-for="(q, idx) in questions"
        :key="q.id || idx"
        class="qp-item"
        :class="{ expanded: isExpanded(idx) }"
      >
        <button
          class="qp-item-head"
          type="button"
          @click="toggleOne(idx)"
        >
          <span class="qp-num">{{ idx + 1 }}</span>
          <span class="qp-type-chip" :class="q.type">{{ typeLabel(q.type) }}</span>
          <span v-if="q.difficulty" class="qp-diff-chip" :class="q.difficulty">
            {{ diffLabel(q.difficulty) }}
          </span>
          <span v-if="typeof q.points === 'number'" class="qp-points-chip">{{ q.points }} 分</span>
          <span class="qp-text-line">
            {{ q.content.length > 64 ? q.content.slice(0, 64) + '…' : q.content }}
          </span>
          <span class="qp-spacer"></span>
          <svg
            class="qp-caret"
            :class="{ rotate: isExpanded(idx) }"
            width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"
            aria-hidden="true"
          >
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>

        <div v-if="isExpanded(idx)" class="qp-item-body">
          <p class="qp-content">{{ q.content }}</p>

          <ul
            v-if="q.options && q.options.length > 0 && q.type !== 'short_answer'"
            class="qp-options"
          >
            <li
              v-for="opt in q.options"
              :key="opt.key"
              class="qp-option"
              :class="{ correct: isCorrectOption(q, opt.key) }"
            >
              <span class="qp-option-key">{{ opt.key }}</span>
              <span class="qp-option-text">{{ opt.content }}</span>
              <span v-if="isCorrectOption(q, opt.key)" class="qp-correct-mark" aria-label="正确答案">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              </span>
            </li>
          </ul>

          <div v-if="q.type === 'true_false' && q.answer" class="qp-meta-row">
            <span class="qp-meta-label">正确答案</span>
            <span class="qp-meta-value answer-value">{{ tfDisplay(q.answer) }}</span>
          </div>

          <div
            v-if="q.type !== 'short_answer' && q.answer && !q.options?.length"
            class="qp-meta-row"
          >
            <span class="qp-meta-label">正确答案</span>
            <span class="qp-meta-value answer-value">{{ q.answer }}</span>
          </div>

          <div v-if="q.type === 'short_answer' && q.referenceAnswer" class="qp-meta-block">
            <span class="qp-meta-label">参考答案</span>
            <p class="qp-meta-text">{{ q.referenceAnswer }}</p>
          </div>

          <div v-if="q.analysis" class="qp-meta-block">
            <span class="qp-meta-label">解析</span>
            <p class="qp-meta-text">{{ q.analysis }}</p>
          </div>

          <div v-if="q.knowledgePoints && q.knowledgePoints.length > 0" class="qp-kp-row">
            <span class="qp-meta-label">知识点</span>
            <div class="qp-kp-chips">
              <span v-for="kp in q.knowledgePoints" :key="kp" class="qp-kp-chip">{{ kp }}</span>
            </div>
          </div>

          <div class="qp-action-row">
            <TtsButton v-if="withTts" :text="buildReadText(q)" :label="true" />
            <span class="qp-spacer"></span>
            <button
              v-if="removable"
              class="qp-action-btn danger"
              type="button"
              @click="$emit('remove', idx)"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
              删除
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import TtsButton from './TtsButton.vue'

export interface PreviewQuestionOption {
  key: string
  content: string
}

export interface PreviewQuestion {
  id?: string
  type: string
  content: string
  options?: PreviewQuestionOption[]
  answer?: string
  referenceAnswer?: string
  analysis?: string
  points?: number
  difficulty?: 'easy' | 'medium' | 'hard'
  knowledgePoints?: string[]
}

const props = withDefaults(defineProps<{
  questions: PreviewQuestion[]
  title?: string
  emptyText?: string
  /** 默认展开第一题（方便用户一眼看到内容） */
  defaultExpandFirst?: boolean
  /** 是否允许删除 */
  removable?: boolean
  /** 是否显示朗读按钮 */
  withTts?: boolean
}>(), {
  title: '已添加题目',
  emptyText: '暂无题目',
  defaultExpandFirst: true,
  removable: false,
  withTts: false,
})

defineEmits<{ remove: [idx: number] }>()

const expanded = ref<Set<number>>(new Set())

watch(
  () => props.questions.length,
  (n, rawOldN) => {
    const oldN = rawOldN ?? 0
    if (props.defaultExpandFirst && n > 0 && oldN === 0) {
      expanded.value.add(0)
    }
    if (n > oldN) {
      for (let i = oldN; i < n; i++) expanded.value.add(i)
    }
    if (n < oldN) {
      const next = new Set<number>()
      for (const i of expanded.value) if (i < n) next.add(i)
      expanded.value = next
    }
  },
  { immediate: true },
)

const allExpanded = computed(() =>
  props.questions.length > 0 && expanded.value.size === props.questions.length,
)

function isExpanded(idx: number) {
  return expanded.value.has(idx)
}

function toggleOne(idx: number) {
  const next = new Set(expanded.value)
  if (next.has(idx)) next.delete(idx)
  else next.add(idx)
  expanded.value = next
}

function toggleAll() {
  if (allExpanded.value) {
    expanded.value = new Set()
  } else {
    expanded.value = new Set(props.questions.map((_, i) => i))
  }
}

function typeLabel(t: string) {
  const map: Record<string, string> = {
    single_choice: '单选',
    multiple_choice: '多选',
    true_false: '判断',
    short_answer: '简答',
  }
  return map[t] || t
}

function diffLabel(d: string) {
  const map: Record<string, string> = {
    easy: '简单',
    medium: '中等',
    hard: '困难',
  }
  return map[d] || d
}

function tfDisplay(ans: string) {
  const a = ans.trim()
  if (a === 'A' || a === '对' || a === 'true' || a === 'True') return '对'
  if (a === 'B' || a === '错' || a === 'false' || a === 'False') return '错'
  return ans
}

/** 单选/多选：判断选项 key 是否在答案集合里 */
function isCorrectOption(q: PreviewQuestion, key: string): boolean {
  if (!q.answer || q.type === 'short_answer') return false
  if (q.type === 'true_false') {
    const norm = tfDisplay(q.answer)
    if (key === 'A' && norm === '对') return true
    if (key === 'B' && norm === '错') return true
    return false
  }
  const keys = q.answer
    .toUpperCase()
    .split(/[,，;；\s]+/u)
    .map(s => s.trim())
    .filter(Boolean)
  return keys.includes(key.toUpperCase())
}

function buildReadText(q: PreviewQuestion): string {
  const parts: string[] = []
  parts.push(`${typeLabel(q.type)}题。`)
  parts.push(q.content)
  if (q.options && q.options.length > 0 && q.type !== 'short_answer') {
    parts.push(' 选项：')
    for (const o of q.options) parts.push(`${o.key}：${o.content}。`)
  }
  return parts.join(' ')
}
</script>

<style scoped lang="scss">
.qp-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.qp-list-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.qp-list-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.qp-list-tools {
  display: flex;
  gap: 6px;
}

.qp-tool-btn {
  padding: 4px 12px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: #fff;
  font-size: 12px;
  color: var(--text-secondary);
  cursor: pointer;
  min-height: 28px;
  transition: all 0.18s ease;

  &:hover {
    border-color: var(--primary);
    color: var(--primary);
  }

  &.active {
    border-color: var(--primary);
    color: var(--primary);
    background: var(--primary-light);
  }
}

.qp-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 24px 12px;
  background: var(--bg-page);
  border-radius: 10px;
  color: var(--text-muted);
  font-size: 13px;
}

.qp-items {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.qp-item {
  background: var(--bg-page);
  border: 1px solid transparent;
  border-radius: 10px;
  overflow: hidden;
  transition: border-color 0.18s ease, box-shadow 0.18s ease;

  &.expanded {
    background: var(--bg-card, #fff);
    border-color: rgba(22, 119, 255, 0.25);
    box-shadow: 0 4px 14px -8px rgba(22, 119, 255, 0.25);
  }
}

.qp-item-head {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: transparent;
  border: 0;
  cursor: pointer;
  text-align: left;
  min-height: 44px;
  transition: background 0.18s ease;

  &:hover { background: rgba(22, 119, 255, 0.04); }
  &:active { background: rgba(22, 119, 255, 0.08); }
}

.qp-num {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--primary);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  flex-shrink: 0;
}

.qp-type-chip {
  flex-shrink: 0;
  padding: 2px 8px;
  font-size: 10px;
  font-weight: 600;
  border-radius: 8px;

  &.single_choice { background: #e6f4ff; color: #1677ff; }
  &.multiple_choice { background: #f9f0ff; color: #722ed1; }
  &.true_false { background: #fff7e6; color: #d46b08; }
  &.short_answer { background: #f6ffed; color: #389e0d; }
}

.qp-diff-chip {
  flex-shrink: 0;
  padding: 2px 8px;
  font-size: 10px;
  font-weight: 600;
  border-radius: 8px;
  background: #f5f5f5;
  color: #595959;
  border: 1px solid transparent;

  &.easy { background: #f6ffed; color: #52c41a; border-color: #b7eb8f; }
  &.medium { background: #fffbe6; color: #d4b106; border-color: #ffe58f; }
  &.hard { background: #fff1f0; color: #cf1322; border-color: #ffa39e; }
}

.qp-points-chip {
  flex-shrink: 0;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 600;
  background: #fff7e6;
  color: #d46b08;
  border: 1px solid #ffe7ba;
}

.qp-text-line {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.qp-spacer { flex: 1; }

.qp-caret {
  flex-shrink: 0;
  color: var(--text-secondary);
  transition: transform 0.18s ease;

  &.rotate { transform: rotate(180deg); }
}

.qp-item-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 0 14px 14px;
  border-top: 1px dashed rgba(22, 119, 255, 0.18);
  padding-top: 12px;
  animation: qp-expand 0.18s ease-out;
}

@keyframes qp-expand {
  from { opacity: 0; transform: translateY(-4px); }
  to   { opacity: 1; transform: translateY(0); }
}

.qp-content {
  font-size: 14px;
  line-height: 1.6;
  color: var(--text-primary);
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
}

.qp-options {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.qp-option {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: #fff;
  font-size: 13px;
  line-height: 1.5;
  color: var(--text-primary);
  transition: all 0.18s ease;

  &.correct {
    border-color: #52c41a;
    background: linear-gradient(0deg, rgba(82, 196, 26, 0.06), rgba(82, 196, 26, 0.06));
    color: #237804;
  }
}

.qp-option-key {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--bg-page);
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  flex-shrink: 0;

  .qp-option.correct & {
    background: #52c41a;
    color: #fff;
  }
}

.qp-option-text {
  flex: 1;
  word-break: break-word;
}

.qp-correct-mark {
  flex-shrink: 0;
  color: #52c41a;
  display: flex;
  align-items: center;
  margin-top: 2px;
}

.qp-meta-row {
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex-wrap: wrap;
}

.qp-meta-label {
  flex-shrink: 0;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
}

.qp-meta-value {
  font-size: 13px;
  color: var(--text-primary);

  &.answer-value {
    padding: 2px 10px;
    border-radius: 6px;
    background: #f6ffed;
    color: #237804;
    border: 1px solid #b7eb8f;
    font-weight: 600;
  }
}

.qp-meta-block {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 12px;
  background: rgba(22, 119, 255, 0.04);
  border-left: 3px solid var(--primary);
  border-radius: 6px;
}

.qp-meta-text {
  margin: 0;
  font-size: 13px;
  line-height: 1.55;
  color: var(--text-primary);
  white-space: pre-wrap;
  word-break: break-word;
}

.qp-kp-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.qp-kp-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.qp-kp-chip {
  padding: 2px 10px;
  font-size: 11px;
  border-radius: 10px;
  background: linear-gradient(135deg, #f9f0ff, #f3e8ff);
  color: #722ed1;
  border: 1px solid rgba(114, 46, 209, 0.18);
}

.qp-action-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-top: 4px;
  border-top: 1px dashed transparent;
}

.qp-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: #fff;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  min-height: 30px;
  color: var(--text-secondary);
  transition: all 0.18s ease;

  &:hover {
    border-color: var(--primary);
    color: var(--primary);
  }

  &.danger {
    color: #cf1322;
    &:hover {
      border-color: #cf1322;
      color: #fff;
      background: #cf1322;
    }
  }
}
</style>
