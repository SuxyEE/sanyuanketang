<template>
  <div class="student-profile-page">
    <!-- ============ 返回 ============ -->
    <div class="breadcrumb-row card-rise">
      <router-link :to="`/classes/${profile.classId}`" class="back-link">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M19 12H5M12 19l-7-7 7-7"/>
        </svg>
        返回 {{ profile.className }}
      </router-link>
    </div>

    <!-- ============ 学生 Hero ============ -->
    <header class="stu-hero card-rise" :style="{ animationDelay: '40ms' }">
      <div class="stu-hero-main">
        <span class="stu-hero-avatar" :data-gender="profile.gender">{{ profile.name.charAt(0) }}</span>
        <div class="stu-hero-text">
          <div class="stu-hero-name-row">
            <h1>{{ profile.name }}</h1>
            <span class="stu-no num-tabular">学号 {{ profile.studentNo }}</span>
          </div>
          <p class="stu-hero-meta">{{ profile.className }} · {{ profile.department }} · {{ profile.gender }}</p>
          <div class="stu-tags">
            <span
              v-for="(t, i) in profile.tags"
              :key="i"
              class="stu-tag"
              :data-kind="t.kind"
            >{{ t.text }}</span>
          </div>
        </div>
      </div>
      <div class="stu-summary-card">
        <div class="stu-summary-head">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2l1.5 4.5L18 8l-4.5 1.5L12 14l-1.5-4.5L6 8l4.5-1.5z"/>
          </svg>
          <span>AI 综合评价</span>
        </div>
        <p class="stu-summary-text">{{ profile.summary }}</p>
      </div>
    </header>

    <!-- ============ 雷达 / 成绩趋势 / AI 偏好 ============ -->
    <section class="row-3">
      <div class="surface-card card-rise" :style="{ animationDelay: '80ms' }">
        <header class="surface-header">
          <div>
            <h2>5 维能力画像</h2>
            <p class="surface-sub">出勤 / 答题 / 互动 / AI使用 / 协作</p>
          </div>
        </header>
        <div ref="radarChartRef" class="chart-canvas" :style="{ height: '240px' }" aria-label="个人能力雷达"></div>
      </div>

      <div class="surface-card card-rise" :style="{ animationDelay: '120ms' }">
        <header class="surface-header">
          <div>
            <h2>4 周测验趋势</h2>
            <p class="surface-sub">每周测验平均分</p>
          </div>
          <span class="trend-delta num-tabular" :data-trend="trendDelta >= 0 ? 'up' : 'down'">
            {{ trendDelta >= 0 ? '+' : '' }}{{ trendDelta }} 分
          </span>
        </header>
        <div ref="lineChartRef" class="chart-canvas" :style="{ height: '240px' }" aria-label="测验趋势"></div>
      </div>

      <div class="surface-card card-rise" :style="{ animationDelay: '160ms' }">
        <header class="surface-header">
          <div>
            <h2>AI 助教偏好</h2>
            <p class="surface-sub">按功能调用占比</p>
          </div>
        </header>
        <div ref="aiPieRef" class="chart-canvas" :style="{ height: '180px' }" aria-label="AI 偏好饼图"></div>
        <ul class="ai-pref-legend">
          <li v-for="p in profile.aiPreference" :key="p.feature">
            <span class="pref-dot" :style="{ background: p.color }"></span>
            <span class="pref-name">{{ p.feature }}</span>
            <span class="pref-pct num-tabular">{{ p.pct }}%</span>
          </li>
        </ul>
      </div>
    </section>

    <!-- ============ 出勤热力 + 各科掌握度 ============ -->
    <section class="row-split">
      <div class="surface-card card-rise" :style="{ animationDelay: '200ms' }">
        <header class="surface-header">
          <div>
            <h2>最近 4 周出勤热力图</h2>
            <p class="surface-sub">绿 = 出勤、黄 = 迟到、灰 = 请假、红 = 缺勤</p>
          </div>
          <ul class="heat-legend">
            <li><span class="heat-cell" data-value="2"></span>出勤</li>
            <li><span class="heat-cell" data-value="1"></span>迟到</li>
            <li><span class="heat-cell" data-value="3"></span>请假</li>
            <li><span class="heat-cell" data-value="0"></span>缺勤</li>
          </ul>
        </header>
        <div class="heatmap">
          <div class="heatmap-headers">
            <span class="heatmap-col-empty"></span>
            <span v-for="d in days" :key="d" class="heatmap-col-header">{{ d }}</span>
          </div>
          <div v-for="w in 4" :key="w" class="heatmap-row">
            <span class="heatmap-row-label">第 {{ w }} 周</span>
            <div
              v-for="d in 5"
              :key="d"
              class="heat-cell-lg"
              :data-value="getHeatValue(w - 1, d - 1)"
              :title="`第${w}周·星期${d}: ${labelHeat(getHeatValue(w - 1, d - 1))}`"
            ></div>
          </div>
        </div>
      </div>

      <div class="surface-card card-rise" :style="{ animationDelay: '240ms' }">
        <header class="surface-header">
          <div>
            <h2>本班主修课程掌握度</h2>
            <p class="surface-sub">较班级均值的偏差</p>
          </div>
        </header>
        <ul class="subj-list">
          <li v-for="sm in profile.subjectMastery" :key="sm.subject" class="subj-item">
            <div class="subj-head">
              <span class="subj-name">{{ sm.subject }}</span>
              <span class="subj-delta num-tabular" :data-trend="sm.delta >= 0 ? 'up' : 'down'">
                {{ sm.delta >= 0 ? '+' : '' }}{{ sm.delta }}
              </span>
            </div>
            <div class="subj-bar">
              <div
                class="subj-bar-fill"
                :style="{ width: sm.mastery + '%' }"
                :data-quality="sm.mastery >= 80 ? 'ok' : sm.mastery >= 60 ? 'mid' : 'low'"
              ></div>
            </div>
            <span
              class="subj-pct num-tabular"
              :data-quality="sm.mastery >= 80 ? 'ok' : sm.mastery >= 60 ? 'mid' : 'low'"
            >{{ sm.mastery }}%</span>
          </li>
        </ul>
      </div>
    </section>

    <!-- ============ 错题集中度 ============ -->
    <section class="surface-card card-rise" :style="{ animationDelay: '280ms' }">
      <header class="surface-header">
        <div>
          <h2>错题集中度 · 知识点 Top</h2>
          <p class="surface-sub">同一类知识点反复出错次数</p>
        </div>
      </header>
      <div class="wrong-grid">
        <article v-for="(w, idx) in profile.wrongTopics" :key="w.topic" class="wrong-item" :style="{ animationDelay: 320 + idx * 50 + 'ms' }">
          <div class="wrong-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
            </svg>
          </div>
          <div class="wrong-info">
            <h3 class="wrong-topic">{{ w.topic }}</h3>
            <span class="wrong-subject">{{ w.subject }}</span>
          </div>
          <div class="wrong-count-wrap">
            <span class="wrong-count num-tabular">{{ w.count }}</span>
            <span class="wrong-count-label">次</span>
          </div>
        </article>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import * as echarts from 'echarts'
