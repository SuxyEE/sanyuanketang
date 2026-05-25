<template>
  <div class="quiz-report" role="dialog" aria-label="测验报告">
    <div class="panel-header">
      <div class="header-title">
        <h3>{{ report.title }} · 测验报告</h3>
        <p class="header-sub">
          {{ formatTime(report.startedAt) }} 开始 · {{ report.submittedCount }}/{{ report.totalStudents || report.submittedCount }} 人提交
        </p>
      </div>
      <button class="close-btn" @click="$emit('close')" aria-label="关闭">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>

    <div class="panel-body">
      <section class="summary-cards">
        <div class="stat-card primary">
          <span class="stat-label">平均分</span>
          <span class="stat-value">{{ report.avgScore || 0 }}</span>
          <span class="stat-unit">分</span>
        </div>
        <div class="stat-card success">
          <span class="stat-label">最高分</span>
          <span class="stat-value">{{ report.maxScore || 0 }}</span>
          <span class="stat-unit">分</span>
        </div>
        <div class="stat-card warning">
          <span class="stat-label">最低分</span>
          <span class="stat-value">{{ report.minScore || 0 }}</span>
          <span class="stat-unit">分</span>
        </div>
        <div class="stat-card info">
          <span class="stat-label">参与人数</span>
          <span class="stat-value">{{ report.submittedCount }}</span>
          <span class="stat-unit">人</span>
        </div>
      </section>

      <section v-if="hasMastery" class="mastery-section">
        <h4 class="mastery-title">知识点掌握度<span class="mastery-hint">基于本次测验</span></h4>
        <div class="mastery-list">
          <div
            v-for="m in report.knowledgeMastery"
            :key="m.knowledgePointName"
            class="mastery-row"
            :class="m.status"
          >
            <div class="mastery-head">
              <span class="mastery-name">{{ m.knowledgePointName }}</span>
              <span class="mastery-meta">
                <span class="mastery-q-count">{{ m.questionCount }} 道题</span>
                <strong class="mastery-pct">{{ m.masteryPercent }}%</strong>
              </span>
            </div>
            <div class="mastery-bar">
              <div class="mastery-fill" :style="{ width: m.masteryPercent + '%' }"></div>
            </div>
            <span class="mastery-status">{{ statusLabel(m.status) }}</span>
          </div>
        </div>
      </section>

      <div class="tab-bar">
        <button :class="{ active: tab === 'questions' }" @click="tab = 'questions'">按题目分析</button>
        <button :class="{ active: tab === 'students' }" @click="tab = 'students'">按学生分析</button>
      </div>

      <section v-if="tab === 'questions'" class="question-list">
        <div
          v-for="(qs, idx) in report.questionStats"
          :key="qs.question.id || idx"
          class="question-block"
        >
          <div class="qb-head">
            <div class="qb-num">{{ idx + 1 }}</div>
            <div class="qb-meta">
              <span class="qb-type-badge" :class="qs.question.type">{{ typeLabel(qs.question.type) }}</span>
              <span class="qb-stats">
                <template v-if="isObjective(qs.question.type)">
                  正确率
                  <strong :class="rateClass(qs.correctRate)">{{ qs.correctRate }}%</strong>
                </template>
                <template v-else>
                  AI 平均
                  <strong :class="rateClass(qs.avgScore)">{{ qs.avgScore }}</strong>
                  分
                </template>
              </span>
            </div>
          </div>
          <div class="qb-content-row">
            <p class="qb-content">{{ qs.question.content }}</p>
            <TtsButton :text="qs.question.content" />
          </div>

          <div v-if="isObjective(qs.question.type)" class="option-stats">
            <div
              v-for="opt in resolveOptions(qs.question)"
              :key="opt.key"
              class="opt-stat"
              :class="{ correct: isCorrectOption(qs.question, opt.key) }"
            >
              <div class="opt-stat-head">
                <span class="opt-stat-key">{{ opt.displayKey || opt.key }}</span>
                <span class="opt-stat-text">{{ opt.content }}</span>
                <span class="opt-stat-count">{{ answerCountForOption(qs, opt.key) }} 人</span>
              </div>
              <div class="opt-stat-bar">
                <div
                  class="opt-stat-fill"
                  :class="{ correct: isCorrectOption(qs.question, opt.key) }"
                  :style="{ width: optionPct(qs, opt.key) + '%' }"
                ></div>
              </div>
            </div>
            <p v-if="qs.question.answer" class="qb-answer">
              <span class="answer-tag">正确答案</span>
              <strong>{{ qs.question.answer }}</strong>
              <template v-if="qs.question.analysis"> · 解析：{{ qs.question.analysis }}</template>
            </p>
          </div>

          <div v-else class="short-answers">
            <div
              v-for="(ans, ai) in qs.answers.filter((a: any) => a.answer)"
              :key="ai"
              class="short-ans-card"
            >
              <div class="sa-head">
                <span class="sa-student">{{ ans.studentName }}</span>
                <span v-if="ans.score != null" class="sa-score" :class="rateClass(ans.score)">{{ ans.score }} 分</span>
              </div>
              <div class="sa-answer-row">
                <p class="sa-answer">{{ ans.answer }}</p>
                <TtsButton :text="`${ans.studentName} 的回答：${ans.answer}`" />
              </div>
              <p v-if="ans.comment" class="sa-comment">
                <span class="ai-tag">AI 评语</span>
                {{ ans.comment }}
              </p>
            </div>
            <p v-if="qs.answers.filter((a: any) => a.answer).length === 0" class="empty-tip">没有学生作答这道题</p>
            <p v-if="qs.question.referenceAnswer" class="qb-answer">
              <span class="answer-tag">参考答案</span>
              {{ qs.question.referenceAnswer }}
            </p>
          </div>
        </div>
      </section>

      <section v-else class="student-list">
        <table class="student-table">
          <thead>
            <tr>
              <th>学生</th>
              <th>得分</th>
              <th>提交时间</th>
              <th>详情</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="s in report.submissions" :key="s.studentId" @click="expandStudent = expandStudent === s.studentId ? '' : s.studentId" :class="{ active: expandStudent === s.studentId }">
              <td>{{ s.studentName }}</td>
              <td><strong :class="rateClass(s.score)">{{ s.score }}</strong></td>
              <td class="dim">{{ formatTime(s.submittedAt) }}</td>
              <td><button class="link-btn">{{ expandStudent === s.studentId ? '收起' : '展开' }}</button></td>
            </tr>
            <tr v-if="expandStudent" class="expand-row">
              <td colspan="4">
                <div class="student-detail">
                  <div v-for="(q, qi) in report.questions" :key="q.id || qi" class="sd-q">
                    <div class="sd-q-head">
                      <span class="sd-q-num">第 {{ qi + 1 }} 题</span>
                      <span class="qb-type-badge" :class="q.type">{{ typeLabel(q.type) }}</span>
                      <span class="sd-q-score" :class="rateClass(perQuestion(q.id || `q-${qi + 1}`)?.score)">
                        {{ perQuestion(q.id || `q-${qi + 1}`)?.score ?? '-' }} 分
                      </span>
                    </div>
                    <p class="sd-q-content">{{ q.content }}</p>
                    <p class="sd-q-answer">
                      <span class="answer-tag">学生答案</span>
                      {{ getStudentAnswer(q.id || `q-${qi + 1}`) || '（未作答）' }}
                    </p>
                    <p v-if="perQuestion(q.id || `q-${qi + 1}`)?.comment" class="sd-q-comment">
                      <span class="ai-tag">AI 评语</span>
                      {{ perQuestion(q.id || `q-${qi + 1}`)?.comment }}
                    </p>
                  </div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>

    <div class="panel-actions">
      <button class="btn-secondary" @click="exportMarkdown" :title="'复制 Markdown 到剪贴板'">导出 Markdown</button>
      <button class="btn-secondary" @click="exportPPTX" :disabled="exportingPptx" :title="'下载 PPTX 课后报告，可分享给学生或归档'">
        <span v-if="exportingPptx" class="btn-spinner"></span>
        {{ exportingPptx ? '生成中…' : '下载 PPTX' }}
      </button>
      <button class="btn-primary" @click="$emit('close')">完成</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useToast } from '../composables/useToast'
