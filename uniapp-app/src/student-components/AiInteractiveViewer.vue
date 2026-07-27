<template>
  <view class="ai-interactive">
    <view class="head" :style="{ paddingTop: `max(var(--space-5), var(--safe-top))` }">
      <view class="head-left">
        <view class="head-icon-wrap"><Icon name="sparkles" size="md" tone="secondary" /></view>
        <view class="head-text">
          <text class="title">{{ payload.title || 'AI 实践场景' }}</text>
          <text v-if="payload.description" class="desc">{{ payload.description }}</text>
        </view>
      </view>
      <view class="head-actions">
        <Button
          v-if="showForceExit"
          variant="danger"
          size="sm"
          icon-left="alert-circle"
          aria-label="强制返回课堂"
          @tap="onForceExit"
        >
          强制返回
        </Button>
        <Button
          variant="secondary"
          size="sm"
          icon-left="x"
          aria-label="关闭 AI 实践"
          @tap="emit('close')"
        >
          关闭
        </Button>
      </view>
    </view>

    <!-- App-Plus / H5 渲染 web-view；微信小程序兜底 -->
    <!-- #ifdef APP-PLUS || H5 -->
    <view class="webview-wrap">
      <web-view
        v-if="srcUrl"
        :src="srcUrl"
        class="webview"
      />
      <view v-if="loadingState === 'preparing'" class="loading-overlay">
        <view class="loading-spinner"></view>
        <text class="loading-text">正在准备 AI 实践内容…</text>
        <text class="loading-sub">{{ prepareNote }}</text>
      </view>
      <view v-if="loadingState === 'failed'" class="loading-overlay error">
        <view class="fallback-icon error-icon"><Icon name="alert-circle" size="2xl" tone="danger" /></view>
        <text class="loading-text">AI 实践内容加载失败</text>
        <text class="loading-sub">{{ failReason || '请点击右上角"关闭"返回课堂' }}</text>
      </view>
      <view v-if="showSlowHint" class="slow-hint">
        <Icon name="info" size="sm" tone="warning" />
        <text>加载较慢？点击右上角"强制返回"可立即退出</text>
      </view>
    </view>
    <!-- #endif -->

    <!-- #ifdef MP-WEIXIN -->
    <view class="mp-fallback">
      <view class="fallback-icon"><Icon name="alert-circle" size="2xl" tone="warning" /></view>
      <text class="fallback-title">当前端不支持 HTML 沙盘渲染</text>
      <text class="fallback-desc">请使用 App 端或 H5 端访问完整 AI 实践场景</text>
    </view>
    <!-- #endif -->
  </view>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import Icon from '@/student-components/ui/Icon.vue'
import Button from '@/student-components/ui/Button.vue'

const props = defineProps<{
  payload: {
    title?: string
    description?: string
    html?: string
  }
}>()

const emit = defineEmits<{ close: [] }>()

/**
 * 加载状态机：
 * - 'init': 还没开始处理 payload
 * - 'preparing': 正在写文件或编码 base64
 * - 'loaded': srcUrl 已就绪，web-view 已渲染
 * - 'failed': 准备过程出错，显示错误界面
 */
const srcUrl = ref('')
const loadingState = ref<'init' | 'preparing' | 'loaded' | 'failed'>('init')
const prepareNote = ref('')
const failReason = ref('')

/** Soft watchdog：超过 4s 显示「加载较慢」提示，超过 5s 把"强制返回"按钮露出来 */
const showSlowHint = ref(false)
const showForceExit = ref(false)
let slowHintTimer: ReturnType<typeof setTimeout> | null = null
let forceExitTimer: ReturnType<typeof setTimeout> | null = null

/** 临时文件路径（仅 App-Plus 在大 HTML 时使用），unmount 时清理 */
let tempFileEntry: any = null

function buildDataUrl(html: string): string {
  try {
    const b64 = btoa(unescape(encodeURIComponent(html)))
    return `data:text/html;base64,${b64}`
  } catch (err) {
    console.warn('[AiInteractiveViewer] buildDataUrl failed', err)
    return ''
  }
}

// #ifdef APP-PLUS
/**
 * App-Plus 的 web-view 不能正确解析 `data:text/html;base64,...` URL：
 * 真机日志里它会把 data URL 当成"相对路径"，前缀 file:///...HBuilder/www/ → 加载失败。
 * 所以 App-Plus 必须 **始终** 把 HTML 写到 plus.io 的本地临时文件、然后 web-view 加载 file:// URL。
 * 大小阈值无关 —— data URL 在 App-Plus 上根本不工作。
 */
function writeTempHtml(html: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const plusObj: any = (globalThis as any).plus
    if (!plusObj?.io) {
      reject(new Error('plus.io 不可用'))
      return
    }
    plusObj.io.requestFileSystem(
      plusObj.io.PRIVATE_DOC,
      (fs: any) => {
        const fileName = `ai-interactive-${Date.now()}.html`
        fs.root.getFile(
          fileName,
          { create: true, exclusive: false },
          (entry: any) => {
            entry.createWriter(
              (writer: any) => {
                writer.onwriteend = () => {
                  tempFileEntry = entry
                  resolve(entry.toLocalURL())
                }
                writer.onerror = (e: any) => reject(e?.message || e || new Error('write failed'))
                writer.write(html)
              },
              (e: any) => reject(e?.message || e || new Error('createWriter failed')),
            )
          },
          (e: any) => reject(e?.message || e || new Error('getFile failed')),
        )
      },
      (e: any) => reject(e?.message || e || new Error('requestFileSystem failed')),
    )
  })
}

