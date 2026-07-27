<template>
  <view
    class="icon"
    :class="[`size-${size}`, tone ? `tone-${tone}` : '']"
    :style="customStyle"
    :aria-label="label || undefined"
    :aria-hidden="!label"
    role="img"
  >
    <view class="svg" v-html="svg"></view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { icons, type IconName } from '@/icons'

type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl'
type Tone =
  | 'primary'
  | 'secondary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'muted'
  | 'inverse'

const props = withDefaults(
  defineProps<{
    name: IconName
    size?: Size
    tone?: Tone | ''
    label?: string
    stroke?: number
  }>(),
  {
    size: 'md',
    tone: '',
    label: '',
    stroke: 2,
  },
)

const svg = computed(() => {
  const raw = icons[props.name]
  if (!raw) {
    console.warn(`[Icon] unknown name: ${props.name}`)
    return ''
  }
  if (props.stroke !== 2) {
    return raw.replace('stroke-width="2"', `stroke-width="${props.stroke}"`)
  }
  return raw
})

const customStyle = computed(() => ({}))
</script>

<style lang="scss" scoped>
@import '@/styles/variables.scss';

.icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: currentColor;
  flex-shrink: 0;
  line-height: 0;

  &.size-xs { width: 24rpx; height: 24rpx; }
  &.size-sm { width: 32rpx; height: 32rpx; }
  &.size-md { width: 40rpx; height: 40rpx; }
  &.size-lg { width: 48rpx; height: 48rpx; }
  &.size-xl { width: 64rpx; height: 64rpx; }
  &.size-2xl { width: 96rpx; height: 96rpx; }
  &.size-3xl { width: 144rpx; height: 144rpx; }

  &.tone-primary   { color: var(--color-primary); }
  &.tone-secondary { color: var(--color-secondary); }
  &.tone-success   { color: var(--color-success); }
  &.tone-warning   { color: var(--color-warning); }
  &.tone-danger    { color: var(--color-danger); }
  &.tone-muted     { color: var(--color-text-tertiary); }
  &.tone-inverse   { color: var(--color-text-on-color); }
}

.svg {
  width: 100%;
  height: 100%;
  display: block;
}

/* SVG fits container */
.svg :deep(svg) {
  width: 100%;
  height: 100%;
  display: block;
}
</style>
