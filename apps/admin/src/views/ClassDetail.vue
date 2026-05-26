<template>
  <div v-if="detail" class="class-detail-page">
    <!-- ============ 返回 + 班级 Hero ============ -->
    <div class="breadcrumb-row card-rise">
      <router-link to="/classes" class="back-link">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M19 12H5M12 19l-7-7 7-7"/>
        </svg>
        返回班级列表
      </router-link>
    </div>

    <header class="cls-hero card-rise" :style="{ animationDelay: '40ms' }">
      <div class="cls-hero-main">
        <div class="cls-hero-icon">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
            <path d="M6 12v5c3 3 9 3 12 0v-5"/>
          </svg>
        </div>
        <div class="cls-hero-text">
          <h1>{{ detail.name }}</h1>
          <p class="cls-hero-sub">
            {{ detail.department }} · 班主任 {{ detail.headTeacher }} · {{ detail.studentCount }} 名学生 · 已完成 {{ detail.lessonsDone }} 课时
          </p>
        </div>
      </div>
      <div class="cls-hero-stats">
        <div class="cls-hero-stat">
          <span class="hero-stat-label">出勤率</span>
          <span class="hero-stat-val num-tabular">{{ detail.attendanceRate }}<small>%</small></span>
        </div>
        <div class="cls-hero-stat">
          <span class="hero-stat-label">平均分</span>
          <span class="hero-stat-val num-tabular">{{ detail.avgScore.toFixed(1) }}</span>
        </div>
        <div class="cls-hero-stat" data-tone="ai">
          <span class="hero-stat-label">AI 活跃度</span>
          <span class="hero-stat-val num-tabular">{{ detail.aiActivity }}<small>/100</small></span>
        </div>
      </div>
    </header>

    <!-- ============ AI 洞察 ============ -->
    <section class="insight-grid">
      <article
        v-for="(it, idx) in detail.insights"
        :key="idx"
        class="insight-item card-rise"
        :data-kind="it.kind"
        :style="{ animationDelay: 80 + idx * 50 + 'ms' }"
      >
        <div class="insight-icon" :data-kind="it.kind">
          <svg v-if="it.kind === 'highlight'" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4"/><circle cx="12" cy="12" r="3"/></svg>
          <svg v-else-if="it.kind === 'warning'" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
          <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
        </div>
        <h3 class="insight-title">{{ it.title }}</h3>
        <p class="insight-desc">{{ it.desc }}</p>
      </article>
    </section>

    <!-- ============ 雷达 / AI 分布 / 薄弱知识点 ============ -->
    <section class="row-3">
      <div class="surface-card card-rise" :style="{ animationDelay: '120ms' }">
        <header class="surface-header">
          <div>
            <h2>班级能力画像</h2>
            <p class="surface-sub">5 维综合评分</p>
          </div>
        </header>
        <div ref="radarChartRef" class="chart-canvas" :style="{ height: '260px' }" aria-label="班级能力雷达图"></div>
      </div>

      <div class="surface-card card-rise" :style="{ animationDelay: '160ms' }">
        <header class="surface-header">
          <div>
            <h2>AI 调用分布</h2>
            <p class="surface-sub">本学期累计</p>
          </div>
        </header>
        <div ref="pieChartRef" class="chart-canvas" :style="{ height: '200px' }" aria-label="AI 调用分布图"></div>
        <ul class="pie-legend">
          <li v-for="item in detail.aiBreakdown" :key="item.name">
            <span class="pie-dot" :style="{ background: item.color }"></span>
            <span class="pie-name">{{ item.name }}</span>
            <span class="pie-value num-tabular">{{ item.value }}</span>
          </li>
        </ul>
      </div>

      <div class="surface-card card-rise" :style="{ animationDelay: '200ms' }">
        <header class="surface-header">
          <div>
            <h2>最薄弱知识点</h2>
            <p class="surface-sub">按平均掌握度排序</p>
          </div>
        </header>
        <ul class="weak-list">
          <li v-for="(wp, i) in detail.weakPoints" :key="wp.name" class="weak-item">
            <span class="weak-rank num-tabular">{{ i + 1 }}</span>
            <div class="weak-info">
              <span class="weak-name">{{ wp.name }}</span>
              <div class="weak-bar">
                <div
                  class="weak-bar-fill"
                  :style="{ width: wp.mastery + '%' }"
                  :data-quality="wp.mastery >= 70 ? 'mid' : wp.mastery >= 60 ? 'low' : 'risk'"
                ></div>
              </div>
            </div>
            <span
              class="weak-pct num-tabular"
              :data-quality="wp.mastery >= 70 ? 'mid' : wp.mastery >= 60 ? 'low' : 'risk'"
            >{{ wp.mastery }}%</span>
          </li>
        </ul>
      </div>
    </section>

    <!-- ============ 学生表格 ============ -->
    <section class="surface-card card-rise" :style="{ animationDelay: '240ms' }">
      <header class="surface-header">
        <div>
          <h2>学生名册（{{ filteredStudents.length }} 人）</h2>
          <p class="surface-sub">点击学生姓名查看个人学情画像</p>
        </div>
        <div class="filter-bar">
          <div class="chip-group" role="tablist">
            <button
              v-for="s in statusFilters"
              :key="s.key"
              role="tab"
              :aria-selected="statusFilter === s.key"
              :class="['chip', { 'chip--active': statusFilter === s.key }]"
              @click="statusFilter = s.key"
            >{{ s.label }}<span v-if="s.count > 0" class="chip-count num-tabular">{{ s.count }}</span></button>
          </div>
          <input
            v-model="searchText"
            class="search-input"
            placeholder="搜索姓名 / 学号"
            type="text"
          />
        </div>
      </header>

      <div class="student-table-wrap">
        <table class="student-table">
          <thead>
            <tr>
              <th>姓名</th>
              <th>学号</th>
              <th>性别</th>
              <th class="num">平均分</th>
              <th class="num">出勤率</th>
              <th class="num">AI 使用</th>
              <th>状态</th>
              <th class="col-action"></th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="stu in filteredStudents"
              :key="stu.id"
            >
              <td>
                <button class="stu-name-btn" @click="goStudent(stu.id)">
                  <span class="stu-avatar" :data-gender="stu.gender">{{ stu.name[0] }}</span>
                  <span class="stu-name">{{ stu.name }}</span>
                </button>
              </td>
              <td class="num-tabular">{{ stu.studentNo }}</td>
              <td>{{ stu.gender }}</td>
              <td class="num num-tabular" :data-quality="stu.avgScore >= 85 ? 'ok' : stu.avgScore >= 75 ? 'mid' : 'low'">
                {{ stu.avgScore }}
              </td>
              <td class="num num-tabular" :data-quality="stu.attendanceRate >= 95 ? 'ok' : stu.attendanceRate >= 88 ? 'mid' : 'low'">
                {{ stu.attendanceRate }}<small>%</small>
              </td>
              <td class="num num-tabular">
                <span class="ai-usage-bar">
                  <span class="ai-usage-fill" :style="{ width: Math.min(100, stu.aiUsage * 1.5) + '%' }"></span>
                </span>
                <span class="ai-usage-num">{{ stu.aiUsage }}</span>
              </td>
              <td>
                <span class="status-pill" :data-tone="STATUS_COLOR[stu.status]">
                  {{ stu.status }}
                </span>
                <span v-if="stu.riskTag" class="risk-tag">{{ stu.riskTag }}</span>
              </td>
              <td class="col-action">
                <button class="action-btn" @click="goStudent(stu.id)" aria-label="查看画像">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M5 12h14M13 5l7 7-7 7"/>
                  </svg>
                </button>
              </td>
            </tr>
            <tr v-if="filteredStudents.length === 0">
              <td colspan="8" class="empty-row">没有符合条件的学生</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
  <div v-else class="not-found">
    <h2>班级不存在</h2>
    <router-link to="/classes" class="back-link">返回班级列表</router-link>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import * as echarts from 'echarts'