import { getStudentProfile } from '../mocks/classes'

const route = useRoute()
const profile = computed(() => getStudentProfile(route.params.studentId as string))

/* ----- 图表 ----- */
const radarChartRef = ref<HTMLElement>()
const lineChartRef = ref<HTMLElement>()
const aiPieRef = ref<HTMLElement>()
let radarChart: echarts.ECharts | null = null
let lineChart: echarts.ECharts | null = null
let aiPie: echarts.ECharts | null = null

const cssColorMap: Record<string, string> = {
  'var(--color-brand-500)':   '47, 84, 235',
  'var(--color-ai-500)':      '114, 46, 209',
  'var(--color-info-500)':    '6, 182, 212',
  'var(--color-warning-500)': '245, 158, 11',
  'var(--color-success-500)': '22, 163, 74',
  'var(--color-danger-500)':  '239, 68, 68',
}
function rgb(token: string, alpha = 1) {
  const v = cssColorMap[token] || '47, 84, 235'
  return `rgba(${v}, ${alpha})`
}

function buildRadarOption() {
  return {
    tooltip: { trigger: 'item', backgroundColor: 'rgba(15,23,42,0.92)', borderWidth: 0, textStyle: { color: '#fff' } },
    radar: {
      indicator: profile.value.radar.map(d => ({ name: d.name, max: 100 })),
      shape: 'polygon',
      splitNumber: 4,
      axisName: { color: '#475569', fontSize: 12 },
      splitArea: { areaStyle: { color: ['rgba(114,46,209,0.02)', 'rgba(114,46,209,0.05)'] } },
      splitLine: { lineStyle: { color: '#e2e8f0' } },
      axisLine: { lineStyle: { color: '#e2e8f0' } },
    },
    series: [{
      type: 'radar',
      symbol: 'circle',
      symbolSize: 6,
      lineStyle: { color: rgb('var(--color-ai-500)', 0.85), width: 2 },
      itemStyle: { color: rgb('var(--color-ai-500)', 1) },
      areaStyle: { color: rgb('var(--color-ai-500)', 0.2) },
      data: [{ value: profile.value.radar.map(d => d.value), name: profile.value.name }],
    }],
  }
}

