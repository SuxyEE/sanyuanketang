<template>
  <div class="dashboard">
    <!-- ============ 1. Hero ============ -->
    <header class="hero card-rise">
      <div class="hero-text">
        <div class="hero-greet">
          <span class="hero-greet-emoji" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
            </svg>
          </span>
          <h1>{{ greeting }}，管理员</h1>
        </div>
        <p class="hero-sub">
          今日共 <strong>{{ kpi.todayLessons.value }}</strong> 节课、 <strong>{{ totalOnlineDisplay }}</strong> 名师生在线，AI 助教累计被调用 <strong>{{ kpi.aiTotalCalls.value }}</strong> 次。
        </p>
      </div>
      <div class="hero-status">
        <div class="status-chip" :data-status="isConnected ? 'ok' : 'off'">
          <span class="status-dot"></span>
          {{ isConnected ? '实时数据已连接' : '实时数据离线' }}
        </div>
        <span class="status-meta num-tabular">{{ nowTime }}</span>
      </div>
    </header>

    <!-- ============ 2. KPI Bento Grid ============ -->
    <section class="kpi-grid">
      <article
        v-for="(card, idx) in kpiCards"
        :key="card.key"
        class="kpi-card card-rise"
        :style="{ animationDelay: idx * 50 + 'ms' }"
      >
        <div class="kpi-head">
          <div class="kpi-icon" :class="`kpi-icon--${card.tone}`" aria-hidden="true">
            <component :is="card.icon" />
          </div>
          <span class="kpi-label">{{ card.label }}</span>
        </div>
        <div class="kpi-body">
          <div class="kpi-value-row">
            <span class="kpi-value num-tabular">{{ card.data.value.toLocaleString() }}</span>
            <span class="kpi-unit">{{ card.data.unit }}</span>
          </div>
          <div class="kpi-delta" :data-trend="card.data.delta >= 0 ? 'up' : 'down'">
            <svg v-if="card.data.delta >= 0" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17L17 7M17 7H8M17 7v9"/></svg>
            <svg v-else width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 7l10 10M17 17H8M17 17V8"/></svg>
            <span class="num-tabular">{{ Math.abs(card.data.delta).toFixed(1) }}%</span>
            <span class="kpi-delta-text">较昨日</span>
          </div>
        </div>
        <Sparkline :points="card.data.series" :color="card.sparkColor" class="kpi-spark" />
      </article>
    </section>

    <!-- ============ 3. AI 使用面板 + 活动类型分布 ============ -->
    <section class="row-split">
      <div class="surface-card card-rise">
        <header class="surface-header">
          <div>
            <h2>AI 助教 7 日使用趋势</h2>
            <p class="surface-sub">按功能拆分的每日调用次数（对话 / 板书 / 实践 / 课件 / 出题）</p>
          </div>
          <div class="chip-group" role="tablist" aria-label="时间范围">
            <button
              v-for="r in ranges"
              :key="r"
              role="tab"
              :aria-selected="range === r"
              :class="['chip', { 'chip--active': range === r }]"
              @click="range = r"
            >{{ r }}</button>
          </div>
        </header>
        <div ref="aiChartRef" class="chart-canvas" :style="{ height: '288px' }" aria-label="AI 使用趋势图表"></div>
      </div>

      <div class="surface-card card-rise" :style="{ animationDelay: '60ms' }">
        <header class="surface-header">
          <div>
            <h2>本周课堂活动分布</h2>
            <p class="surface-sub">按互动类型统计的累计触发次数</p>
          </div>
        </header>
        <div ref="distChartRef" class="chart-canvas" :style="{ height: '232px' }" aria-label="活动分布图表"></div>
        <ul class="dist-legend">
          <li v-for="item in activityDistribution" :key="item.name">
            <span class="dist-dot" :style="{ background: item.color }"></span>
            <span class="dist-name">{{ item.name }}</span>
            <span class="dist-value num-tabular">{{ item.value }}</span>
          </li>
        </ul>
      </div>
    </section>

    <!-- ============ 4. 实时课堂 + 实时事件 ============ -->
    <section class="row-split">
      <div class="surface-card card-rise">
        <header class="surface-header">
          <div>
            <h2>实时课堂</h2>
            <p class="surface-sub">教师端 / 学生端 / 大屏 当前正在进行的课堂</p>
          </div>
          <router-link to="/monitor" class="link-text">查看全部 →</router-link>
        </header>
        <ul class="classroom-list">
          <li v-for="(room, idx) in displayedClassrooms" :key="room.id" class="classroom-row" :style="{ animationDelay: idx * 40 + 'ms' }">
            <span class="cr-pulse" aria-hidden="true"></span>
            <div class="cr-info">
              <h3 class="cr-name text-truncate">{{ room.name }}</h3>
              <p class="cr-meta text-truncate">{{ room.teacher }} · {{ room.className }}</p>
            </div>
            <span class="cr-activity" :data-activity="room.activity">{{ room.activity }}</span>
            <div class="cr-stats">
              <span class="cr-online num-tabular">{{ room.online }}<small>/{{ room.total }}</small></span>
              <div class="cr-bar">
                <div class="cr-bar-fill" :style="{ width: room.progress + '%' }"></div>
              </div>
            </div>
          </li>
        </ul>
      </div>

      <div class="surface-card card-rise" :style="{ animationDelay: '60ms' }">
        <header class="surface-header">
          <div>
            <h2>实时事件</h2>
            <p class="surface-sub">最近 {{ displayedEvents.length }} 条课堂动态</p>
          </div>
          <span class="badge-count num-tabular">{{ liveEvents.length }}</span>
        </header>
        <ul class="event-list">
          <li
            v-for="(evt, idx) in displayedEvents"
            :key="`${evt.time}-${idx}`"
            class="event-item card-rise"
            :style="{ animationDelay: idx * 30 + 'ms' }"
          >
            <span class="event-dot" :data-type="evt.type"></span>
            <div class="event-content">
              <p class="event-msg">{{ evt.text }}</p>
              <span class="event-time num-tabular">{{ evt.time }}</span>
            </div>
          </li>
        </ul>
      </div>
    </section>

    <!-- ============ 5. 智能洞察 ============ -->
    <section class="surface-card insight-card card-rise">
      <header class="surface-header">
        <div>
          <h2>今日智能洞察</h2>
          <p class="surface-sub">基于课堂数据生成的关键发现，点击查看详细报告</p>
        </div>
        <router-link to="/reports" class="link-text">完整报告 →</router-link>
      </header>
      <div class="insight-grid">
        <article
          v-for="(it, idx) in insights"
          :key="it.id"
          class="insight-item card-rise"
          :data-kind="it.kind"
          :style="{ animationDelay: idx * 60 + 'ms' }"
        >
          <div class="insight-icon" :data-kind="it.kind">
            <svg v-if="it.kind === 'highlight'" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4"/><circle cx="12" cy="12" r="3"/></svg>
            <svg v-else-if="it.kind === 'warning'" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
            <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
          </div>
          <h3 class="insight-title">{{ it.title }}</h3>
          <p class="insight-desc">{{ it.desc }}</p>
          <span v-if="it.metric" class="insight-metric num-tabular">{{ it.metric }}</span>
        </article>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, h, onMounted, onUnmounted, ref, watch } from 'vue'