import TtsButton from './TtsButton.vue'
import { exportQuizReportToPPTX } from '../utils/pptx-export'

interface PerQuestion { score: number; correct?: boolean; comment?: string; aiGraded?: boolean }

interface Submission {
  studentId: string
  studentName: string
  score?: number
  submittedAt: string
  perQuestion?: Record<string, PerQuestion>
}

interface Question {
  id?: string
  type: string
  content: string
  options?: { key: string; content: string }[]
  answer?: string
  analysis?: string
  referenceAnswer?: string
  knowledgePoints?: string[]
}

interface KnowledgeMastery {
  knowledgePointName: string
  masteryPercent: number
  questionCount: number
  status: 'mastered' | 'practicing' | 'needs_improvement'
}

interface QuestionStat {
  question: Question
  answerCount: Record<string, number>
  correctCount: number
  correctRate: number
  avgScore: number
  answers: Array<{ studentId: string; studentName: string; answer: string; score?: number; comment?: string; correct?: boolean }>
}

interface Report {
  taskId: string
  title: string
  startedAt: string
  endedAt?: string
  totalStudents: number
  submittedCount: number
  avgScore: number
  maxScore: number
  minScore: number
  questions: Question[]
  questionStats: QuestionStat[]
  knowledgeMastery?: KnowledgeMastery[]
  submissions: Submission[]
}

