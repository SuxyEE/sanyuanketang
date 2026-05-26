<template>
  <svg
    class="spark"
    :viewBox="`0 0 ${width} ${height}`"
    preserveAspectRatio="none"
    aria-hidden="true"
  >
    <defs>
      <linearGradient :id="gradientId" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"  :stop-color="color" stop-opacity="0.35" />
        <stop offset="100%" :stop-color="color" stop-opacity="0" />
      </linearGradient>
    </defs>
    <path :d="areaPath" :fill="`url(#${gradientId})`" />
    <path :d="linePath" :stroke="color" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round" />
    <circle
      v-if="lastPoint"
      :cx="lastPoint.x"
      :cy="lastPoint.y"
      r="2.2"
      :fill="color"
    />
  </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    points: number[]
    color?: string
    width?: number
    height?: number
  }>(),
  {
    color: '#2f54eb',
    width: 120,
    height: 40,
  },
)

const gradientId = `spark-${Math.random().toString(36).slice(2, 9)}`

const normalized = computed(() => {
  if (!props.points || props.points.length === 0) return []
  const w = props.width
  const h = props.height
  const padding = 3
  const max = Math.max(...props.points)
  const min = Math.min(...props.points)
  const range = Math.max(max - min, 1)
  const step = props.points.length > 1 ? (w - padding * 2) / (props.points.length - 1) : 0
  return props.points.map((p, i) => ({
    x: +(padding + i * step).toFixed(2),
    y: +(h - padding - ((p - min) / range) * (h - padding * 2)).toFixed(2),
  }))
})

const lastPoint = computed(() => normalized.value[normalized.value.length - 1] || null)

const linePath = computed(() => {
  if (normalized.value.length === 0) return ''
  return normalized.value
    .map((pt, i) => (i === 0 ? `M${pt.x},${pt.y}` : `L${pt.x},${pt.y}`))
    .join(' ')
})

const areaPath = computed(() => {
  if (normalized.value.length === 0) return ''
  const first = normalized.value[0]
  const last = normalized.value[normalized.value.length - 1]
  const top = normalized.value
    .map((pt, i) => (i === 0 ? `M${pt.x},${pt.y}` : `L${pt.x},${pt.y}`))
    .join(' ')
  return `${top} L${last.x},${props.height} L${first.x},${props.height} Z`
})
</script>

<style scoped>
.spark {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