import { STATUS_COLOR, getClassDetail } from '../mocks/classes'

const route = useRoute()
const router = useRouter()

const detail = computed(() => getClassDetail(route.params.classId as string))

/* 雷达图 + 饼图 */
const radarChartRef = ref<HTMLElement>()
const pieChartRef = ref<HTMLElement>()
let radarChart: echarts.ECharts | null = null
let pieChart: echarts.ECharts | null = null

const cssColorMap: Record<string, string> = {
  'var(--color-brand-500)':   '47, 84, 235',
  'var(--color-ai-500)':      '114, 46, 209',
  'var(--color-info-500)':    '6, 182, 212',
  'var(--color-warning-500)': '245, 158, 11',
  'var(--color-success-500)': '22, 163, 74',
}
function rgb(token: string, alpha = 1): string {
  const v = cssColorMap[token] || '47, 84, 235'
  return `rgba(${v}, ${alpha})`
}

function buildRadarOption() {
  if (!detail.value) return {}
  return {
    tooltip: { trigger: 'item', backgroundColor: 'rgba(15,23,42,0.92)', borderWidth: 0, textStyle: { color: '#fff' } },
    radar: {
      indicator: detail.value.radar.map(d => ({ name: d.name, max: 100 })),
      shape: 'polygon',
      splitNumber: 4,
      axisName: { color: '#475569', fontSize: 12 },
      splitArea: { areaStyle: { color: ['rgba(47,84,235,0.02)', 'rgba(47,84,235,0.05)'] } },
      splitLine: { lineStyle: { color: '#e2e8f0' } },
      axisLine: { lineStyle: { color: '#e2e8f0' } },
    },
    series: [{
      type: 'radar',
      symbol: 'circle',
      symbolSize: 6,
      lineStyle: { color: rgb('var(--color-brand-500)', 0.85), width: 2 },
      itemStyle: { color: rgb('var(--color-brand-500)', 1) },
      areaStyle: { color: rgb('var(--color-brand-500)', 0.18) },
      data: [{ value: detail.value.radar.map(d => d.value), name: detail.value.name }],
    }],
  }
}