const props = defineProps<{ report: Report }>()
defineEmits<{ close: [] }>()

const { toastSuccess } = useToast()

const tab = ref<'questions' | 'students'>('questions')
const expandStudent = ref('')

const hasMastery = computed(() => (props.report.knowledgeMastery?.length ?? 0) > 0)

function statusLabel(s: 'mastered' | 'practicing' | 'needs_improvement'): string {
  if (s === 'mastered') return '已掌握'
  if (s === 'practicing') return '练习中'
  return '需加强'
}

const expandedSubmission = computed(() => props.report.submissions.find(s => s.studentId === expandStudent.value))

function isObjective(t: string) {
  return t === 'single_choice' || t === 'multiple_choice' || t === 'true_false'
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

function rateClass(v: number | undefined) {
  if (v == null) return ''
  if (v >= 85) return 'rate-excellent'
  if (v >= 70) return 'rate-good'
  if (v >= 50) return 'rate-fair'
  return 'rate-poor'
}

const TRUE_TOKENS = new Set(['TRUE', 'T', 'YES', 'Y', '1', 'A', '对', '正确'])
const FALSE_TOKENS = new Set(['FALSE', 'F', 'NO', 'N', '0', 'B', '错', '错误'])

function resolveOptions(q: Question) {
  if (q.type === 'true_false' && (!q.options || q.options.length === 0)) {
    return [
      { key: 'true', displayKey: '对', content: '对（正确）' },
      { key: 'false', displayKey: '错', content: '错（错误）' },
    ]
  }
  return (q.options || []).map(o => ({ ...o, displayKey: o.key }))
}

function answerCountForOption(qs: QuestionStat, key: string): number {
  if (qs.question.type !== 'true_false') return qs.answerCount[key] || 0
  const targetIsTrue = TRUE_TOKENS.has(key.toUpperCase()) || TRUE_TOKENS.has(key)
  let count = 0
  for (const [k, v] of Object.entries(qs.answerCount)) {
    const upper = k.toUpperCase()
    const isTrue = TRUE_TOKENS.has(upper) || TRUE_TOKENS.has(k)
    const isFalse = FALSE_TOKENS.has(upper) || FALSE_TOKENS.has(k)
    if (targetIsTrue && isTrue) count += v
    if (!targetIsTrue && isFalse) count += v
  }
  return count
}

function optionPct(qs: QuestionStat, key: string): number {
  const total = props.report.submittedCount || 1
  return Math.round((answerCountForOption(qs, key) / total) * 100)
}

function isCorrectOption(q: Question, key: string) {
  if (!q.answer) return false
  const upperAnswer = q.answer.trim().toUpperCase()
  if (q.type === 'true_false') {
    const targetIsTrue = TRUE_TOKENS.has(key.toUpperCase()) || TRUE_TOKENS.has(key)
    const answerIsTrue = TRUE_TOKENS.has(upperAnswer) || TRUE_TOKENS.has(q.answer.trim())
    return targetIsTrue === answerIsTrue
  }
  return upperAnswer.split(',').map(s => s.trim()).includes(key.toUpperCase())
}

function formatTime(iso?: string) {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`
  } catch {
    return ''
  }
}

function perQuestion(qid: string): PerQuestion | undefined {
  return expandedSubmission.value?.perQuestion?.[qid]
}

function getStudentAnswer(qid: string): string {
  const sub = expandedSubmission.value
  if (!sub) return ''
  const stat = props.report.questionStats.find(qs => (qs.question.id || '') === qid)
  return stat?.answers.find(a => a.studentId === sub.studentId)?.answer || ''
}

const exportingPptx = ref(false)

function exportMarkdown() {
  const lines: string[] = []
  lines.push(`# ${props.report.title} - 测验报告`)
  lines.push('')
  lines.push(`- 参与人数：${props.report.submittedCount}/${props.report.totalStudents}`)
  lines.push(`- 平均分：${props.report.avgScore} 分（最高 ${props.report.maxScore} / 最低 ${props.report.minScore}）`)
  lines.push('')
  props.report.questionStats.forEach((qs, i) => {
    lines.push(`## 第 ${i + 1} 题 [${typeLabel(qs.question.type)}]`)
    lines.push(qs.question.content)
    if (isObjective(qs.question.type)) {
      lines.push(`正确率：${qs.correctRate}% (正确 ${qs.correctCount}/${props.report.submittedCount})`)
    } else {
      lines.push(`AI 平均分：${qs.avgScore} 分`)
    }
    lines.push('')
  })
  navigator.clipboard?.writeText(lines.join('\n')).then(() => {
    toastSuccess('Markdown 已复制到剪贴板')
  }).catch(() => {
    console.log(lines.join('\n'))
    toastSuccess('Markdown 已输出到控制台')
  })
}

async function exportPPTX() {
  if (exportingPptx.value) return
  exportingPptx.value = true
  try {
    await exportQuizReportToPPTX(props.report)
    toastSuccess('PPTX 已下载，可用 PowerPoint/Keynote/WPS 打开')
  } catch (err: any) {
    console.error('[QuizReport] pptx export failed:', err)
    toastSuccess(`PPTX 导出失败：${err?.message || err}`)
  } finally {
    exportingPptx.value = false
  }
}
</script>

<style scoped lang="scss">
.quiz-report {
  position: fixed; inset: 0; z-index: 110;
  background: var(--bg-card); display: flex; flex-direction: column;
  animation: slideUp 0.25s ease-out;
}

@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }

