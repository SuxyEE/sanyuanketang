<template>
  <transition name="popup">
    <div v-if="visible" class="signin-overlay">
      <div class="signin-card" role="dialog" aria-label="签到">
        <div class="signin-header">
          <div class="signin-icon" v-html="checkIcon" aria-hidden="true"></div>
          <h3>{{ isSigned ? '签到成功！' : '课堂签到' }}</h3>
          <p class="signin-course">{{ courseName }}</p>
          <p class="signin-mode-tag">{{ modeLabel }}</p>
        </div>

        <!-- 已签到态：仅显示完成提示 -->
        <div v-if="isSigned" class="signed-info">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#52c41a" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          <span class="signed-time">{{ signedTime }}</span>
        </div>

        <!-- 未签到态 -->
        <div v-else class="signin-body">
          <!-- 步骤指引 -->
          <div v-if="steps.length > 1" class="step-indicator">
            <div
              v-for="(s, i) in steps"
              :key="s"
              class="step-dot"
              :class="{ active: i === currentStepIndex, done: i < currentStepIndex }"
            >
              <span class="step-num">{{ i + 1 }}</span>
              <span class="step-label">{{ stepLabel(s) }}</span>
            </div>
          </div>

          <!-- 拍照步骤 -->
          <div v-if="currentStep === 'photo'" class="photo-stage">
            <div class="camera-frame" :class="{ 'has-photo': !!capturedPhoto }">
              <video
                v-show="!capturedPhoto && cameraReady"
                ref="videoRef"
                class="camera-video"
                autoplay
                playsinline
                muted
              ></video>
              <img v-if="capturedPhoto" :src="capturedPhoto" class="camera-photo" alt="已拍摄" />
              <div v-if="!cameraReady && !capturedPhoto" class="camera-loading">
                <div v-if="cameraError" class="cam-error">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  <p>{{ cameraError }}</p>
                  <button class="retry-btn" @click="initCamera">重试</button>
                </div>
                <div v-else class="cam-loading">
                  <div class="spinner"></div>
                  <p>正在唤起摄像头…</p>
                </div>
              </div>
              <div v-if="!capturedPhoto && cameraReady" class="face-guide" aria-hidden="true">
                <div class="face-oval"></div>
                <p class="face-tip">请将正面对准框内</p>
              </div>
            </div>

            <div class="step-actions">
              <button
                v-if="!capturedPhoto"
                class="primary-btn"
                :disabled="!cameraReady"
                @click="capturePhoto"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="13" r="4"/><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/></svg>
                拍摄正面照
              </button>
              <template v-else>
                <button class="secondary-btn" @click="resetPhoto">重新拍摄</button>
                <button class="primary-btn" @click="nextStep">
                  {{ hasLocationStep ? '下一步：定位校验' : '完成签到' }}
                </button>
              </template>
            </div>
          </div>

          <!-- 定位步骤 -->
          <div v-else-if="currentStep === 'location'" class="location-stage">
            <div class="location-card" :class="locationCardClass">
              <div class="loc-icon" v-html="locationIcon" aria-hidden="true"></div>
              <h4 class="loc-title">{{ locationTitle }}</h4>
              <p class="loc-desc">{{ locationDesc }}</p>
              <p v-if="distance !== null" class="distance">
                距离教师约 <strong>{{ Math.round(distance) }}</strong> 米
              </p>
            </div>

            <div class="step-actions">
              <button
                v-if="!location || (requireLocation && !locationOk)"
                class="primary-btn"
                :disabled="locating"
                @click="acquireLocation"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                {{ locating ? '定位中…' : (location ? '重新定位' : '获取当前位置') }}
              </button>
              <button
                v-if="location && locationOk"
                class="primary-btn success"
                :disabled="submitting"
                @click="submit"
              >
                {{ submitting ? '提交中…' : '完成签到' }}
              </button>
            </div>

            <button v-if="hasPhotoStep" class="ghost-btn" @click="currentStep = 'photo'">返回拍照</button>
          </div>

          <!-- 默认（兼容旧逻辑：无需拍照也无需定位时直接一键签到） -->
          <div v-else class="quick-stage">
            <p class="quick-hint">请点击下方按钮完成签到</p>
            <button class="primary-btn large" :disabled="submitting" @click="submit">
              {{ submitting ? '签到中...' : '一键签到' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted, nextTick } from 'vue'
import { icons } from '@snyuan/shared'

const props = withDefaults(defineProps<{
  visible: boolean
  courseName: string
  mode?: string
  requirePhoto?: boolean
  requireLocation?: boolean
  radius?: number
  teacherLocation?: { latitude: number; longitude: number }
}>(), {
  mode: 'normal',
  requirePhoto: false,
  requireLocation: false,
  radius: 50,
})

const emit = defineEmits<{
  signed: [payload: {
    photo?: string
    location?: { latitude: number; longitude: number; accuracy?: number }
    distance?: number
    verified: boolean
  }]
  close: []
}>()

const checkIcon = icons.userCheck
const isSigned = ref(false)
const signedTime = ref('')

const videoRef = ref<HTMLVideoElement | null>(null)
const cameraReady = ref(false)
const cameraError = ref('')
const capturedPhoto = ref('')
let mediaStream: MediaStream | null = null

const locating = ref(false)
const location = ref<{ latitude: number; longitude: number; accuracy?: number } | null>(null)
const distance = ref<number | null>(null)
const submitting = ref(false)

const hasPhotoStep = computed(() => !!props.requirePhoto)
const hasLocationStep = computed(() => !!props.requireLocation)

const steps = computed(() => {
  const result: Array<'photo' | 'location' | 'quick'> = []
  if (hasPhotoStep.value) result.push('photo')
  if (hasLocationStep.value) result.push('location')
  if (result.length === 0) result.push('quick')
  return result
})

const currentStep = ref<'photo' | 'location' | 'quick'>('quick')

const currentStepIndex = computed(() => steps.value.indexOf(currentStep.value))

const modeLabel = computed(() => {
  const parts: string[] = []
  if (props.requirePhoto) parts.push('正面照')
  if (props.requireLocation) parts.push(`${props.radius}米内定位`)
  if (parts.length === 0) {
    if (props.mode === 'code') return '签到码模式'
    return '点击即可签到'
  }
  return `需要：${parts.join(' + ')}`
})

const locationOk = computed(() => {
  if (!props.requireLocation) return true
  if (!location.value) return false
  if (!props.teacherLocation) return true
  return distance.value !== null && distance.value <= props.radius
})

const locationIcon = computed(() => {
  if (!location.value) {
    return '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>'
  }
  if (locationOk.value) {
    return '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>'
  }
  return '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>'
})

const locationCardClass = computed(() => {
  if (!location.value) return ''
  return locationOk.value ? 'ok' : 'bad'
})

const locationTitle = computed(() => {
  if (!location.value) return '需要获取定位'
  if (locationOk.value) return '定位校验通过'
  return '超出签到范围'
})

const locationDesc = computed(() => {
  if (!location.value) return `请允许浏览器获取位置权限，系统会判断你是否在教师 ${props.radius} 米范围内。`
  if (!props.teacherLocation) return '已获取当前位置；教师未提供基准点，将记录为参考定位。'
  if (locationOk.value) return '你在允许签到的范围内，可以完成签到。'
  return `当前距离教师较远，请走近后再签到（要求 ${props.radius} 米内）。`
})

function stepLabel(s: 'photo' | 'location' | 'quick') {
  if (s === 'photo') return '拍照'
  if (s === 'location') return '定位'
  return '签到'
}

watch(() => props.visible, async (val) => {
  if (val) {
    isSigned.value = false
    signedTime.value = ''
    capturedPhoto.value = ''
    location.value = null
    distance.value = null
    submitting.value = false
    cameraError.value = ''
    cameraReady.value = false
    currentStep.value = steps.value[0]
    if (currentStep.value === 'photo') {
      await nextTick()
      initCamera()
    }
  } else {
    stopCamera()
  }
}, { immediate: true })

watch(currentStep, async (val) => {
  if (val === 'photo' && !cameraReady.value && !capturedPhoto.value) {
    await nextTick()
    initCamera()
  } else if (val !== 'photo') {
    stopCamera()
  }
})

async function initCamera() {
  cameraError.value = ''
  cameraReady.value = false
  if (!navigator.mediaDevices?.getUserMedia) {
    cameraError.value = '当前环境不支持摄像头（请使用 HTTPS 访问或更换浏览器）'
    return
  }
  try {
    stopCamera()
    mediaStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 720 } },
      audio: false,
    })
    if (videoRef.value) {
      videoRef.value.srcObject = mediaStream
      await new Promise(resolve => {
        if (!videoRef.value) return resolve(null)
        const onReady = () => {
          videoRef.value?.removeEventListener('loadedmetadata', onReady)
          resolve(null)
        }
        videoRef.value.addEventListener('loadedmetadata', onReady)
      })
    }
    cameraReady.value = true
  } catch (err: any) {
    const name = err?.name
    if (name === 'NotAllowedError') {
      cameraError.value = '已拒绝摄像头权限，请在浏览器地址栏开启权限后重试'
    } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
      cameraError.value = '设备未找到可用摄像头'
    } else if (name === 'NotReadableError') {
      cameraError.value = '摄像头被其他应用占用，请关闭后重试'
    } else {
      cameraError.value = err?.message || '无法访问摄像头'
    }
  }
}