function buildPieOption() {
  if (!detail.value) return {}
  return {
    tooltip: { trigger: 'item', formatter: '{b}<br/>{c} 次 ({d}%)', backgroundColor: 'rgba(15,23,42,0.92)', borderWidth: 0, textStyle: { color: '#fff' } },
    series: [{
      type: 'pie',
      radius: ['56%', '82%'],
      center: ['50%', '50%'],
      avoidLabelOverlap: true,
      itemStyle: { borderColor: '#fff', borderWidth: 4, borderRadius: 8 },
      label: { show: false },
      labelLine: { show: false },
      data: detail.value.aiBreakdown.map(it => ({
        name: it.name,
        value: it.value,
        itemStyle: { color: rgb(it.color, 1) },
      })),
    }],
  }
}

function initCharts() {
  if (radarChartRef.value && !radarChart) {
    radarChart = echarts.init(radarChartRef.value)
    radarChart.setOption(buildRadarOption())
  }
  if (pieChartRef.value && !pieChart) {
    pieChart = echarts.init(pieChartRef.value)
    pieChart.setOption(buildPieOption())
  }
}
function disposeCharts() {
  radarChart?.dispose(); radarChart = null
  pieChart?.dispose(); pieChart = null
}
function handleResize() {
  radarChart?.resize()
  pieChart?.resize()
}

/* 学生筛选 */
const searchText = ref('')

