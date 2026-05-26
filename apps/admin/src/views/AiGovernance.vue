<template>
  <div class="ai-gov">
    <!-- ============ 1. Hero ============ -->
    <header class="hero card-rise">
      <div class="hero-text">
        <div class="hero-greet">
          <span class="hero-greet-emoji" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 2l1.5 4.5L18 8l-4.5 1.5L12 14l-1.5-4.5L6 8l4.5-1.5z"/>
              <path d="M5 19l1 3M19 19l1 3M2 16h4M18 16h4"/>
            </svg>
          </span>
          <h1>AI 助教治理中心</h1>
        </div>
        <p class="hero-sub">
          今日累计消耗 <strong>{{ kpi.todayTokens.value }}k</strong> token、被调用 <strong>{{ kpi.todayCalls.value }}</strong> 次，
          错误率 <strong>{{ kpi.errorRate.value }}%</strong>，
          当前主路由 <strong>{{ primaryProvider?.name || '—' }}</strong>。
        </p>
      </div>
      <div class="hero-status">
        <div class="status-chip" :data-status="primaryProvider?.status === 'healthy' ? 'ok' : 'off'">
          <span class="status-dot"></span>
          {{ primaryProvider?.status === 'healthy' ? '主路由健康' : '主路由异常' }}
        </div>
        <span class="status-meta num-tabular">{{ nowTime }}</span>
      </div>
    </header>

    <!-- ============ 2. KPI Bento ============ -->
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
            <span class="kpi-value num-tabular">{{ formatValue(card.data.value) }}</span>
            <span class="kpi-unit">{{ card.data.unit }}</span>
          </div>
          <div class="kpi-delta" :data-trend="card.preferDecrease ? (card.data.delta <= 0 ? 'up' : 'down') : (card.data.delta >= 0 ? 'up' : 'down')">
            <svg v-if="card.data.delta >= 0" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17L17 7M17 7H8M17 7v9"/></svg>
            <svg v-else width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 7l10 10M17 17H8M17 17V8"/></svg>
            <span class="num-tabular">{{ Math.abs(card.data.delta).toFixed(1) }}%</span>
            <span class="kpi-delta-text">较昨日</span>
          </div>
        </div>
        <Sparkline :points="card.data.series" :color="card.sparkColor" class="kpi-spark" />
      </article>
    </section>

    <!-- ============ 3. Token 趋势 + Provider 健康 ============ -->
    <section class="row-split">
      <div class="surface-card card-rise">
        <header class="surface-header">
          <div>
            <h2>Token 7 日消耗趋势</h2>
            <p class="surface-sub">按功能拆分的日消耗（千 token）</p>
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
        <div ref="tokenChartRef" class="chart-canvas" :style="{ height: '288px' }" aria-label="Token 消耗趋势图表"></div>
      </div>

      <div class="surface-card card-rise" :style="{ animationDelay: '60ms' }">
        <header class="surface-header">
          <div>
            <h2>Provider 路由健康</h2>
            <p class="surface-sub">实时心跳 / 24h 调用 / 成功率</p>
          </div>
          <span class="link-text" style="cursor: default">
            主路由：{{ primaryProvider?.model || '—' }}
          </span>
        </header>
        <ul class="provider-list">
          <li
            v-for="(p, i) in providerHealth"
            :key="p.id"
            class="provider-row card-rise"
            :style="{ animationDelay: i * 50 + 'ms' }"
          >
            <div class="prov-head">
              <span class="prov-status-dot" :data-status="p.status"></span>
              <div class="prov-name-wrap">
                <span class="prov-name">{{ p.name }}</span>
                <span v-if="p.isPrimary" class="prov-primary-badge">主路由</span>
              </div>
              <span class="prov-model num-tabular">{{ p.model }}</span>
            </div>
            <div class="prov-stats">
              <div class="prov-stat">
                <span class="prov-stat-val num-tabular">{{ p.requests24h.toLocaleString() }}</span>
                <span class="prov-stat-label">24h 调用</span>
              </div>
              <div class="prov-stat">
                <span class="prov-stat-val num-tabular">{{ p.avgLatency }}<small>ms</small></span>
                <span class="prov-stat-label">平均延迟</span>
              </div>
              <div class="prov-stat">
                <span class="prov-stat-val num-tabular" :data-success="p.successRate >= 99 ? 'ok' : p.successRate >= 95 ? 'mid' : 'low'">
                  {{ p.successRate.toFixed(1) }}<small>%</small>
                </span>
                <span class="prov-stat-label">成功率</span>
              </div>
              <div class="prov-stat">
                <span class="prov-stat-val num-tabular">¥{{ p.costToday.toFixed(1) }}</span>
                <span class="prov-stat-label">今日成本</span>
              </div>
            </div>
            <div class="prov-foot">
              <span class="prov-check">心跳 {{ p.lastCheck }}</span>
              <span class="prov-status-label" :data-status="p.status">{{ statusLabel(p.status) }}</span>
            </div>
          </li>
        </ul>
      </div>
    </section>

    <!-- ============ 4. 实时调用流水 ============ -->
    <section class="surface-card card-rise">
      <header class="surface-header">
        <div>
          <h2>实时调用流水</h2>
          <p class="surface-sub">最近 {{ filteredCallLog.length }} / {{ aiCallLog.length }} 条 AI 调用日志</p>
        </div>
        <div class="filter-bar">
          <div class="chip-group" role="tablist" aria-label="功能筛选">
            <button
              v-for="f in featureFilters"
              :key="f.key"
              role="tab"
              :aria-selected="featureFilter === f.key"
              :class="['chip', { 'chip--active': featureFilter === f.key }]"
              @click="featureFilter = f.key"
            >{{ f.label }}</button>
          </div>
          <div class="chip-group" role="tablist" aria-label="状态筛选">
            <button
              v-for="s in statusFilters"
              :key="s.key"
              role="tab"
              :aria-selected="statusFilter === s.key"
              :class="['chip', { 'chip--active': statusFilter === s.key }]"
              @click="statusFilter = s.key"
            >{{ s.label }}</button>
          </div>
        </div>
      </header>

      <div class="call-table-wrap">
        <table class="call-table">
          <thead>
            <tr>
              <th>时间</th>
              <th>Provider</th>
              <th>功能</th>
              <th>用户</th>
              <th class="col-prompt">Prompt 摘要</th>
              <th class="num">In</th>
              <th class="num">Out</th>
              <th class="num">延迟</th>
              <th class="num">成本</th>
              <th>状态</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="item in filteredCallLog"
              :key="item.id"
              :data-status="item.status"
            >
              <td class="num-tabular">{{ item.time }}</td>
              <td>
                <span class="prov-pill" :data-prov="item.provider">{{ PROVIDER_LABEL[item.provider] || item.provider }}</span>
              </td>
              <td>
                <span class="feat-pill" :data-feat="item.feature">{{ FEATURE_LABEL[item.feature] }}</span>
              </td>
              <td>{{ item.user }}</td>
              <td class="col-prompt prompt-cell text-truncate" :title="item.promptPreview">{{ item.promptPreview }}</td>
              <td class="num num-tabular">{{ item.tokensIn }}</td>
              <td class="num num-tabular">{{ item.tokensOut }}</td>
              <td class="num num-tabular">{{ item.latency }}</td>
              <td class="num num-tabular">¥{{ item.cost.toFixed(3) }}</td>
              <td>
                <span class="status-pill" :data-tone="STATUS_TONE[item.status]">
                  <span class="status-pill-dot"></span>
                  {{ STATUS_LABEL[item.status] }}
                </span>
              </td>
            </tr>
            <tr v-if="filteredCallLog.length === 0">
              <td colspan="10" class="empty-row">当前筛选条件下没有调用记录</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- ============ 5. 敏感词告警 + Token Top ============ -->
    <section class="row-split">
      <div class="surface-card card-rise">
        <header class="surface-header">
          <div>
            <h2>安全告警 · 最近 24h</h2>
            <p class="surface-sub">敏感词 / 注入攻击 / 超长 / 隐私信息 / 限流</p>
          </div>
          <span class="badge-count num-tabular">{{ unhandledCount }} 未处理</span>
        </header>
        <ul class="alert-list">
          <li
            v-for="(a, i) in sensitiveAlerts"
            :key="a.id"
            class="alert-item card-rise"
            :data-severity="a.severity"
            :style="{ animationDelay: i * 40 + 'ms' }"
          >
            <div class="alert-icon" :data-severity="a.severity">
              <svg v-if="a.severity === 'high'" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
              <svg v-else-if="a.severity === 'medium'" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
              <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9 12l2 2 4-4"/></svg>
            </div>
            <div class="alert-body">
              <div class="alert-head">
                <h3 class="alert-title">{{ a.title }}</h3>
                <span class="alert-kind">{{ ALERT_KIND_LABEL[a.kind] }}</span>
                <span class="alert-time num-tabular">{{ a.time }}</span>
              </div>
              <p class="alert-desc">{{ a.desc }}</p>
              <div class="alert-foot">
                <span class="alert-user">触发者：{{ a.user }}</span>
                <span class="alert-status" :data-handled="a.handled">{{ a.handled ? '已处理' : '待处理' }}</span>
              </div>
            </div>
          </li>
        </ul>
      </div>

      <div class="surface-card card-rise" :style="{ animationDelay: '60ms' }">
        <header class="surface-header">
          <div>
            <h2>Token 用量 Top · 本周</h2>
            <p class="surface-sub">按消耗量排名的活跃教师</p>
          </div>
          <span class="link-text" style="cursor: default">含 chat / 板书 / 实践</span>
        </header>
        <ul class="top-list">
          <li
            v-for="(u, i) in tokenTopUsers"
            :key="u.rank"
            class="top-row card-rise"
            :style="{ animationDelay: i * 40 + 'ms' }"
          >
            <span class="top-rank" :data-rank="u.rank">{{ u.rank }}</span>
            <div class="top-info">
              <div class="top-name-row">
                <span class="top-name">{{ u.name }}</span>
                <span class="top-role">{{ u.role }}</span>
                <span class="top-feat-tag" :data-feat="featureKeyFromLabel(u.topFeature)">{{ u.topFeature }}最多</span>
              </div>
              <span class="top-dept">{{ u.department }}</span>
            </div>
            <div class="top-stats">
              <span class="top-tokens num-tabular">{{ u.tokensUsed }}<small>k</small></span>
              <span class="top-calls num-tabular">{{ u.calls }} 次</span>
            </div>
          </li>
        </ul>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import {
  ChatDotRound,
  Coin,
  Lightning,
  Warning,
} from '@element-plus/icons-vue'
import * as echarts from 'echarts'
import {
  ALERT_KIND_LABEL,
  FEATURE_LABEL,
  PROVIDER_LABEL,
  STATUS_LABEL,
  STATUS_TONE,
  aiCallLog,
  aiGovernanceKpi,
  providerHealth,
  sensitiveAlerts,
  tokenTopUsers,
  tokenUsageSeries,
  type CallFeature,
  type CallStatus,
  type ProviderStatus,
} from '../mocks/ai-governance'
import Sparkline from '../components/Sparkline.vue'