.panel-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 20px; border-bottom: 1px solid var(--border);
  .header-title h3 { font-size: 16px; font-weight: 700; margin: 0; }
  .header-sub { font-size: 11px; color: var(--text-muted); margin: 2px 0 0; }
}

.close-btn {
  width: 36px; height: 36px; border-radius: 50%; border: none;
  background: var(--bg-page); color: var(--text-secondary);
  display: flex; align-items: center; justify-content: center; cursor: pointer;
}

.panel-body {
  flex: 1; overflow-y: auto; padding: 14px 20px;
  display: flex; flex-direction: column; gap: 16px;
  -webkit-overflow-scrolling: touch;
}

.summary-cards {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}

.mastery-section {
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 14px 16px;
  background: linear-gradient(135deg, rgba(114, 46, 209, 0.04), rgba(22, 119, 255, 0.03));

  .mastery-title {
    font-size: 14px;
    font-weight: 700;
    margin: 0 0 10px;
    display: flex;
    align-items: baseline;
    gap: 8px;
  }
  .mastery-hint {
    font-size: 11px;
    font-weight: 400;
    color: var(--text-muted);
  }
}

.mastery-list { display: flex; flex-direction: column; gap: 10px; }

.mastery-row {
  display: grid;
  grid-template-columns: 1fr;
  gap: 4px;
  padding: 8px 12px;
  border-radius: 10px;
  background: #fff;
  border: 1px solid var(--border);
  position: relative;
  &.mastered { border-color: rgba(82, 196, 26, 0.3); }
  &.practicing { border-color: rgba(22, 119, 255, 0.3); }
  &.needs_improvement { border-color: rgba(207, 19, 34, 0.3); }
}