const statusFilters = computed(() => {
  const all = detail.value?.students || []
  const counts = {
    excellent: all.filter(s => s.status === '优秀').length,
    warn:      all.filter(s => s.status === '需关注').length,
    sleep:     all.filter(s => s.status === '待激活').length,
  }
  return [
    { key: 'all',       label: '全部',   count: 0 },
    { key: 'excellent', label: '优秀',   count: counts.excellent },
    { key: 'good',      label: '良好',   count: 0 },
    { key: 'warn',      label: '需关注', count: counts.warn },
    { key: 'sleep',     label: '待激活', count: counts.sleep },
  ]
})
const statusFilter = ref('all')

const filteredStudents = computed(() => {
  const all = detail.value?.students || []
  let list = all
  if (statusFilter.value !== 'all') {
    const map: Record<string, string> = { excellent: '优秀', good: '良好', warn: '需关注', sleep: '待激活' }
    list = list.filter(s => s.status === map[statusFilter.value])
  }
  const q = searchText.value.trim().toLowerCase()
  if (q) {
    list = list.filter(s => s.name.toLowerCase().includes(q) || s.studentNo.toLowerCase().includes(q))
  }
  return list
})

function goStudent(studentId: string) {
  router.push({ name: 'StudentProfile', params: { studentId } })
}

/* 路由变更 → 重绘 */
watch(() => route.params.classId, async () => {
  disposeCharts()
  await nextTick()
  initCharts()
})

onMounted(() => {
  initCharts()
  window.addEventListener('resize', handleResize)
})
onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  disposeCharts()
})
</script>

<style scoped>
.class-detail-page {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  padding-bottom: var(--space-5);
}

.breadcrumb-row { display: flex; align-items: center; }
.back-link {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  text-decoration: none;
  font-weight: var(--font-weight-medium);
  transition: color var(--duration-fast);
}
.back-link:hover { color: var(--color-brand-600); }

/* 班级 Hero */
.cls-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-5);
  padding: var(--space-6);
  background: linear-gradient(135deg, #0e7c66 0%, #16a34a 60%, #22d3ee 100%);
  border-radius: var(--radius-xl);
  color: #fff;
  box-shadow: var(--shadow-lg);
  overflow: hidden;
  position: relative;
}
.cls-hero::before {
  content: '';
  position: absolute;
  inset: -50% -10% auto auto;
  width: 320px;
  height: 320px;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.2) 0%, transparent 60%);
  pointer-events: none;
}
.cls-hero-main {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  z-index: 1;
}
.cls-hero-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 60px;
  height: 60px;
  border-radius: var(--radius-lg);
  background: rgba(255, 255, 255, 0.18);
  color: #fff;
  flex-shrink: 0;
  backdrop-filter: blur(8px);
}
.cls-hero-text h1 {
  margin: 0;
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  letter-spacing: 0.02em;
}
.cls-hero-sub {
  margin: var(--space-2) 0 0 0;
  font-size: var(--font-size-base);
  color: rgba(255, 255, 255, 0.85);
}
.cls-hero-stats {
  display: flex;
  gap: var(--space-5);
  z-index: 1;
}
.cls-hero-stat {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
}
.cls-hero-stat[data-tone='ai'] .hero-stat-val {
  color: #fff;
  text-shadow: 0 0 12px rgba(255, 255, 255, 0.4);
}
.hero-stat-label {
  font-size: var(--font-size-xs);
  color: rgba(255, 255, 255, 0.75);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.hero-stat-val {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  color: #fff;
  display: inline-flex;
  align-items: baseline;
  gap: 2px;
}
.hero-stat-val small {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-regular);
  color: rgba(255, 255, 255, 0.6);
}

/* 洞察 */
.insight-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-4);
}
.insight-item {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-4) var(--space-5);
  background: var(--color-bg-elevated);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
  border-top: 3px solid var(--color-brand-500);
}
.insight-item[data-kind='highlight'] { border-top-color: var(--color-brand-500); }
.insight-item[data-kind='warning']   { border-top-color: var(--color-warning-500); }
.insight-item[data-kind='tip']       { border-top-color: var(--color-info-500); }