function buildLineOption() {
  const data = profile.value.scoreTrend
  return {
    tooltip: { trigger: 'axis', backgroundColor: 'rgba(15,23,42,0.92)', borderWidth: 0, textStyle: { color: '#fff' } },
    grid: { left: 36, right: 16, top: 16, bottom: 28 },
    xAxis: {
      type: 'category',
      data: data.map(d => d.week),
      axisLine: { lineStyle: { color: '#e2e8f0' } },
      axisLabel: { color: '#94a3b8', fontSize: 11 },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      min: 50,
      max: 100,
      splitLine: { lineStyle: { color: '#eef1f6' } },
      axisLabel: { color: '#94a3b8', fontSize: 11 },
    },
    series: [{
      type: 'line',
      smooth: true,
      symbolSize: 10,
      data: data.map(d => d.score),
      itemStyle: { color: rgb('var(--color-brand-500)', 1), borderColor: '#fff', borderWidth: 2 },
      lineStyle: { color: rgb('var(--color-brand-500)', 0.85), width: 2 },
      areaStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: rgb('var(--color-brand-500)', 0.4) },
          { offset: 1, color: rgb('var(--color-brand-500)', 0.02) },
        ]),
      },
    }],
  }
}

function buildAiPieOption() {
  return {
    tooltip: { trigger: 'item', formatter: '{b}<br/>{c}%', backgroundColor: 'rgba(15,23,42,0.92)', borderWidth: 0, textStyle: { color: '#fff' } },
    series: [{
      type: 'pie',
      radius: ['52%', '78%'],
      center: ['50%', '50%'],
      avoidLabelOverlap: true,
      itemStyle: { borderColor: '#fff', borderWidth: 4, borderRadius: 8 },
      label: { show: false },
      labelLine: { show: false },
      data: profile.value.aiPreference.map(p => ({
        name: p.feature,
        value: p.pct,
        itemStyle: { color: rgb(p.color, 1) },
      })),
    }],
  }
}

function initCharts() {
  if (radarChartRef.value && !radarChart) {
    radarChart = echarts.init(radarChartRef.value)
    radarChart.setOption(buildRadarOption())
  }
  if (lineChartRef.value && !lineChart) {
    lineChart = echarts.init(lineChartRef.value)
    lineChart.setOption(buildLineOption())
  }
  if (aiPieRef.value && !aiPie) {
    aiPie = echarts.init(aiPieRef.value)
    aiPie.setOption(buildAiPieOption())
  }
}
function disposeCharts() {
  radarChart?.dispose(); radarChart = null
  lineChart?.dispose(); lineChart = null
  aiPie?.dispose(); aiPie = null
}
function handleResize() {
  radarChart?.resize()
  lineChart?.resize()
  aiPie?.resize()
}

