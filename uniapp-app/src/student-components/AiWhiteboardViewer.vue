<template>
  <view class="ai-wb-viewer" role="dialog" aria-label="AI 板书">
    <view class="wb-head" :style="{ paddingTop: `max(var(--space-5), var(--safe-top))` }">
      <view class="wb-head-left">
        <view class="wb-badge">
          <Icon name="sparkles" size="sm" tone="onPrimary" />
          <text class="wb-badge-text">AI 板书</text>
        </view>
        <view class="wb-title-group">
          <text class="wb-title">{{ board.title }}</text>
          <text v-if="board.subtitle" class="wb-subtitle">{{ board.subtitle }}</text>
        </view>
      </view>
      <Button variant="secondary" size="sm" icon-left="x" @tap="emit('close')">关闭</Button>
    </view>

    <view class="wb-body-wrap">
    <scroll-view class="wb-body" scroll-y :show-scrollbar="false">
      <view v-for="(item, idx) in board.items" :key="idx" class="wb-item">
        <!-- heading -->
        <text
          v-if="item.type === 'heading'"
          :class="['wb-heading', `level-${Math.min(3, Math.max(1, item.level || 2))}`]"
        >{{ item.text }}</text>

        <!-- text -->
        <text v-else-if="item.type === 'text'" class="wb-text">{{ item.text }}</text>

        <!-- latex -->
        <view
          v-else-if="item.type === 'latex'"
          :class="['wb-latex', item.display ? 'display' : 'inline']"
        >
          <rich-text :nodes="renderLatex(item.tex, !!item.display)" />
        </view>

        <!-- list -->
        <view v-else-if="item.type === 'list'" class="wb-list">
          <view
            v-for="(li, liIdx) in item.items"
            :key="liIdx"
            class="wb-list-item"
          >
            <text class="wb-list-marker">{{ item.ordered ? `${liIdx + 1}.` : '•' }}</text>
            <text class="wb-list-content">{{ li }}</text>
          </view>
        </view>

        <!-- table -->
        <scroll-view v-else-if="item.type === 'table'" class="wb-table-scroll" scroll-x>
          <view class="wb-table">
            <view class="wb-table-row wb-table-header">
              <text v-for="(h, hi) in item.headers" :key="hi" class="wb-table-cell wb-th">{{ h }}</text>
            </view>
            <view v-for="(row, ri) in item.rows" :key="ri" class="wb-table-row">
              <text v-for="(cell, ci) in row" :key="ci" class="wb-table-cell">{{ cell }}</text>
            </view>
          </view>
        </scroll-view>

        <!-- callout -->
        <view v-else-if="item.type === 'callout'" :class="['wb-callout', `kind-${item.kind || 'info'}`]">
          <text class="wb-callout-icon">{{ calloutIcon(item.kind) }}</text>
          <text class="wb-callout-text">{{ item.text }}</text>
        </view>

        <!-- image (SVG) -->
        <view v-else-if="item.type === 'image'" class="wb-image">
          <rich-text :nodes="item.svg" />
        </view>
      </view>
    </scroll-view>
    <canvas canvas-id="wb-student-pen" class="wb-pen-canvas" />
    </view>

    <view class="wb-footer">
      <view class="wb-footer-dot"></view>
      <text class="wb-footer-text">AI 生成 · 共 {{ board.items.length }} 项</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import Icon from '@/student-components/ui/Icon.vue'
import Button from '@/student-components/ui/Button.vue'

type WhiteboardItem =
  | { type: 'heading'; level?: number; text: string }
  | { type: 'text'; text: string }
  | { type: 'latex'; tex: string; display?: boolean }
  | { type: 'list'; ordered?: boolean; items: string[] }
  | { type: 'table'; headers: string[]; rows: string[][] }
  | { type: 'callout'; kind?: 'tip' | 'warning' | 'info' | 'note'; text: string }
  | { type: 'image'; svg: string }

