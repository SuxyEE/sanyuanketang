<template>
  <div class="classes-page">
    <!-- ============ 1. Hero ============ -->
    <header class="hero card-rise">
      <div class="hero-text">
        <div class="hero-greet">
          <span class="hero-greet-emoji" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
              <path d="M9 22V12h6v10"/>
            </svg>
          </span>
          <h1>班级与学生学情</h1>
        </div>
        <p class="hero-sub">
          全校共 <strong>{{ classList.length }}</strong> 个班级、
          <strong>{{ totalStudents.toLocaleString() }}</strong> 名学生。AI 活跃度领先班级：
          <strong>{{ topAiClass?.name }}</strong>（{{ topAiClass?.aiActivity }} 分）
        </p>
      </div>
      <div class="hero-status">
        <div class="status-chip" data-status="ok">
          <span class="status-dot"></span>
          数据每 5 分钟更新一次
        </div>
        <span class="status-meta num-tabular">{{ nowTime }}</span>
      </div>
    </header>

    <!-- ============ 2. KPI ============ -->
    <section class="kpi-grid">
      <article class="kpi-card card-rise">
        <div class="kpi-head">
          <div class="kpi-icon kpi-icon--brand"><School /></div>
          <span class="kpi-label">班级总数</span>
        </div>
        <div class="kpi-value-row">
          <span class="kpi-value num-tabular">{{ classList.length }}</span>
          <span class="kpi-unit">个</span>
        </div>
        <div class="kpi-subtext">活跃 {{ classList.filter(c => c.status === 'active').length }} 个</div>
      </article>

      <article class="kpi-card card-rise" :style="{ animationDelay: '50ms' }">
        <div class="kpi-head">
          <div class="kpi-icon kpi-icon--info"><UserFilled /></div>
          <span class="kpi-label">学生总数</span>
        </div>
        <div class="kpi-value-row">
          <span class="kpi-value num-tabular">{{ totalStudents.toLocaleString() }}</span>
          <span class="kpi-unit">人</span>
        </div>
        <div class="kpi-subtext">均班级 {{ Math.round(totalStudents / classList.length) }} 人</div>
      </article>

      <article class="kpi-card card-rise" :style="{ animationDelay: '100ms' }">
        <div class="kpi-head">
          <div class="kpi-icon kpi-icon--success"><CircleCheck /></div>
          <span class="kpi-label">平均出勤率</span>
        </div>
        <div class="kpi-value-row">
          <span class="kpi-value num-tabular">{{ avgAttendance }}</span>
          <span class="kpi-unit">%</span>
        </div>
        <div class="kpi-subtext">最高 {{ Math.max(...classList.map(c => c.attendanceRate)) }}%</div>
      </article>

      <article class="kpi-card card-rise" :style="{ animationDelay: '150ms' }">
        <div class="kpi-head">
          <div class="kpi-icon kpi-icon--ai"><MagicStick /></div>
          <span class="kpi-label">AI 活跃班级</span>
        </div>
        <div class="kpi-value-row">
          <span class="kpi-value num-tabular">{{ aiActiveCount }}</span>
          <span class="kpi-unit">/ {{ classList.length }}</span>
        </div>
        <div class="kpi-subtext">AI 活跃度 ≥ 70</div>
      </article>
    </section>

    <!-- ============ 3. 筛选 + 班级网格 ============ -->
    <section class="surface-card card-rise">
      <header class="surface-header">
        <div>
          <h2>班级一览</h2>
          <p class="surface-sub">点击任一卡片进入班级详情，可下钻到学生画像</p>
        </div>
        <div class="filter-bar">
          <div class="chip-group" role="tablist">
            <button
              v-for="d in departmentFilters"
              :key="d.key"
              role="tab"
              :aria-selected="deptFilter === d.key"
              :class="['chip', { 'chip--active': deptFilter === d.key }]"
              @click="deptFilter = d.key"
            >{{ d.label }}</button>
          </div>
          <div class="chip-group" role="tablist">
            <button
              v-for="s in sortOptions"
              :key="s.key"
              role="tab"
              :aria-selected="sortKey === s.key"
              :class="['chip', { 'chip--active': sortKey === s.key }]"
              @click="sortKey = s.key"
            >{{ s.label }}</button>
          </div>
        </div>
      </header>

      <div class="class-grid">
        <article
          v-for="(cls, idx) in displayedClasses"
          :key="cls.id"
          class="class-card card-rise"
          :style="{ animationDelay: idx * 40 + 'ms' }"
          tabindex="0"
          role="link"
          @click="goDetail(cls.id)"
          @keydown.enter="goDetail(cls.id)"
        >
          <div class="cc-head">
            <div class="cc-title">
              <h3 class="cc-name">{{ cls.name }}</h3>
              <p class="cc-dept">{{ cls.department }}</p>
            </div>
            <div class="cc-activity-badge" :data-level="activityLevel(cls.aiActivity)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77 5.82 21l1.18-6.88L2 9.27l6.91-1.01L12 2z"/>
              </svg>
              <span class="num-tabular">{{ cls.aiActivity }}</span>
            </div>
          </div>

          <div class="cc-teacher">
            <span class="cc-avatar" :data-name="cls.headTeacher[0]">{{ cls.headTeacher[0] }}</span>
            <div>
              <span class="cc-teacher-label">班主任</span>
              <span class="cc-teacher-name">{{ cls.headTeacher }}</span>
            </div>
          </div>

          <div class="cc-stats">
            <div class="cc-stat">
              <span class="cc-stat-val num-tabular">{{ cls.studentCount }}</span>
              <span class="cc-stat-label">学生</span>
            </div>
            <div class="cc-stat">
              <span class="cc-stat-val num-tabular">{{ cls.lessonsDone }}</span>
              <span class="cc-stat-label">已上课时</span>
            </div>
            <div class="cc-stat">
              <span class="cc-stat-val num-tabular" :data-quality="qualityLevel(cls.attendanceRate)">
                {{ cls.attendanceRate }}<small>%</small>
              </span>
              <span class="cc-stat-label">出勤率</span>
            </div>
            <div class="cc-stat">
              <span class="cc-stat-val num-tabular" :data-quality="qualityLevel(cls.avgScore)">
                {{ cls.avgScore.toFixed(1) }}
              </span>
              <span class="cc-stat-label">平均分</span>
            </div>
          </div>

          <div class="cc-spark-row">
            <span class="cc-spark-label">本周活跃度</span>
            <Sparkline :points="cls.weekActivity" color="var(--color-ai-500)" class="cc-spark" />
          </div>

          <div class="cc-foot">
            <div class="cc-subjects">
              <span v-for="s in cls.subjects.slice(0, 3)" :key="s" class="cc-subject-tag">{{ s }}</span>
            </div>
            <span class="cc-arrow" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M5 12h14M13 5l7 7-7 7"/>
              </svg>
            </span>
          </div>
        </article>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { CircleCheck, MagicStick, School, UserFilled } from '@element-plus/icons-vue'