.mastery-head { display: flex; justify-content: space-between; align-items: center; }
.mastery-name { font-size: 13px; font-weight: 600; color: var(--text-primary); }
.mastery-meta { display: flex; align-items: baseline; gap: 8px; }
.mastery-q-count { font-size: 11px; color: var(--text-muted); }
.mastery-pct { font-size: 16px; font-weight: 800; }
.mastery-bar {
  width: 100%;
  height: 6px;
  background: var(--bg-page);
  border-radius: 3px;
  overflow: hidden;
}
.mastery-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.4s ease-out;
}
.mastery-row.mastered { .mastery-pct { color: #52c41a; } .mastery-fill { background: linear-gradient(90deg, #95de64, #52c41a); } }
.mastery-row.practicing { .mastery-pct { color: #1677ff; } .mastery-fill { background: linear-gradient(90deg, #69b1ff, #1677ff); } }
.mastery-row.needs_improvement { .mastery-pct { color: #cf1322; } .mastery-fill { background: linear-gradient(90deg, #ff7875, #cf1322); } }
.mastery-status {
  position: absolute;
  top: 8px;
  right: 12px;
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 8px;
  display: none;
}

.stat-card {
  border-radius: 14px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  background: var(--bg-page);
  .stat-label { font-size: 11px; color: var(--text-muted); }
  .stat-value { font-size: 26px; font-weight: 800; }
  .stat-unit { font-size: 11px; color: var(--text-muted); }
  &.primary { background: linear-gradient(135deg, #e6f4ff, #f0f8ff); .stat-value { color: #1677ff; } }
  &.success { background: linear-gradient(135deg, #f6ffed, #eaffec); .stat-value { color: #52c41a; } }
  &.warning { background: linear-gradient(135deg, #fff7e6, #ffeed4); .stat-value { color: #d46b08; } }
  &.info { background: linear-gradient(135deg, #f9f0ff, #f0e7ff); .stat-value { color: #722ed1; } }
}

.tab-bar {
  display: flex;
  gap: 6px;
  padding: 4px;
  background: var(--bg-page);
  border-radius: 10px;
  button {
    flex: 1;
    padding: 8px;
    border: none;
    background: transparent;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 600;
    color: var(--text-secondary);
    cursor: pointer;
    &.active { background: #fff; color: var(--primary); box-shadow: 0 2px 6px -2px rgba(15, 23, 42, 0.1); }
  }
}

.question-block {
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.qb-head {
  display: flex;
  align-items: center;
  gap: 10px;
}

.qb-num {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--primary);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 700;
  flex-shrink: 0;
}

.qb-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12px;
  color: var(--text-secondary);
  strong { font-size: 14px; }
}

.qb-type-badge {
  padding: 2px 8px;
  font-size: 10px;
  font-weight: 700;
  border-radius: 8px;
  &.single_choice { background: #e6f4ff; color: #1677ff; }
  &.multiple_choice { background: #f9f0ff; color: #722ed1; }
  &.true_false { background: #fff7e6; color: #d46b08; }
  &.short_answer { background: #f6ffed; color: #389e0d; }
}

.qb-content-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-bottom: 10px;

  .qb-content { flex: 1; margin-bottom: 0; }
}

.sa-answer-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;

  .sa-answer { flex: 1; margin-bottom: 0; }
}

.qb-content {
  font-size: 14px;
  color: var(--text-primary);
  line-height: 1.6;
  margin: 0;
}

.option-stats {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.opt-stat {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 10px;
  background: var(--bg-page);
  border-radius: 8px;
  &.correct { background: rgba(82, 196, 26, 0.08); border: 1px solid rgba(82, 196, 26, 0.3); }
}

.opt-stat-head {
  display: flex;
  align-items: center;
  gap: 8px;
  .opt-stat-key { width: 22px; height: 22px; border-radius: 50%; background: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 11px; }
  .opt-stat-text { flex: 1; font-size: 13px; color: var(--text-primary); }
  .opt-stat-count { font-size: 12px; color: var(--text-muted); }
}

.opt-stat-bar {
  height: 6px;
  background: rgba(0,0,0,0.06);
  border-radius: 3px;
  overflow: hidden;
}

.opt-stat-fill {
  height: 100%;
  background: linear-gradient(90deg, #1677ff, #4096ff);
  transition: width 0.6s ease;
  &.correct { background: linear-gradient(90deg, #52c41a, #73d13d); }
}

.qb-answer {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  strong { color: #52c41a; font-weight: 700; }
}

.answer-tag {
  padding: 1px 8px;
  background: #f6ffed;
  color: #389e0d;
  border-radius: 8px;
  font-size: 10px;
  font-weight: 700;
}

.short-answers {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.short-ans-card {
  padding: 10px 12px;
  background: var(--bg-page);
  border: 1px solid var(--border);
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.sa-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  .sa-student { font-size: 13px; font-weight: 600; }
  .sa-score { font-size: 14px; font-weight: 700; padding: 2px 10px; background: rgba(22, 119, 255, 0.08); border-radius: 8px; }
}

.sa-answer {
  font-size: 13px;
  color: var(--text-primary);
  line-height: 1.6;
  margin: 0;
  white-space: pre-wrap;
}

.sa-comment {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.55;
  margin: 0;
  padding: 6px 10px;
  background: linear-gradient(135deg, rgba(22, 119, 255, 0.04), rgba(82, 196, 26, 0.04));
  border-radius: 8px;
}

.ai-tag {
  padding: 1px 8px;
  background: linear-gradient(135deg, var(--primary), #52c41a);
  color: #fff;
  border-radius: 8px;
  font-size: 10px;
  font-weight: 700;
  margin-right: 6px;
}

.empty-tip {
  font-size: 12px;
  color: var(--text-muted);
  text-align: center;
  margin: 6px 0;
}

.student-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  th, td { padding: 10px 12px; text-align: left; border-bottom: 1px solid var(--border); }
  th { background: var(--bg-page); font-size: 12px; color: var(--text-secondary); font-weight: 600; }
  tbody tr { cursor: pointer; transition: background 0.15s; &:hover { background: var(--bg-page); } &.active { background: var(--primary-light, #e6f4ff); } }
  .dim { color: var(--text-muted); font-size: 12px; }
}

.link-btn {
  border: none; background: transparent;
  color: var(--primary); font-size: 12px; font-weight: 600; cursor: pointer;
}

.expand-row td {
  background: var(--bg-page);
  padding: 0 !important;
}

.student-detail {
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.sd-q {
  padding: 10px 12px;
  background: #fff;
  border: 1px solid var(--border);
  border-radius: 10px;
}

.sd-q-head { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.sd-q-num { font-size: 12px; font-weight: 700; color: var(--text-secondary); }
.sd-q-score { margin-left: auto; font-size: 13px; font-weight: 700; padding: 2px 10px; background: var(--bg-page); border-radius: 8px; }
.sd-q-content { font-size: 13px; color: var(--text-primary); line-height: 1.55; margin: 0 0 6px; }
.sd-q-answer { font-size: 12px; color: var(--text-secondary); line-height: 1.55; margin: 0 0 4px; display: flex; gap: 6px; flex-wrap: wrap; }
.sd-q-comment { font-size: 12px; color: var(--text-secondary); line-height: 1.55; margin: 4px 0 0; padding: 6px 10px; background: linear-gradient(135deg, rgba(22, 119, 255, 0.04), rgba(82, 196, 26, 0.04)); border-radius: 8px; }

.rate-excellent { color: #52c41a; }
.rate-good { color: #1677ff; }
.rate-fair { color: #d46b08; }
.rate-poor { color: #ff4d4f; }

.panel-actions {
  display: flex;
  gap: 10px;
  padding: 12px 20px;
  padding-bottom: calc(12px + var(--safe-bottom));
  border-top: 1px solid var(--border);
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
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;

  &:disabled { opacity: 0.6; cursor: wait; }
}

.btn-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(0, 0, 0, 0.15);
  border-top-color: var(--text-primary);
  border-radius: 50%;
  animation: btn-spin 0.7s linear infinite;
}

@keyframes btn-spin {
  to { transform: rotate(360deg); }
}

.btn-primary {
  flex: 1.5;
  padding: 14px;
  border: none;
  border-radius: var(--radius-md);
  background: linear-gradient(135deg, var(--primary), #4096ff);
  color: #fff;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  min-height: 48px;
}

@media (max-width: 640px) {
  .summary-cards { grid-template-columns: repeat(2, 1fr); }
}
</style>