function stopCamera() {
  if (mediaStream) {
    mediaStream.getTracks().forEach(t => t.stop())
    mediaStream = null
  }
  if (videoRef.value) videoRef.value.srcObject = null
  cameraReady.value = false
}

function capturePhoto() {
  if (!videoRef.value || !cameraReady.value) return
  const video = videoRef.value
  const canvas = document.createElement('canvas')
  // 横向裁切到正方形，避免上传大图浪费带宽（保留 480 边）
  const size = Math.min(video.videoWidth, video.videoHeight) || 480
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const sx = (video.videoWidth - size) / 2
  const sy = (video.videoHeight - size) / 2
  // 前置摄像头需镜像翻转，让用户视觉与现实一致
  ctx.translate(size, 0)
  ctx.scale(-1, 1)
  ctx.drawImage(video, sx, sy, size, size, 0, 0, size, size)
  capturedPhoto.value = canvas.toDataURL('image/jpeg', 0.8)
  stopCamera()
}

function resetPhoto() {
  capturedPhoto.value = ''
  initCamera()
}

function nextStep() {
  const idx = currentStepIndex.value
  if (idx < steps.value.length - 1) {
    currentStep.value = steps.value[idx + 1]
  } else {
    submit()
  }
}

function acquireLocation() {
  if (locating.value) return
  if (!('geolocation' in navigator)) {
    alert('当前浏览器不支持定位')
    return
  }
  locating.value = true
  navigator.geolocation.getCurrentPosition(
    pos => {
      location.value = {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
      }
      distance.value = props.teacherLocation
        ? calcDistanceMeters(pos.coords.latitude, pos.coords.longitude, props.teacherLocation.latitude, props.teacherLocation.longitude)
        : 0
      locating.value = false
    },
    err => {
      locating.value = false
      const msgMap: Record<number, string> = {
        1: '已拒绝定位权限，请在浏览器设置中允许后重试',
        2: '系统定位不可用，请检查网络或 GPS',
        3: '定位超时，请重试',
      }
      alert(msgMap[err.code] || '获取位置失败')
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
  )
}

function calcDistanceMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const rad = Math.PI / 180
  const dLat = (lat2 - lat1) * rad
  const dLng = (lng2 - lng1) * rad
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function submit() {
  if (submitting.value) return
  if (props.requirePhoto && !capturedPhoto.value) {
    currentStep.value = 'photo'
    return
  }
  if (props.requireLocation && !locationOk.value) {
    currentStep.value = 'location'
    return
  }
  submitting.value = true
  isSigned.value = true
  signedTime.value = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  emit('signed', {
    photo: capturedPhoto.value || undefined,
    location: location.value || undefined,
    distance: distance.value ?? undefined,
    verified: true,
  })
  setTimeout(() => emit('close'), 1500)
}

onUnmounted(() => {
  stopCamera()
})
</script>

<style scoped lang="scss">
.popup-enter-active, .popup-leave-active {
  transition: opacity 0.25s ease;
  .signin-card { transition: transform 0.25s ease; }
}
.popup-enter-from, .popup-leave-to {
  opacity: 0;
  .signin-card { transform: scale(0.95) translateY(20px); }
}

.signin-overlay {
  position: fixed;
  inset: 0;
  z-index: 300;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

.signin-card {
  width: 100%;
  max-width: 420px;
  max-height: 92vh;
  overflow-y: auto;
  background: var(--bg-card);
  border-radius: 20px;
  padding: 24px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.18);
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.signin-header {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  .signin-icon { color: var(--primary); :deep(svg) { width: 40px; height: 40px; } }
  h3 { font-size: 20px; font-weight: 700; color: var(--text-primary); }
  .signin-course { font-size: 13px; color: var(--primary); margin: 0; }
  .signin-mode-tag {
    font-size: 11px; color: var(--text-secondary);
    background: var(--bg-page); padding: 3px 10px; border-radius: 10px;
    margin: 0;
  }
}

.signin-body {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.step-indicator {
  display: flex; align-items: center; justify-content: center; gap: 18px;
  padding: 0 8px;
}

.step-dot {
  display: flex; flex-direction: column; align-items: center; gap: 4px; opacity: 0.4;
  .step-num {
    width: 26px; height: 26px; border-radius: 50%; background: var(--bg-page);
    color: var(--text-muted); font-size: 13px; font-weight: 700;
    display: flex; align-items: center; justify-content: center;
    border: 2px solid var(--border); transition: all 0.2s;
  }
  .step-label { font-size: 11px; color: var(--text-muted); }

  &.active {
    opacity: 1;
    .step-num { background: var(--primary); color: #fff; border-color: var(--primary); }
    .step-label { color: var(--primary); font-weight: 600; }
  }
  &.done {
    opacity: 1;
    .step-num { background: var(--success, #52c41a); color: #fff; border-color: var(--success, #52c41a); }
    .step-label { color: var(--success, #52c41a); }
  }
}

.photo-stage, .location-stage, .quick-stage {
  display: flex; flex-direction: column; gap: 12px;
}

.camera-frame {
  position: relative;
  width: 100%;
  aspect-ratio: 1 / 1;
  border-radius: 16px;
  overflow: hidden;
  background: #0f172a;
  display: flex; align-items: center; justify-content: center;
}

.camera-video {
  width: 100%; height: 100%; object-fit: cover;
  transform: scaleX(-1); /* 前置摄像头镜像 */
}

.camera-photo {
  width: 100%; height: 100%; object-fit: cover;
}

.camera-loading {
  color: #fff; text-align: center; padding: 24px;
  .spinner {
    width: 40px; height: 40px; border-radius: 50%;
    border: 3px solid rgba(255,255,255,0.15); border-top-color: #fff;
    animation: spin 0.9s linear infinite;
    margin: 0 auto 12px;
  }
  .cam-error svg { color: #ff7875; margin-bottom: 8px; }
  .cam-error p { font-size: 13px; line-height: 1.5; margin-bottom: 12px; opacity: 0.85; }
  .retry-btn {
    padding: 8px 18px; background: rgba(255,255,255,0.15); color: #fff;
    border: 1px solid rgba(255,255,255,0.3); border-radius: 16px; cursor: pointer;
    font-size: 12px;
  }
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.face-guide {
  position: absolute; inset: 0;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  pointer-events: none;
}

.face-oval {
  width: 56%; aspect-ratio: 3 / 4;
  border: 3px dashed rgba(255,255,255,0.85);
  border-radius: 50%;
  box-shadow: 0 0 0 9999px rgba(0,0,0,0.32);
}

.face-tip {
  position: absolute; bottom: 16px; left: 0; right: 0;
  color: #fff; text-align: center; font-size: 13px; font-weight: 600;
  text-shadow: 0 1px 3px rgba(0,0,0,0.6);
}

.step-actions {
  display: flex; flex-direction: column; gap: 10px;
}

.primary-btn, .secondary-btn, .ghost-btn {
  width: 100%; min-height: 48px; padding: 12px;
  border-radius: 14px; font-size: 15px; font-weight: 600;
  cursor: pointer; transition: all 0.2s;
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  &:disabled { opacity: 0.55; cursor: not-allowed; }
  &:not(:disabled):active { transform: scale(0.98); }
}

.primary-btn {
  background: linear-gradient(135deg, var(--primary), #4096ff);
  color: #fff; border: none;
  &.success { background: linear-gradient(135deg, #52c41a, #73d13d); }
  &.large { min-height: 56px; font-size: 17px; }
}

.secondary-btn {
  background: var(--bg-card); border: 1.5px solid var(--border); color: var(--text-primary);
}

.ghost-btn {
  background: transparent; border: none; color: var(--text-secondary); min-height: 40px;
  font-size: 13px;
  text-decoration: underline;
}

.location-card {
  background: var(--bg-page);
  border: 2px solid var(--border);
  border-radius: 16px;
  padding: 20px 16px;
  text-align: center;
  display: flex; flex-direction: column; align-items: center; gap: 6px;
  transition: all 0.2s;

  .loc-icon { color: var(--primary); }
  .loc-title { font-size: 16px; font-weight: 700; color: var(--text-primary); margin: 4px 0 0; }
  .loc-desc { font-size: 13px; color: var(--text-secondary); line-height: 1.5; margin: 0; }
  .distance {
    margin: 6px 0 0;
    font-size: 13px; color: var(--primary);
    strong { font-size: 18px; font-weight: 700; }
  }

  &.ok {
    border-color: var(--success, #52c41a);
    background: #f6ffed;
    .loc-icon { color: var(--success, #52c41a); }
    .loc-title { color: var(--success, #52c41a); }
    .distance { color: var(--success, #52c41a); }
  }

  &.bad {
    border-color: var(--danger, #ff4d4f);
    background: #fff1f0;
    .loc-icon { color: var(--danger, #ff4d4f); }
    .loc-title { color: var(--danger, #ff4d4f); }
    .distance { color: var(--danger, #ff4d4f); }
  }
}

.quick-hint {
  text-align: center; color: var(--text-secondary); font-size: 13px; margin: 8px 0;
}

.signed-info {
  display: flex; flex-direction: column; align-items: center; gap: 10px;
  padding: 16px 0;
  .signed-time { font-size: 16px; color: var(--text-primary); font-weight: 600; }
}
</style>