import { classList } from '../mocks/classes'
import Sparkline from '../components/Sparkline.vue'

const router = useRouter()

/* 时间 */
const nowTime = ref('')
let nowTimer: ReturnType<typeof setInterval> | null = null
function tickNow() {
  nowTime.value = new Date().toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

/* 统计 */
const totalStudents  = computed(() => classList.reduce((s, c) => s + c.studentCount, 0))
const avgAttendance  = computed(() => Math.round(classList.reduce((s, c) => s + c.attendanceRate, 0) / classList.length))
const aiActiveCount  = computed(() => classList.filter(c => c.aiActivity >= 70).length)
const topAiClass     = computed(() => [...classList].sort((a, b) => b.aiActivity - a.aiActivity)[0])

/* 筛选 + 排序 */
const departmentFilters = computed(() => {
  const depts = Array.from(new Set(classList.map(c => c.department)))
  return [{ key: 'all', label: '全部学院' }, ...depts.map(d => ({ key: d, label: d }))]
})
const deptFilter = ref<string>('all')

const sortOptions = [
  { key: 'aiActivity', label: 'AI 活跃' },
  { key: 'avgScore',   label: '平均分' },
  { key: 'attendance', label: '出勤率' },
  { key: 'students',   label: '学生数' },
] as const
const sortKey = ref<typeof sortOptions[number]['key']>('aiActivity')

const displayedClasses = computed(() => {
  const list = deptFilter.value === 'all'
    ? classList
    : classList.filter(c => c.department === deptFilter.value)
  return [...list].sort((a, b) => {
    switch (sortKey.value) {
      case 'avgScore':   return b.avgScore - a.avgScore
      case 'attendance': return b.attendanceRate - a.attendanceRate
      case 'students':   return b.studentCount - a.studentCount
      default:           return b.aiActivity - a.aiActivity
    }
  })
})

function activityLevel(v: number): 'hot' | 'normal' | 'cool' {
  if (v >= 80) return 'hot'
  if (v >= 60) return 'normal'
  return 'cool'
}
function qualityLevel(v: number): 'ok' | 'mid' | 'low' {
  if (v >= 90) return 'ok'
  if (v >= 75) return 'mid'
  return 'low'
}

function goDetail(id: string) {
  router.push({ name: 'ClassDetail', params: { classId: id } })
}

onMounted(() => {
  tickNow()
  nowTimer = setInterval(tickNow, 30_000)
})
onUnmounted(() => {
  if (nowTimer) clearInterval(nowTimer)
})
</script>

<style scoped>
.classes-page {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  padding-bottom: var(--space-5);
}

/* Hero（绿色调，区别于 Dashboard 蓝紫和 AI 治理紫） */
.hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-5);
  padding: var(--space-6);
  background: linear-gradient(135deg, #0e7c66 0%, #16a34a 55%, #22d3ee 100%);
  border-radius: var(--radius-xl);
  color: #fff;
  box-shadow: var(--shadow-lg);
  overflow: hidden;
  position: relative;
}
.hero::before {
  content: '';
  position: absolute;
  inset: -40% -10% auto auto;
  width: 360px;
  height: 360px;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.22) 0%, transparent 60%);
  pointer-events: none;
}
.hero-text { max-width: 760px; z-index: 1; }
.hero-greet { display: flex; align-items: center; gap: var(--space-3); }
.hero-greet h1 {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-bold);
  margin: 0;
  letter-spacing: 0.02em;
}
.hero-greet-emoji {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: var(--radius-full);
  background: rgba(255, 255, 255, 0.18);
  color: #fff;
  backdrop-filter: blur(8px);
}
.hero-sub {
  margin: var(--space-2) 0 0 0;
  font-size: var(--font-size-base);
  line-height: var(--line-height-base);
  color: rgba(255, 255, 255, 0.85);
}
.hero-sub strong {
  color: #fff;
  font-weight: var(--font-weight-bold);
  font-variant-numeric: tabular-nums;
}
.hero-status {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: var(--space-2);
  z-index: 1;
}
.status-chip {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: 6px var(--space-3);
  border-radius: var(--radius-full);
  background: rgba(255, 255, 255, 0.18);
  color: #fff;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  backdrop-filter: blur(8px);
}
.status-dot {
  width: 8px;
  height: 8px;
  border-radius: var(--radius-full);
  background: var(--color-success-500);
  box-shadow: 0 0 0 4px rgba(22, 163, 74, 0.25);
  animation: live-pulse 1.5s infinite;
}
@keyframes live-pulse {
  0%, 100% { box-shadow: 0 0 0 4px rgba(22, 163, 74, 0.25); }
  50%      { box-shadow: 0 0 0 8px rgba(22, 163, 74, 0); }
}
.status-meta { font-size: var(--font-size-xs); color: rgba(255, 255, 255, 0.7); }

