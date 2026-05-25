<template>
  <transition name="popup">
    <div v-if="visible" class="signin-overlay">
      <div class="signin-card" role="dialog" aria-label="签到">
        <div class="signin-icon" v-html="checkIcon" aria-hidden="true"></div>
        <h3>课堂签到</h3>
        <p class="signin-course">{{ courseName }}</p>
        <p class="signin-hint" v-if="!isSigned">请点击下方按钮完成签到</p>
        <p class="signin-success" v-else>签到成功!</p>

        <button
          v-if="!isSigned"
          class="signin-btn"
          @click="doSignIn"
          :disabled="isLoading"
        >
          {{ isLoading ? '签到中...' : '一键签到' }}
        </button>

        <div v-else class="signed-info">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#52c41a" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          <span class="signed-time">{{ signedTime }}</span>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { icons } from '@snyuan/shared'

const props = defineProps<{
  visible: boolean
  courseName: string
}>()

const emit = defineEmits<{ signed: []; close: [] }>()

const checkIcon = icons.userCheck
const isSigned = ref(false)
const isLoading = ref(false)
const signedTime = ref('')

watch(() => props.visible, (val) => {
  if (val) {
    isSigned.value = false
    isLoading.value = false
    signedTime.value = ''
  }
})

function doSignIn() {
  isLoading.value = true
  setTimeout(() => {
    isLoading.value = false
    isSigned.value = true
    signedTime.value = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    emit('signed')
    setTimeout(() => emit('close'), 1500)
  }, 600)
}
</script>

<style scoped lang="scss">
.popup-enter-active, .popup-leave-active {
  transition: opacity 0.25s ease;
  .signin-card { transition: transform 0.25s ease; }
}
.popup-enter-from, .popup-leave-to {
  opacity: 0;
  .signin-card { transform: scale(0.9) translateY(20px); }
}

.signin-overlay {
  position: fixed;
  inset: 0;
  z-index: 300;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.signin-card {
  width: 100%;
  max-width: 360px;
  background: var(--bg-card);
  border-radius: 20px;
  padding: 40px 32px;
  text-align: center;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);

  .signin-icon {
    margin-bottom: 16px;
    color: var(--primary);
    :deep(svg) { width: 48px; height: 48px; }
  }

  h3 { font-size: 20px; font-weight: 700; color: var(--text-primary); margin-bottom: 8px; }
  .signin-course { font-size: 14px; color: var(--primary); margin-bottom: 4px; }
  .signin-hint { font-size: 13px; color: var(--text-muted); margin-bottom: 24px; }
  .signin-success { font-size: 14px; color: var(--primary); font-weight: 600; margin-bottom: 16px; }
}

.signin-btn {
  width: 100%;
  padding: 16px;
  border: none;
  border-radius: 16px;
  background: linear-gradient(135deg, var(--primary), #73d13d);
  color: #fff;
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
  min-height: 52px;
  transition: all 0.2s;

  &:disabled { opacity: 0.6; }
  &:not(:disabled):active { transform: scale(0.97); }
}

.signed-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;

  .signed-time { font-size: 14px; color: var(--text-secondary); }
}
</style>
