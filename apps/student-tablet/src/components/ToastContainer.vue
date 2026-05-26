<template>
  <transition-group tag="div" class="toast-stack" name="toast">
    <div
      v-for="t in toasts"
      :key="t.id"
      class="toast"
      :class="t.type"
      role="status"
      @click="dismiss(t.id)"
    >
      <span class="toast-icon" v-html="iconFor(t.type)" aria-hidden="true"></span>
      <span class="toast-msg">{{ t.message }}</span>
    </div>
  </transition-group>
</template>

<script setup lang="ts">
import { useToast, type ToastType } from '../composables/useToast'

const { toasts, dismiss } = useToast()

const ICONS: Record<ToastType, string> = {
  success: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
  info: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
  warning: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  error: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
}

function iconFor(type: ToastType) {
  return ICONS[type] || ICONS.info
}
</script>

<style scoped lang="scss">
.toast-stack {
  position: fixed;
  top: 24px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 9999;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  pointer-events: none;
}

.toast {
  pointer-events: auto;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 12px 18px;
  min-height: 44px;
  max-width: 88vw;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 600;
  background: #fff;
  color: var(--text-primary, #1f2937);
  box-shadow: 0 12px 28px -8px rgba(15, 23, 42, 0.18), 0 4px 10px -2px rgba(15, 23, 42, 0.06);
  border: 1px solid var(--border, #e5e7eb);
  cursor: pointer;
  user-select: none;
  line-height: 1.4;

  .toast-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  &.success {
    border-color: #b7eb8f;
    background: #f6ffed;
    color: #237804;
    .toast-icon { background: #52c41a; color: #fff; }
  }

  &.info {
    border-color: #91caff;
    background: #e6f4ff;
    color: #003eb3;
    .toast-icon { background: #1677ff; color: #fff; }
  }

  &.warning {
    border-color: #ffe58f;
    background: #fffbe6;
    color: #874d00;
    .toast-icon { background: #faad14; color: #fff; }
  }

  &.error {
    border-color: #ffa39e;
    background: #fff1f0;
    color: #a8071a;
    .toast-icon { background: #f5222d; color: #fff; }
  }
}

.toast-enter-active { transition: transform 0.28s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.22s ease-out; }
.toast-leave-active { transition: transform 0.18s ease-in, opacity 0.18s ease-in; position: absolute; }
.toast-enter-from { opacity: 0; transform: translateY(-14px) scale(0.96); }
.toast-leave-to { opacity: 0; transform: translateY(-6px) scale(0.98); }
.toast-move { transition: transform 0.22s ease; }
</style>
