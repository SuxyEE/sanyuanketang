import { ref, onUnmounted } from 'vue'
import { io, Socket } from 'socket.io-client'

const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:3000'

const sharedSocket = ref<Socket | null>(null)
const sharedConnected = ref(false)
let connectionCount = 0
let latestJoinPayload: { lessonId: string; userId: string; userName: string } | null = null

function emitTeacherJoin(s: any, payload: { lessonId: string; userId: string; userName: string }) {
  s.emit('room:join', {
    lessonId: payload.lessonId,
    userId: payload.userId,
    userName: payload.userName,
    role: 'teacher',
    clientType: 'teacher-tablet',
  })
}

export function useSocket() {
  let didConnect = false

  function connect(lessonId: string, userId: string, userName: string) {
    latestJoinPayload = { lessonId, userId, userName }
    if (!didConnect) {
      connectionCount++
      didConnect = true
    }

    if (sharedSocket.value?.connected) {
      emitTeacherJoin(sharedSocket.value, latestJoinPayload)
      return sharedSocket.value
    }
    if (sharedSocket.value) return sharedSocket.value

    const s = io(`${WS_URL}/classroom`, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      randomizationFactor: 0.3,
    })

    sharedSocket.value = s

    s.on('connect', () => {
      sharedConnected.value = true
      if (latestJoinPayload) emitTeacherJoin(s, latestJoinPayload)
    })

    s.on('disconnect', () => { sharedConnected.value = false })

    s.on('reconnect', () => {
      sharedConnected.value = true
      if (latestJoinPayload) emitTeacherJoin(s, latestJoinPayload)
    })

    s.on('connect_error', () => { sharedConnected.value = false })

    return s
  }

  function disconnect() {
    if (!didConnect) return
    didConnect = false
    connectionCount--
    if (connectionCount <= 0 && sharedSocket.value) {
      sharedSocket.value.disconnect()
      sharedSocket.value = null
      sharedConnected.value = false
      connectionCount = 0
      latestJoinPayload = null
    }
  }

  onUnmounted(() => disconnect())

  return { socket: sharedSocket, connected: sharedConnected, connect, disconnect }
}
