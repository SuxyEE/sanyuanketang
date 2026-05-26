import { Injectable, Logger } from '@nestjs/common'
import { randomBytes } from 'node:crypto'

/**
 * 手机 → 教师平板 课件 beam 会话。
 *
 * 流程：
 *  1. 教师平板 POST /sessions 创建一次性 sessionId（6 位字母数字，10 分钟 TTL）
 *  2. 平板拿 sessionId 拼成 QR URL → 显示
 *  3. 教师拿手机扫码打开 H5 上传页
 *  4. 手机选择课件文件 POST /sessions/:id/files multipart
 *  5. 服务端把文件转 dataUrl 通过 WS 推回订阅的平板 socket
 *  6. 平板拿 dataUrl 走原有 PDF/图片处理流程
 *
 * 设计要点：
 *  - 内存 Map（够用，单进程 MVP）
 *  - 单文件单 session，文件落地后立刻 destroy session
 *  - sessionId 不可猜（randomBytes + base36），10 分钟过期
 *  - subscribe 通过 socketId 锁定接收方，phone POST 时只推回这一个 socket
 */
export interface UploadSession {
  sessionId: string
  createdAt: number
  expiresAt: number
  /** 单次性：一旦 consumed=true，session 就拒绝再次上传 */
  consumed?: boolean
}

const SESSION_TTL_MS = 10 * 60 * 1000
const MAX_FILE_SIZE = 10 * 1024 * 1024
const SESSION_ID_LEN = 6

@Injectable()
export class CoursewareUploadService {
  private readonly logger = new Logger(CoursewareUploadService.name)
  private readonly sessions = new Map<string, UploadSession>()
  private gcTimer: NodeJS.Timeout | null = null

  constructor() {
    this.gcTimer = setInterval(() => this.gc(), 60 * 1000).unref?.() ?? setInterval(() => this.gc(), 60 * 1000)
  }

  /** 教师平板创建上传会话 */
  createSession(): UploadSession {
    let id = ''
    let attempts = 0
    do {
      id = this.genId()
      attempts++
      if (attempts > 50) throw new Error('Failed to generate unique sessionId')
    } while (this.sessions.has(id))

    const now = Date.now()
    const session: UploadSession = {
      sessionId: id,
      createdAt: now,
      expiresAt: now + SESSION_TTL_MS,
    }
    this.sessions.set(id, session)
    this.logger.log(`upload session created: ${id} (TTL ${SESSION_TTL_MS / 1000}s)`)
    return session
  }

  /**
   * 标记 session 已被使用（手机刚 POST 上传完）。
   * 真正的 socketId 订阅放在 ClassroomGateway 里，避免循环依赖。
   */
  markConsumed(sessionId: string): UploadSession | null {
    const s = this.sessions.get(sessionId)
    if (!s || s.expiresAt < Date.now() || s.consumed) return null
    s.consumed = true
    setTimeout(() => this.sessions.delete(sessionId), 5_000)
    return s
  }

  /** 取 session 状态（手机 H5 加载页时确认 sessionId 合法）*/
  peek(sessionId: string): UploadSession | null {
    const s = this.sessions.get(sessionId)
    if (!s) return null
    if (s.expiresAt < Date.now() || s.consumed) return null
    return s
  }

  validateFile(size: number, mimetype: string): { ok: true } | { ok: false; reason: string } {
    if (size > MAX_FILE_SIZE) {
      return { ok: false, reason: `文件过大（${Math.round(size / 1024 / 1024)}MB > ${MAX_FILE_SIZE / 1024 / 1024}MB）` }
    }
    const okType =
      mimetype.startsWith('image/') ||
      mimetype === 'application/pdf' ||
      mimetype === 'application/vnd.ms-powerpoint' ||
      mimetype === 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    if (!okType) return { ok: false, reason: `不支持的文件类型：${mimetype}` }
    return { ok: true }
  }

  bufferToDataUrl(buffer: Buffer, mimetype: string): string {
    return `data:${mimetype};base64,${buffer.toString('base64')}`
  }

  private genId(): string {
    const bytes = randomBytes(SESSION_ID_LEN)
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let out = ''
    for (let i = 0; i < SESSION_ID_LEN; i++) out += alphabet[bytes[i] % alphabet.length]
    return out
  }

  private gc() {
    const now = Date.now()
    let removed = 0
    for (const [id, s] of this.sessions.entries()) {
      if (s.expiresAt < now || s.consumed) {
        this.sessions.delete(id)
        removed++
      }
    }
    if (removed > 0) this.logger.debug(`GC removed ${removed} expired sessions`)
  }
}