/** ----- 时间 ----- */
const nowTime = ref('')
let nowTimer: ReturnType<typeof setInterval> | null = null

function tickNow() {
  nowTime.value = new Date().toLocaleString('zh-CN', {
    month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

/** ----- KPI 卡片 ----- */
const kpi = aiGovernanceKpi
const kpiCards = computed(() => [
  { key: 'tok',  label: '今日 Token 消耗', tone: 'ai',      icon: Coin,         data: kpi.todayTokens, sparkColor: 'var(--color-ai-500)',      preferDecrease: false },
  { key: 'call', label: '今日调用次数',     tone: 'brand',   icon: ChatDotRound, data: kpi.todayCalls,  sparkColor: 'var(--color-brand-500)',   preferDecrease: false },
  { key: 'lat',  label: '平均首字延迟',     tone: 'info',    icon: Lightning,    data: kpi.avgLatency,  sparkColor: 'var(--color-info-500)',    preferDecrease: true  },
  { key: 'err',  label: '调用错误率',       tone: 'warning', icon: Warning,      data: kpi.errorRate,   sparkColor: 'var(--color-warning-500)', preferDecrease: true  },
])

function formatValue(v: number): string {
  return v >= 1000 ? v.toLocaleString() : v.toString()
}

/** ----- Provider 健康 ----- */
const primaryProvider = computed(() => providerHealth.find(p => p.isPrimary))
function statusLabel(s: ProviderStatus): string {
  return ({ healthy: '健康', degraded: '降级', down: '故障', standby: '待命' } as const)[s]
}

/** ----- Token 趋势图 ----- */
const tokenChartRef = ref<HTMLElement>()
const ranges = ['7天', '30天', '90天'] as const
const range = ref<typeof ranges[number]>('7天')
let tokenChart: echarts.ECharts | null = null

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

function buildTokenOption() {
  const dates = tokenUsageSeries.map(d => d.date)
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
      valueFormatter: (v: number) => `${v}k`,
      axisPointer: { lineStyle: { color: 'rgba(114,46,209,0.25)' } },
    },
    legend: {
      bottom: 0,
      itemWidth: 10,
      itemHeight: 10,
      textStyle: { color: '#475569', fontSize: 12 },
    },
    grid: { left: 40, right: 16, top: 16, bottom: 40 },
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
      axisLabel: { color: '#94a3b8', fontSize: 11, formatter: '{value}k' },
    },
    series: series.map((s, i) => ({
      name: s.name,
      type: 'line',
      stack: 'token-total',
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
      data: tokenUsageSeries.map(d => d[s.key as keyof typeof d]),
      itemStyle: { color: getCssColor(s.color, 1) },
      z: 10 - i,
    })),
  }
}

