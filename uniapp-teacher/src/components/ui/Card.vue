<template>
  <view
    class="card"
    :class="[
      `elevation-${elevation}`,
      `pad-${padding}`,
      interactive && 'interactive',
      selected && 'selected',
    ]"
    :hover-class="interactive ? 'card-hover' : ''"
    :hover-stay-time="80"
    @tap="onTap"
  >
    <slot />
  </view>
</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    elevation?: 0 | 1 | 2 | 3
    padding?: 'none' | 'sm' | 'md' | 'lg'
    interactive?: boolean
    selected?: boolean
  }>(),
  {
    elevation: 1,
    padding: 'md',
    interactive: false,
    selected: false,
  },
)

const emit = defineEmits<{ tap: [] }>()

function onTap() {
  if (props.interactive) emit('tap')
}
</script>

<style lang="scss" scoped>
@import '@/styles/variables.scss';

.card {
  background: var(--color-surface);
  border-radius: var(--radius-xl);
  border: 2rpx solid transparent;
  transition: background-color var(--duration-base) var(--ease-standard),
              border-color var(--duration-base) var(--ease-standard),
              box-shadow var(--duration-base) var(--ease-standard),
              transform var(--duration-fast) var(--ease-standard);
  box-sizing: border-box;
  position: relative;

  &.elevation-0 { box-shadow: none; border-color: var(--color-outline-variant); }
  &.elevation-1 { box-shadow: var(--elevation-1); }
  &.elevation-2 { box-shadow: var(--elevation-2); }
  &.elevation-3 { box-shadow: var(--elevation-3); }

  &.pad-none { padding: 0; }
  &.pad-sm   { padding: var(--space-4); }
  &.pad-md   { padding: var(--space-5); }
  &.pad-lg   { padding: var(--space-7); }

  &.interactive {
    cursor: pointer;
  }

  &.card-hover {
    background: var(--color-state-overlay-hover);
    transform: scale(0.99);
  }

  &.selected {
    border-color: var(--color-primary);
    background: var(--color-primary-container);
  }
}
</style>
