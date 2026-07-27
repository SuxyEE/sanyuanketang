<template>
  <view class="join-classroom" :class="{ landscape: isLandscape, portrait: !isLandscape }">
    <!-- 装饰性动画背景：4 个浮动光斑 + 网格纹理 -->
    <view class="bg-decor" aria-hidden="true">
      <view class="orb orb-1"></view>
      <view class="orb orb-2"></view>
      <view class="orb orb-3"></view>
      <view class="orb orb-4"></view>
      <view class="grid-pattern"></view>
    </view>

    <!-- 左侧品牌区（横屏专属） -->
    <view class="brand-pane">
      <view class="brand-content">
        <view class="logo-wrap" aria-hidden="true">
          <view class="logo-glow"></view>
          <Icon name="logo" size="3xl" tone="primary" />
        </view>
        <text class="title fade-up" style="animation-delay: 60ms">三元课堂</text>
        <text class="sub-title fade-up" style="animation-delay: 140ms">集美工业职业学院</text>
        <text class="tagline fade-up" style="animation-delay: 220ms">真人课堂 · AI 副驾 · 互动学习</text>
        <view class="features">
          <view
            v-for="(f, i) in features"
            :key="f.label"
            class="feat fade-up"
            :style="{ animationDelay: (320 + i * 80) + 'ms' }"
          >
            <view class="feat-icon-wrap"><Icon :name="f.icon" size="md" tone="primary" /></view>
            <text class="feat-label">{{ f.label }}</text>
          </view>
        </view>
      </view>
      <text class="version-text">v1.0.0 · 三元课堂学生端</text>
    </view>

    <!-- 右侧输入区 -->
    <view class="input-pane">
      <view class="join-card">
        <view class="join-head">
          <text class="join-title">输入入口码加入课堂</text>
          <text class="join-sub">课堂入口码由教师在课前下发</text>
        </view>

        <Field label="你的姓名" :error="nameError" required>
          <template #default="{ setFocused }">
            <view class="input-wrap">
              <view class="input-icon"><Icon name="user" size="sm" tone="muted" /></view>
              <input
                v-model="studentName"
                class="text-input"
                placeholder="请输入真实姓名（便于教师识别）"
                maxlength="10"
                :adjust-position="false"
                @focus="setFocused(true)"
                @blur="setFocused(false); validateName()"
              />
            </view>
          </template>
        </Field>

        <Field label="6 位课堂入口码" :error="codeError" required>
          <template #default="{ setFocused }">
            <view class="code-boxes" :class="{ shake: codeError }">
              <view
                v-for="(d, i) in codeDigits"
                :key="i"
                class="code-cell"
                :class="{ filled: !!d, active: i === activeCellIdx && cellFocus }"
                @tap="focusCell(i)"
              >
                <text class="code-digit">{{ d || '' }}</text>
              </view>
              <input
                class="code-hidden-input"
                type="number"
                inputmode="numeric"
                :focus="cellFocus"
                :value="codeRaw"
                maxlength="6"
                :adjust-position="false"
                @input="onCodeInput"
                @focus="cellFocus = true; setFocused(true)"
                @blur="cellFocus = false; setFocused(false)"
              />
            </view>
          </template>
        </Field>

        <Button
          variant="primary"
          size="lg"
          block
          :disabled="!canJoin"
          :loading="joining"
          icon-right="arrow-right"
          aria-label="加入课堂"
          @tap="joinClassroom"
        >
          加入课堂
        </Button>

        <Button
          variant="secondary"
          size="lg"
          block
          icon-left="radio-tower"
          aria-label="扫码加入课堂"
          @tap="scanJoinCode"
        >
          扫码加入课堂
        </Button>

        <view class="quick-tips" v-if="!cellFocus">
          <view class="tip">
            <Icon name="help-circle" size="xs" tone="muted" />
            <text>入口码由老师在课堂开始时下发</text>
          </view>
          <view class="tip">
            <Icon name="radio-tower" size="xs" tone="muted" />
            <text>加入后会自动同步老师的课件</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useStudentStore } from '@/stores/student'
import { useOrientation } from '@/composables/useOrientation'
import Icon from '@/student-components/ui/Icon.vue'
import Button from '@/student-components/ui/Button.vue'
import Field from '@/student-components/ui/Field.vue'
import type { IconName } from '@/icons'
import { useSessionStore } from '@/stores/session'

const store = useStudentStore()
const session = useSessionStore()
const { isLandscape } = useOrientation()

const studentName = ref(store.studentName)
const codeDigits = ref<string[]>(['', '', '', '', '', ''])
const codeRaw = ref('')
const cellFocus = ref(false)
const activeCellIdx = ref(0)
const nameError = ref('')
const codeError = ref('')
const joining = ref(false)

