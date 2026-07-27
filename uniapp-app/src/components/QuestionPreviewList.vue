<template>
  <view class="qp-list">
    <view class="qp-list-head">
      <text class="qp-list-title">{{ title }}（{{ questions.length }}）</text>
      <button
        v-if="questions.length > 0"
        class="qp-tool-btn"
        :class="{ active: allExpanded }"
        @tap="toggleAll"
      >{{ allExpanded ? '全部折叠' : '全部展开' }}</button>
    </view>

    <view v-if="questions.length === 0" class="qp-empty">
      <text>暂无题目</text>
    </view>

    <view v-else class="qp-items">
      <view
        v-for="(q, idx) in questions"
        :key="q.id || idx"
        class="qp-item"
        :class="{ expanded: isExpanded(idx) }"
      >
        <view class="qp-item-head" @tap="toggleOne(idx)">
          <view class="qp-num">
            <text class="qp-num-text">{{ idx + 1 }}</text>
          </view>
          <view class="qp-type-chip" :class="q.type">
            <text>{{ typeLabel(q.type) }}</text>
          </view>
          <view v-if="q.difficulty" class="qp-diff-chip" :class="q.difficulty">
            <text>{{ diffLabel(q.difficulty) }}</text>
          </view>
          <view v-if="typeof q.points === 'number'" class="qp-points-chip">
            <text>{{ q.points }} 分</text>
          </view>
          <text class="qp-text-line">
            {{ contentText(q).length > 48 ? contentText(q).slice(0, 48) + '…' : contentText(q) }}
          </text>
          <view class="qp-caret" :class="{ rotate: isExpanded(idx) }">
            <Icon name="chevron-down" size="sm" />
          </view>
        </view>

        <view v-if="isExpanded(idx)" class="qp-item-body">
          <text class="qp-content">{{ contentText(q) }}</text>

          <view
            v-if="normalizedOptions(q).length > 0 && q.type !== 'short_answer'"
            class="qp-options"
          >
            <view
              v-for="opt in normalizedOptions(q)"
              :key="opt.key"
              class="qp-option"
              :class="{ correct: isCorrectOption(q, opt.key) }"
            >
              <view class="qp-option-key">
                <text>{{ opt.key }}</text>
              </view>
              <text class="qp-option-text">{{ opt.content }}</text>
              <view v-if="isCorrectOption(q, opt.key)" class="qp-correct-mark">
                <Icon name="check" size="sm" tone="success" />
              </view>
            </view>
          </view>

          <view v-if="q.type === 'true_false' && q.answer" class="qp-meta-row">
            <text class="qp-meta-label">正确答案</text>
            <view class="qp-answer-pill">
              <text>{{ tfDisplay(String(q.answer)) }}</text>
            </view>
          </view>

          <view
            v-if="q.type !== 'short_answer' && q.type !== 'true_false' && q.answer && normalizedOptions(q).length === 0"
            class="qp-meta-row"
          >
            <text class="qp-meta-label">正确答案</text>
            <view class="qp-answer-pill">
              <text>{{ String(q.answer) }}</text>
            </view>
          </view>

          <view v-if="q.type === 'short_answer' && q.referenceAnswer" class="qp-meta-block">
            <text class="qp-meta-label">参考答案</text>
            <text class="qp-meta-text">{{ q.referenceAnswer }}</text>
          </view>

          <view v-if="q.analysis" class="qp-meta-block">
            <text class="qp-meta-label">解析</text>
            <text class="qp-meta-text">{{ q.analysis }}</text>
          </view>

          <view v-if="q.knowledgePoints && q.knowledgePoints.length > 0" class="qp-kp-row">
            <text class="qp-meta-label">知识点</text>
            <view class="qp-kp-chips">
              <view v-for="kp in q.knowledgePoints" :key="kp" class="qp-kp-chip">
                <text>{{ kp }}</text>
              </view>
            </view>
          </view>

          <view v-if="removable" class="qp-action-row">
            <view class="qp-spacer" />
            <button class="qp-action-btn danger" @tap.stop="$emit('remove', idx)">
              <Icon name="trash" size="sm" tone="danger" />
              <text>删除</text>
            </button>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import Icon from '@/components/ui/Icon.vue'

export interface PreviewOption { key: string; content: string }

export interface PreviewQuestion {
  id?: string
  type: string
  /** 题干文本。优先用 content，回退到 stem */
  content?: string
  stem?: string
  options?: PreviewOption[] | string[]
  answer?: string | number | string[]
  referenceAnswer?: string
  analysis?: string
  points?: number
  score?: number
  difficulty?: 'easy' | 'medium' | 'hard'
  knowledgePoints?: string[]
}

const props = withDefaults(defineProps<{
  questions: PreviewQuestion[]
  title?: string
  defaultExpandFirst?: boolean
  removable?: boolean
}>(), {
  title: '题目列表',
  defaultExpandFirst: true,
  removable: false,
})