function initChart() {
  if (tokenChartRef.value && !tokenChart) {
    tokenChart = echarts.init(tokenChartRef.value)
    tokenChart.setOption(buildTokenOption())
  }
}
function handleResize() { tokenChart?.resize() }

/** ----- 流水筛选 ----- */
const featureFilters: { key: CallFeature | 'all'; label: string }[] = [
  { key: 'all',        label: '全部' },
  { key: 'chat',       label: 'AI 对话' },
  { key: 'whiteboard', label: 'AI 板书' },
  { key: 'practice',   label: 'AI 实践' },
  { key: 'courseware', label: 'AI 课件' },
  { key: 'quiz',       label: 'AI 出题' },
]
const statusFilters: { key: CallStatus | 'all'; label: string }[] = [
  { key: 'all',     label: '全部' },
  { key: 'success', label: '成功' },
  { key: 'flagged', label: '已拦截' },
  { key: 'timeout', label: '超时' },
  { key: 'failed',  label: '失败' },
]
const featureFilter = ref<CallFeature | 'all'>('all')
const statusFilter  = ref<CallStatus | 'all'>('all')

const filteredCallLog = computed(() =>
  aiCallLog.filter(it =>
    (featureFilter.value === 'all' || it.feature === featureFilter.value) &&
    (statusFilter.value  === 'all' || it.status  === statusFilter.value),
  ),
)

