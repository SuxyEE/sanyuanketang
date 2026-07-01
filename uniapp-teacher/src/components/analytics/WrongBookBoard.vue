<template>
  <view v-if="open" class="modal-mask" @tap="close">
    <view class="modal-card" @tap.stop>
      <view class="modal-head">
        <text class="modal-title">错题学情</text>
        <view class="head-actions">
          <button class="icon-btn" :class="{ spinning: loading }" @tap="fetchStats">
            <Icon name="download" size="sm" />
          </button>
          <button class="close-btn" @tap="close"><Icon name="x" size="md" /></button>
        </view>
      </view>

      <!-- 加载 -->
      <view v-if="loading && !data" class="state-box">
        <view class="state-spinner"></view>
        <text class="state-text">正在加载错题数据…</text>
      </view>

      <!-- 错误 / 空 -->
      <view v-else-if="error" class="state-box">
        <Icon name="alert-circle" size="2xl" tone="warning" />
        <text class="state-text">{{ error }}</text>
        <Button variant="secondary" size="sm" icon-left="download" @tap="fetchStats">重新加载</Button>
      </view>

      <view v-else-if="data" class="board">
        <!-- 概览 -->
        <view class="overview">
          <view class="ov-stat">
            <text class="ov-num">{{ data.totalWrong }}</text>
            <text class="ov-label">错题总数</text>
          </view>
          <view class="ov-stat">
            <text class="ov-num">{{ data.uniqueStudents }}</text>
            <text class="ov-label">涉及学生</text>
          </view>
          <view class="ov-stat">
            <text class="ov-num">{{ data.questions.length }}</text>
            <text class="ov-label">错题数量</text>
          </view>
        </view>

        <!-- 薄弱知识点 -->
        <view v-if="topKnowledgePoints.length > 0" class="section">
          <text class="section-title">薄弱知识点 Top {{ topKnowledgePoints.length }}</text>
          <view class="kp-row" v-for="(kp, i) in topKnowledgePoints" :key="i">
            <text class="kp-name">{{ kp.name }}</text>
            <view class="kp-track">
              <view class="kp-fill" :style="{ width: kpPercent(kp.wrongCount) + '%' }"></view>
            </view>
            <text class="kp-count">{{ kp.wrongCount }}</text>
          </view>
        </view>

        <!-- 错题 TopN -->
        <view v-if="topQuestions.length > 0" class="section">
          <text class="section-title">高频错题 Top {{ topQuestions.length }}</text>
          <view class="q-item" v-for="(q, i) in topQuestions" :key="q.questionId || i">
            <view class="q-head">
              <view class="q-rank">{{ i + 1 }}</view>
              <view class="q-type" :class="q.questionType">{{ typeLabel(q.questionType) }}</view>
              <view class="q-wrong">
                <Icon name="alert-circle" size="xs" tone="danger" />
                <text>{{ q.wrongCount }} 人错</text>
              </view>
            </view>
            <text class="q-content">{{ q.questionContent }}</text>
            <view v-if="q.wrongStudents && q.wrongStudents.length > 0" class="q-students">
              <text
                v-for="s in q.wrongStudents.slice(0, 12)"
                :key="s.id"
                class="q-student-chip"
              >{{ s.name }}</text>
              <text v-if="q.wrongStudents.length > 12" class="q-student-more">+{{ q.wrongStudents.length - 12 }}</text>
            </view>
          </view>
        </view>

        <view v-if="topQuestions.length === 0 && topKnowledgePoints.length === 0" class="state-box">
          <Icon name="check-circle" size="2xl" tone="success" />
          <text class="state-text">本堂暂无错题记录</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Icon from '@/components/ui/Icon.vue'
import Button from '@/components/ui/Button.vue'
import { API_BASE } from '@/shared/config'

interface WrongStudent { id: string; name: string }
interface WrongQuestion {
  questionId: string
  questionContent: string
  questionType: string
  wrongCount: number
  wrongStudents: WrongStudent[]
}
interface KnowledgePoint { name: string; wrongCount: number }
interface WrongBookStats {
  lessonId: string
  totalWrong: number
  uniqueStudents: number
  questions: WrongQuestion[]
  topKnowledgePoints: KnowledgePoint[]
}

const props = defineProps<{ open: boolean; lessonId: string }>()
const emit = defineEmits<{ 'update:open': [boolean] }>()

const TOP_QUESTIONS = 10
const TOP_KNOWLEDGE = 8

const loading = ref(false)
const error = ref('')
const data = ref<WrongBookStats | null>(null)

const topQuestions = computed(() =>
  [...(data.value?.questions || [])].sort((a, b) => b.wrongCount - a.wrongCount).slice(0, TOP_QUESTIONS),
)
const topKnowledgePoints = computed(() =>
  [...(data.value?.topKnowledgePoints || [])].sort((a, b) => b.wrongCount - a.wrongCount).slice(0, TOP_KNOWLEDGE),
)
const maxKpWrong = computed(() => Math.max(...topKnowledgePoints.value.map((k) => k.wrongCount), 1))

function kpPercent(n: number) {
  return Math.round((n / maxKpWrong.value) * 100)
}

function typeLabel(t: string) {
  const map: Record<string, string> = {
    single_choice: '单选',
    multiple_choice: '多选',
    true_false: '判断',
    short_answer: '简答',
  }
  return map[t] || '题目'
}

