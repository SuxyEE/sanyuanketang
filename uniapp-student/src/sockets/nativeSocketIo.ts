type Handler = (...args: any[]) => void

export interface SocketLike {
  connected: boolean
  io: {
    on: (event: string, handler: Handler) => SocketLike
    off: (event: string, handler?: Handler) => SocketLike
  }
  on: (event: string, handler: Handler) => SocketLike
  off: (event: string, handler?: Handler) => SocketLike
  emit: (event: string, ...args: any[]) => SocketLike
  disconnect: () => void
}

interface NativeSocketOptions {
  timeout?: number
  reconnection?: boolean
  reconnectionDelay?: number
  reconnectionDelayMax?: number
}

function parseEndpoint(endpoint: string) {
  const match = endpoint.match(/^(https?):\/\/([^/]+)(\/.*)?$/i)
  if (!match) throw new Error(`Invalid socket endpoint: ${endpoint}`)
  const protocol = match[1].toLowerCase() === 'https' ? 'wss' : 'ws'
  const host = match[2]
  const namespace = (match[3] || '').replace(/\/+$/, '') || '/'
  return {
    url: `${protocol}://${host}/socket.io/?EIO=4&transport=websocket`,
    namespace,
  }
}

function toMessage(data: any) {
  if (typeof data === 'string') return data
  if (data instanceof ArrayBuffer && typeof TextDecoder !== 'undefined') {
    return new TextDecoder().decode(data)
  }
  return String(data || '')
}

export function createNativeSocketIo(endpoint: string, options: NativeSocketOptions = {}): SocketLike {
  return new NativeSocketIo(endpoint, options)
}

class NativeSocketIo implements SocketLike {
  connected = false
  io = {
    on: (event: string, handler: Handler) => {
      this.on(`io:${event}`, handler)
      return this as SocketLike
    },
    off: (event: string, handler?: Handler) => {
      this.off(`io:${event}`, handler)
      return this as SocketLike
    },
  }

  private readonly endpoint: ReturnType<typeof parseEndpoint>
  private readonly handlers = new Map<string, Set<Handler>>()
  private readonly sendQueue: string[] = []
  private task: any = null
  private connectTimer: ReturnType<typeof setTimeout> | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private manuallyClosed = false
  private reconnectDelay: number

  constructor(
    rawEndpoint: string,
    private readonly options: NativeSocketOptions,
  ) {
    this.endpoint = parseEndpoint(rawEndpoint)
    this.reconnectDelay = options.reconnectionDelay || 1000
    this.open()
  }

  on(event: string, handler: Handler) {
    const list = this.handlers.get(event) || new Set<Handler>()
    list.add(handler)
    this.handlers.set(event, list)
    return this
  }

  off(event: string, handler?: Handler) {
    if (!handler) {
      this.handlers.delete(event)
      return this
    }
    const list = this.handlers.get(event)
    if (!list) return this
    list.delete(handler)
    if (list.size === 0) this.handlers.delete(event)
    return this
  }

  emit(event: string, ...args: any[]) {
    const packet = `42${this.endpoint.namespace},${JSON.stringify([event, ...args])}`
    if (this.connected) this.send(packet)
    else this.sendQueue.push(packet)
    return this
  }

  disconnect() {
    this.manuallyClosed = true
    this.clearTimers()
    if (this.connected) this.send(`41${this.endpoint.namespace},`)
    this.connected = false
    try { this.task?.close?.({ code: 1000, reason: 'client disconnect' }) } catch { /* ignore */ }
    this.task = null
  }

  private open() {
    this.clearTimers()
    this.manuallyClosed = false
    this.connectTimer = setTimeout(() => {
      if (this.connected) return
      this.emitLocal('connect_error', { message: 'timeout' })
      try { this.task?.close?.() } catch { /* ignore */ }
      this.scheduleReconnect()
    }, this.options.timeout || 8000)

    try {
      this.task = uni.connectSocket({
        url: this.endpoint.url,
        complete: () => undefined,
      })
    } catch (err: any) {
      this.emitLocal('connect_error', { message: err?.message || String(err) })
      this.scheduleReconnect()
      return
    }

    this.task.onOpen?.(() => undefined)
    this.task.onMessage?.((event: any) => this.handleMessage(toMessage(event?.data)))
    this.task.onError?.((err: any) => {
      if (!this.connected) this.emitLocal('connect_error', { message: err?.errMsg || err?.message || 'socket error' })
    })
    this.task.onClose?.(() => {
      const wasConnected = this.connected
      this.connected = false
      this.clearTimers()
      if (wasConnected) this.emitLocal('disconnect')
      if (!this.manuallyClosed && this.options.reconnection !== false) this.scheduleReconnect()
    })
  }

  private handleMessage(message: string) {
    if (!message) return
    if (message === '2') {
      this.send('3')
      return
    }
    if (message.startsWith('0')) {
      this.send(`40${this.endpoint.namespace},`)
      return
    }
    if (message.startsWith(`40${this.endpoint.namespace}`)) {
      this.connected = true
      this.clearConnectTimer()
      this.emitLocal('connect')
      this.flushQueue()
      return
    }
    if (message.startsWith(`44${this.endpoint.namespace},`)) {
      this.emitLocal('connect_error', { message: message.slice(`44${this.endpoint.namespace},`.length) })
      return
    }
    if (message.startsWith(`42${this.endpoint.namespace},`)) {
      const json = message.slice(`42${this.endpoint.namespace},`.length)
      try {
        const packet = JSON.parse(json)
        const [event, ...args] = Array.isArray(packet) ? packet : []
        if (event) this.emitLocal(event, ...args)
      } catch (err) {
        console.warn('[native socket.io] parse failed', err)
      }
      return
    }
    if (message.startsWith(`41${this.endpoint.namespace}`)) {
      this.connected = false
      this.emitLocal('disconnect')
    }
  }

  private send(data: string) {
    if (!this.task) return
    try {
      this.task.send({ data })
    } catch (err) {
      console.warn('[native socket.io] send failed', err)
    }
  }

  private flushQueue() {
    while (this.connected && this.sendQueue.length > 0) {
      const packet = this.sendQueue.shift()
      if (packet) this.send(packet)
    }
  }

  private scheduleReconnect() {
    if (this.manuallyClosed || this.reconnectTimer) return
    const delay = this.reconnectDelay
    const max = this.options.reconnectionDelayMax || 10000
    this.reconnectDelay = Math.min(max, Math.round(delay * 1.5))
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.open()
      this.emitLocal('io:reconnect')
    }, delay)
  }

  private emitLocal(event: string, ...args: any[]) {
    this.handlers.get(event)?.forEach(handler => handler(...args))
  }

  private clearConnectTimer() {
    if (this.connectTimer) {
      clearTimeout(this.connectTimer)
      this.connectTimer = null
    }
  }

  private clearTimers() {
    this.clearConnectTimer()
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }
}