/** ----- 告警 ----- */
const unhandledCount = computed(() => sensitiveAlerts.filter(a => !a.handled).length)

/** ----- 工具 ----- */
function featureKeyFromLabel(label: string): CallFeature {
  switch (label) {
    case '对话': return 'chat'
    case '板书': return 'whiteboard'
    case '实践': return 'practice'
    case '课件': return 'courseware'
    case '出题': return 'quiz'
    default: return 'chat'
  }
}

watch(range, () => {
  // mock：仅触发重绘；真实接入时此处发请求
  tokenChart?.setOption(buildTokenOption())
})

onMounted(() => {
  tickNow()
  nowTimer = setInterval(tickNow, 30_000)
  initChart()
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  if (nowTimer) clearInterval(nowTimer)
  window.removeEventListener('resize', handleResize)
  tokenChart?.dispose(); tokenChart = null
})
</script>

<style scoped>
.ai-gov {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  padding-bottom: var(--space-5);
}

/* ====== Hero（紫色调，区别于 Dashboard 的蓝紫渐变） ====== */
.hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-5);
  padding: var(--space-6);
  background: linear-gradient(135deg, #5b1eb0 0%, #722ed1 55%, #a370f7 100%);
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

/* ====== KPI Bento ====== */
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

/* ====== Row Split ====== */
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
.link-text {
  font-size: var(--font-size-sm);
  color: var(--color-brand-500);
  text-decoration: none;
  font-weight: var(--font-weight-medium);
}
.badge-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  height: 24px;
  padding: 0 var(--space-2);
  border-radius: var(--radius-full);
  background: var(--color-warning-50);
  color: var(--color-warning-600);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semi);
}