/* ----- 出勤热力 ----- */
const days = ['一', '二', '三', '四', '五']

function getHeatValue(week: number, day: number): number {
  const c = profile.value.attendanceHeatmap.find(c => c.week === week && c.day === day)
  return c?.value ?? 2
}
function labelHeat(v: number): string {
  return v === 0 ? '缺勤' : v === 1 ? '迟到' : v === 3 ? '请假' : '出勤'
}

const trendDelta = computed(() => {
  const arr = profile.value.scoreTrend
  if (arr.length < 2) return 0
  return arr[arr.length - 1].score - arr[0].score
})

/* 路由切换重绘 */
watch(() => route.params.studentId, async () => {
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
.student-profile-page {
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

/* 学生 Hero */
.stu-hero {
  display: grid;
  grid-template-columns: 1.2fr 1.8fr;
  gap: var(--space-4);
  align-items: stretch;
}
.stu-hero-main {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-5);
  background: var(--color-bg-elevated);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--color-border-subtle);
}
.stu-hero-avatar {
  width: 72px;
  height: 72px;
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  background: var(--color-brand-100);
  color: var(--color-brand-700);
  flex-shrink: 0;
  box-shadow: var(--shadow-sm);
}
.stu-hero-avatar[data-gender='女'] {
  background: #fce7f3;
  color: #be185d;
}
.stu-hero-text { flex: 1; min-width: 0; }
.stu-hero-name-row {
  display: flex;
  align-items: baseline;
  gap: var(--space-3);
  flex-wrap: wrap;
}
.stu-hero-name-row h1 {
  margin: 0;
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
}
.stu-no {
  font-size: var(--font-size-sm);
  color: var(--color-text-tertiary);
}
.stu-hero-meta {
  margin: var(--space-2) 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}
.stu-tags {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
}
.stu-tag {
  padding: 3px 10px;
  border-radius: var(--radius-full);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
}
.stu-tag[data-kind='highlight'] { background: var(--color-success-50); color: var(--color-success-600); }
.stu-tag[data-kind='warning']   { background: var(--color-warning-50); color: var(--color-warning-600); }

.stu-summary-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-5);
  background: linear-gradient(135deg, var(--color-ai-50) 0%, var(--color-brand-50) 100%);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border-subtle);
}
.stu-summary-head {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semi);
  color: var(--color-ai-600);
}
.stu-summary-text {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
  line-height: var(--line-height-base);
}

/* ====== Row 3 ====== */
.row-3 {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: var(--space-4);
}
.row-split {
  display: grid;
  grid-template-columns: 1.5fr 1fr;
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

.trend-delta {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semi);
  padding: 2px 8px;
  border-radius: var(--radius-full);
}
.trend-delta[data-trend='up']   { background: var(--color-success-50); color: var(--color-success-600); }
.trend-delta[data-trend='down'] { background: var(--color-danger-50);  color: var(--color-danger-600);  }

