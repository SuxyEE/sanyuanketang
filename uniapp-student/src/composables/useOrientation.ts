/**
 * 横竖屏检测 composable。
 *
 * 用法：
 *   const { isLandscape, screenW, screenH } = useOrientation()
 *   computed(() => isLandscape.value ? '横屏布局' : '竖屏布局')
 *
 * 同时在 App.vue 启动时调一次 hintIfPortrait()，竖屏时弹一次软提示。
 */

import { ref, computed, onMounted, onUnmounted } from 'vue'

const screenW = ref(0)
const screenH = ref(0)
let inited = false
let resizeHandler: ((res: any) => void) | null = null

function readSize() {
  try {
    const info = uni.getSystemInfoSync()
    screenW.value = info.windowWidth || info.screenWidth || 0
    screenH.value = info.windowHeight || info.screenHeight || 0
  } catch { /* ignore */ }
}

function initOnce() {
  if (inited) return
  inited = true
  readSize()
  // App 与 H5 都支持 onWindowResize
  resizeHandler = (res: any) => {
    screenW.value = res.size?.windowWidth || screenW.value
    screenH.value = res.size?.windowHeight || screenH.value
  }
  // #ifdef APP-PLUS || H5
  uni.onWindowResize?.(resizeHandler!)
  // #endif
}

export function useOrientation() {
  initOnce()
  if (screenW.value === 0) readSize() // 兜底

  const isLandscape = computed(() => screenW.value >= screenH.value)
  const isPortrait = computed(() => !isLandscape.value)
  /** 是否窄屏（< 768 逻辑像素），用于折叠侧栏 */
  const isNarrow = computed(() => Math.min(screenW.value, screenH.value) < 768)

  // 不主动 offWindowResize，让 listener 与 app 生命周期一致

  return {
    screenW,
    screenH,
    isLandscape,
    isPortrait,
    isNarrow,
  }
}

let hintedOnce = false
/**
 * 启动时调用一次：若当前是竖屏，弹 toast 引导用户横屏。
 * - 同一进程仅弹一次
 * - kiosk 强控制模式下用户也旋转不了，但开发调试 / H5 端有用
 */
export function hintIfPortrait() {
  if (hintedOnce) return
  initOnce()
  if (screenW.value === 0) readSize()
  if (screenW.value < screenH.value) {
    hintedOnce = true
    uni.showToast({
      title: '建议横屏使用，体验更佳',
      icon: 'none',
      duration: 2400,
    })
  }
}