defineProps<{
  board: {
    topic?: string
    title: string
    subtitle?: string
    items: WhiteboardItem[]
    generatedAt?: string
  }
}>()

const emit = defineEmits<{ close: [] }>()

let studentPenCtx: UniApp.CanvasContext | null = null

function drawStroke(data: { color: string; width: number; points: Array<{ x: number; y: number }> }) {
  if (!data?.points?.length || data.points.length < 2) return
  if (!studentPenCtx) studentPenCtx = uni.createCanvasContext('wb-student-pen')
  studentPenCtx.setStrokeStyle(data.color)
  studentPenCtx.setLineWidth(data.width)
  studentPenCtx.setLineCap('round')
  studentPenCtx.setLineJoin('round')
  studentPenCtx.beginPath()
  studentPenCtx.moveTo(data.points[0].x, data.points[0].y)
  for (let i = 1; i < data.points.length; i++) {
    studentPenCtx.lineTo(data.points[i].x, data.points[i].y)
  }
  studentPenCtx.stroke()
  studentPenCtx.draw(true)
}

function clearCanvas() {
  if (!studentPenCtx) studentPenCtx = uni.createCanvasContext('wb-student-pen')
  studentPenCtx.clearRect(0, 0, 9999, 9999)
  studentPenCtx.draw()
}

defineExpose({ drawStroke, clearCanvas })

function calloutIcon(kind?: string): string {
  switch (kind) {
    case 'tip': return '💡'
    case 'warning': return '⚠️'
    case 'info': return 'ℹ️'
    case 'note': return '📝'
    default: return 'ℹ️'
  }
}

/**
 * UniApp 不支持直接用 KaTeX 渲染 DOM，这里降级为纯文本展示。
 * display 模式居中大字，inline 模式原样展示公式文本。
 */
function renderLatex(tex: string, display: boolean): string {
  const escaped = tex
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  if (display) {
    return `<span style="font-size:36rpx;font-family:'Cambria Math','Times New Roman',serif;color:#1a1a1a;">${escaped}</span>`
  }
  return `<span style="font-size:28rpx;font-family:'Cambria Math','Times New Roman',serif;color:#1a1a1a;">${escaped}</span>`
}
</script>

<style lang="scss" scoped>
@import '@/styles/variables.scss';

.ai-wb-viewer {
  position: fixed;
  inset: 0;
  z-index: 600;
  background: var(--color-surface);
  display: flex;
  flex-direction: column;
  animation: wbSlideUp 0.3s ease;
}

@keyframes wbSlideUp {
  from { opacity: 0; transform: translateY(40rpx); }
  to { opacity: 1; transform: translateY(0); }
}

.wb-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-4) var(--space-5);
  padding-left: max(var(--space-5), var(--safe-left));
  padding-right: max(var(--space-5), var(--safe-right));
  border-bottom: 2rpx solid var(--color-outline-variant);
  background: var(--color-surface);
  gap: var(--space-3);
}

