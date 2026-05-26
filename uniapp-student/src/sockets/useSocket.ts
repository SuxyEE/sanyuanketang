/**
 * Socket.IO 客户端封装（UniApp 多端兼容版）。
 *
 * 通过 uni.connectSocket 直连 Socket.IO websocket 传输，避开 App 真机 WebView
 * 对 socket.io-client 的 XHR polling / WebSocket 适配差异。
 *
 * 全局 singleton 模式：所有页面 useSocket() 拿到同一个 socket 实例，
 * disconnect 在最后一个引用计数归零时执行。
 */

import { ref, onUnmounted } from 'vue'
import { WS_URL, WS_NAMESPACE } from '@/shared/config'
import { RoomEvent } from '@/shared/wsEvents'
import { createNativeSocketIo, type SocketLike } from './nativeSocketIo'

let sharedSocket: SocketLike | null = null
const connected = ref(false)
let refCount = 0
let latestPayload: JoinPayload | null = null

export interface JoinPayload {
  lessonId: string
  userId: string
  userName: string
  role?: 'teacher' | 'student' | 'admin'
  clientType?: string
}

export function useSocket() {
  let didConnect = false

  function join(s: SocketLike, payload: JoinPayload) {
    s.emit(RoomEvent.Join, {
      lessonId: payload.lessonId,
      userId: payload.userId,
      userName: payload.userName,
      role: payload.role || 'student',
      clientType: payload.clientType || 'student-tablet',
    })
  }

  function joinSoon(s: SocketLike, payload: JoinPayload) {
    setTimeout(() => {
      if (!s.connected || latestPayload !== payload) return
      join(s, payload)
    }, 0)
  }

  function connect(payload: JoinPayload): SocketLike {
    latestPayload = payload
    if (!didConnect) {
      refCount++
      didConnect = true
    }
    if (sharedSocket?.connected) {
      joinSoon(sharedSocket, payload)
      return sharedSocket
    }
    if (sharedSocket) return sharedSocket

    const s = createNativeSocketIo(`${WS_URL}${WS_NAMESPACE}`, {
      timeout: 6000,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      // 后端 WS_AUTH_MODE=required 时打开下面这行（token 从 storage 拿）
      // auth: { token: uni.getStorageSync('jwt') || '' },
    })

    sharedSocket = s

    s.on('connect', () => {
      connected.value = true
      if (latestPayload) joinSoon(s, latestPayload)
    })

    s.io.on('reconnect', () => {
      connected.value = true
      if (latestPayload) joinSoon(s, latestPayload)
    })

    s.on('disconnect', () => { connected.value = false })
    s.on('connect_error', err => {
      connected.value = false
      console.warn('[socket] connect_error', err?.message || err)
    })

    return s
  }

  function disconnect() {
    if (!didConnect) return
    didConnect = false
    refCount = Math.max(0, refCount - 1)
    if (refCount === 0 && sharedSocket) {
      sharedSocket.disconnect()
      sharedSocket = null
      connected.value = false
      latestPayload = null
    }
  }

  /**
   * 学生 App 切走时上报 — 让教师立即收到 toast。
   * Kiosk 模式下学生切不走，这段几乎不会触发；做兜底防 kiosk 没配好。
   */
  function reportFocusLost() {
    sharedSocket?.emit(RoomEvent.StudentFocusLost, { ts: Date.now() })
  }
  function reportFocusGained() {
    sharedSocket?.emit(RoomEvent.StudentFocusGained, { ts: Date.now() })
  }

  onUnmounted(() => disconnect())

  return {
    socket: sharedSocket,
    connected,
    connect,
    disconnect,
    reportFocusLost,
    reportFocusGained,
    /** 获取最新的 sharedSocket（页面里 ref 可能滞后） */
    getSocket: () => sharedSocket,
  }
}