.insight-icon {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.insight-icon[data-kind='highlight'] { background: var(--color-brand-50);   color: var(--color-brand-600);   }
.insight-icon[data-kind='warning']   { background: var(--color-warning-50); color: var(--color-warning-600); }
.insight-icon[data-kind='tip']       { background: var(--color-info-50);    color: var(--color-info-600);    }

.insight-title {
  margin: 0;
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semi);
  color: var(--color-text-primary);
}
.insight-desc {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  line-height: var(--line-height-base);
}

/* Row 3 */
.row-3 {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: var(--space-4);
}

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
  gap: var(--space-3);
  margin-bottom: var(--space-3);
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
}
.chart-canvas { width: 100%; }

.pie-legend {
  list-style: none;
  margin: var(--space-3) 0 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.pie-legend li {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
}
.pie-dot {
  width: 8px;
  height: 8px;
  border-radius: var(--radius-full);
  flex-shrink: 0;
}
.pie-name { flex: 1; }
.pie-value { color: var(--color-text-primary); font-weight: var(--font-weight-semi); }

.weak-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.weak-item {
  display: grid;
  grid-template-columns: 24px 1fr 42px;
  gap: var(--space-3);
  align-items: center;
}
.weak-rank {
  width: 24px;
  height: 24px;
  border-radius: var(--radius-full);
  background: var(--color-bg-soft);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-secondary);
}
.weak-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}
.weak-name {
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
}
.weak-bar {
  height: 6px;
  background: var(--color-border-subtle);
  border-radius: var(--radius-full);
  overflow: hidden;
}
.weak-bar-fill {
  height: 100%;
  border-radius: var(--radius-full);
  background: var(--color-info-500);
  transition: width var(--duration-slow) var(--ease-out);
}
.weak-bar-fill[data-quality='mid']  { background: var(--color-info-500);    }
.weak-bar-fill[data-quality='low']  { background: var(--color-warning-500); }
.weak-bar-fill[data-quality='risk'] { background: var(--color-danger-500);  }
.weak-pct {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semi);
  text-align: right;
}
.weak-pct[data-quality='mid']  { color: var(--color-info-600);    }
.weak-pct[data-quality='low']  { color: var(--color-warning-600); }
.weak-pct[data-quality='risk'] { color: var(--color-danger-600);  }

/* 学生表 */
.filter-bar { display: flex; gap: var(--space-2); align-items: center; flex-wrap: wrap; }
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
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.chip:hover { color: var(--color-text-primary); }
.chip--active {
  background: var(--color-bg-elevated);
  color: var(--color-brand-600);
  box-shadow: var(--shadow-sm);
}
.chip-count {
  background: var(--color-brand-100);
  color: var(--color-brand-700);
  font-size: 10px;
  padding: 1px 6px;
  border-radius: var(--radius-full);
}
.chip:not(.chip--active) .chip-count {
  background: var(--color-bg-elevated);
  color: var(--color-text-tertiary);
}
.search-input {
  width: 180px;
  padding: 6px var(--space-3);
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-full);
  font-size: var(--font-size-sm);
  outline: none;
  transition: border-color var(--duration-fast), box-shadow var(--duration-fast);
}
.search-input:focus {
  border-color: var(--color-brand-500);
  box-shadow: var(--shadow-focus);
}

.student-table-wrap {
  overflow-x: auto;
  margin: 0 calc(-1 * var(--space-5));
  padding: 0 var(--space-5);
}
.student-table {
  width: 100%;
  min-width: 720px;
  border-collapse: collapse;
  font-size: var(--font-size-sm);
}
.student-table thead th {
  text-align: left;
  font-weight: var(--font-weight-medium);
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
  padding: var(--space-3) var(--space-2);
  border-bottom: 1px solid var(--color-border-subtle);
}
.student-table tbody td {
  padding: var(--space-3) var(--space-2);
  border-bottom: 1px solid var(--color-border-subtle);
  color: var(--color-text-primary);
  vertical-align: middle;
}
.student-table tbody tr {
  transition: background var(--duration-fast);
}
.student-table tbody tr:hover { background: var(--color-bg-soft); }
.student-table th.num, .student-table td.num { text-align: right; }
.student-table .col-action { width: 40px; text-align: center; }

