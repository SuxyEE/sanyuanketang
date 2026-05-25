<template>
  <div class="reports-page">
    <el-row :gutter="16">
      <el-col :span="12">
        <el-card shadow="never">
          <template #header>
            <span>本周课堂活跃度趋势</span>
          </template>
          <div ref="lineChartRef" class="chart-container"></div>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card shadow="never">
          <template #header>
            <span>各专业AI使用分布</span>
          </template>
          <div ref="pieChartRef" class="chart-container"></div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="16" style="margin-top: 16px">
      <el-col :span="12">
        <el-card shadow="never">
          <template #header>
            <span>课堂互动类型统计</span>
          </template>
          <div ref="barChartRef" class="chart-container"></div>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card shadow="never">
          <template #header>
            <span>教师活跃度排行</span>
          </template>
          <div ref="rankChartRef" class="chart-container"></div>
        </el-card>
      </el-col>
    </el-row>

    <el-card shadow="never" style="margin-top: 16px">
      <template #header>
        <span>知识点掌握度排行</span>
      </template>
      <el-table :data="knowledgeData" stripe>
        <el-table-column type="index" label="#" width="50" />
        <el-table-column prop="subject" label="专业" width="180" />
        <el-table-column prop="point" label="知识点" min-width="200" />
        <el-table-column prop="mastery" label="平均掌握度" width="150">
          <template #default="{ row }">
            <el-progress :percentage="row.mastery" :color="getColor(row.mastery)" :stroke-width="8" />
          </template>
        </el-table-column>
        <el-table-column prop="students" label="学习人数" width="100" align="center" />
        <el-table-column prop="trend" label="趋势" width="80" align="center">
          <template #default="{ row }">
            <el-icon :color="row.trend === 'up' ? '#52c41a' : '#ff4d4f'">
              <component :is="row.trend === 'up' ? 'Top' : 'Bottom'" />
            </el-icon>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import * as echarts from 'echarts'

const lineChartRef = ref<HTMLElement>()
const pieChartRef = ref<HTMLElement>()
const barChartRef = ref<HTMLElement>()
const rankChartRef = ref<HTMLElement>()
let charts: echarts.ECharts[] = []

const knowledgeData = ref([
  { subject: '工业机器人技术', point: '机器人运动学正/逆解', mastery: 72, students: 135, trend: 'up' },
  { subject: '数字化设计与制造', point: '三维曲面建模', mastery: 65, students: 80, trend: 'up' },
  { subject: '智能控制技术', point: 'PLC梯形图编程', mastery: 88, students: 192, trend: 'up' },
  { subject: '计算机网络技术', point: 'VLAN配置与划分', mastery: 45, students: 76, trend: 'down' },
  { subject: '新能源汽车技术', point: '电池管理系统BMS', mastery: 58, students: 126, trend: 'down' },
  { subject: '应用化工技术', point: '精馏操作规范', mastery: 82, students: 60, trend: 'up' },
])

function getColor(pct: number) {
  if (pct >= 80) return '#52c41a'
  if (pct >= 60) return '#faad14'
  return '#ff4d4f'
}

function initLineChart() {
  if (!lineChartRef.value) return
  const chart = echarts.init(lineChartRef.value)
  charts.push(chart)

  chart.setOption({
    tooltip: { trigger: 'axis' },
    legend: { data: ['课堂活跃率', 'AI使用率'], bottom: 0 },
    grid: { top: 20, right: 20, bottom: 40, left: 50 },
    xAxis: { type: 'category', data: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'], boundaryGap: false },
    yAxis: { type: 'value', max: 100, axisLabel: { formatter: '{value}%' } },
    series: [
      {
        name: '课堂活跃率',
        type: 'line',
        smooth: true,
        data: [75, 82, 88, 79, 91, 45, 30],
        lineStyle: { width: 3 },
        itemStyle: { color: '#1677ff' },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(22,119,255,0.25)' },
            { offset: 1, color: 'rgba(22,119,255,0.02)' },
          ]),
        },
      },
      {
        name: 'AI使用率',
        type: 'line',
        smooth: true,
        data: [42, 55, 63, 58, 72, 28, 15],
        lineStyle: { width: 3 },
        itemStyle: { color: '#52c41a' },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(82,196,26,0.2)' },
            { offset: 1, color: 'rgba(82,196,26,0.02)' },
          ]),
        },
      },
    ],
  })
}