defineEmits<{ remove: [idx: number] }>()

const expanded = ref<Set<number>>(new Set())

watch(
  () => props.questions.length,
  (n, rawOldN) => {
    const oldN = rawOldN ?? 0
    if (props.defaultExpandFirst && n > 0 && oldN === 0) expanded.value.add(0)
    if (n > oldN) for (let i = oldN; i < n; i++) expanded.value.add(i)
    if (n < oldN) {
      const next = new Set<number>()
      for (const i of expanded.value) if (i < n) next.add(i)
      expanded.value = next
    }
  },
  { immediate: true },
)

const allExpanded = computed(
  () => props.questions.length > 0 && expanded.value.size === props.questions.length,
)

function isExpanded(idx: number) { return expanded.value.has(idx) }

function toggleOne(idx: number) {
  const next = new Set(expanded.value)
  if (next.has(idx)) next.delete(idx); else next.add(idx)
  expanded.value = next
}

function toggleAll() {
  if (allExpanded.value) expanded.value = new Set()
  else expanded.value = new Set(props.questions.map((_, i) => i))
}

function contentText(q: PreviewQuestion): string {
  return q.content || q.stem || ''
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
  const map: Record<string, string> = { easy: '简单', medium: '中等', hard: '困难' }
  return map[d] || d
}

function tfDisplay(ans: string) {
  const a = String(ans).trim()
  if (a === 'A' || a === '对' || a === 'true' || a === 'True') return '对'
  if (a === 'B' || a === '错' || a === 'false' || a === 'False') return '错'
  return ans
}

/** 归一化 options：支持 string[]（A. xxx）与 { key, content }[] 两种格式 */
function normalizedOptions(q: PreviewQuestion): PreviewOption[] {
  const opts = q.options
  if (!opts || opts.length === 0) return []
  if (typeof opts[0] === 'string') {
    return (opts as string[]).map((s, i) => {
      const txt = s.trim()
      const m = txt.match(/^([A-Z])[\.|、](.*)$/u)
      if (m) return { key: m[1] || '', content: (m[2] || '').trim() }
      return { key: String.fromCharCode(65 + i), content: txt }
    })
  }
  return opts as PreviewOption[]
}

function answerKeys(q: PreviewQuestion): string[] {
  const ans = q.answer
  if (ans === undefined || ans === null) return []
  if (Array.isArray(ans)) return ans.map((s) => String(s).toUpperCase().trim()).filter(Boolean)
  return String(ans)
    .toUpperCase()
    .split(/[,，;；\s]+/u)
    .map((s) => s.trim())
    .filter(Boolean)
}

function isCorrectOption(q: PreviewQuestion, key: string): boolean {
  if (!q.answer || q.type === 'short_answer') return false
  if (q.type === 'true_false') {
    const norm = tfDisplay(String(q.answer))
    if (key === 'A' && norm === '对') return true
    if (key === 'B' && norm === '错') return true
    return false
  }
  return answerKeys(q).includes(key.toUpperCase())
}
</script>

<style scoped lang="scss">
.qp-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  width: 100%;
}

.qp-list-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}

.qp-list-title {
  font-size: 24rpx;
  font-weight: 600;
  color: #1f2933;
}

.qp-tool-btn {
  padding: 6rpx 20rpx;
  border: 2rpx solid #d1d5db;
  border-radius: 28rpx;
  background: #ffffff;
  font-size: 22rpx;
  color: #6b7280;
  line-height: 1.4;
  min-height: 0;

  &.active {
    border-color: #2f6bff;
    color: #2f6bff;
    background: rgba(47, 107, 255, 0.08);
  }
}

.qp-empty {
  padding: 32rpx;
  background: #f7f9fc;
  border-radius: 16rpx;
  text-align: center;
  color: #9ca3af;
  font-size: 24rpx;
}

.qp-items {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.qp-item {
  background: #f7f9fc;
  border: 2rpx solid transparent;
  border-radius: 16rpx;
  overflow: hidden;

  &.expanded {
    background: #ffffff;
    border-color: rgba(47, 107, 255, 0.25);
    box-shadow: 0 8rpx 24rpx -16rpx rgba(47, 107, 255, 0.25);
  }
}

.qp-item-head {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 16rpx 18rpx;
  min-height: 80rpx;
}

.qp-num {
  width: 40rpx;
  height: 40rpx;
  border-radius: 50%;
  background: #2f6bff;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  .qp-num-text {
    color: #ffffff;
    font-size: 22rpx;
    font-weight: 700;
  }
}