/* KPI */
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-4);
}
.kpi-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-5);
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  transition: transform var(--duration-base) var(--ease-out),
              box-shadow var(--duration-base) var(--ease-out);
}
.kpi-card:hover { transform: translateY(-2px); box-shadow: var(--shadow-md); }
.kpi-head { display: flex; align-items: center; gap: var(--space-3); }
.kpi-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: var(--radius-md);
  font-size: 18px;
}
.kpi-icon--brand   { background: var(--color-brand-50);   color: var(--color-brand-600);   }
.kpi-icon--info    { background: var(--color-info-50);    color: var(--color-info-600);    }
.kpi-icon--success { background: var(--color-success-50); color: var(--color-success-600); }
.kpi-icon--ai      { background: var(--color-ai-50);      color: var(--color-ai-600);      }
.kpi-label {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  font-weight: var(--font-weight-medium);
}
.kpi-value-row {
  display: flex;
  align-items: baseline;
  gap: var(--space-2);
}
.kpi-value {
  font-size: var(--font-size-3xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
  line-height: var(--line-height-tight);
  letter-spacing: -0.02em;
}
.kpi-unit {
  font-size: var(--font-size-sm);
  color: var(--color-text-tertiary);
  font-weight: var(--font-weight-medium);
}
.kpi-subtext {
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
}

/* 班级网格 */
.surface-card {
  display: flex;
  flex-direction: column;
  padding: var(--space-5);
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
}
.surface-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
  margin-bottom: var(--space-4);
  flex-wrap: wrap;
}
.surface-header h2 {
  margin: 0;
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semi);
  color: var(--color-text-primary);
}
.surface-sub {
  margin: 4px 0 0 0;
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
  line-height: var(--line-height-base);
}
.filter-bar { display: flex; gap: var(--space-2); flex-wrap: wrap; }
.chip-group {
  display: inline-flex;
  align-items: center;
  background: var(--color-bg-soft);
  border-radius: var(--radius-full);
  padding: 3px;
}
.chip {
  appearance: none;
  background: transparent;
  border: 0;
  padding: 4px 12px;
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-secondary);
  border-radius: var(--radius-full);
  cursor: pointer;
  transition: background var(--duration-fast), color var(--duration-fast);
}
.chip:hover { color: var(--color-text-primary); }
.chip--active {
  background: var(--color-bg-elevated);
  color: var(--color-brand-600);
  box-shadow: var(--shadow-sm);
}

