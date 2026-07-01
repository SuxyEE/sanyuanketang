<template>
  <div class="wb-screen">
    <div class="wb-card">
      <header class="wb-header">
        <div class="wb-title-block">
          <span class="wb-kicker">本节课已结束 · 错题回顾</span>
          <h1 class="wb-title">课堂错题分析</h1>
        </div>
        <div v-if="data" class="wb-overview">
          <div class="wb-ov">
            <span class="wb-ov-num">{{ data.totalWrong }}</span>
            <span class="wb-ov-label">错题总数</span>
          </div>
          <div class="wb-ov">
            <span class="wb-ov-num">{{ data.uniqueStudents }}</span>
            <span class="wb-ov-label">涉及学生</span>
          </div>
          <div class="wb-ov">
            <span class="wb-ov-num">{{ data.questions.length }}</span>
            <span class="wb-ov-label">错题数量</span>
          </div>
        </div>
      </header>

      <div v-if="loading" class="wb-state">
        <div class="wb-spinner"></div>
        <span>正在统计本堂错题…</span>
      </div>
      <div v-else-if="error" class="wb-state">
        <span class="wb-state-icon">⚠️</span>
        <span>{{ error }}</span>
      </div>
      <div v-else-if="isEmpty" class="wb-state">
        <span class="wb-state-icon">🎉</span>
        <span>本堂暂无错题记录，全员掌握良好！</span>
      </div>

      <div v-else class="wb-body">
        <section class="wb-col wb-col-kp">
          <h2 class="wb-col-title">薄弱知识点 Top {{ topKnowledgePoints.length }}</h2>
          <div v-for="(kp, i) in topKnowledgePoints" :key="i" class="wb-kp">
            <span class="wb-kp-rank">{{ i + 1 }}</span>
            <span class="wb-kp-name">{{ kp.name }}</span>
            <div class="wb-kp-bar-wrap">
              <div class="wb-kp-bar" :style="{ width: kpPct(kp.wrongCount) + '%' }"></div>
            </div>
            <span class="wb-kp-count">{{ kp.wrongCount }}</span>
          </div>
        </section>

        <section class="wb-col wb-col-q">
          <h2 class="wb-col-title">高频错题 Top {{ topQuestions.length }}</h2>
          <div class="wb-q-list">
            <div v-for="(q, i) in topQuestions" :key="q.questionId || i" class="wb-q">
              <div class="wb-q-head">
                <span class="wb-q-rank">{{ i + 1 }}</span>
                <span class="wb-q-type" :class="q.questionType">{{ typeLabel(q.questionType) }}</span>
                <span class="wb-q-wrong">{{ q.wrongCount }} 人错</span>
              </div>
              <p class="wb-q-content">{{ q.questionContent }}</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { API_BASE } from '../shared/backend'

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

const props = defineProps<{ lessonId: string }>()
const emit = defineEmits<{ close: [] }>()

const TOP_QUESTIONS = 8
const TOP_KNOWLEDGE = 8

const loading = ref(true)
const error = ref('')
const data = ref<WrongBookStats | null>(null)

const topQuestions = computed(() =>
  [...(data.value?.questions || [])].sort((a, b) => b.wrongCount - a.wrongCount).slice(0, TOP_QUESTIONS),
)
const topKnowledgePoints = computed(() =>
  [...(data.value?.topKnowledgePoints || [])].sort((a, b) => b.wrongCount - a.wrongCount).slice(0, TOP_KNOWLEDGE),
)
const maxKpWrong = computed(() => topKnowledgePoints.value.reduce((m, k) => Math.max(m, k.wrongCount), 1))
const isEmpty = computed(() => !!data.value && topQuestions.value.length === 0 && topKnowledgePoints.value.length === 0)

function kpPct(n: number) {
  return Math.min(100, Math.round((n / maxKpWrong.value) * 100))
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

async function load() {
  if (!props.lessonId) {
    error.value = '无课堂信息，无法统计错题'
    loading.value = false
    return
  }
  loading.value = true
  error.value = ''
  try {
    const res = await fetch(`${API_BASE}/wrong-book/lesson-stats?lessonId=${encodeURIComponent(props.lessonId)}`)
    const body = await res.json()
    if (body && body.success && body.data) {
      data.value = body.data as WrongBookStats
    } else {
      data.value = null
      error.value = (body && body.message) || '暂无错题数据'
    }
  } catch {
    data.value = null
    error.value = '错题数据加载失败'
  } finally {
    loading.value = false
    // 预埋逻辑期望：无数据 / 失败时自动关闭，回到“本节课已结束”谢幕
    if (error.value || isEmpty.value) {
      setTimeout(() => emit('close'), 2500)
    }
  }
}

onMounted(load)
</script>

<style scoped lang="scss">
.wb-screen {
  position: fixed;
  inset: 0;
  z-index: 46;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48px;
  background: radial-gradient(circle at 50% 25%, rgba(22, 63, 140, 0.5), rgba(6, 10, 31, 0.92));
  animation: wb-fade 0.4s ease;
}
@keyframes wb-fade { from { opacity: 0; } to { opacity: 1; } }

.wb-card {
  width: min(1500px, 100%);
  max-height: 100%;
  display: flex;
  flex-direction: column;
  background: rgba(15, 20, 48, 0.94);
  border: 1px solid rgba(120, 170, 255, 0.24);
  border-radius: 28px;
  padding: 40px 52px;
  box-shadow: 0 30px 90px -20px rgba(0, 0, 0, 0.6);
}

.wb-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
  padding-bottom: 24px;
  margin-bottom: 28px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}