.student-table td.num[data-quality='ok']  { color: var(--color-success-600); font-weight: var(--font-weight-semi); }
.student-table td.num[data-quality='mid'] { color: var(--color-text-primary); font-weight: var(--font-weight-semi); }
.student-table td.num[data-quality='low'] { color: var(--color-warning-600); font-weight: var(--font-weight-semi); }

.stu-name-btn {
  appearance: none;
  background: transparent;
  border: 0;
  padding: 0;
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  cursor: pointer;
  color: inherit;
  font: inherit;
}
.stu-name-btn:hover .stu-name { color: var(--color-brand-600); }
.stu-avatar {
  width: 28px;
  height: 28px;
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: var(--font-weight-bold);
  font-size: var(--font-size-xs);
  background: var(--color-brand-100);
  color: var(--color-brand-700);
}
.stu-avatar[data-gender='女'] {
  background: #fce7f3;
  color: #be185d;
}
.stu-name {
  font-weight: var(--font-weight-medium);
  transition: color var(--duration-fast);
}

.ai-usage-bar {
  display: inline-block;
  width: 60px;
  height: 6px;
  background: var(--color-border-subtle);
  border-radius: var(--radius-full);
  overflow: hidden;
  vertical-align: middle;
  margin-right: var(--space-2);
}
.ai-usage-fill {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, var(--color-ai-500), var(--color-brand-500));
  border-radius: var(--radius-full);
  transition: width var(--duration-slow) var(--ease-out);
}
.ai-usage-num {
  font-weight: var(--font-weight-semi);
}

.status-pill {
  display: inline-block;
  padding: 2px 8px;
  border-radius: var(--radius-full);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
}
.status-pill[data-tone='success'] { background: var(--color-success-50); color: var(--color-success-600); }
.status-pill[data-tone='info']    { background: var(--color-info-50);    color: var(--color-info-600);    }
.status-pill[data-tone='warning'] { background: var(--color-warning-50); color: var(--color-warning-600); }
.status-pill[data-tone='danger']  { background: var(--color-danger-50);  color: var(--color-danger-600);  }
.risk-tag {
  display: inline-block;
  margin-left: 4px;
  padding: 2px 6px;
  border-radius: var(--radius-xs);
  font-size: 11px;
  background: var(--color-danger-50);
  color: var(--color-danger-600);
  font-weight: var(--font-weight-medium);
}

.action-btn {
  width: 28px;
  height: 28px;
  border-radius: var(--radius-full);
  background: var(--color-bg-soft);
  color: var(--color-text-tertiary);
  border: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background var(--duration-fast), color var(--duration-fast);
}
.action-btn:hover {
  background: var(--color-brand-500);
  color: #fff;
}

.empty-row {
  text-align: center;
  color: var(--color-text-tertiary);
  padding: var(--space-7) 0 !important;
}

.not-found {
  text-align: center;
  padding: var(--space-9) var(--space-5);
}
.not-found h2 {
  margin: 0 0 var(--space-3) 0;
  color: var(--color-text-secondary);
}

/* 响应式 */
@media (max-width: 1280px) {
  .insight-grid { grid-template-columns: 1fr; }
  .row-3 { grid-template-columns: 1fr 1fr; }
}
@media (max-width: 1024px) {
  .row-3 { grid-template-columns: 1fr; }
  .cls-hero { flex-direction: column; align-items: flex-start; }
  .cls-hero-stats { width: 100%; justify-content: space-between; }
}
@media (max-width: 640px) {
  .cls-hero-stats { gap: var(--space-3); flex-wrap: wrap; }
  .search-input { width: 100%; }
}
</style>
