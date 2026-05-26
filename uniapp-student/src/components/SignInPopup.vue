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
          <!-- 仅在权限就绪且 camera 组件可用且未拍照时挂载 <camera> -->
          <camera
            v-if="hasCameraComponent && appCamReady && !photoPath"
            class="camera"
            device-position="front"
            flash="off"
            mode="normal"
            @error="onCameraError"
          />
          <cover-view v-if="hasCameraComponent && appCamReady && !photoPath" class="face-mask">
            <cover-view class="face-oval"></cover-view>
            <cover-view class="mask-tip">请将脸部置于框内，保持正面清晰</cover-view>
          </cover-view>
          <view v-if="!hasCameraComponent && !photoPath" class="camera-fallback">
            <Icon name="user" size="3xl" tone="muted" />
            <text>点击下方按钮调用系统相机拍照</text>
          </view>
          <view v-else-if="!appCamReady && !photoPath" class="camera-fallback">
            <Icon :name="appCamError ? 'alert-circle' : 'user'" size="3xl" :tone="appCamError ? 'warning' : 'muted'" />
            <text>{{ appCamError || '正在申请摄像头权限…' }}</text>
            <Button v-if="appCamError" variant="secondary" size="sm" icon-left="refresh-cw" @tap="initAppCamera">重试授权</Button>
          </view>
          <!-- #endif -->
          <!-- #ifdef H5 -->
          <view v-show="h5CameraReady && !photoPath" class="h5-cam-wrap">
            <view class="h5-video-host" :id="h5VideoHostId" />
            <view class="face-mask-h5">
              <view class="face-oval-h5"></view>
              <text class="mask-tip-h5">请将脸部置于框内，保持正面清晰</text>
            </view>
          </view>
          <view v-if="!h5CameraReady && !photoPath" class="camera-fallback">
            <Icon :name="h5CameraError ? 'alert-circle' : 'user'" size="3xl" :tone="h5CameraError ? 'warning' : 'muted'" />
            <text>{{ h5CameraError || '正在唤起摄像头…' }}</text>
            <Button v-if="h5CameraError" variant="secondary" size="sm" icon-left="refresh-cw" @tap="initH5Camera">重试唤起</Button>
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
          v-if="!photoPath && (h5CameraError || appCamError)"
          variant="ghost"
          size="md"
          block
          icon-left="image"
          @tap="chooseCameraImage"
        >
          直接调用系统相机
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

// App-Plus / 小程序：权限状态。挂载 <camera> 之前必须为 true，
// 否则首次没权限时只看到一块无反馈黑框，用户根本不知道要去系统设置开权限。
const appCamReady = ref(false)
const appCamError = ref('')
const hasCameraComponent = typeof uni.createCameraContext === 'function'

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
  appCamError.value = '摄像头初始化失败，请检查系统设置中的相机权限'
  appCamReady.value = false
  console.warn('[attendance camera] error', err)
}

// #ifdef APP-PLUS || MP-WEIXIN
// 主动申请摄像头权限。<camera> 组件自身不会显式向用户解释为什么需要权限，
// 首次拒绝后会留个无任何提示的黑框；改成先 authorize → 通过再挂 <camera>。
function initAppCamera() {
  if (!hasCameraComponent) return
  appCamError.value = ''
  appCamReady.value = false
  cameraBroken.value = false
  try {
    uni.authorize({
      scope: 'scope.camera',
      success: () => {
        appCamReady.value = true
      },
      fail: () => {
        appCamError.value = '未获得相机权限，请到系统设置 → 应用权限中开启「相机」'
      },
    })
  } catch {
    appCamReady.value = true
  }
}
// #endif

function takePhoto() {
  if (takingPhoto.value) return
  takingPhoto.value = true

  // #ifdef APP-PLUS || MP-WEIXIN
  if (hasCameraComponent && appCamReady.value && !cameraBroken.value) {
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
  // #ifdef APP-PLUS || MP-WEIXIN
  if (props.requirePhoto && step.value === 'photo') {
    initAppCamera()
  }
  // #endif
  // #ifdef H5
  if (props.requirePhoto && step.value === 'photo') {
    setTimeout(() => initH5Camera(), 200)
  }
  // #endif
})

// 切换回拍照步骤、或清空照片重拍时，自动重启摄像头
watch([step, photoPath], ([s, p]) => {
  if (s === 'photo' && !p) {
    // #ifdef APP-PLUS || MP-WEIXIN
    if (!appCamReady.value && !appCamError.value) initAppCamera()
    // #endif
    // #ifdef H5
    if (!h5CameraReady.value) setTimeout(() => initH5Camera(), 100)
    // #endif
  }
  // #ifdef H5
  if (s !== 'photo') stopH5Camera()
  // #endif
})

onUnmounted(() => {
  if (pulseTimer) clearTimeout(pulseTimer)
  // #ifdef H5
  stopH5Camera()
  // #endif
})

// #ifdef H5
// 重试拿到承载 video 的 DOM 节点。uniapp <view :id> 的 id 属性在 H5
// 实际是绑到 <uni-view> 上，首次渲染可能比 onMounted 还慢一拍，
// 所以这里轮询 5 次（每次 80ms）兜底，避免曾经那种「拿不到 host 就静默 return → 永远黑框」。
function waitForHost(maxTries = 5): Promise<HTMLElement | null> {
  return new Promise((resolve) => {
    let tries = 0
    const tick = () => {
      const el = document.getElementById(h5VideoHostId) as HTMLElement | null
      if (el) return resolve(el)
      tries += 1
      if (tries >= maxTries) return resolve(null)
      setTimeout(tick, 80)
    }
    tick()
  })
}

function isInsecureContext(): boolean {
  if (typeof window === 'undefined') return false
  const isHttps = window.location?.protocol === 'https:'
  const host = window.location?.hostname || ''
  const isLocal = host === 'localhost' || host === '127.0.0.1' || host === '::1'
  return !isHttps && !isLocal
}

function initH5Camera() {
  h5CameraError.value = ''
  h5CameraReady.value = false
  const md: any = (typeof navigator !== 'undefined' && (navigator as any).mediaDevices) || null
  if (!md || typeof md.getUserMedia !== 'function') {
    h5CameraError.value = isInsecureContext()
      ? '通过 IP 访问的非 HTTPS 页面无法调用摄像头。请改用 localhost 或开启 HTTPS。'
      : '当前浏览器不支持摄像头（请更换浏览器）'
    return
  }
  md.getUserMedia({
    video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 720 } },
    audio: false,
  }).then(async (stream: any) => {
    h5MediaStream = stream
    const host = await waitForHost()
    if (!host) {
      // 防止 stream 泄漏
      stream.getTracks?.().forEach((t: any) => t.stop && t.stop())
      h5MediaStream = null
      h5CameraError.value = '摄像头预览容器加载失败，请点重试'
      return
    }
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
      h5CameraError.value = isInsecureContext()
        ? '当前为非安全上下文（HTTP+IP）。浏览器只允许在 HTTPS / localhost 调用摄像头。'
        : '已拒绝摄像头权限，请在浏览器地址栏左侧的权限设置中开启相机后点重试'
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
