<template>
  <view class="signin-overlay">
    <view class="scrim"></view>
    <view class="card" :class="{ pulse: pulsing }">
      <view class="head">
        <view class="icon-wrap"><Icon :name="modeIcon" size="2xl" tone="success" /></view>
        <text class="title">课堂签到</text>
        <text class="sub">{{ modeLabel }}</text>
      </view>

      <view v-if="step === 'photo'" class="photo-stage">
        <view class="camera-box">
          <!-- #ifdef APP-PLUS || MP-WEIXIN -->
          <camera
            class="camera"
            device-position="front"
            flash="off"
            mode="normal"
            @error="onCameraError"
          />
          <cover-view class="face-mask">
            <cover-view class="face-oval"></cover-view>
            <cover-view class="mask-tip">请将脸部置于框内，保持正面清晰</cover-view>
          </cover-view>
          <!-- #endif -->
          <!-- #ifdef H5 -->
          <view v-show="h5CameraReady && !photoPath" class="h5-cam-wrap">
            <!-- 用原生 video 元素直接拉摄像头流，避免 uniapp camera 在 H5 不可用 -->
            <view class="h5-video-host" :id="h5VideoHostId" />
            <view class="face-mask-h5">
              <view class="face-oval-h5"></view>
              <text class="mask-tip-h5">请将脸部置于框内，保持正面清晰</text>
            </view>
          </view>
          <view v-if="!h5CameraReady && !photoPath" class="camera-fallback">
            <Icon v-if="!h5CameraError" name="user" size="3xl" tone="muted" />
            <Icon v-else name="alert-circle" size="3xl" tone="warning" />
            <text>{{ h5CameraError || '正在唤起摄像头…' }}</text>
          </view>
          <!-- #endif -->
          <!-- #ifndef APP-PLUS || MP-WEIXIN || H5 -->
          <view class="camera-fallback">
            <Icon name="user" size="3xl" tone="muted" />
            <text>点击下方按钮调用摄像头</text>
          </view>
          <!-- #endif -->
          <image v-if="photoPath" class="photo-preview" :src="photoPath" mode="aspectFill" />
        </view>
        <Button
          variant="primary"
          size="lg"
          block
          icon-left="user"
          :loading="takingPhoto"
          @tap="takePhoto"
        >
          {{ photoPath ? '重新拍摄' : '拍摄正面照' }}
        </Button>
        <Button
          v-if="photoPath && requireLocation"
          variant="success"
          size="lg"
          block
          icon-right="arrow-right"
          @tap="step = 'location'"
        >
          下一步：定位校验
        </Button>
        <Button
          v-else-if="photoPath && !requireLocation"
          variant="success"
          size="lg"
          block
          icon-left="check"
          @tap="submit"
        >
          完成签到
        </Button>
      </view>

      <view v-else class="location-stage">
        <view class="location-card" :class="{ ok: locationOk, bad: distance !== null && !locationOk }">
          <Icon :name="locationOk ? 'check-circle' : 'radio-tower'" size="2xl" :tone="locationOk ? 'success' : 'primary'" />
          <text class="loc-title">{{ locationTitle }}</text>
          <text class="loc-desc">{{ locationDesc }}</text>
          <text v-if="distance !== null" class="distance">距离教师约 {{ Math.round(distance) }} 米</text>
        </view>
        <Button
          variant="primary"
          size="lg"
          block
          icon-left="radio-tower"
          :loading="locating"
          @tap="getLocation"
        >
          获取当前位置
        </Button>
        <Button
          variant="success"
          size="lg"
          block
          icon-left="check"
          :disabled="!canSubmit"
          @tap="submit"
        >
          完成签到
        </Button>
        <Button variant="ghost" size="md" block @tap="step = 'photo'">返回拍照</Button>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, watch } from 'vue'
import Icon from '@/components/ui/Icon.vue'
import Button from '@/components/ui/Button.vue'
import type { IconName } from '@/icons'

