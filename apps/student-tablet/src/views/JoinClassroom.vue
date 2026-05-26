<template>
  <div class="join-classroom">
    <div class="join-header">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="1.5">
        <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
      </svg>
      <h1>智慧课堂</h1>
      <p>输入课堂入口码加入课堂</p>
    </div>

    <div class="join-card">
      <div class="name-input">
        <label>你的姓名</label>
        <input v-model="studentName" placeholder="输入姓名" maxlength="10" />
      </div>

      <div class="code-input">
        <label>课堂入口码</label>
        <div class="code-boxes">
          <input
            v-for="i in 6"
            :key="i"
            :ref="el => codeInputs[i-1] = el as HTMLInputElement"
            type="text"
            maxlength="1"
            inputmode="numeric"
            class="code-box"
            :value="codeDigits[i-1]"
            @input="handleCodeInput($event, i-1)"
            @keydown.delete="handleBackspace($event, i-1)"
            @paste="handlePaste"
          />
        </div>
      </div>

      <button
        class="join-btn"
        :disabled="!canJoin"
        @click="joinClassroom"
      >
        加入课堂
      </button>

      <div v-if="error" class="error-msg">{{ error }}</div>
    </div>

    <p class="version-text">集美工业职业学院 · 交互课堂系统</p>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useStudentStore } from '../stores/student'

const router = useRouter()
const route = useRoute()
const store = useStudentStore()

const studentName = ref(store.studentName)
const codeDigits = ref<string[]>(['', '', '', '', '', ''])
const codeInputs = ref<(HTMLInputElement | null)[]>([])
const error = ref('')

const canJoin = computed(() =>
  studentName.value.trim().length > 0 &&
  codeDigits.value.every(d => d !== '')
)

function readRoomFromQuery(): string {
  if (route.query.action === 'teacher' || route.query.role === 'teacher') return ''
  // 兼容多种命名：?room=854160 / ?roomCode=854160 / ?code=854160
  const candidates = [route.query.room, route.query.roomCode, route.query.code]
  for (const c of candidates) {
    if (typeof c === 'string' && /^\d{6}$/.test(c)) return c
  }
  return ''
}

onMounted(() => {
  const roomParam = readRoomFromQuery()
  if (roomParam) {
    codeDigits.value = roomParam.split('')
    // 名字未填时不自动 join，避免没姓名进课堂
    if (studentName.value.trim()) {
      joinClassroom()
    }
  }
})

function handleCodeInput(e: Event, idx: number) {
  const input = e.target as HTMLInputElement
  const val = input.value.replace(/\D/g, '')
  codeDigits.value[idx] = val
  if (val && idx < 5) {
    codeInputs.value[idx + 1]?.focus()
  }
}

function handleBackspace(e: KeyboardEvent, idx: number) {
  if (!codeDigits.value[idx] && idx > 0) {
    codeInputs.value[idx - 1]?.focus()
  }
}

function handlePaste(e: ClipboardEvent) {
  e.preventDefault()
  const text = e.clipboardData?.getData('text') || ''
  const digits = text.replace(/\D/g, '').slice(0, 6).split('')
  for (let i = 0; i < digits.length; i++) {
    codeDigits.value[i] = digits[i]
  }
  if (digits.length >= 6) {
    codeInputs.value[5]?.focus()
  }
}

function joinClassroom() {
  const roomFromQuery = readRoomFromQuery()
  if (!canJoin.value && !roomFromQuery) return
  if (!studentName.value.trim()) return
  error.value = ''
  store.studentName = studentName.value.trim()

  const roomCode = codeDigits.value.join('') || roomFromQuery
  if (!/^\d{6}$/.test(roomCode)) {
    error.value = '入口码格式不正确（应为 6 位数字）'
    return
  }
  router.push({ name: 'StudentMain', query: { room: roomCode } })
}
</script>

<style scoped lang="scss">
.join-classroom {
  min-height: 100vh;
  background: var(--bg-page);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
}

.join-header {
  text-align: center;
  margin-bottom: 32px;

  h1 { font-size: 24px; font-weight: 700; color: var(--text-primary); margin: 12px 0 4px; }
  p { font-size: 14px; color: var(--text-secondary); }
}

.join-card {
  width: 100%;
  max-width: 360px;
  background: var(--bg-card);
  border-radius: 20px;
  padding: 28px 24px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.06);
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.name-input, .code-input {
  label {
    display: block;
    font-size: 13px;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 8px;
  }
}

.name-input input {
  width: 100%;
  padding: 12px 14px;
  border: 2px solid var(--border);
  border-radius: 12px;
  font-size: 15px;
  outline: none;
  min-height: 44px;
  &:focus { border-color: var(--primary); }
}

.code-boxes {
  display: flex;
  gap: 8px;
  justify-content: center;
}

.code-box {
  width: 44px;
  height: 52px;
  border: 2px solid var(--border);
  border-radius: 12px;
  text-align: center;
  font-size: 22px;
  font-weight: 700;
  color: var(--text-primary);
  outline: none;
  transition: border-color 0.2s;

  &:focus { border-color: var(--primary); background: var(--primary-light); }
}

.join-btn {
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

  &:disabled { opacity: 0.4; cursor: not-allowed; }
  &:not(:disabled):active { transform: scale(0.98); }
}

.error-msg {
  text-align: center;
  color: var(--danger);
  font-size: 13px;
}

.version-text {
  margin-top: 32px;
  font-size: 11px;
  color: var(--text-muted);
}
</style>
