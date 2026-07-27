import { onMounted, onUnmounted, watch } from 'vue'
import { useSocket } from '@/sockets/useSocket'
import type { SocketLike } from '@/sockets/nativeSocketIo'

type Handlers = Record<string, (...args: any[]) => void>

/**
 * 复用课堂 socket 单例，并安全地绑定 / 解绑一组事件监听。
 *
 * 为什么需要它：
 *  - socket 单例由 `pages/classroom/index.vue` 在 onMounted 里 connect() 创建，
 *    但子组件的 onMounted 早于父页面执行，首次 getSocket() 可能还是 null。
 *  - 因此除了 onMounted 立即尝试绑定，再用 watch(connected) 在连接建立 / 重连后补绑。
 *  - bound 记录当前已绑定的实例，避免重复注册（NativeSocketIo 用 Set 去重，双保险）。
 *
 * 注意：本 hook 只“搭车”使用单例，不会自己 connect()，因此不影响连接引用计数。
 */
export function useRoomSocket(handlers: Handlers = {}) {
  const { getSocket, connected } = useSocket()
  const entries = Object.entries(handlers)
  let bound: SocketLike | null = null

  function unbind() {
    if (!bound) return
    for (const [evt, h] of entries) bound.off(evt, h)
    bound = null
  }

  function bind() {
    const s = getSocket()
    if (!s || bound === s) return
    if (bound) unbind()
    for (const [evt, h] of entries) s.on(evt, h)
    bound = s
  }

  function emit(event: string, payload?: any) {
    const s = getSocket()
    if (s) s.emit(event, payload)
  }

  onMounted(bind)
  watch(connected, (v) => { if (v) bind() })
  onUnmounted(unbind)

  return { emit, getSocket, connected }
}
