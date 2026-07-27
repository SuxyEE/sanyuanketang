<template>
  <button
    class="btn"
    :class="[
      `variant-${variant}`,
      `size-${size}`,
      block && 'block',
      loading && 'is-loading',
      disabled && 'is-disabled',
    ]"
    :disabled="disabled || loading"
    :hover-class="(disabled || loading) ? '' : 'btn-hover'"
    :hover-stay-time="80"
    :aria-label="ariaLabel || undefined"
    :aria-busy="loading || undefined"
    :aria-disabled="disabled || undefined"
    @tap="onTap"
  >
    <view class="content">
      <view v-if="loading" class="spinner" aria-hidden="true"></view>
      <Icon v-else-if="iconLeft" :name="iconLeft" :size="iconSize" />
      <text v-if="$slots.default" class="label"><slot /></text>
      <Icon v-if="!loading && iconRight" :name="iconRight" :size="iconSize" />
    </view>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import Icon from './Icon.vue'
import type { IconName } from '@/icons'

type Variant = 'primary' | 'secondary' | 'tonal' | 'ghost' | 'danger' | 'success'
type Size = 'sm' | 'md' | 'lg'

const props = withDefaults(
  defineProps<{
    variant?: Variant
    size?: Size
    block?: boolean
    disabled?: boolean
    loading?: boolean
    iconLeft?: IconName
    iconRight?: IconName
    ariaLabel?: string
  }>(),
  {
    variant: 'primary',
    size: 'md',
    block: false,
    disabled: false,
    loading: false,
  },
)

const emit = defineEmits<{ tap: [] }>()

const iconSize = computed<'sm' | 'md' | 'lg'>(() => {
  if (props.size === 'sm') return 'sm'
  if (props.size === 'lg') return 'lg'
  return 'md'
})

function onTap() {
  if (props.disabled || props.loading) return
  emit('tap')
}
</script>

<style lang="scss" scoped>
@import '@/styles/variables.scss';

.btn {
  /* reset uniapp/native button defaults */
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  font-family: inherit;
  font-weight: var(--font-weight-semibold);
  line-height: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
  border-radius: var(--radius-pill);
  min-width: var(--touch-min);
  min-height: var(--touch-min);
  transition: background-color var(--duration-fast) var(--ease-standard),
              box-shadow var(--duration-base) var(--ease-standard),
              transform var(--duration-fast) var(--ease-standard),
              opacity var(--duration-fast) var(--ease-standard);

  &::after { border: 0 !important; }

  .content {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
  }

  &.block {
    width: 100%;
    display: flex;
  }

  /* ---- sizes ---- */
  &.size-sm {
    height: 64rpx;
    min-height: 64rpx;
    padding: 0 var(--space-4);
    font-size: var(--font-caption);
    border-radius: var(--radius-pill);
  }
  &.size-md {
    height: 88rpx;
    padding: 0 var(--space-6);
    font-size: var(--font-label);
  }
  &.size-lg {
    height: 104rpx;
    padding: 0 var(--space-7);
    font-size: var(--font-body);
  }

  /* ---- variant: primary ---- */
  &.variant-primary {
    background: var(--color-primary);
    color: var(--color-primary-on);
    box-shadow: var(--elevation-1);
  }

  /* ---- variant: secondary (low-emphasis, outlined) ---- */
  &.variant-secondary {
    background: var(--color-surface);
    color: var(--color-text-primary);
    border: 2rpx solid var(--color-outline);
  }

  /* ---- variant: tonal (low-emphasis, soft fill) ---- */
  &.variant-tonal {
    background: var(--color-primary-container);
    color: var(--color-on-primary-container);
  }

  /* ---- variant: ghost (no fill) ---- */
  &.variant-ghost {
    background: transparent;
    color: var(--color-text-primary);
  }

  /* ---- variant: danger ---- */
  &.variant-danger {
    background: var(--color-danger);
    color: var(--color-text-on-color);
    box-shadow: var(--elevation-1);
  }

  /* ---- variant: success ---- */
  &.variant-success {
    background: var(--color-success);
    color: var(--color-text-on-color);
    box-shadow: var(--elevation-1);
  }

  /* ---- press state (hover-class on uniapp) ---- */
  &.btn-hover {
    transform: scale(0.97);
    &.variant-primary { background: var(--color-primary-hover); }
    &.variant-secondary,
    &.variant-ghost { background: var(--color-state-overlay-press); }
    &.variant-tonal { background: rgba(47, 107, 255, 0.16); }
    &.variant-danger { background: var(--p-red-700); }
    &.variant-success { background: var(--p-green-700); }
  }

  /* ---- disabled / loading ---- */
  &.is-disabled,
  &[disabled] {
    opacity: 0.42;
  }
  &.is-loading {
    cursor: progress;
  }
}

.label {
  font-weight: inherit;
  white-space: nowrap;
}

/* spinner */
.spinner {
  width: 32rpx;
  height: 32rpx;
  border-radius: 50%;
  border: 4rpx solid currentColor;
  border-right-color: transparent;
  animation: spin 800ms linear infinite;
  opacity: 0.85;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