import {
  Calendar,
  ChatDotRound,
  DataAnalysis,
  EditPen,
  Histogram,
  School,
  TrendCharts,
  User,
} from '@element-plus/icons-vue'
import * as echarts from 'echarts'
import { useAdminSocket } from '../composables/useAdminSocket'
import {
  activityDistribution,
  aiUsageSeries,
  insights,
  kpiMock,
  liveClassrooms,
  staticTimeline,
} from '../mocks/dashboard'
import Sparkline from '../components/Sparkline.vue'

const { isConnected, totalOnline, liveEvents, rooms } = useAdminSocket()

/** ----- 时间 / 问候 ----- */
const nowTime = ref('')
let nowTimer: ReturnType<typeof setInterval> | null = null

function tickNow() {
  nowTime.value = new Date().toLocaleString('zh-CN', {
    month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

const greeting = computed(() => {
  const h = new Date().getHours()
  if (h < 6)  return '凌晨好'
  if (h < 12) return '上午好'
  if (h < 14) return '中午好'
  if (h < 18) return '下午好'
  return '晚上好'
})

/** ----- KPI 卡片配置 ----- */
const kpi = kpiMock
const totalOnlineDisplay = computed(() =>
  totalOnline.value > 0 ? totalOnline.value.toLocaleString() : kpi.totalOnline.value.toLocaleString(),
)

const kpiCards = computed(() => [
  { key: 'today',  label: '今日课堂',   tone: 'brand',   icon: Calendar,      data: kpi.todayLessons,    sparkColor: 'var(--color-brand-500)'   },
  {
    key: 'online', label: '在线师生',   tone: 'success', icon: User,          data: {
      ...kpi.totalOnline,
      value: totalOnline.value > 0 ? totalOnline.value : kpi.totalOnline.value,
    }, sparkColor: 'var(--color-success-500)' },
  { key: 'active', label: '课堂活跃率', tone: 'warning', icon: TrendCharts,   data: kpi.activeRate,      sparkColor: 'var(--color-warning-500)' },
  { key: 'aiAll',  label: 'AI 调用总数',tone: 'ai',      icon: ChatDotRound,  data: kpi.aiTotalCalls,    sparkColor: 'var(--color-ai-500)'      },
  { key: 'wb',     label: 'AI 板书',    tone: 'ai',      icon: EditPen,       data: kpi.aiWhiteboard,    sparkColor: 'var(--color-ai-500)'      },
  { key: 'prac',   label: 'AI 实践',    tone: 'info',    icon: DataAnalysis,  data: kpi.aiPractice,      sparkColor: 'var(--color-info-500)'    },
  { key: 'group',  label: '分组讨论',   tone: 'success', icon: Histogram,     data: kpi.groupDiscussion, sparkColor: 'var(--color-success-500)' },
  { key: 'att',    label: '平均签到率', tone: 'brand',   icon: School,        data: kpi.attendanceRate,  sparkColor: 'var(--color-brand-500)'   },
])

/** ----- AI 使用 / 分布图（echarts） ----- */
const aiChartRef = ref<HTMLElement>()
const distChartRef = ref<HTMLElement>()
const ranges = ['7天', '30天', '90天'] as const
const range = ref<typeof ranges[number]>('7天')

let aiChart: echarts.ECharts | null = null
let distChart: echarts.ECharts | null = null

function buildAiOption() {
  const dates = aiUsageSeries.map(d => d.date)
  const series = [
    { key: 'chat',       name: 'AI 对话', color: 'var(--color-brand-500)'   },
    { key: 'whiteboard', name: 'AI 板书', color: 'var(--color-ai-500)'      },
    { key: 'practice',   name: 'AI 实践', color: 'var(--color-info-500)'    },
    { key: 'courseware', name: 'AI 课件', color: 'var(--color-warning-500)' },
    { key: 'quiz',       name: 'AI 出题', color: 'var(--color-success-500)' },
  ]
  return {
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(15,23,42,0.92)',
      borderWidth: 0,
      textStyle: { color: '#fff', fontSize: 12 },
      axisPointer: { lineStyle: { color: 'rgba(47,84,235,0.25)' } },
    },
    legend: {
      bottom: 0,
      itemWidth: 10,
      itemHeight: 10,
      textStyle: { color: '#475569', fontSize: 12 },
    },
    grid: { left: 36, right: 16, top: 16, bottom: 40 },
    xAxis: {
      type: 'category',
      data: dates,
      boundaryGap: false,
      axisLine: { lineStyle: { color: '#e2e8f0' } },
      axisLabel: { color: '#94a3b8', fontSize: 11 },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: '#eef1f6' } },
      axisLabel: { color: '#94a3b8', fontSize: 11 },
    },
    series: series.map((s, i) => ({
      name: s.name,
      type: 'line',
      stack: 'ai-total',
      smooth: true,
      showSymbol: false,
      lineStyle: { width: 0 },
      emphasis: { focus: 'series' },
      areaStyle: {
        opacity: 0.82,
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: getCssColor(s.color, 0.85) },
          { offset: 1, color: getCssColor(s.color, 0.35) },
        ]),
      },
      data: aiUsageSeries.map(d => d[s.key as keyof typeof d]),
      itemStyle: { color: getCssColor(s.color, 1) },
      z: 10 - i,
    })),
  }
}