.ai-pref-legend {
  list-style: none;
  margin: var(--space-3) 0 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.ai-pref-legend li {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
}
.pref-dot {
  width: 8px;
  height: 8px;
  border-radius: var(--radius-full);
  flex-shrink: 0;
}
.pref-name { flex: 1; }
.pref-pct { color: var(--color-text-primary); font-weight: var(--font-weight-semi); }

/* ====== 热力图 ====== */
.heat-legend {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  gap: var(--space-3);
  flex-wrap: wrap;
}
.heat-legend li {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--color-text-tertiary);
}
.heat-cell {
  width: 12px;
  height: 12px;
  border-radius: 3px;
  display: inline-block;
}
.heat-cell[data-value='2'] { background: var(--color-success-500); }
.heat-cell[data-value='1'] { background: var(--color-warning-500); }
.heat-cell[data-value='3'] { background: #cbd5e1; }
.heat-cell[data-value='0'] { background: var(--color-danger-500); }

.heatmap {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.heatmap-headers {
  display: grid;
  grid-template-columns: 64px repeat(5, 1fr);
  gap: 6px;
}
.heatmap-col-empty { width: 64px; }
.heatmap-col-header {
  text-align: center;
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
}
.heatmap-row {
  display: grid;
  grid-template-columns: 64px repeat(5, 1fr);
  gap: 6px;
  align-items: center;
}
.heatmap-row-label {
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
}
.heat-cell-lg {
  width: 100%;
  height: 38px;
  border-radius: var(--radius-sm);
  position: relative;
  cursor: help;
  transition: transform var(--duration-fast);
}
.heat-cell-lg:hover {
  transform: scale(1.08);
}
.heat-cell-lg[data-value='2'] { background: var(--color-success-500); box-shadow: inset 0 -2px 0 rgba(0,0,0,0.05); }
.heat-cell-lg[data-value='1'] { background: var(--color-warning-500); box-shadow: inset 0 -2px 0 rgba(0,0,0,0.05); }
.heat-cell-lg[data-value='3'] { background: #cbd5e1; }
.heat-cell-lg[data-value='0'] { background: var(--color-danger-500); box-shadow: inset 0 -2px 0 rgba(0,0,0,0.05); }

/* ====== 科目掌握度 ====== */
.subj-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.subj-item {
  display: grid;
  grid-template-columns: 1fr 42px;
  gap: 6px var(--space-3);
  align-items: center;
}
.subj-head {
  grid-column: 1 / 3;
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: var(--space-2);
}
.subj-name {
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
  font-weight: var(--font-weight-medium);
}
.subj-delta {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semi);
}
.subj-delta[data-trend='up']   { color: var(--color-success-600); }
.subj-delta[data-trend='down'] { color: var(--color-danger-600);  }
.subj-bar {
  grid-column: 1;
  height: 8px;
  background: var(--color-border-subtle);
  border-radius: var(--radius-full);
  overflow: hidden;
}
.subj-bar-fill {
  height: 100%;
  border-radius: var(--radius-full);
  transition: width var(--duration-slow) var(--ease-out);
}
.subj-bar-fill[data-quality='ok']  { background: var(--color-success-500); }
.subj-bar-fill[data-quality='mid'] { background: var(--color-info-500);    }
.subj-bar-fill[data-quality='low'] { background: var(--color-warning-500); }
.subj-pct {
  grid-column: 2;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semi);
  text-align: right;
}
.subj-pct[data-quality='ok']  { color: var(--color-success-600); }
.subj-pct[data-quality='mid'] { color: var(--color-info-600);    }
.subj-pct[data-quality='low'] { color: var(--color-warning-600); }

/* ====== 错题集中度 ====== */
.wrong-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-3);
}
.wrong-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-4);
  background: var(--color-bg-soft);
  border-radius: var(--radius-md);
  border-left: 3px solid var(--color-warning-500);
  animation: card-rise-in var(--duration-slow) var(--ease-out) both;
}
.wrong-icon {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-md);
  background: var(--color-warning-50);
  color: var(--color-warning-600);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.wrong-info { flex: 1; min-width: 0; }
.wrong-topic {
  margin: 0;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semi);
  color: var(--color-text-primary);
}
.wrong-subject {
  display: block;
  margin-top: 2px;
  font-size: 11px;
  color: var(--color-text-tertiary);
}
.wrong-count-wrap {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}
.wrong-count {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-warning-600);
  line-height: 1;
}
.wrong-count-label {
  font-size: 11px;
  color: var(--color-text-tertiary);
}

/* ====== 响应式 ====== */
@media (max-width: 1280px) {
  .row-3 { grid-template-columns: 1fr 1fr; }
  .wrong-grid { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 1024px) {
  .stu-hero { grid-template-columns: 1fr; }
  .row-3 { grid-template-columns: 1fr; }
  .row-split { grid-template-columns: 1fr; }
}
@media (max-width: 640px) {
  .wrong-grid { grid-template-columns: 1fr; }
  .heatmap-headers, .heatmap-row { grid-template-columns: 56px repeat(5, 1fr); }
  .heat-cell-lg { height: 28px; }
}
</style>
