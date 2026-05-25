<template>
  <button
    v-if="isSupported"
    class="tts-button"
    :class="{ speaking: isSpeaking && !isPaused }"
    :title="title"
    :aria-label="title"
    @click.stop="onClick"
  >
    <svg v-if="!isSpeaking || isPaused" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
    </svg>
    <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="6" y="4" width="4" height="16"></rect>
      <rect x="14" y="4" width="4" height="16"></rect>
    </svg>
    <span v-if="label" class="label">{{ buttonText }}</span>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useTts } from '../composables/useTts'

const props = defineProps<{
  text: string
  label?: boolean
  rate?: number
  lang?: string
}>()

const { isSupported, isSpeaking, isPaused, toggle } = useTts()

const title = computed(() =>
  isSpeaking.value && !isPaused.value ? '停止朗读' : '朗读这段文字',
)

const buttonText = computed(() =>
  isSpeaking.value && !isPaused.value ? '停止' : '朗读',
)

function onClick() {
  if (!props.text?.trim()) return
  toggle(props.text, { rate: props.rate, lang: props.lang })
}
</script>

<style scoped lang="scss">
.tts-button {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border: 1px solid #d9d9d9;
  border-radius: 14px;
  background: #fff;
  color: #595959;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    color: #1677ff;
    border-color: #1677ff;
    background: #e6f4ff;
  }

  &.speaking {
    color: #fff;
    background: #1677ff;
    border-color: #1677ff;
    animation: tts-pulse 1.2s ease-in-out infinite;
  }

  svg {
    flex-shrink: 0;
  }

  .label {
    font-size: 12px;
    line-height: 1;
  }
}

@keyframes tts-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(22, 119, 255, 0.4); }
  50% { box-shadow: 0 0 0 4px rgba(22, 119, 255, 0); }
}
</style>