function fetchStats() {
  if (!props.lessonId) {
    error.value = '当前无课堂码，无法查询'
    data.value = null
    return
  }
  loading.value = true
  error.value = ''
  uni.request({
    url: `${API_BASE}/wrong-book/lesson-stats?lessonId=${encodeURIComponent(props.lessonId)}`,
    method: 'GET',
    success: (res: any) => {
      const body = res?.data
      if (body && body.success && body.data) {
        data.value = body.data as WrongBookStats
      } else {
        data.value = null
        error.value = body?.message || '暂无错题数据'
      }
    },
    fail: () => {
      data.value = null
      error.value = '加载失败，请检查网络后重试'
    },
    complete: () => { loading.value = false },
  })
}

function close() {
  emit('update:open', false)
}

watch(() => props.open, (v) => { if (v) fetchStats() })
</script>

<style scoped lang="scss">
@import '@/styles/variables.scss';

.modal-mask {
  position: fixed; inset: 0; background: var(--color-scrim);
  display: flex; align-items: center; justify-content: center; z-index: var(--z-modal); padding: var(--space-5);
}
.modal-card {
  width: 92%; max-width: 720rpx; max-height: 86vh; overflow-y: auto; background: var(--color-surface-raised);
  border-radius: var(--radius-2xl); padding: var(--space-6); box-shadow: var(--elevation-4);
}
.modal-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-5); }
.modal-title { font-size: var(--font-title-sm); font-weight: var(--font-weight-bold); color: var(--color-text-primary); }
.head-actions { display: flex; align-items: center; gap: var(--space-2); }
.icon-btn, .close-btn {
  width: 64rpx; height: 64rpx; min-height: 0; padding: 0; display: flex; align-items: center; justify-content: center;
  background: var(--color-surface-variant); border-radius: var(--radius-full); color: var(--color-text-secondary);
}
.icon-btn.spinning { animation: spin 800ms linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.state-box {
  display: flex; flex-direction: column; align-items: center; gap: var(--space-3);
  padding: var(--space-9) var(--space-4);
}
.state-text { font-size: var(--font-caption); color: var(--color-text-tertiary); }
.state-spinner {
  width: 56rpx; height: 56rpx; border-radius: 50%;
  border: 6rpx solid var(--color-outline); border-top-color: var(--color-primary);
  animation: spin 800ms linear infinite;
}

.board { display: flex; flex-direction: column; gap: var(--space-5); }

.overview { display: flex; gap: var(--space-3); }
.ov-stat {
  flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4rpx;
  padding: var(--space-4) var(--space-2); background: var(--color-surface-variant); border-radius: var(--radius-lg);
}
.ov-num { font-size: var(--font-title-lg); font-weight: var(--font-weight-bold); color: var(--color-primary); line-height: 1.1; }
.ov-label { font-size: var(--font-overline); color: var(--color-text-tertiary); }

.section { display: flex; flex-direction: column; gap: var(--space-3); }
.section-title { font-size: var(--font-label); font-weight: var(--font-weight-semibold); color: var(--color-text-primary); }

.kp-row { display: flex; align-items: center; gap: var(--space-3); }
.kp-name { width: 220rpx; font-size: var(--font-caption); color: var(--color-text-primary); overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.kp-track { flex: 1; height: 24rpx; background: var(--color-surface-variant); border-radius: var(--radius-pill); overflow: hidden; }
.kp-fill { height: 100%; background: var(--color-warning); border-radius: var(--radius-pill); transition: width var(--duration-med) var(--ease-standard); }
.kp-count { width: 56rpx; text-align: right; font-size: var(--font-caption); font-weight: var(--font-weight-semibold); color: var(--color-text-primary); }

.q-item {
  display: flex; flex-direction: column; gap: var(--space-2);
  padding: var(--space-4); background: var(--color-surface-variant); border-radius: var(--radius-lg);
}
.q-head { display: flex; align-items: center; gap: var(--space-2); }
.q-rank {
  width: 40rpx; height: 40rpx; border-radius: 50%; background: var(--color-primary); color: var(--color-text-on-color);
  display: flex; align-items: center; justify-content: center; font-size: var(--font-caption); font-weight: var(--font-weight-bold); flex-shrink: 0;
}
.q-type {
  padding: 4rpx 14rpx; font-size: var(--font-overline); font-weight: var(--font-weight-semibold); border-radius: var(--radius-sm);
  background: var(--color-primary-container); color: var(--color-on-primary-container);
  &.single_choice { background: #e6f4ff; color: #1677ff; }
  &.multiple_choice { background: #f9f0ff; color: #722ed1; }
  &.true_false { background: #fff7e6; color: #d46b08; }
  &.short_answer { background: #f6ffed; color: #389e0d; }
}
.q-wrong { margin-left: auto; display: flex; align-items: center; gap: 4rpx; text { font-size: var(--font-overline); color: var(--color-danger); } }
.q-content { font-size: var(--font-body); color: var(--color-text-primary); line-height: 1.5; word-break: break-word; }
.q-students { display: flex; flex-wrap: wrap; gap: 8rpx; }
.q-student-chip {
  padding: 4rpx var(--space-3); background: var(--color-danger-container); color: var(--color-on-danger-container);
  border-radius: var(--radius-pill); font-size: var(--font-overline);
}
.q-student-more { padding: 4rpx var(--space-2); font-size: var(--font-overline); color: var(--color-text-tertiary); }
</style>