/** 把 CSS var color 转 echarts 需要的 rgba 字符串（fallback 用预定义 palette） */
const cssColorMap: Record<string, string> = {
  'var(--color-brand-500)':   '47, 84, 235',
  'var(--color-ai-500)':      '114, 46, 209',
  'var(--color-info-500)':    '6, 182, 212',
  'var(--color-warning-500)': '245, 158, 11',
  'var(--color-success-500)': '22, 163, 74',
  'var(--color-danger-500)':  '239, 68, 68',
}
function getCssColor(token: string, alpha = 1): string {
  const rgb = cssColorMap[token] || '47, 84, 235'
  return `rgba(${rgb}, ${alpha})`
}

function buildDistOption() {
  return {
    tooltip: {
      trigger: 'item',
      formatter: '{b}<br/>{c} 次 ({d}%)',
      backgroundColor: 'rgba(15,23,42,0.92)',
      borderWidth: 0,
      textStyle: { color: '#fff', fontSize: 12 },
    },
    series: [
      {
        type: 'pie',
        radius: ['58%', '82%'],
        center: ['50%', '50%'],
        avoidLabelOverlap: true,
        itemStyle: { borderColor: '#fff', borderWidth: 4, borderRadius: 8 },
        label: { show: false },
        labelLine: { show: false },
        data: activityDistribution.map(it => ({
          name: it.name,
          value: it.value,
          itemStyle: { color: getCssColor(it.color, 1) },
        })),
      },
    ],
  }
}