const props = withDefaults(defineProps<{
  mode: string
  radius?: number
  teacherLocation?: { latitude: number; longitude: number }
  requirePhoto?: boolean
  requireLocation?: boolean
}>(), {
  radius: 50,
  requirePhoto: true,
  requireLocation: true,
})

const emit = defineEmits<{
  sign: [payload: {
    photo?: string
    location?: { latitude: number; longitude: number; accuracy?: number }
    distance?: number
    verified: boolean
  }]
  close: []
}>()

const pulsing = ref(true)
const step = ref<'photo' | 'location'>(props.requirePhoto ? 'photo' : 'location')
const photoPath = ref('')
const takingPhoto = ref(false)
const locating = ref(false)
const location = ref<{ latitude: number; longitude: number; accuracy?: number } | null>(null)
const distance = ref<number | null>(null)
const cameraBroken = ref(false)
let pulseTimer: ReturnType<typeof setTimeout> | null = null

// H5 模式专用：用 getUserMedia 拉前置摄像头实时画面
const h5VideoHostId = `signin-h5-cam-${Math.random().toString(36).slice(2, 8)}`
const h5CameraReady = ref(false)
const h5CameraError = ref('')
let h5MediaStream: any = null
let h5VideoEl: any = null

const modeIcon = computed<IconName>(() => 'user')

const modeLabel = computed(() => {
  return `请完成正面照采集，并在教师 ${props.radius} 米范围内打卡`
})

const locationOk = computed(() => {
  if (!props.requireLocation) return true
  if (!props.teacherLocation) return !!location.value
  return distance.value !== null && distance.value <= props.radius
})

const canSubmit = computed(() => {
  const photoOk = !props.requirePhoto || !!photoPath.value
  return photoOk && locationOk.value
})

const locationTitle = computed(() => {
  if (!location.value) return '需要获取定位'
  if (locationOk.value) return '定位校验通过'
  return '超出签到范围'
})

const locationDesc = computed(() => {
  if (!location.value) return `请允许定位权限，系统将校验是否在 ${props.radius} 米范围内。`
  if (!props.teacherLocation) return '已获取当前位置，教师端未提供基准点。'
  if (locationOk.value) return '你在允许签到范围内，可以完成签到。'
  return `请回到教师附近 ${props.radius} 米内再签到。`
})

function onCameraError(err: any) {
  cameraBroken.value = true
  console.warn('[attendance camera] error', err)
}

function takePhoto() {
  if (takingPhoto.value) return
  takingPhoto.value = true

  // #ifdef APP-PLUS || MP-WEIXIN
  if (!cameraBroken.value) {
    const ctx = uni.createCameraContext()
    ctx.takePhoto({
      quality: 'normal',
      success: (res) => { photoPath.value = res.tempImagePath },
      fail: () => chooseCameraImage(),
      complete: () => { takingPhoto.value = false },
    })
    return
  }
  // #endif

  // #ifdef H5
  if (h5CameraReady.value && h5VideoEl) {
    captureH5Frame()
    takingPhoto.value = false
    return
  }
  // #endif

  chooseCameraImage()
}

function chooseCameraImage() {
  uni.chooseImage({
    count: 1,
    sourceType: ['camera'],
    sizeType: ['compressed'],
    success: (res) => {
      photoPath.value = Array.isArray(res.tempFilePaths) ? res.tempFilePaths[0] : String(res.tempFilePaths || '')
    },
    fail: () => uni.showToast({ title: '拍照失败，请检查相机权限', icon: 'none' }),
    complete: () => { takingPhoto.value = false },
  })
}

