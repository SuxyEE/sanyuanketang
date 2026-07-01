<template>
  <view v-if="visible && wall" class="wall-overlay">
    <view class="wall-scrim"></view>
    <view class="wall-card">
      <view class="wall-head">
        <view class="wall-head-left">
          <Tag tone="primary" size="sm">答案上墙</Tag>
          <text v-if="itemCount > 0" class="wall-count">已有 {{ itemCount }} 条</text>
        </view>
        <IconButton icon="x" size="sm" aria-label="收起" @tap="dismiss" />
      </view>

      <text class="wall-prompt">{{ wall.prompt || '请提交你的答案' }}</text>

      <!-- ===== 提交区 ===== -->
      <view v-if="!submitted" class="wall-form">
        <textarea
          v-model="text"
          class="wall-textarea"
          placeholder="输入你的答案，提交后展示到大屏…"
          :maxlength="500"
          :auto-height="true"
          :adjust-position="true"
        />

        <view v-if="wall.allowImage" class="wall-image">
          <image v-if="image" :src="image" mode="widthFix" class="wall-image-preview" />
          <view class="wall-image-actions">
            <Button variant="secondary" size="sm" icon-left="image" :loading="imageLoading" @tap="pickImage">
              {{ image ? '重新选择' : '添加图片' }}
            </Button>
            <Button v-if="image" variant="ghost" size="sm" icon-left="x" @tap="clearImage">移除</Button>
          </view>
        </view>
      </view>

      <!-- ===== 已提交 ===== -->
      <view v-else class="wall-done">
        <Icon name="check-circle" size="lg" tone="success" />
        <text class="wall-done-text">已提交，感谢参与！</text>
        <text class="wall-done-sub">你的答案将展示在课堂大屏上</text>
      </view>

      <!-- ===== 底部 ===== -->
      <view class="wall-foot">
        <Button
          v-if="!submitted"
          variant="primary"
          size="md"
          block
          icon-left="send"
          :disabled="!canSubmit"
          :loading="submitting"
          @tap="submit"
        >
          {{ submitting ? '提交中' : '提交上墙' }}
        </Button>
        <Button v-else variant="secondary" size="md" block icon-left="refresh-cw" @tap="again">
          再提交一条
        </Button>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useSocket } from '@/sockets/useSocket'
import { RoomEvent } from '@/shared/wsEvents'
import Icon from '@/components/ui/Icon.vue'
import Button from '@/components/ui/Button.vue'
import IconButton from '@/components/ui/IconButton.vue'
import Tag from '@/components/ui/Tag.vue'

const { getSocket } = useSocket()

interface WallDef {
  wallId: string
  prompt: string
  allowImage: boolean
}

const visible = ref(false)
const wall = ref<WallDef | null>(null)
const text = ref('')
const image = ref('')
const imageLoading = ref(false)
const submitting = ref(false)
const submitted = ref(false)
const itemCount = ref(0)

const canSubmit = computed(() => {
  if (!wall.value || submitting.value) return false
  return text.value.trim().length > 0 || image.value.length > 0
})

/* ============ 图片选择 → base64 ============ */
function pickImage() {
  if (!wall.value?.allowImage || imageLoading.value) return
  uni.chooseImage({
    count: 1,
    sizeType: ['compressed'],
    success: (res) => {
      const path = Array.isArray(res.tempFilePaths) ? res.tempFilePaths[0] : String(res.tempFilePaths || '')
      if (!path) return
      imageLoading.value = true
      toBase64(path)
        .then((b64) => { image.value = b64 })
        .catch(() => uni.showToast({ title: '图片处理失败', icon: 'none' }))
        .finally(() => { imageLoading.value = false })
    },
    fail: () => {},
  })
}

function clearImage() {
  image.value = ''
}

function toBase64(path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    // #ifdef H5
    const xhr = new XMLHttpRequest()
    xhr.open('GET', path, true)
    xhr.responseType = 'blob'
    xhr.onload = () => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(String(reader.result || ''))
      reader.onerror = () => reject(new Error('read fail'))
      reader.readAsDataURL(xhr.response)
    }
    xhr.onerror = () => reject(new Error('xhr fail'))
    xhr.send()
    // #endif
    // #ifndef H5
    ;(uni as any).getFileSystemManager().readFile({
      filePath: path,
      encoding: 'base64',
      success: (r: any) => resolve(`data:image/jpeg;base64,${r.data}`),
      fail: () => reject(new Error('fs fail')),
    })
    // #endif
  })
}

/* ============ 提交 ============ */
function submit() {
  const w = wall.value
  if (!w || !canSubmit.value) return
  submitting.value = true
  getSocket()?.emit(RoomEvent.WallSubmit, {
    wallId: w.wallId,
    text: text.value.trim() || undefined,
    image: w.allowImage && image.value ? image.value : undefined,
  })
  // 后端无独立 submit ack（提交后广播 wall:item），此处乐观确认，避免卡 loading
  setTimeout(() => {
    if (!submitting.value) return
    submitting.value = false
    submitted.value = true
    uni.showToast({ title: '提交成功', icon: 'success' })
  }, 300)
}

