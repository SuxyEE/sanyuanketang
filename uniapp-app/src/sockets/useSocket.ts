import { ref, onUnmounted } from 'vue'
import { WS_NAMESPACE, WS_URL } from '@/shared/config'
import { RoomEvent } from '@/shared/wsEvents'
import { getPlatformJoinContext, type PlatformJoinContext } from '@/shared/platform'
import { createNativeSocketIo, type SocketLike } from './nativeSocketIo'

let sharedSocket: SocketLike | null = null
const connected = ref(false)
let refCount = 0
let latestPayload: TeacherJoinPayload | null = null

export interface TeacherJoinPayload {
  lessonId: string
  userId: string
  userName: string
  platform?: Partial<PlatformJoinContext>
}

export function useSocket() {
  let didConnect = false

  function join(s: SocketLike, payload: TeacherJoinPayload) {
    s.emit(RoomEvent.Join, {
      lessonId: payload.lessonId,
      userId: payload.userId,
      userName: payload.userName,
      role: 'teacher',
      clientType: 'teacher-uniapp',
      ...getPlatformJoinContext(),
      ...(payload.platform || {}),
    })
  }

  function joinSoon(s: SocketLike, payload: TeacherJoinPayload) {
    setTimeout(() => {
      if (!s.connected || latestPayload !== payload) return
      join(s, payload)
    }, 0)
  }

  function connect(payload: TeacherJoinPayload): SocketLike {
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
      auth: { token: uni.getStorageSync('jwt') || '' },
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
    s.on('disconnect', () => {
      connected.value = false
    })
    s.on('connect_error', (err) => {
      connected.value = false
      console.warn('[teacher socket] connect_error', err?.message || err)
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

  function forceDisconnect() {
    didConnect = false
    refCount = 0
    if (sharedSocket) {
      sharedSocket.disconnect()
      sharedSocket = null
    }
    connected.value = false
    latestPayload = null
  }

  onUnmounted(() => disconnect())

  return {
    connected,
    connect,
    disconnect,
    forceDisconnect,
    getSocket: () => sharedSocket,
  }
}