function getLocation() {
  if (locating.value) return
  locating.value = true
  uni.getLocation({
    type: 'gcj02',
    isHighAccuracy: true,
    success: (res) => {
      location.value = {
        latitude: res.latitude,
        longitude: res.longitude,
        accuracy: (res as any).accuracy,
      }
      distance.value = props.teacherLocation
        ? calcDistanceMeters(res.latitude, res.longitude, props.teacherLocation.latitude, props.teacherLocation.longitude)
        : 0
      if (!locationOk.value) {
        uni.showToast({ title: `距离超过 ${props.radius} 米`, icon: 'none' })
      }
    },
    fail: () => {
      uni.showToast({ title: '定位失败，请开启定位权限', icon: 'none' })
    },
    complete: () => { locating.value = false },
  })
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
  if (!canSubmit.value) return
  pulsing.value = false
  emit('sign', {
    photo: photoPath.value,
    location: location.value || undefined,
    distance: distance.value ?? undefined,
    verified: true,
  })
}

onMounted(() => {
  pulseTimer = setTimeout(() => { pulsing.value = false }, 2400)
  // #ifdef H5
  if (props.requirePhoto && step.value === 'photo') {
    // 略等 DOM 挂好再初始化 video host
    setTimeout(() => initH5Camera(), 60)
  }
  // #endif
})

// 切换回拍照步骤、或清空照片重拍时，自动重启摄像头
// #ifdef H5
watch([step, photoPath], ([s, p]) => {
  if (s === 'photo' && !p && !h5CameraReady.value) {
    setTimeout(() => initH5Camera(), 60)
  }
  if (s !== 'photo') stopH5Camera()
})
// #endif

onUnmounted(() => {
  if (pulseTimer) clearTimeout(pulseTimer)
  // #ifdef H5
  stopH5Camera()
  // #endif
})

// #ifdef H5
function initH5Camera() {
  h5CameraError.value = ''
  h5CameraReady.value = false
  const md: any = (typeof navigator !== 'undefined' && (navigator as any).mediaDevices) || null
  if (!md || typeof md.getUserMedia !== 'function') {
    h5CameraError.value = '当前浏览器不支持摄像头（请使用 HTTPS 访问或更换浏览器）'
    return
  }
  md.getUserMedia({
    video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 720 } },
    audio: false,
  }).then((stream: any) => {
    h5MediaStream = stream
    // 在 host 容器里手动插入 video（避免 uniapp 模板里 video 与 video 标签冲突）
    const host = document.getElementById(h5VideoHostId) as HTMLElement | null
    if (!host) return
    host.innerHTML = ''
    const v = document.createElement('video')
    v.autoplay = true
    v.playsInline = true
    v.muted = true
    v.style.width = '100%'
    v.style.height = '100%'
    v.style.objectFit = 'cover'
    v.style.transform = 'scaleX(-1)' // 前置镜像
    v.srcObject = stream
    host.appendChild(v)
    h5VideoEl = v
    v.onloadedmetadata = () => { h5CameraReady.value = true }
  }).catch((err: any) => {
    const name = err?.name
    if (name === 'NotAllowedError') {
      h5CameraError.value = '已拒绝摄像头权限，请在浏览器允许后重试'
    } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
      h5CameraError.value = '未找到可用摄像头'
    } else if (name === 'NotReadableError') {
      h5CameraError.value = '摄像头被其他应用占用'
    } else {
      h5CameraError.value = err?.message || '无法访问摄像头'
    }
  })
}

function stopH5Camera() {
  if (h5MediaStream && typeof h5MediaStream.getTracks === 'function') {
    h5MediaStream.getTracks().forEach((t: any) => t.stop && t.stop())
  }
  h5MediaStream = null
  if (h5VideoEl) {
    try { h5VideoEl.pause(); h5VideoEl.srcObject = null } catch { /* ignore */ }
  }
  h5VideoEl = null
  const host = document.getElementById(h5VideoHostId)
  if (host) host.innerHTML = ''
  h5CameraReady.value = false
}

function captureH5Frame() {
  if (!h5VideoEl) return
  const v = h5VideoEl as HTMLVideoElement
  const canvas = document.createElement('canvas')
  const size = Math.min(v.videoWidth, v.videoHeight) || 480
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const sx = (v.videoWidth - size) / 2
  const sy = (v.videoHeight - size) / 2
  ctx.translate(size, 0)
  ctx.scale(-1, 1)
  ctx.drawImage(v, sx, sy, size, size, 0, 0, size, size)
  photoPath.value = canvas.toDataURL('image/jpeg', 0.8)
  stopH5Camera()
}
// #endif
</script>