function again() {
  submitted.value = false
  text.value = ''
  image.value = ''
}

/* ============ socket 事件 ============ */
function onWallOpen(data: any) {
  if (!data?.wallId) return
  wall.value = {
    wallId: String(data.wallId),
    prompt: String(data.prompt || ''),
    allowImage: data.allowImage === true,
  }
  text.value = ''
  image.value = ''
  submitting.value = false
  submitted.value = false
  itemCount.value = 0
  visible.value = true
}

function onWallItem(data: any) {
  if (!wall.value || (data?.wallId && data.wallId !== wall.value.wallId)) return
  itemCount.value += 1
}

function onWallClose(data: any) {
  if (data?.wallId && wall.value && data.wallId !== wall.value.wallId) return
  close()
}

function onRoomJoined(data: any) {
  const aw = data?.activeWall
  if (!aw?.wallId) return
  wall.value = {
    wallId: String(aw.wallId),
    prompt: String(aw.prompt || ''),
    allowImage: aw.allowImage === true,
  }
  itemCount.value = Array.isArray(aw.items) ? aw.items.length : 0
  submitting.value = false
  submitted.value = false
  visible.value = true
}

function dismiss() {
  visible.value = false
}

function close() {
  visible.value = false
  wall.value = null
  text.value = ''
  image.value = ''
  submitting.value = false
  submitted.value = false
  itemCount.value = 0
}

// socket 单例由父页面 onMounted 才建立；本组件常驻挂载会早于父，故重试绑定（与 PollPanel 一致）
let retryTimer: ReturnType<typeof setInterval> | null = null
function bindSocket() {
  const s = getSocket()
  if (!s) return false
  s.on(RoomEvent.WallOpen, onWallOpen)
  s.on(RoomEvent.WallItem, onWallItem)
  s.on(RoomEvent.WallClose, onWallClose)
  s.on(RoomEvent.Joined, onRoomJoined)
  return true
}

onMounted(() => {
  if (bindSocket()) return
  let tries = 0
  retryTimer = setInterval(() => {
    if (bindSocket() || ++tries > 30) {
      if (retryTimer) { clearInterval(retryTimer); retryTimer = null }
    }
  }, 100)
})

onUnmounted(() => {
  if (retryTimer) { clearInterval(retryTimer); retryTimer = null }
  const s = getSocket()
  s?.off(RoomEvent.WallOpen, onWallOpen)
  s?.off(RoomEvent.WallItem, onWallItem)
  s?.off(RoomEvent.WallClose, onWallClose)
  s?.off(RoomEvent.Joined, onRoomJoined)
})
</script>

<style lang="scss" scoped>
@import '@/styles/variables.scss';

.wall-overlay {
  position: fixed;
  inset: 0;
  z-index: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-5);
  box-sizing: border-box;
}

.wall-scrim {
  position: absolute;
  inset: 0;
  background: var(--color-scrim);
  animation: wall-fade var(--duration-base) var(--ease-decelerate);
}

.wall-card {
  position: relative;
  z-index: 1;
  width: min(760rpx, 94vw);
  max-height: 90vh;
  overflow-y: auto;
  background: var(--color-surface-raised);
  border-radius: var(--radius-2xl);
  padding: var(--space-6);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  box-shadow: var(--elevation-4);
  animation: wall-rise var(--duration-med) var(--ease-emphasized);
}

.wall-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.wall-head-left {
  display: inline-flex;
  align-items: center;
  gap: var(--space-3);
}

.wall-count {
  font-size: var(--font-caption);
  color: var(--color-text-tertiary);
  font-variant-numeric: tabular-nums;
}

.wall-prompt {
  font-size: var(--font-title-sm);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
  line-height: var(--line-height-normal);
}

.wall-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.wall-textarea {
  width: 100%;
  min-height: 200rpx;
  padding: var(--space-4);
  background: var(--color-surface-variant);
  border: 2rpx solid var(--color-outline);
  border-radius: var(--radius-lg);
  font-size: var(--font-body);
  line-height: var(--line-height-normal);
  color: var(--color-text-primary);
  box-sizing: border-box;
}

.wall-image {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.wall-image-preview {
  width: 100%;
  border-radius: var(--radius-lg);
  background: var(--color-surface-variant);
}

.wall-image-actions {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.wall-done {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-6) 0;
  text-align: center;
}

.wall-done-text {
  font-size: var(--font-title-sm);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
}

.wall-done-sub {
  font-size: var(--font-caption);
  color: var(--color-text-tertiary);
}

.wall-foot {
  margin-top: var(--space-2);
}

@keyframes wall-fade {
  from { opacity: 0; }
  to   { opacity: 1; }
}

@keyframes wall-rise {
  from { opacity: 0; transform: translateY(20rpx) scale(0.96); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
</style>
