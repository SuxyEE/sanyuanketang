<template>
  <view class="tag" :class="[`tone-${tone}`, `size-${size}`]">
    <Icon v-if="icon" :name="icon" :size="iconSize" />
    <text class="label"><slot /></text>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import Icon from './Icon.vue'
import type { IconName } from '@/icons'

type Tone = 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'neutral'
type Size = 'sm' | 'md'

const props = withDefaults(
  defineProps<{
    tone?: Tone
    size?: Size
    icon?: IconName
  }>(),
  {
    tone: 'primary',
    size: 'sm',
  },
)

const iconSize = computed(() => (props.size === 'sm' ? 'xs' : 'sm'))
</script>

<style lang="scss" scoped>
@import '@/styles/variables.scss';

.tag {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  border-radius: var(--radius-pill);
  font-weight: var(--font-weight-medium);
  white-space: nowrap;

  &.size-sm {
    height: 40rpx;
    padding: 0 var(--space-3);
    font-size: var(--font-caption);
  }
  &.size-md {
    height: 56rpx;
    padding: 0 var(--space-4);
    font-size: var(--font-label);
  }

  &.tone-primary   { background: var(--color-primary-container); color: var(--color-on-primary-container); }
  &.tone-secondary { background: var(--color-secondary-container); color: var(--color-on-secondary-container); }
  &.tone-success   { background: var(--color-success-container); color: var(--color-on-success-container); }
  &.tone-warning   { background: var(--color-warning-container); color: var(--color-on-warning-container); }
  &.tone-danger    { background: var(--color-danger-container); color: var(--color-on-danger-container); }
  &.tone-neutral   { background: var(--color-surface-variant); color: var(--color-text-secondary); }
}

.label { font-weight: inherit; }
</style>