.qp-type-chip {
  padding: 4rpx 14rpx;
  font-size: 20rpx;
  font-weight: 600;
  border-radius: 14rpx;
  flex-shrink: 0;

  text { font-size: 20rpx; }

  &.single_choice { background: #e6f4ff; text { color: #1677ff; } }
  &.multiple_choice { background: #f9f0ff; text { color: #722ed1; } }
  &.true_false { background: #fff7e6; text { color: #d46b08; } }
  &.short_answer { background: #f6ffed; text { color: #389e0d; } }
}

.qp-diff-chip {
  padding: 4rpx 14rpx;
  font-size: 20rpx;
  font-weight: 600;
  border-radius: 14rpx;
  flex-shrink: 0;
  border: 2rpx solid transparent;
  background: #f5f5f5;

  text { font-size: 20rpx; color: #6b7280; }

  &.easy {
    background: #f6ffed;
    border-color: #b7eb8f;
    text { color: #52c41a; }
  }
  &.medium {
    background: #fffbe6;
    border-color: #ffe58f;
    text { color: #d4b106; }
  }
  &.hard {
    background: #fff1f0;
    border-color: #ffa39e;
    text { color: #cf1322; }
  }
}

.qp-points-chip {
  padding: 4rpx 14rpx;
  border-radius: 16rpx;
  background: #fff7e6;
  border: 2rpx solid #ffe7ba;
  flex-shrink: 0;

  text {
    font-size: 20rpx;
    font-weight: 600;
    color: #d46b08;
  }
}

.qp-text-line {
  flex: 1;
  font-size: 24rpx;
  color: #1f2933;
  line-height: 1.4;
}

.qp-caret {
  flex-shrink: 0;
  color: #6b7280;
  transition: transform 0.18s ease;

  &.rotate { transform: rotate(180deg); }
}

.qp-item-body {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  padding: 16rpx 18rpx 20rpx;
  border-top: 2rpx dashed rgba(47, 107, 255, 0.18);
}

.qp-content {
  font-size: 26rpx;
  line-height: 1.6;
  color: #1f2933;
  white-space: pre-wrap;
  word-break: break-word;
}

.qp-options {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
}

.qp-option {
  display: flex;
  align-items: flex-start;
  gap: 14rpx;
  padding: 12rpx 16rpx;
  border: 2rpx solid #e5e7eb;
  border-radius: 14rpx;
  background: #ffffff;

  &.correct {
    border-color: #52c41a;
    background: rgba(82, 196, 26, 0.08);
  }
}

.qp-option-key {
  width: 36rpx;
  height: 36rpx;
  border-radius: 50%;
  background: #f3f4f6;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  text {
    font-size: 20rpx;
    font-weight: 700;
    color: #6b7280;
  }

  .qp-option.correct & {
    background: #52c41a;
    text { color: #ffffff; }
  }
}

.qp-option-text {
  flex: 1;
  font-size: 24rpx;
  line-height: 1.5;
  color: #1f2933;
  word-break: break-word;

  .qp-option.correct & { color: #237804; }
}

.qp-correct-mark {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  padding-top: 4rpx;
}

.qp-meta-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  flex-wrap: wrap;
}

.qp-meta-label {
  font-size: 22rpx;
  font-weight: 600;
  color: #6b7280;
  flex-shrink: 0;
}

.qp-answer-pill {
  padding: 4rpx 16rpx;
  border-radius: 12rpx;
  background: #f6ffed;
  border: 2rpx solid #b7eb8f;

  text {
    font-size: 22rpx;
    font-weight: 600;
    color: #237804;
  }
}

.qp-meta-block {
  display: flex;
  flex-direction: column;
  gap: 6rpx;
  padding: 14rpx 16rpx;
  background: rgba(47, 107, 255, 0.06);
  border-left: 6rpx solid #2f6bff;
  border-radius: 10rpx;
}

.qp-meta-text {
  font-size: 24rpx;
  line-height: 1.55;
  color: #1f2933;
  white-space: pre-wrap;
  word-break: break-word;
}

.qp-kp-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  flex-wrap: wrap;
}

.qp-kp-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx;
}

.qp-kp-chip {
  padding: 4rpx 14rpx;
  border-radius: 14rpx;
  background: linear-gradient(135deg, #f9f0ff, #f3e8ff);
  border: 2rpx solid rgba(114, 46, 209, 0.18);

  text {
    font-size: 20rpx;
    color: #722ed1;
  }
}

.qp-action-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding-top: 4rpx;
}

.qp-spacer { flex: 1; }

.qp-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 8rpx;
  padding: 8rpx 20rpx;
  border: 2rpx solid #e5e7eb;
  border-radius: 24rpx;
  background: #ffffff;
  min-height: 0;
  line-height: 1.4;

  text { font-size: 22rpx; color: #6b7280; }

  &.danger {
    border-color: rgba(207, 19, 34, 0.3);
    text { color: #cf1322; }
  }
}
</style>