function initCharts() {
  if (aiChartRef.value && !aiChart) {
    aiChart = echarts.init(aiChartRef.value)
    aiChart.setOption(buildAiOption())
  }
  if (distChartRef.value && !distChart) {
    distChart = echarts.init(distChartRef.value)
    distChart.setOption(buildDistOption())
  }
}

function disposeCharts() {
  aiChart?.dispose(); aiChart = null
  distChart?.dispose(); distChart = null
}

function handleResize() {
  aiChart?.resize()
  distChart?.resize()
}

/** ----- 课堂列表（real-time WS + mock fallback） ----- */
const displayedClassrooms = computed(() => {
  const live = rooms.value
    .filter(r => r.lessonId !== 'admin-monitor')
    .slice(0, 4)
    .map(r => ({
      id: r.roomId,
      name: r.lessonId || '未命名课堂',
      teacher: r.members.find(m => m.role === 'teacher')?.userName || '教师',
      className: '-',
      online: r.studentCount,
      total: Math.max(r.studentCount, 1),
      progress: Math.round((r.currentSlide / Math.max(r.totalSlides, 1)) * 100),
      activity: r.isLocked ? '锁屏' : (r.activeQuiz ? '随堂测验' : '授课中'),
    }))
  return live.length > 0 ? [...live, ...liveClassrooms.slice(0, 5 - live.length)] : liveClassrooms.slice(0, 5)
})

/** ----- 事件 feed（实时 + 静态合并） ----- */
const displayedEvents = computed(() => {
  const ws = liveEvents.value.slice(0, 8).map(e => ({
    time: e.time,
    type: e.type,
    text: e.message,
  }))
  return ws.length > 0 ? ws : staticTimeline.slice(0, 8)
})

onMounted(() => {
  tickNow()
  nowTimer = setInterval(tickNow, 30_000)
  initCharts()
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  if (nowTimer) clearInterval(nowTimer)
  window.removeEventListener('resize', handleResize)
  disposeCharts()
})

watch(range, () => {
  // mock：暂不变更，预留接口；真实接入时此处发起请求
  aiChart?.setOption(buildAiOption())
})

// 让模板能用 h 渲染图标（type narrowing）— 实际不用，但保留以备扩展
void h
</script>

<style scoped>
/* ========== 容器 ========== */
.dashboard {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  padding-bottom: var(--space-5);
}

/* ========== Hero ========== */
.hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-5);
  padding: var(--space-6);
  background: linear-gradient(135deg, #2f54eb 0%, #4361ee 60%, #722ed1 100%);
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

.hero-text { max-width: 720px; z-index: 1; }
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

.status-chip[data-status='off'] {
  background: rgba(0, 0, 0, 0.25);
  color: rgba(255, 255, 255, 0.7);
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: var(--radius-full);
  background: var(--color-success-500);
  box-shadow: 0 0 0 4px rgba(22, 163, 74, 0.25);
  animation: live-pulse 1.5s infinite;
}

.status-chip[data-status='off'] .status-dot {
  background: var(--color-danger-500);
  box-shadow: none;
  animation: none;
}

@keyframes live-pulse {
  0%, 100% { box-shadow: 0 0 0 4px rgba(22, 163, 74, 0.25); }
  50%      { box-shadow: 0 0 0 8px rgba(22, 163, 74, 0); }
}

.status-meta {
  font-size: var(--font-size-xs);
  color: rgba(255, 255, 255, 0.7);
}

/* ========== KPI Bento ========== */
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
  overflow: hidden;
}