function cleanupTempHtml() {
  if (!tempFileEntry) return
  try {
    tempFileEntry.remove(() => {}, () => {})
  } catch { /* ignore */ }
  tempFileEntry = null
}
// #endif

async function prepareSrc(html: string) {
  loadingState.value = 'preparing'
  prepareNote.value = ''
  failReason.value = ''
  srcUrl.value = ''
  armWatchdogs()

  const sizeKB = Math.round(html.length / 1024)

  // #ifdef APP-PLUS
  prepareNote.value = `正在写入本地缓存（${sizeKB}KB）…`
  try {
    const fileUrl = await writeTempHtml(html)
    srcUrl.value = fileUrl
    loadingState.value = 'loaded'
    return
  } catch (err: any) {
    console.error('[AiInteractiveViewer] writeTempHtml failed', err)
    failReason.value = '本地缓存写入失败：' + (err?.message || String(err))
    loadingState.value = 'failed'
    return
  }
  // #endif

  // #ifdef H5
  prepareNote.value = `内容大小 ${sizeKB}KB，正在编码…`
  const dataUrl = buildDataUrl(html)
  if (!dataUrl) {
    failReason.value = '内容编码失败'
    loadingState.value = 'failed'
    return
  }
  srcUrl.value = dataUrl
  loadingState.value = 'loaded'
  // #endif
}

function armWatchdogs() {
  clearWatchdogs()
  showSlowHint.value = false
  showForceExit.value = false
  slowHintTimer = setTimeout(() => { showSlowHint.value = true }, 4000)
  forceExitTimer = setTimeout(() => { showForceExit.value = true }, 5000)
}

function clearWatchdogs() {
  if (slowHintTimer) { clearTimeout(slowHintTimer); slowHintTimer = null }
  if (forceExitTimer) { clearTimeout(forceExitTimer); forceExitTimer = null }
}

function onForceExit() {
  emit('close')
}

watch(
  () => props.payload?.html,
  (html) => {
    if (typeof html === 'string' && html.length > 0) {
      prepareSrc(html)
    } else {
      loadingState.value = 'failed'
      failReason.value = 'AI 实践内容为空'
    }
  },
  { immediate: true },
)

onMounted(() => {
  // 兜底：5s 内如果还卡在 preparing，就露出强制返回（armWatchdogs 已设；此处仅做安全网）
  if (loadingState.value === 'preparing') armWatchdogs()
})

onUnmounted(() => {
  clearWatchdogs()
  // #ifdef APP-PLUS
  cleanupTempHtml()
  // #endif
})
</script>

<style lang="scss" scoped>
@import '@/styles/variables.scss';

.ai-interactive {
  position: fixed;
  inset: 0;
  z-index: 600;
  background: var(--color-surface);
  display: flex;
  flex-direction: column;
}

.head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-5) var(--space-6);
  padding-left: max(var(--space-6), var(--safe-left));
  padding-right: max(var(--space-6), var(--safe-right));
  border-bottom: 2rpx solid var(--color-outline-variant);
  background: var(--color-surface);
  gap: var(--space-3);
}

.head-left {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.head-actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-shrink: 0;
}

.head-icon-wrap {
  width: 72rpx;
  height: 72rpx;
  border-radius: var(--radius-md);
  background: var(--color-secondary-container);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.head-text {
  display: flex;
  flex-direction: column;
  gap: 2rpx;
  min-width: 0;
}

.title {
  font-size: var(--font-title-sm);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.desc {
  font-size: var(--font-caption);
  color: var(--color-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.webview-wrap {
  flex: 1;
  position: relative;
  width: 100%;
  min-height: 0;
}

.webview {
  flex: 1;
  width: 100%;
  height: 100%;
}

.loading-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-4);
  background: var(--color-surface);
  padding: var(--space-6);
  z-index: 1;

  &.error {
    background: var(--color-error-container, #ffeaea);
  }
}

.loading-spinner {
  width: 96rpx;
  height: 96rpx;
  border: 8rpx solid var(--color-outline-variant);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-text {
  font-size: var(--font-body);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
}

.loading-sub {
  font-size: var(--font-caption);
  color: var(--color-text-secondary);
  text-align: center;
  max-width: 480rpx;
}

.slow-hint {
  position: absolute;
  bottom: var(--space-4);
  left: 50%;
  transform: translateX(-50%);
  background: rgba(245, 166, 35, 0.94);
  color: #fff;
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--font-caption);
  box-shadow: var(--shadow-2);
  z-index: 2;
}

.mp-fallback {
  flex: 1;
  padding: var(--space-9) var(--space-7);
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-4);
  color: var(--color-text-secondary);
}

.fallback-icon {
  width: 144rpx;
  height: 144rpx;
  border-radius: var(--radius-full);
  background: var(--color-warning-container);
  display: flex;
  align-items: center;
  justify-content: center;
}

.fallback-title {
  font-size: var(--font-title-sm);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
}

.fallback-desc {
  font-size: var(--font-body);
  color: var(--color-text-secondary);
  max-width: 480rpx;
}
</style>