.wb-kicker { font-size: 16px; font-weight: 600; color: #7fb0ff; letter-spacing: 1px; }
.wb-title { margin: 8px 0 0; font-size: 40px; font-weight: 800; color: #fff; }

.wb-overview { display: flex; gap: 40px; }
.wb-ov { display: flex; flex-direction: column; align-items: center; }
.wb-ov-num { font-size: 56px; font-weight: 800; color: #ff7d6b; line-height: 1; font-variant-numeric: tabular-nums; }
.wb-ov-label { margin-top: 6px; font-size: 15px; color: rgba(255, 255, 255, 0.55); }

.wb-state {
  flex: 1;
  min-height: 320px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 18px;
  color: rgba(255, 255, 255, 0.6);
  font-size: 22px;
}
.wb-state-icon { font-size: 64px; }
.wb-spinner {
  width: 64px; height: 64px; border-radius: 50%;
  border: 6px solid rgba(255, 255, 255, 0.14); border-top-color: #4da3ff;
  animation: wb-spin 800ms linear infinite;
}
@keyframes wb-spin { to { transform: rotate(360deg); } }

.wb-body {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 1fr 1.1fr;
  gap: 44px;
}
.wb-col { display: flex; flex-direction: column; min-height: 0; }
.wb-col-title {
  margin: 0 0 20px;
  font-size: 24px;
  font-weight: 700;
  color: #fff;
}

/* ---- 知识点横条 ---- */
.wb-kp {
  display: grid;
  grid-template-columns: 40px minmax(160px, 260px) 1fr 64px;
  gap: 16px;
  align-items: center;
  margin-bottom: 18px;
}
.wb-kp-rank {
  width: 40px; height: 40px; border-radius: 12px;
  display: flex; align-items: center; justify-content: center;
  background: rgba(250, 173, 20, 0.18); color: #ffd666;
  font-size: 18px; font-weight: 800;
}
.wb-kp-name {
  font-size: 20px; color: rgba(255, 255, 255, 0.92);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.wb-kp-bar-wrap { height: 26px; background: rgba(255, 255, 255, 0.06); border-radius: 13px; overflow: hidden; }
.wb-kp-bar {
  height: 100%; min-width: 3px; border-radius: 13px;
  background: linear-gradient(90deg, #faad14, #ff7d4d);
  transition: width 0.7s cubic-bezier(0.22, 1, 0.36, 1);
}
.wb-kp-count { font-size: 22px; font-weight: 800; color: #fff; text-align: right; font-variant-numeric: tabular-nums; }

/* ---- 错题列表 ---- */
.wb-q-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding-right: 6px;

  &::-webkit-scrollbar { width: 5px; }
  &::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.15); border-radius: 4px; }
}
.wb-q {
  padding: 16px 20px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
}
.wb-q-head { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
.wb-q-rank {
  width: 34px; height: 34px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  background: rgba(65, 120, 255, 0.22); color: #7fb0ff; font-size: 16px; font-weight: 800;
}
.wb-q-type {
  padding: 3px 12px; border-radius: 8px; font-size: 14px; font-weight: 700;
  background: rgba(65, 120, 255, 0.16); color: #7fb0ff;
  &.single_choice { background: rgba(22, 119, 255, 0.18); color: #69b1ff; }
  &.multiple_choice { background: rgba(114, 46, 209, 0.2); color: #b37feb; }
  &.true_false { background: rgba(212, 107, 8, 0.2); color: #ffc069; }
  &.short_answer { background: rgba(56, 158, 13, 0.2); color: #95de64; }
}
.wb-q-wrong { margin-left: auto; font-size: 16px; font-weight: 700; color: #ff7875; font-variant-numeric: tabular-nums; }
.wb-q-content { margin: 0; font-size: 19px; line-height: 1.5; color: rgba(255, 255, 255, 0.9); }

@media (max-width: 1024px) {
  .wb-card { padding: 28px; }
  .wb-title { font-size: 30px; }
  .wb-overview { gap: 24px; }
  .wb-ov-num { font-size: 40px; }
  .wb-body { grid-template-columns: 1fr; gap: 28px; }
}
</style>
