<template>
  <button
    class="icon-btn"
    :class="[`size-${size}`, `tone-${tone}`]"
    :disabled="disabled"
    :hover-class="disabled ? '' : 'icon-btn-hover'"
    :hover-stay-time="80"
    :aria-label="computedAriaLabel"
    :aria-disabled="disabled || undefined"
    @tap="onTap"
  >
    <Icon :name="icon" :size="iconSize" />
  </button>
</template>

<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import Icon from './Icon.vue'
import type { IconName } from '@/icons'

defineOptions({ inheritAttrs: false })

type Size = 'sm' | 'md' | 'lg'
type Tone = 'neutral' | 'primary' | 'danger' | 'inverse'

const props = withDefaults(
  defineProps<{
    icon: IconName
    ariaLabel?: string
    size?: Size
    tone?: Tone
    disabled?: boolean
  }>(),
  {
    size: 'md',
    tone: 'neutral',
    disabled: false,
  },
)

const emit = defineEmits<{ tap: [] }>()
const attrs = useAttrs()

const computedAriaLabel = computed(() => {
  const kebabLabel = attrs['aria-label']
  if (props.ariaLabel) return props.ariaLabel
  if (typeof kebabLabel === 'string' && kebabLabel.trim()) return kebabLabel
  return '图标按钮'
})

const iconSize = computed(() => {
  if (props.size === 'sm') return 'sm'
  if (props.size === 'lg') return 'lg'
  return 'md'
})

function onTap() {
  if (props.disabled) return
  emit('tap')
}
</script>

<style lang="scss" scoped>
@import '@/styles/variables.scss';

.icon-btn {
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-full);
  flex-shrink: 0;
  transition: background-color var(--duration-fast) var(--ease-standard),
              transform var(--duration-fast) var(--ease-standard);

  &::after { border: 0 !important; }

  &.size-sm { width: 64rpx; height: 64rpx; }   /* below recommended for non-critical secondary controls */
  &.size-md { width: 88rpx; height: 88rpx; }   /* meets 44pt × 88rpx minimum */
  &.size-lg { width: 104rpx; height: 104rpx; }

  &.tone-neutral { color: var(--color-text-secondary); }
  &.tone-primary { color: var(--color-primary); }
  &.tone-danger  { color: var(--color-danger); }
  &.tone-inverse { color: var(--color-text-on-color); }

  &.icon-btn-hover {
    background: var(--color-state-overlay-press);
    transform: scale(0.92);
  }

  &[disabled] { opacity: 0.38; }
}
</style>