const features: Array<{ icon: IconName; label: string }> = [
  { icon: 'hand', label: '随堂举手与抢答' },
  { icon: 'sparkles', label: 'AI 答疑与练习' },
  { icon: 'bar-chart', label: '实时学情反馈' },
  { icon: 'lock', label: '专注课堂模式' },
]

const canJoin = computed(
  () => studentName.value.trim().length > 0 && codeDigits.value.every(d => d !== ''),
)

function syncDigitsFromRaw() {
  const padded = codeRaw.value.padEnd(6, '').slice(0, 6)
  codeDigits.value = padded.split('')
  activeCellIdx.value = Math.min(codeRaw.value.length, 5)
}

function onCodeInput(e: any) {
  const v = String(e.detail?.value || '').replace(/\D/g, '').slice(0, 6)
  codeRaw.value = v
  syncDigitsFromRaw()
  if (codeError.value) codeError.value = ''
}

function focusCell(_idx: number) {
  cellFocus.value = false
  setTimeout(() => { cellFocus.value = true }, 30)
}

function validateName() {
  const v = studentName.value.trim()
  if (!v) nameError.value = '请输入姓名'
  else if (v.length < 2) nameError.value = '姓名至少 2 个字符'
  else nameError.value = ''
}

function readRoomFromQuery(query: Record<string, string | undefined>): string {
  if (query.action === 'teacher' || query.role === 'teacher') return ''
  const candidates = [query.room, query.roomCode, query.code]
  for (const c of candidates) {
    if (typeof c === 'string' && /^\d{6}$/.test(c)) return c
  }
  return ''
}