.kpi-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.kpi-head {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

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
.kpi-icon--success { background: var(--color-success-50); color: var(--color-success-600); }
.kpi-icon--warning { background: var(--color-warning-50); color: var(--color-warning-600); }
.kpi-icon--ai      { background: var(--color-ai-50);      color: var(--color-ai-600);      }
.kpi-icon--info    { background: var(--color-info-50);    color: var(--color-info-600);    }

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

.kpi-delta {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-top: var(--space-2);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semi);
}

.kpi-delta[data-trend='up']   { color: var(--color-success-600); }
.kpi-delta[data-trend='down'] { color: var(--color-danger-600);  }

.kpi-delta-text {
  color: var(--color-text-tertiary);
  font-weight: var(--font-weight-regular);
  margin-left: var(--space-1);
}

.kpi-spark {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 120px;
  height: 40px;
  pointer-events: none;
  opacity: 0.85;
}

/* ========== Row Split (60/40) ========== */
.row-split {
  display: grid;
  grid-template-columns: 1.5fr 1fr;
  gap: var(--space-4);
}

/* ========== Surface Card ========== */
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

.link-text {
  font-size: var(--font-size-sm);
  color: var(--color-brand-500);
  text-decoration: none;
  font-weight: var(--font-weight-medium);
  transition: color var(--duration-fast) var(--ease-out);
}

.link-text:hover { color: var(--color-brand-600); }

.badge-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  height: 24px;
  padding: 0 var(--space-2);
  border-radius: var(--radius-full);
  background: var(--color-brand-50);
  color: var(--color-brand-600);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semi);
}

/* ----- chips ----- */
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
  transition: background var(--duration-fast) var(--ease-out),
              color var(--duration-fast) var(--ease-out);
}

.chip:hover {
  color: var(--color-text-primary);
}

.chip--active {
  background: var(--color-bg-elevated);
  color: var(--color-brand-600);
  box-shadow: var(--shadow-sm);
}

/* ----- 图表容器 ----- */
.chart-canvas {
  width: 100%;
}

/* ----- 分布图 legend ----- */
.dist-legend {
  list-style: none;
  margin: var(--space-3) 0 0 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 6px var(--space-3);
}

.dist-legend li {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
}

.dist-dot {
  width: 8px;
  height: 8px;
  border-radius: var(--radius-full);
  flex-shrink: 0;
}

.dist-name { flex: 1; }
.dist-value { color: var(--color-text-primary); font-weight: var(--font-weight-semi); }

/* ========== 实时课堂 ========== */
.classroom-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.classroom-row {
  display: grid;
  grid-template-columns: 12px 1fr auto 168px;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: var(--color-bg-soft);
  border-radius: var(--radius-md);
  transition: background var(--duration-fast) var(--ease-out);
  animation: card-rise-in var(--duration-slow) var(--ease-out) both;
}

.classroom-row:hover {
  background: var(--color-brand-50);
}

.cr-pulse {
  width: 8px;
  height: 8px;
  border-radius: var(--radius-full);
  background: var(--color-success-500);
  box-shadow: 0 0 0 3px rgba(22, 163, 74, 0.18);
  animation: live-pulse-sm 1.5s infinite;
}

@keyframes live-pulse-sm {
  0%, 100% { box-shadow: 0 0 0 3px rgba(22, 163, 74, 0.18); }
  50%      { box-shadow: 0 0 0 6px rgba(22, 163, 74, 0); }
}

.cr-info { min-width: 0; }
.cr-name {
  margin: 0;
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semi);
  color: var(--color-text-primary);
}

.cr-meta {
  margin: 2px 0 0 0;
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
}

.cr-activity {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  padding: 3px var(--space-2);
  border-radius: var(--radius-sm);
  background: var(--color-brand-50);
  color: var(--color-brand-600);
}