/* chips */
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
.chip:hover { color: var(--color-text-primary); }
.chip--active {
  background: var(--color-bg-elevated);
  color: var(--color-brand-600);
  box-shadow: var(--shadow-sm);
}
.chart-canvas { width: 100%; }

/* ====== Provider 健康卡 ====== */
.provider-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.provider-row {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-4);
  background: var(--color-bg-soft);
  border-radius: var(--radius-md);
  border: 1px solid transparent;
  transition: border-color var(--duration-fast) var(--ease-out);
}
.provider-row:hover {
  border-color: var(--color-border-default);
}
.prov-head {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}
.prov-status-dot {
  width: 10px;
  height: 10px;
  border-radius: var(--radius-full);
  flex-shrink: 0;
}
.prov-status-dot[data-status='healthy']  { background: var(--color-success-500); box-shadow: 0 0 0 3px rgba(22,163,74,0.18); }
.prov-status-dot[data-status='degraded'] { background: var(--color-warning-500); box-shadow: 0 0 0 3px rgba(245,158,11,0.18); }
.prov-status-dot[data-status='down']     { background: var(--color-danger-500);  box-shadow: 0 0 0 3px rgba(239,68,68,0.18); }
.prov-status-dot[data-status='standby']  { background: var(--color-text-tertiary); }
.prov-name-wrap { flex: 1; display: flex; align-items: center; gap: var(--space-2); min-width: 0; }
.prov-name {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semi);
  color: var(--color-text-primary);
}
.prov-primary-badge {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: var(--radius-xs);
  background: var(--color-brand-50);
  color: var(--color-brand-600);
  font-weight: var(--font-weight-semi);
}
.prov-model {
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
  font-family: var(--font-mono);
}
.prov-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-2);
}
.prov-stat {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.prov-stat-val {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
  display: inline-flex;
  align-items: baseline;
  gap: 2px;
}
.prov-stat-val[data-success='ok']  { color: var(--color-success-600); }
.prov-stat-val[data-success='mid'] { color: var(--color-warning-600); }
.prov-stat-val[data-success='low'] { color: var(--color-danger-600);  }
.prov-stat-val small {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-regular);
  color: var(--color-text-tertiary);
}
.prov-stat-label {
  font-size: 11px;
  color: var(--color-text-tertiary);
}
.prov-foot {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
}
.prov-status-label {
  padding: 2px 8px;
  border-radius: var(--radius-xs);
  font-weight: var(--font-weight-medium);
}
.prov-status-label[data-status='healthy']  { background: var(--color-success-50); color: var(--color-success-600); }
.prov-status-label[data-status='degraded'] { background: var(--color-warning-50); color: var(--color-warning-600); }
.prov-status-label[data-status='down']     { background: var(--color-danger-50);  color: var(--color-danger-600);  }
.prov-status-label[data-status='standby']  { background: #f1f5f9;                 color: #475569;                  }

/* ====== 流水表 ====== */
.filter-bar {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
}
.call-table-wrap {
  overflow-x: auto;
  margin: 0 calc(-1 * var(--space-5));
  padding: 0 var(--space-5);
}
.call-table {
  width: 100%;
  min-width: 920px;
  border-collapse: collapse;
  font-size: var(--font-size-sm);
}
.call-table thead th {
  text-align: left;
  font-weight: var(--font-weight-medium);
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
  padding: var(--space-3) var(--space-2);
  border-bottom: 1px solid var(--color-border-subtle);
  position: sticky;
  top: 0;
  background: var(--color-bg-elevated);
}
.call-table tbody td {
  padding: var(--space-3) var(--space-2);
  border-bottom: 1px solid var(--color-border-subtle);
  color: var(--color-text-primary);
  vertical-align: middle;
}
.call-table tbody tr:last-child td { border-bottom: none; }
.call-table tbody tr {
  transition: background var(--duration-fast) var(--ease-out);
}
.call-table tbody tr:hover { background: var(--color-bg-soft); }
.call-table tbody tr[data-status='flagged'] { background: rgba(6, 182, 212, 0.04); }
.call-table tbody tr[data-status='timeout'] { background: rgba(245, 158, 11, 0.04); }
.call-table tbody tr[data-status='failed']  { background: rgba(239, 68, 68, 0.04); }
.call-table th.num, .call-table td.num { text-align: right; }
.col-prompt { width: 32%; }
.prompt-cell {
  color: var(--color-text-secondary);
  max-width: 280px;
}
.empty-row {
  text-align: center;
  color: var(--color-text-tertiary);
  padding: var(--space-7) 0 !important;
}

/* provider / feature / status pills */
.prov-pill, .feat-pill {
  display: inline-block;
  padding: 2px 8px;
  border-radius: var(--radius-xs);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  background: var(--color-bg-soft);
  color: var(--color-text-secondary);
}
.prov-pill[data-prov='qwen']     { background: var(--color-brand-50);   color: var(--color-brand-600);   }
.prov-pill[data-prov='claude']   { background: var(--color-warning-50); color: var(--color-warning-600); }
.prov-pill[data-prov='deepseek'] { background: var(--color-info-50);    color: var(--color-info-600);    }
.prov-pill[data-prov='gemini']   { background: var(--color-success-50); color: var(--color-success-600); }

.feat-pill[data-feat='chat']       { background: var(--color-brand-50);   color: var(--color-brand-600);   }
.feat-pill[data-feat='whiteboard'] { background: var(--color-ai-50);      color: var(--color-ai-600);      }
.feat-pill[data-feat='practice']   { background: var(--color-info-50);    color: var(--color-info-600);    }
.feat-pill[data-feat='courseware'] { background: var(--color-warning-50); color: var(--color-warning-600); }
.feat-pill[data-feat='quiz']       { background: var(--color-success-50); color: var(--color-success-600); }

.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: var(--radius-full);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
}
.status-pill-dot {
  width: 6px;
  height: 6px;
  border-radius: var(--radius-full);
  background: currentColor;
}
.status-pill[data-tone='success'] { background: var(--color-success-50); color: var(--color-success-600); }
.status-pill[data-tone='danger']  { background: var(--color-danger-50);  color: var(--color-danger-600);  }
.status-pill[data-tone='warning'] { background: var(--color-warning-50); color: var(--color-warning-600); }
.status-pill[data-tone='info']    { background: var(--color-info-50);    color: var(--color-info-600);    }