<style lang="scss" scoped>
@import '@/styles/variables.scss';

.signin-overlay {
  position: fixed;
  inset: 0;
  z-index: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-5);
  box-sizing: border-box;
  animation: fade-in var(--duration-base) var(--ease-decelerate);
}

.scrim {
  position: absolute;
  inset: 0;
  background: var(--color-scrim);
}

.card {
  position: relative;
  z-index: 1;
  width: min(700rpx, 92vw);
  max-height: 92vh;
  overflow-y: auto;
  background: var(--color-surface-raised);
  padding: var(--space-5);
  border-radius: var(--radius-2xl);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  box-shadow: var(--elevation-4);
  animation: surface-rise var(--duration-med) var(--ease-emphasized);
}

.head {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  text-align: center;
}

.icon-wrap {
  width: 112rpx;
  height: 112rpx;
  border-radius: var(--radius-full);
  background: var(--color-success-container);
  display: flex;
  align-items: center;
  justify-content: center;
}

.card.pulse .icon-wrap { animation: pulse 1600ms ease-in-out infinite; }

.title {
  font-size: var(--font-title-lg);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
}

.sub {
  font-size: var(--font-label);
  color: var(--color-text-secondary);
  line-height: var(--line-height-normal);
}

.photo-stage,
.location-stage {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.camera-box {
  position: relative;
  height: 520rpx;
  border-radius: var(--radius-xl);
  overflow: hidden;
  background: #111827;
}

.camera,
.photo-preview,
.camera-fallback {
  width: 100%;
  height: 100%;
}

.photo-preview {
  position: absolute;
  inset: 0;
}

.camera-fallback {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  color: #fff;
  text-align: center;
  padding: var(--space-4);
}

.h5-cam-wrap {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.h5-video-host {
  width: 100%;
  height: 100%;
}

.face-mask-h5 {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.face-oval-h5 {
  width: 320rpx;
  height: 420rpx;
  border: 6rpx solid rgba(255, 255, 255, 0.92);
  border-radius: 50%;
  box-shadow: 0 0 0 999rpx rgba(0, 0, 0, 0.34);
}

.mask-tip-h5 {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 32rpx;
  color: #fff;
  font-size: 28rpx;
  text-align: center;
  font-weight: 600;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.6);
}

.face-mask {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.28);
}

.face-oval {
  width: 320rpx;
  height: 420rpx;
  border: 6rpx solid rgba(255, 255, 255, 0.92);
  border-radius: 50%;
  box-shadow: 0 0 0 999rpx rgba(0, 0, 0, 0.34);
}

.mask-tip {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 32rpx;
  color: #fff;
  font-size: 28rpx;
  text-align: center;
  font-weight: 600;
}

.location-card {
  min-height: 260rpx;
  padding: var(--space-5);
  border: 2rpx solid var(--color-outline);
  border-radius: var(--radius-xl);
  background: var(--color-surface-variant);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  text-align: center;
}

.location-card.ok {
  border-color: var(--color-success);
  background: var(--color-success-container);
}

.location-card.bad {
  border-color: var(--color-danger);
  background: var(--color-danger-container);
}

.loc-title,
.loc-desc,
.distance {
  display: block;
}

.loc-title {
  font-size: var(--font-title-sm);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
}

.loc-desc {
  color: var(--color-text-secondary);
  font-size: var(--font-label);
}

.distance {
  color: var(--color-primary);
  font-size: var(--font-body);
  font-weight: var(--font-weight-bold);
}

@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes surface-rise {
  from { opacity: 0; transform: translateY(16rpx) scale(0.96); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

@keyframes pulse {
  0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(32, 165, 70, 0.35); }
  50% { transform: scale(1.05); box-shadow: 0 0 0 16rpx rgba(32, 165, 70, 0); }
}
</style>