function readRoomFromText(text: string): string {
  const raw = String(text || '').trim()
  const direct = raw.match(/^\d{6}$/)
  if (direct) return direct[0]

  const protocolMatch = raw.match(/snyuan-classroom:\/\/join\?room=([0-9]{6})/i)
  if (protocolMatch) return protocolMatch[1]

  if (/^snyuan-classroom:\/\//i.test(raw)) return ''

  const roomMatch = raw.match(/[?&#](?:room|roomCode|code)=([0-9]{6})/i)
  if (roomMatch) return roomMatch[1]

  const loose = raw.match(/\b([0-9]{6})\b/)
  return loose ? loose[1] : ''
}

onLoad((query: any = {}) => {
  const roomFromQuery = readRoomFromQuery(query || {})
  if (roomFromQuery) {
    codeRaw.value = roomFromQuery
    syncDigitsFromRaw()
    if (studentName.value.trim()) joinClassroom()
  }
})

onMounted(() => {
  session.hydrate()
  const activeRole = session.activeRole || (session.roles.length === 1 ? session.roles[0] : undefined)
  if (!session.user) {
    uni.reLaunch({ url: '/pages/login/index' })
    return
  }
  if (!activeRole) {
    uni.reLaunch({ url: '/pages/role-select/index' })
    return
  }
  if (activeRole !== 'student') {
    uni.reLaunch({ url: '/pages/course-select/index' })
    return
  }
  if (session.user.name) {
    studentName.value = session.user.name
  }
  if (session.user.id) {
    store.studentId = session.user.id
  }
  store.studentName = studentName.value.trim() || store.studentName
  try {
    uni.setStorageSync('snyuan_student_id_v1', store.studentId)
    uni.setStorageSync('snyuan_student_name_v1', store.studentName)
  } catch { /* ignore */ }
  setTimeout(() => { cellFocus.value = true }, 200)
})

function joinClassroom() {
  validateName()
  if (!canJoin.value) return
  const code = codeDigits.value.join('')
  if (!/^\d{6}$/.test(code)) {
    codeError.value = '入口码必须是 6 位数字'
    return
  }
  if (nameError.value) return
  codeError.value = ''
  joining.value = true
  store.studentName = studentName.value.trim()
  try { uni.setStorageSync('snyuan_student_name_v1', store.studentName) } catch { /* ignore */ }
  setTimeout(() => {
    uni.navigateTo({
      url: `/pages/student/classroom/index?room=${code}`,
      complete: () => { joining.value = false },
    })
  }, 150)
}

function scanJoinCode() {
  uni.scanCode({
    onlyFromCamera: true,
    scanType: ['qrCode'],
    success: (res) => {
      const code = readRoomFromText(res.result || '')
      if (!code) {
        codeError.value = '未识别到有效课堂码'
        uni.showToast({ title: '二维码无效', icon: 'none' })
        return
      }
      codeRaw.value = code
      syncDigitsFromRaw()
      codeError.value = ''
      uni.showToast({ title: '已识别课堂码', icon: 'success' })
      if (studentName.value.trim()) joinClassroom()
    },
    fail: () => {
      uni.showToast({ title: '扫码失败，请检查相机权限', icon: 'none' })
    },
  })
}
</script>

<style lang="scss" scoped>
@import '@/styles/variables.scss';

.join-classroom {
  width: 100vw;
  min-height: 100vh;
  display: flex;
  background: var(--color-bg);
  overflow: hidden;
  padding-top: var(--safe-top);
  padding-bottom: var(--safe-bottom);
  padding-left: var(--safe-left);
  padding-right: var(--safe-right);
  box-sizing: border-box;
  position: relative;
}

/* ===== 装饰背景层（绝对底层） ===== */
.bg-decor {
  position: absolute;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;
}

.orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(80rpx);
  opacity: 0.55;
  will-change: transform;
}
.orb-1 {
  width: 720rpx; height: 720rpx;
  background: radial-gradient(circle at 30% 30%, rgba(47, 107, 255, 0.55), transparent 70%);
  top: -120rpx; left: -160rpx;
  animation: orb-float-1 22s var(--ease-standard) infinite;
}
.orb-2 {
  width: 560rpx; height: 560rpx;
  background: radial-gradient(circle at 40% 60%, rgba(124, 77, 255, 0.45), transparent 70%);
  top: 30%; right: -120rpx;
  animation: orb-float-2 28s var(--ease-standard) infinite;
}
.orb-3 {
  width: 480rpx; height: 480rpx;
  background: radial-gradient(circle at 50% 50%, rgba(32, 165, 70, 0.32), transparent 70%);
  bottom: -100rpx; left: 30%;
  animation: orb-float-3 32s var(--ease-standard) infinite;
}
.orb-4 {
  width: 380rpx; height: 380rpx;
  background: radial-gradient(circle at 50% 50%, rgba(245, 166, 35, 0.28), transparent 70%);
  bottom: 20%; right: 25%;
  animation: orb-float-4 26s var(--ease-standard) infinite reverse;
}

.grid-pattern {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(10, 13, 21, 0.025) 2rpx, transparent 2rpx),
    linear-gradient(90deg, rgba(10, 13, 21, 0.025) 2rpx, transparent 2rpx);
  background-size: 80rpx 80rpx;
  mask-image: radial-gradient(ellipse 80% 60% at center, black 30%, transparent 75%);
  -webkit-mask-image: radial-gradient(ellipse 80% 60% at center, black 30%, transparent 75%);
}

@keyframes orb-float-1 {
  0%, 100% { transform: translate(0, 0) scale(1); }
  33%      { transform: translate(80rpx, 60rpx) scale(1.05); }
  66%      { transform: translate(-40rpx, 120rpx) scale(0.95); }
}
@keyframes orb-float-2 {
  0%, 100% { transform: translate(0, 0) scale(1); }
  50%      { transform: translate(-100rpx, 80rpx) scale(1.08); }
}
@keyframes orb-float-3 {
  0%, 100% { transform: translate(0, 0) scale(1); }
  40%      { transform: translate(60rpx, -80rpx) scale(1.04); }
  80%      { transform: translate(-50rpx, -40rpx) scale(0.96); }
}
@keyframes orb-float-4 {
  0%, 100% { transform: translate(0, 0) scale(1); }
  50%      { transform: translate(40rpx, -100rpx) scale(1.1); }
}

/* 进入动画：每个元素自下淡入 */
.fade-up {
  opacity: 0;
  animation: fade-up var(--duration-slow) var(--ease-decelerate) forwards;
}
@keyframes fade-up {
  from { opacity: 0; transform: translateY(20rpx); }
  to   { opacity: 1; transform: translateY(0); }
}

@media (prefers-reduced-motion: reduce) {
  .orb { animation: none; }
  .fade-up { opacity: 1; animation: none; transform: none; }
}

/* —— 横屏：左右分栏 —— */
.landscape {
  flex-direction: row;
  .brand-pane {
    flex: 1;
    max-width: 56%;
    padding: var(--space-9) var(--space-8);
    z-index: 1;
  }
  .input-pane {
    flex: 1;
    min-width: 480rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-8);
    z-index: 1;
  }
}

/* —— 竖屏：上下堆叠 —— */
.portrait {
  flex-direction: column;
  .brand-pane {
    flex: 0 0 auto;
    padding: var(--space-9) var(--space-7) var(--space-4);
    min-height: 360rpx;
    z-index: 1;
    .features { display: none; }
    .version-text { display: none; }
  }
  .input-pane {
    flex: 1;
    padding: var(--space-4) var(--space-7) var(--space-7);
    display: flex;
    align-items: flex-start;
    justify-content: center;
    z-index: 1;
  }
}