.wb-head-left {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.wb-badge {
  display: flex;
  align-items: center;
  gap: 8rpx;
  padding: 8rpx 20rpx;
  border-radius: var(--radius-full);
  background: linear-gradient(135deg, var(--p-blue-500), var(--p-purple-500));
  flex-shrink: 0;
}

.wb-badge-text {
  font-size: var(--font-caption);
  font-weight: var(--font-weight-bold);
  color: #fff;
  letter-spacing: 1rpx;
}

.wb-title-group {
  display: flex;
  flex-direction: column;
  gap: 2rpx;
  min-width: 0;
}

.wb-title {
  font-size: var(--font-title-sm);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.wb-subtitle {
  font-size: var(--font-caption);
  color: var(--color-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.wb-body-wrap {
  flex: 1;
  position: relative;
  min-height: 0;
}

.wb-body {
  position: absolute;
  inset: 0;
  padding: var(--space-5) var(--space-6);
  padding-left: max(var(--space-6), var(--safe-left));
  padding-right: max(var(--space-6), var(--safe-right));
}

.wb-pen-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  z-index: 10;
  pointer-events: none;
}

.wb-item {
  margin-bottom: var(--space-4);
}

/* heading */
.wb-heading {
  display: block;
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);

  &.level-1 {
    font-size: 40rpx;
    padding-bottom: 12rpx;
    border-bottom: 4rpx solid var(--p-blue-500);
    margin-bottom: 8rpx;
  }
  &.level-2 {
    font-size: 34rpx;
    color: var(--p-blue-500);
  }
  &.level-3 {
    font-size: 30rpx;
    color: var(--p-purple-500);
  }
}

/* text */
.wb-text {
  font-size: 28rpx;
  line-height: 1.8;
  color: var(--color-text-primary);
}

/* latex */
.wb-latex {
  &.display {
    text-align: center;
    padding: 24rpx;
    background: var(--p-purple-50);
    border-radius: var(--radius-md);
    border-left: 6rpx solid var(--p-purple-500);
  }
  &.inline {
    display: inline;
    padding: 0 8rpx;
  }
}

/* list */
.wb-list {
  padding-left: 8rpx;
}

.wb-list-item {
  display: flex;
  align-items: flex-start;
  gap: 12rpx;
  margin-bottom: 10rpx;
}

.wb-list-marker {
  font-size: 28rpx;
  color: var(--p-blue-500);
  font-weight: var(--font-weight-bold);
  flex-shrink: 0;
  min-width: 28rpx;
}

.wb-list-content {
  font-size: 28rpx;
  line-height: 1.7;
  color: var(--color-text-primary);
}

/* table */
.wb-table-scroll {
  border-radius: var(--radius-md);
  border: 2rpx solid var(--color-outline-variant);
  overflow: hidden;
}

.wb-table {
  min-width: 100%;
}

.wb-table-row {
  display: flex;
  border-bottom: 2rpx solid var(--color-outline-variant);

  &:last-child {
    border-bottom: none;
  }
}

.wb-table-header {
  background: linear-gradient(135deg, var(--p-blue-50), #f0f5ff);
}

.wb-table-cell {
  flex: 1;
  padding: 16rpx 20rpx;
  font-size: 26rpx;
  color: var(--color-text-primary);
  min-width: 120rpx;
}

.wb-th {
  font-weight: var(--font-weight-bold);
  color: var(--p-blue-500);
}

/* callout */
.wb-callout {
  display: flex;
  align-items: flex-start;
  gap: 16rpx;
  padding: 20rpx 24rpx;
  border-radius: var(--radius-md);
  border-left: 6rpx solid;
}

.wb-callout-icon {
  font-size: 32rpx;
  flex-shrink: 0;
}

.wb-callout-text {
  font-size: 26rpx;
  line-height: 1.7;
  color: var(--color-text-primary);
}

.wb-callout.kind-tip {
  background: var(--p-green-50);
  border-left-color: var(--p-green-500);
}

.wb-callout.kind-warning {
  background: var(--p-amber-50);
  border-left-color: var(--p-amber-500);
}

.wb-callout.kind-info {
  background: var(--p-blue-50);
  border-left-color: var(--p-blue-500);
}

.wb-callout.kind-note {
  background: var(--p-red-50);
  border-left-color: #eb2f96;
}

/* image (SVG) */
.wb-image {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 20rpx;
  background: #fff;
  border-radius: var(--radius-md);
  border: 2rpx solid var(--color-outline-variant);
}

/* footer */
.wb-footer {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
  padding: 16rpx;
  border-top: 2rpx solid var(--color-outline-variant);
  padding-bottom: max(16rpx, var(--safe-bottom));
}

.wb-footer-dot {
  width: 12rpx;
  height: 12rpx;
  border-radius: 50%;
  background: var(--p-green-500);
  box-shadow: 0 0 0 4rpx rgba(32, 165, 70, 0.15);
}

.wb-footer-text {
  font-size: var(--font-caption);
  color: var(--color-text-secondary);
}
</style>
