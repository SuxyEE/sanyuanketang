<template>
  <button
    class="tts-btn"
    :class="{ active: speaking }"
    hover-class="tts-hover"
    :hover-stay-time="80"
    :aria-pressed="speaking"
    :aria-label="speaking ? '停止朗读' : '朗读全文'"
    @tap="toggle"
  >
    <Icon :name="speaking ? 'stop-circle' : 'volume-2'" size="sm" />
    <text class="label">{{ speaking ? '停止' : '朗读' }}</text>
  </button>
</template>

<script setup lang="ts">
import { ref, onUnmounted } from 'vue'
import Icon from '@/student-components/ui/Icon.vue'

const props = defineProps<{ text: string }>()
const speaking = ref(false)

// #ifdef H5
let utter: SpeechSynthesisUtterance | null = null
// #endif

function toggle() {
  if (speaking.value) return stop()
  start()
}

function start() {
  if (!props.text?.trim()) return
  // #ifdef H5
  if (!('speechSynthesis' in window)) {
    uni.showToast({ title: '当前浏览器不支持 TTS', icon: 'none' })
    return
  }
  utter = new SpeechSynthesisUtterance(props.text)
  utter.lang = 'zh-CN'
  utter.rate = 1.0
  utter.onend = () => { speaking.value = false }
  utter.onerror = () => { speaking.value = false }
  window.speechSynthesis.speak(utter)
  speaking.value = true
  // #endif

  // #ifdef APP-PLUS
  uni.showToast({ title: '原生 TTS 暂未实现，请在 H5 端测试', icon: 'none' })
  // #endif
}

function stop() {
  // #ifdef H5
  if (window.speechSynthesis) window.speechSynthesis.cancel()
  // #endif
  speaking.value = false
}

onUnmounted(stop)
</script>

<style lang="scss" scoped>
@import '@/styles/variables.scss';

.tts-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  background: var(--color-surface-variant);
  color: var(--color-text-secondary);
  border-radius: var(--radius-pill);
  border: 0;
  min-height: 64rpx;
  font-size: var(--font-caption);
  font-weight: var(--font-weight-medium);
  transition: background-color var(--duration-fast) var(--ease-standard),
              color var(--duration-fast) var(--ease-standard),
              transform var(--duration-fast) var(--ease-standard);

  &::after { border: 0 !important; }

  &.active {
    background: var(--color-primary);
    color: var(--color-text-on-color);
  }
}

.tts-hover {
  transform: scale(0.96);
  background: var(--color-state-overlay-press);
  &.active { background: var(--color-primary-hover); }
}

.label { font-weight: inherit; color: inherit; }
</style>
