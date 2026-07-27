<template>
  <view class="field" :class="{ 'has-error': !!error }">
    <view v-if="label || required" class="field-head">
      <text class="field-label">{{ label }}<text v-if="required" class="required-marker">*</text></text>
      <text v-if="$slots.action" class="field-action"><slot name="action" /></text>
    </view>

    <view class="field-control" :class="{ focused }">
      <slot :focused="focused" :setFocused="setFocused" />
    </view>

    <view v-if="error" class="field-msg error" role="alert" aria-live="polite">
      <Icon name="alert-circle" size="xs" />
      <text>{{ error }}</text>
    </view>
    <view v-else-if="helper" class="field-msg helper">
      <text>{{ helper }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import Icon from './Icon.vue'

withDefaults(
  defineProps<{
    label?: string
    helper?: string
    error?: string
    required?: boolean
  }>(),
  {
    label: '',
    helper: '',
    error: '',
    required: false,
  },
)

const focused = ref(false)
function setFocused(v: boolean) { focused.value = v }
</script>

<style lang="scss" scoped>
@import '@/styles/variables.scss';

.field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  width: 100%;
}

.field-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-2);
}

.field-label {
  font-size: var(--font-label);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-secondary);
}

.required-marker {
  color: var(--color-danger);
  margin-left: 4rpx;
}

.field-action {
  font-size: var(--font-caption);
  color: var(--color-primary);
}

.field-control {
  position: relative;
  transition: box-shadow var(--duration-base) var(--ease-standard);
  border-radius: var(--radius-lg);
  &.focused { box-shadow: 0 0 0 4rpx var(--color-primary-container); }
}

.field-msg {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--font-caption);
  line-height: var(--line-height-snug);
  padding: 0 var(--space-1);
  &.error { color: var(--color-danger); }
  &.helper { color: var(--color-text-tertiary); }
}
</style>