.class-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-4);
}
.class-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-5);
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: transform var(--duration-base) var(--ease-out),
              box-shadow var(--duration-base) var(--ease-out),
              border-color var(--duration-base) var(--ease-out);
}
.class-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
  border-color: var(--color-brand-200);
}
.class-card:focus-visible {
  outline: none;
  box-shadow: var(--shadow-focus);
}

.cc-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
}
.cc-title { flex: 1; min-width: 0; }
.cc-name {
  margin: 0;
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
}
.cc-dept {
  margin: 2px 0 0 0;
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
}
.cc-activity-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  border-radius: var(--radius-full);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semi);
}
.cc-activity-badge[data-level='hot']    { background: var(--color-ai-50);      color: var(--color-ai-600);      }
.cc-activity-badge[data-level='normal'] { background: var(--color-info-50);    color: var(--color-info-600);    }
.cc-activity-badge[data-level='cool']   { background: var(--color-bg-soft);    color: var(--color-text-tertiary); }

.cc-teacher {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-3);
  background: var(--color-bg-soft);
  border-radius: var(--radius-md);
}
.cc-avatar {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: var(--font-weight-bold);
  background: var(--color-brand-100);
  color: var(--color-brand-700);
  font-size: var(--font-size-sm);
}
.cc-teacher-label {
  display: block;
  font-size: 11px;
  color: var(--color-text-tertiary);
}
.cc-teacher-name {
  display: block;
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
  font-weight: var(--font-weight-medium);
}

.cc-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-2);
}
.cc-stat { display: flex; flex-direction: column; gap: 2px; }
.cc-stat-val {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
  display: inline-flex;
  align-items: baseline;
  gap: 1px;
}
.cc-stat-val[data-quality='ok']  { color: var(--color-success-600); }
.cc-stat-val[data-quality='mid'] { color: var(--color-text-primary); }
.cc-stat-val[data-quality='low'] { color: var(--color-warning-600); }
.cc-stat-val small {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-regular);
  color: var(--color-text-tertiary);
}
.cc-stat-label {
  font-size: 11px;
  color: var(--color-text-tertiary);
}

.cc-spark-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding-top: var(--space-2);
  border-top: 1px solid var(--color-border-subtle);
}
.cc-spark-label {
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
}
.cc-spark {
  flex: 1;
  height: 32px;
}

.cc-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}
.cc-subjects {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  flex: 1;
  min-width: 0;
}
.cc-subject-tag {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: var(--radius-xs);
  background: var(--color-bg-soft);
  color: var(--color-text-secondary);
  white-space: nowrap;
}
.cc-arrow {
  width: 28px;
  height: 28px;
  border-radius: var(--radius-full);
  background: var(--color-bg-soft);
  color: var(--color-text-tertiary);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background var(--duration-fast), color var(--duration-fast), transform var(--duration-fast);
}
.class-card:hover .cc-arrow {
  background: var(--color-brand-500);
  color: #fff;
  transform: translateX(2px);
}

/* 响应式 */
@media (max-width: 1280px) {
  .class-grid { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 1024px) {
  .kpi-grid { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 640px) {
  .kpi-grid { grid-template-columns: 1fr; }
  .class-grid { grid-template-columns: 1fr; }
  .hero { flex-direction: column; align-items: flex-start; padding: var(--space-5); }
  .hero-status { align-items: flex-start; }
}
</style>
