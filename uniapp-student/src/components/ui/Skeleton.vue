<template>
  <view
    class="skeleton"
    :class="[`shape-${shape}`]"
    :style="customStyle"
    aria-hidden="true"
  ></view>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    shape?: 'rect' | 'circle' | 'text'
    width?: string
    height?: string
  }>(),
  {
    shape: 'rect',
    width: '100%',
    height: '40rpx',
  },
)

const customStyle = computed(() => ({
  width: props.width,
  height: props.height,
}))
</script>

<style lang="scss" scoped>
@import '@/styles/variables.scss';

.skeleton {
  display: block;
  background: linear-gradient(
    90deg,
    var(--color-surface-variant) 0%,
    var(--color-outline-variant) 50%,
    var(--color-surface-variant) 100%
  );
  background-size: 200% 100%;
  animation: shimmer 1400ms linear infinite;

  &.shape-rect { border-radius: var(--radius-md); }
  &.shape-circle { border-radius: var(--radius-full); }
  &.shape-text { border-radius: var(--radius-sm); height: 28rpx; }
}

@keyframes shimmer {
  from { background-position: 200% 0; }
  to { background-position: -200% 0; }
}

@media (prefers-reduced-motion: reduce) {
  .skeleton { animation: none; opacity: 0.7; }
}
</style>