/* ====== 告警 ====== */
.alert-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.alert-item {
  display: flex;
  gap: var(--space-3);
  padding: var(--space-4);
  background: var(--color-bg-soft);
  border-radius: var(--radius-md);
  border-left: 3px solid var(--color-border-default);
}
.alert-item[data-severity='high']   { border-left-color: var(--color-danger-500);  }
.alert-item[data-severity='medium'] { border-left-color: var(--color-warning-500); }
.alert-item[data-severity='low']    { border-left-color: var(--color-info-500);    }

.alert-icon {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.alert-icon[data-severity='high']   { background: var(--color-danger-50);  color: var(--color-danger-600);  }
.alert-icon[data-severity='medium'] { background: var(--color-warning-50); color: var(--color-warning-600); }
.alert-icon[data-severity='low']    { background: var(--color-info-50);    color: var(--color-info-600);    }

.alert-body { flex: 1; min-width: 0; }
.alert-head {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}
.alert-title {
  margin: 0;
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semi);
  color: var(--color-text-primary);
  flex: 1;
}
.alert-kind {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: var(--radius-xs);
  background: var(--color-bg-elevated);
  color: var(--color-text-secondary);
  font-weight: var(--font-weight-medium);
}
.alert-time {
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
}
.alert-desc {
  margin: var(--space-2) 0 var(--space-2) 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  line-height: var(--line-height-base);
}
.alert-foot {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
}
.alert-status {
  padding: 2px 8px;
  border-radius: var(--radius-xs);
  font-weight: var(--font-weight-medium);
}
.alert-status[data-handled='false'] { background: var(--color-danger-50);  color: var(--color-danger-600);  }
.alert-status[data-handled='true']  { background: var(--color-success-50); color: var(--color-success-600); }

