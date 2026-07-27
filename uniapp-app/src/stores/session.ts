import { defineStore } from 'pinia'
import { API_BASE } from '@/shared/config'

export type AppRole = 'teacher' | 'student'

export interface SessionUser {
  id: string
  name: string
  username: string
  roles: AppRole[]
  activeRole?: AppRole
  token?: string
  phone?: string
  externalUserId?: string
}

const STORAGE_KEY = 'snyuan_unified_session'
const STORAGE_KEY_STUDENT_ID = 'snyuan_student_id_v1'
const STORAGE_KEY_STUDENT_NAME = 'snyuan_student_name_v1'
const STORAGE_KEY_PHONE = 'snyuan_phone'
const STORAGE_KEY_EXTERNAL_USER_ID = 'snyuan_external_user_id'

function clearStudentIdentityStorage() {
  try {
    uni.removeStorageSync(STORAGE_KEY_STUDENT_ID)
    uni.removeStorageSync(STORAGE_KEY_STUDENT_NAME)
    uni.removeStorageSync(STORAGE_KEY_PHONE)
    uni.removeStorageSync(STORAGE_KEY_EXTERNAL_USER_ID)
  } catch {
    // ignore
  }
}

function normalizeRole(role: unknown): AppRole | null {
  const text = String(role || '').toLowerCase()
  if (text === 'teacher') return 'teacher'
  if (text === 'student') return 'student'
  return null
}

function inferDemoRoles(username: string): AppRole[] {
  const raw = username.trim().toLowerCase()
  if (/学生|student|stu|^s\d*$/.test(raw)) return ['student']
  if (/双|both|all/.test(raw)) return ['teacher', 'student']
  return ['teacher']
}

export const useSessionStore = defineStore('session', {
  state: () => ({
    user: null as SessionUser | null,
    loading: false,
  }),

  getters: {
    isLoggedIn: state => !!state.user,
    activeRole: state => state.user?.activeRole,
    roles: state => state.user?.roles || [],
  },

  actions: {
    hydrate() {
      try {
        const raw = uni.getStorageSync(STORAGE_KEY) as string
        if (raw) this.user = JSON.parse(raw)
      } catch {
        this.user = null
      }
    },

    persist() {
      if (!this.user) {
        uni.removeStorageSync(STORAGE_KEY)
        return
      }
      uni.setStorageSync(STORAGE_KEY, JSON.stringify(this.user))
      if (this.user.token) uni.setStorageSync('jwt', this.user.token)
      if (this.user.phone) uni.setStorageSync(STORAGE_KEY_PHONE, this.user.phone)
      if (this.user.externalUserId) uni.setStorageSync(STORAGE_KEY_EXTERNAL_USER_ID, this.user.externalUserId)
      if (this.user.roles.includes('student')) {
        uni.setStorageSync(STORAGE_KEY_STUDENT_ID, this.user.id)
        uni.setStorageSync(STORAGE_KEY_STUDENT_NAME, this.user.name)
      } else {
        clearStudentIdentityStorage()
      }
    },

    async login(username: string, password: string) {
      const account = username.trim()
      if (!account) throw new Error('请输入账号')
      this.loading = true
      try {
        const user = await this.loginWithBackend(account, password)
        this.user = user
      } catch {
        const roles = inferDemoRoles(account)
        this.user = {
          id: `${roles[0]}-${account || Date.now()}`,
          username: account,
          name: roles[0] === 'student' ? '学生演示账号' : '教师演示账号',
          roles,
          activeRole: roles.length === 1 ? roles[0] : undefined,
        }
      } finally {
        this.loading = false
      }
      this.persist()
      return this.user!
    },

    loginAs(role: AppRole) {
      this.user = {
        id: `${role}-demo`,
        username: role === 'teacher' ? 'teacher-demo' : 'student-demo',
        name: role === 'teacher' ? '教师演示账号' : '学生演示账号',
        roles: [role],
        activeRole: role,
      }
      this.persist()
    },

    selectRole(role: AppRole) {
      if (!this.user || !this.user.roles.includes(role)) return
      this.user.activeRole = role
      this.persist()
    },

    logout() {
      this.user = null
      uni.removeStorageSync(STORAGE_KEY)
      uni.removeStorageSync('jwt')
      clearStudentIdentityStorage()
    },

    async loginWithBackend(username: string, password: string): Promise<SessionUser> {
      const result = await new Promise<any>((resolve, reject) => {
        uni.request({
          url: `${API_BASE}/auth/login`,
          method: 'POST',
          header: { 'content-type': 'application/json' },
          data: { username, password },
          success: (res: any) => {
            if (res.statusCode < 200 || res.statusCode >= 300) {
              reject(new Error(`HTTP ${res.statusCode}`))
              return
            }
            resolve(res.data?.data || res.data)
          },
          fail: reject,
        })
      })

      const rawRole = result?.user?.role || result?.role
      const role = normalizeRole(rawRole)
      const roles = Array.isArray(result?.user?.roles)
        ? result.user.roles.map(normalizeRole).filter(Boolean)
        : role ? [role] : inferDemoRoles(username)

      return {
        id: result?.user?.id || result?.sub || username,
        username,
        name: result?.user?.name || result?.user?.realName || username,
        roles: roles as AppRole[],
        activeRole: roles.length === 1 ? roles[0] as AppRole : undefined,
        token: result?.accessToken || result?.token,
        phone: result?.user?.phone,
        externalUserId: result?.user?.externalUserId,
      }
    },
  },
})