function initPieChart() {
  if (!pieChartRef.value) return
  const chart = echarts.init(pieChartRef.value)
  charts.push(chart)

  chart.setOption({
    tooltip: { trigger: 'item', formatter: '{b}: {c}次 ({d}%)' },
    legend: { bottom: 0, itemWidth: 10, itemHeight: 10, textStyle: { fontSize: 11 } },
    series: [
      {
        type: 'pie',
        radius: ['40%', '65%'],
        center: ['50%', '42%'],
        avoidLabelOverlap: true,
        label: { show: true, formatter: '{d}%', fontSize: 11 },
        data: [
          { value: 320, name: '工业机器人', itemStyle: { color: '#1677ff' } },
          { value: 260, name: '数字化设计', itemStyle: { color: '#52c41a' } },
          { value: 280, name: '智能控制', itemStyle: { color: '#faad14' } },
          { value: 180, name: '计算机网络', itemStyle: { color: '#722ed1' } },
          { value: 150, name: '新能源汽车', itemStyle: { color: '#eb2f96' } },
          { value: 90, name: '应用化工', itemStyle: { color: '#13c2c2' } },
        ],
      },
    ],
  })
}

function initBarChart() {
  if (!barChartRef.value) return
  const chart = echarts.init(barChartRef.value)
  charts.push(chart)

  chart.setOption({
    tooltip: { trigger: 'axis' },
    grid: { top: 20, right: 20, bottom: 30, left: 80 },
    xAxis: { type: 'category', data: ['签到', '测验', '抢答', '讨论', 'AI实践', '点名'] },
    yAxis: { type: 'value' },
    series: [
      {
        type: 'bar',
        barWidth: 32,
        data: [
          { value: 48, itemStyle: { color: '#1677ff' } },
          { value: 36, itemStyle: { color: '#faad14' } },
          { value: 22, itemStyle: { color: '#fa541c' } },
          { value: 28, itemStyle: { color: '#52c41a' } },
          { value: 18, itemStyle: { color: '#722ed1' } },
          { value: 42, itemStyle: { color: '#13c2c2' } },
        ],
        itemStyle: { borderRadius: [4, 4, 0, 0] },
      },
    ],
  })
}

function initRankChart() {
  if (!rankChartRef.value) return
  const chart = echarts.init(rankChartRef.value)
  charts.push(chart)

  const teachers = ['赵敏', '刘洋', '陈磊', '王芳', '张伟', '李明']
  const values = [14, 16, 20, 18, 32, 24]

  chart.setOption({
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { top: 10, right: 40, bottom: 10, left: 60 },
    xAxis: { type: 'value' },
    yAxis: { type: 'category', data: teachers, inverse: false },
    series: [
      {
        type: 'bar',
        data: values.map((v, i) => ({
          value: v,
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
              { offset: 0, color: i >= 4 ? '#1677ff' : i >= 2 ? '#52c41a' : '#faad14' },
              { offset: 1, color: i >= 4 ? '#4096ff' : i >= 2 ? '#73d13d' : '#ffc53d' },
            ]),
            borderRadius: [0, 4, 4, 0],
          },
        })),
        barWidth: 20,
        label: { show: true, position: 'right', formatter: '{c}节', fontSize: 11 },
      },
    ],
  })
}

function handleResize() {
  charts.forEach(c => c.resize())
}

onMounted(() => {
  initLineChart()
  initPieChart()
  initBarChart()
  initRankChart()
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  charts.forEach(c => c.dispose())
  charts = []
})
</script>

<style scoped>
.reports-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.chart-container {
  height: 280px;
  width: 100%;
}
</style>