.brand-pane {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.brand-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.logo-wrap {
  position: relative;
  width: 144rpx;
  height: 144rpx;
  border-radius: var(--radius-2xl);
  background: var(--color-primary-container);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: var(--space-3);
  animation: logo-in 600ms var(--ease-emphasized) both;
}

.logo-glow {
  position: absolute;
  inset: -8rpx;
  border-radius: var(--radius-2xl);
  background: radial-gradient(circle, rgba(47, 107, 255, 0.35), transparent 70%);
  filter: blur(20rpx);
  z-index: -1;
  animation: glow-pulse 3s var(--ease-standard) infinite;
}

@keyframes logo-in {
  from { opacity: 0; transform: scale(0.6) rotate(-8deg); }
  to   { opacity: 1; transform: scale(1) rotate(0); }
}

@keyframes glow-pulse {
  0%, 100% { opacity: 0.6; transform: scale(1); }
  50%      { opacity: 1;   transform: scale(1.15); }
}

@media (prefers-reduced-motion: reduce) {
  .logo-wrap, .logo-glow { animation: none; }
}

.title {
  font-size: var(--font-display);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
  letter-spacing: 4rpx;
  line-height: var(--line-height-tight);
}

.sub-title {
  font-size: var(--font-body-lg);
  color: var(--color-text-secondary);
}

.tagline {
  font-size: var(--font-body);
  color: var(--color-text-tertiary);
  margin-bottom: var(--space-6);
}

.features {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  margin-top: var(--space-3);
}

.feat {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  font-size: var(--font-body);
  color: var(--color-text-primary);
}

.feat-icon-wrap {
  width: 56rpx;
  height: 56rpx;
  border-radius: var(--radius-md);
  background: var(--color-primary-container);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.feat-label {
  font-weight: var(--font-weight-medium);
}

.version-text {
  font-size: var(--font-caption);
  color: var(--color-text-tertiary);
  margin-top: auto;
}

/* —— 加入卡片 —— */
.join-card {
  width: 100%;
  max-width: 640rpx;
  background: var(--color-surface);
  border-radius: var(--radius-2xl);
  padding: var(--space-8) var(--space-7);
  box-shadow: var(--elevation-3);
  display: flex;
  flex-direction: column;
  gap: var(--space-7);
  animation: card-rise 600ms var(--ease-emphasized) 100ms both;
}

@keyframes card-rise {
  from { opacity: 0; transform: translateY(40rpx) scale(0.96); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}

@media (prefers-reduced-motion: reduce) {
  .join-card { animation: none; }
}

.join-head {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  text-align: center;
}

.join-title {
  font-size: var(--font-title);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
}

.join-sub {
  font-size: var(--font-caption);
  color: var(--color-text-tertiary);
}

/* —— 单行 input —— */
.input-wrap {
  position: relative;
  display: flex;
  align-items: center;
  background: var(--color-surface-variant);
  border: 2rpx solid var(--color-outline);
  border-radius: var(--radius-lg);
  transition: border-color var(--duration-base) var(--ease-standard);
  &:focus-within { border-color: var(--color-primary); }
}

.input-icon {
  padding-left: var(--space-4);
  display: flex;
  align-items: center;
}

.text-input {
  flex: 1;
  height: 96rpx;  /* > touch-min 88rpx */
  padding: 0 var(--space-4);
  font-size: var(--font-body);
  background: transparent;
  color: var(--color-text-primary);
}

/* —— 6 位入口码格子 —— */
.code-boxes {
  position: relative;
  display: flex;
  justify-content: space-between;
  gap: var(--space-2);

  &.shake { animation: shake var(--duration-slow) var(--ease-standard); }
}

.code-cell {
  flex: 1;
  height: 112rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-surface-variant);
  border: 4rpx solid var(--color-outline);
  border-radius: var(--radius-lg);
  transition: background-color var(--duration-base) var(--ease-standard),
              border-color var(--duration-base) var(--ease-standard),
              box-shadow var(--duration-base) var(--ease-standard),
              transform var(--duration-base) var(--ease-standard);

  &.filled {
    background: var(--color-primary-container);
    border-color: var(--color-primary);
    .code-digit { color: var(--color-on-primary-container); }
  }
  &.active {
    border-color: var(--color-primary);
    box-shadow: 0 0 0 4rpx var(--color-primary-container);
  }
}

.code-digit {
  font-size: var(--font-title-lg);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
  font-variant-numeric: tabular-nums;
}

.code-hidden-input {
  position: absolute;
  inset: 0;
  opacity: 0;
}

/* —— 提示 —— */
.quick-tips {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  align-items: center;
  margin-top: calc(-1 * var(--space-3));
}

.tip {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--font-caption);
  color: var(--color-text-tertiary);
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-8rpx); }
  50% { transform: translateX(8rpx); }
  75% { transform: translateX(-4rpx); }
}
</style>
