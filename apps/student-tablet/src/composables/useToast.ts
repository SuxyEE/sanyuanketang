import { ref } from 'vue'

export type ToastType = 'success' | 'info' | 'warning' | 'error'

export interface ToastItem {
  id: number
  message: string
  type: ToastType
  duration: number
}

const toasts = ref<ToastItem[]>([])
let seq = 0
const timers = new Map<number, ReturnType<typeof setTimeout>>()

function dismiss(id: number) {
  const t = timers.get(id)
  if (t) {
    clearTimeout(t)
    timers.delete(id)
  }
  toasts.value = toasts.value.filter(t => t.id !== id)
}

function push(message: string, type: ToastType = 'success', duration = 2200) {
  const id = ++seq
  toasts.value.push({ id, message, type, duration })
  const timer = setTimeout(() => dismiss(id), duration)
  timers.set(id, timer)
  return id
}

export function useToast() {
  return {
    toasts,
    dismiss,
    showToast: (msg: string, type: ToastType = 'success', duration = 2200) => push(msg, type, duration),
    toastSuccess: (msg: string, duration = 2200) => push(msg, 'success', duration),
    toastInfo: (msg: string, duration = 2200) => push(msg, 'info', duration),
    toastWarning: (msg: string, duration = 2600) => push(msg, 'warning', duration),
    toastError: (msg: string, duration = 3000) => push(msg, 'error', duration),
  }
}