/* ====== Top 教师 ====== */
.top-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.top-row {
  display: grid;
  grid-template-columns: 36px 1fr auto;
  gap: var(--space-3);
  align-items: center;
  padding: var(--space-3) var(--space-4);
  background: var(--color-bg-soft);
  border-radius: var(--radius-md);
  transition: background var(--duration-fast) var(--ease-out);
}
.top-row:hover { background: var(--color-brand-50); }
.top-rank {
  width: 28px;
  height: 28px;
  border-radius: var(--radius-full);
  background: var(--color-bg-elevated);
  color: var(--color-text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: var(--font-weight-bold);
  font-size: var(--font-size-sm);
  font-variant-numeric: tabular-nums;
}
.top-rank[data-rank='1'] { background: #fff7e6; color: #d48806; }
.top-rank[data-rank='2'] { background: #e6f4ff; color: #1d39c4; }
.top-rank[data-rank='3'] { background: #fff1f0; color: #cf1322; }

.top-info { min-width: 0; }
.top-name-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}
.top-name {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semi);
  color: var(--color-text-primary);
}
.top-role {
  font-size: 11px;
  padding: 1px 6px;
  border-radius: var(--radius-xs);
  background: var(--color-brand-50);
  color: var(--color-brand-600);
}
.top-feat-tag {
  font-size: 11px;
  padding: 1px 6px;
  border-radius: var(--radius-xs);
}
.top-feat-tag[data-feat='chat']       { background: var(--color-brand-50);   color: var(--color-brand-600);   }
.top-feat-tag[data-feat='whiteboard'] { background: var(--color-ai-50);      color: var(--color-ai-600);      }
.top-feat-tag[data-feat='practice']   { background: var(--color-info-50);    color: var(--color-info-600);    }
.top-feat-tag[data-feat='courseware'] { background: var(--color-warning-50); color: var(--color-warning-600); }
.top-feat-tag[data-feat='quiz']       { background: var(--color-success-50); color: var(--color-success-600); }

.top-dept {
  display: block;
  margin-top: 2px;
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
}
.top-stats {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
}
.top-tokens {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
  color: var(--color-ai-600);
  display: inline-flex;
  align-items: baseline;
  gap: 2px;
}
.top-tokens small {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-regular);
  color: var(--color-text-tertiary);
}
.top-calls {
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
}

/* ====== 响应式 ====== */
@media (max-width: 1280px) {
  .kpi-grid { grid-template-columns: repeat(4, 1fr); gap: var(--space-3); }
  .prov-stats { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 1024px) {
  .row-split { grid-template-columns: 1fr; }
  .kpi-grid { grid-template-columns: repeat(2, 1fr); }
  .filter-bar { width: 100%; }
}
@media (max-width: 640px) {
  .kpi-grid { grid-template-columns: 1fr; }
  .hero { flex-direction: column; align-items: flex-start; padding: var(--space-5); }
  .hero-status { align-items: flex-start; }
  .prov-stats { grid-template-columns: 1fr 1fr; }
}
</style>