.cr-activity[data-activity='AI实践']   { background: var(--color-info-50);    color: var(--color-info-600);    }
.cr-activity[data-activity='随堂测验'] { background: var(--color-warning-50); color: var(--color-warning-600); }
.cr-activity[data-activity='分组讨论'] { background: var(--color-success-50); color: var(--color-success-600); }
.cr-activity[data-activity='签到中']   { background: var(--color-ai-50);      color: var(--color-ai-600);      }
.cr-activity[data-activity='抢答中']   { background: var(--color-danger-50);  color: var(--color-danger-600);  }
.cr-activity[data-activity='锁屏']     { background: #f1f5f9;                 color: #475569;                  }

.cr-stats {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.cr-online {
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
}

.cr-online small {
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
  font-weight: var(--font-weight-regular);
  margin-left: 2px;
}

.cr-bar {
  width: 96px;
  height: 6px;
  border-radius: var(--radius-full);
  background: var(--color-border-subtle);
  overflow: hidden;
}

.cr-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--color-brand-500), var(--color-ai-500));
  border-radius: var(--radius-full);
  transition: width var(--duration-slow) var(--ease-out);
}

/* ========== 事件 feed ========== */
.event-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0;
  max-height: 340px;
  overflow-y: auto;
}

.event-item {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-3) 0;
  border-bottom: 1px solid var(--color-border-subtle);
}

.event-item:last-child { border-bottom: none; }

.event-dot {
  width: 8px;
  height: 8px;
  border-radius: var(--radius-full);
  margin-top: 6px;
  flex-shrink: 0;
  background: var(--color-brand-500);
}

.event-dot[data-type='quiz']       { background: var(--color-warning-500); }
.event-dot[data-type='attendance'] { background: var(--color-success-500); }
.event-dot[data-type='broadcast']  { background: var(--color-brand-500);   }
.event-dot[data-type='hand']       { background: #fa541c;                  }
.event-dot[data-type='question']   { background: var(--color-ai-500);      }
.event-dot[data-type='answer']     { background: var(--color-info-500);    }
.event-dot[data-type='lock']       { background: var(--color-danger-500);  }
.event-dot[data-type='group']      { background: var(--color-success-500); }
.event-dot[data-type='lesson']     { background: #eb2f96;                  }
.event-dot[data-type='ai']         { background: var(--color-ai-500);      }

.event-content {
  flex: 1;
  display: flex;
  justify-content: space-between;
  gap: var(--space-3);
  min-width: 0;
}

.event-msg {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
  line-height: var(--line-height-base);
}

.event-time {
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
  flex-shrink: 0;
}

/* ========== 智能洞察 ========== */
.insight-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-3);
}

.insight-item {
  position: relative;
  padding: var(--space-4);
  background: var(--color-bg-soft);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border-subtle);
  transition: transform var(--duration-base) var(--ease-out),
              box-shadow var(--duration-base) var(--ease-out);
}

.insight-item:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.insight-item[data-kind='highlight'] { border-top: 3px solid var(--color-success-500); }
.insight-item[data-kind='warning']   { border-top: 3px solid var(--color-warning-500); }
.insight-item[data-kind='tip']       { border-top: 3px solid var(--color-info-500);    }

.insight-icon {
  display: inline-flex;
  width: 32px;
  height: 32px;
  border-radius: var(--radius-md);
  align-items: center;
  justify-content: center;
  margin-bottom: var(--space-2);
}

.insight-icon[data-kind='highlight'] { background: var(--color-success-50); color: var(--color-success-600); }
.insight-icon[data-kind='warning']   { background: var(--color-warning-50); color: var(--color-warning-600); }
.insight-icon[data-kind='tip']       { background: var(--color-info-50);    color: var(--color-info-600);    }

.insight-title {
  margin: 0;
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semi);
  color: var(--color-text-primary);
}

.insight-desc {
  margin: 4px 0 var(--space-2) 0;
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  line-height: var(--line-height-base);
}

.insight-metric {
  display: inline-block;
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
}

/* ========== 响应式 ========== */
@media (max-width: 1280px) {
  .kpi-grid    { grid-template-columns: repeat(4, 1fr); }
  .insight-grid{ grid-template-columns: repeat(2, 1fr); }
}

@media (max-width: 1024px) {
  .kpi-grid    { grid-template-columns: repeat(2, 1fr); }
  .row-split   { grid-template-columns: 1fr; }
  .insight-grid{ grid-template-columns: repeat(2, 1fr); }
  .hero        { flex-direction: column; align-items: flex-start; }
  .hero-status { align-items: flex-start; }
}

@media (max-width: 640px) {
  .kpi-grid     { grid-template-columns: 1fr; }
  .insight-grid { grid-template-columns: 1fr; }
  .classroom-row{ grid-template-columns: 8px 1fr auto; }
  .cr-stats     { display: none; }
  .hero-greet h1{ font-size: var(--font-size-lg); }
}
</style>
