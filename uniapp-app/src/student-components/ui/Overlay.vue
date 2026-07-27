<template>
  <view class="overlay-root" :class="[`align-${align}`, dense && 'dense']" :style="{ zIndex: zIndex }">
    <view class="scrim" :class="`scrim-${scrimTone}`" @tap.stop="onScrimTap"></view>
    <view class="surface" :style="surfaceStyle" @tap.stop>
      <slot />
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'

type Align = 'center' | 'top' | 'bottom' | 'right' | 'left'

const props = withDefaults(
  defineProps<{
    align?: Align
    dense?: boolean
    closeOnScrim?: boolean
    scrimTone?: 'standard' | 'heavy' | 'none'
    zIndex?: number
    maxWidth?: string
  }>(),
  {
    align: 'center',
    dense: false,
    closeOnScrim: true,
    scrimTone: 'standard',
    zIndex: 500,
    maxWidth: '',
  },
)

const emit = defineEmits<{ close: [] }>()

const surfaceStyle = computed(() => (props.maxWidth ? { maxWidth: props.maxWidth } : {}))

function onScrimTap() {
  if (props.closeOnScrim) emit('close')
}
</script>

<style lang="scss" scoped>
@import '@/styles/variables.scss';

.overlay-root {
  position: fixed;
  inset: 0;
  display: flex;
  padding: var(--space-4);
  padding-top: max(var(--space-4), var(--safe-top));
  padding-bottom: max(var(--space-4), var(--safe-bottom));
  padding-left: max(var(--space-4), var(--safe-left));
  padding-right: max(var(--space-4), var(--safe-right));
  box-sizing: border-box;
  animation: overlay-fade-in var(--duration-base) var(--ease-decelerate);

  &.align-center { align-items: center; justify-content: center; }
  &.align-top { align-items: flex-start; justify-content: center; padding-top: max(var(--space-8), var(--safe-top)); }
  &.align-bottom { align-items: flex-end; justify-content: center; padding-bottom: max(var(--space-4), var(--safe-bottom)); }
  &.align-right { align-items: stretch; justify-content: flex-end; padding: 0; }
  &.align-left { align-items: stretch; justify-content: flex-start; padding: 0; }

  &.dense { padding: 0; }
}

.scrim {
  position: absolute;
  inset: 0;
  animation: scrim-fade-in var(--duration-base) var(--ease-decelerate);
  &.scrim-standard { background: var(--color-scrim); }
  &.scrim-heavy { background: var(--color-scrim-heavy); }
  &.scrim-none { background: transparent; pointer-events: none; }
}

.surface {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  background: var(--color-surface-raised);
  border-radius: var(--radius-2xl);
  box-shadow: var(--elevation-4);
  max-width: 92vw;
  max-height: 92vh;
  overflow: hidden;
  animation: surface-rise var(--duration-med) var(--ease-emphasized);
}

.align-right .surface,
.align-left .surface {
  border-radius: 0;
  max-width: 80%;
  height: 100%;
}

@keyframes overlay-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes scrim-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes surface-rise {
  from { opacity: 0; transform: translateY(16rpx) scale(0.96); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
</style>
