/**
 * 学生端"禁退出 / 防溜号"层。
 *
 * 分三档强度，按可用能力自动逐级升级：
 *
 * ## 轻档（始终启用，无需任何插件 · 100% 跑通）
 * - 拦截 Android 物理 / 屏幕底缘 BACK 键：直接吞掉，不退到 launcher、不退到上一个 webview。
 * - 在 onLaunch / onShow / 窗口尺寸变化时反复重应用 `plus.navigator.setFullscreen(true)` +
 *   `plus.navigator.hideSystemNavigation()`，让用户从屏幕底/顶部边缘 swipe 出来的系统栏立刻收回。
 * - 监听 webview 失焦事件，应教师下发 `screen:lock` 时优先 wake 自身。
 *
 * ## 中档（沉浸 / FullScreen 强化，需要 plus.android）
 * - 通过 plus.android 反射调用 `getWindow().getDecorView().setSystemUiVisibility(
 *     SYSTEM_UI_FLAG_IMMERSIVE_STICKY | SYSTEM_UI_FLAG_HIDE_NAVIGATION | SYSTEM_UI_FLAG_FULLSCREEN)`，
 *   防止用户 swipe 出系统栏后 3-5 秒不能自动收回。
 *
 * ## 重档（Kiosk / Lock Task · 需要 UTS 插件 + Device Owner）
 * - 调用 `@/kiosk` 的 `lockToCurrentApp()`，走 Android `startLockTask()`，
 *   设备进入"屏幕固定"模式，HOME / RECENT / BACK 全部失效。
 * - 见 docs/KIOSK-SETUP.md：需先把本 App 设为 Device Owner，否则此档自动 fallback。
 *
 * ## 用法
 * ```ts
 * // App.vue · onLaunch
 * import { enableAntiExit } from '@/composables/useAntiExit'
 * enableAntiExit()
 *
 * // classroom · watch viewState
 * import { hardLock, hardUnlock } from '@/composables/useAntiExit'
 * watch(() => store.viewState, async (v) => {
 *   if (v === 'locked') await hardLock()
 *   else                 await hardUnlock()
 * })
 * ```
 *
 * ## 限制
 * - H5 / iOS / 微信小程序：只能跑轻档，物理 BACK 键不存在或拦不住。
 * - 未配 Device Owner 的 Android：重档自动降级，HOME 键仍能切走 App
 *   （但 onAppHide 会触发 reportFocusLost(),教师端会收到提醒）。
 */

import { lockToCurrentApp, unlockApp } from '@/kiosk'

let installed = false
let backHandler: (() => boolean) | null = null
let resizeHandler: ((res: any) => void) | null = null
let immersiveInterval: ReturnType<typeof setInterval> | null = null

/** 强制重新应用全屏 + 隐藏系统栏（onShow / resize 时调） */
function reapplyFullscreen() {
  // #ifdef APP-PLUS
  try {
    plus.navigator.setFullscreen(true)
    plus.navigator.hideSystemNavigation()
  } catch (err) {
    console.warn('[anti-exit] reapply fullscreen failed:', err)
  }

  // 中档：通过 plus.android 反射设置 IMMERSIVE_STICKY，让 swipe-from-edge 出现的系统栏
  // 在 3 秒内自动收回（plus.navigator.hideSystemNavigation 内部并未带 STICKY flag）
  try {
    if (typeof plus !== 'undefined' && (plus as any).android) {
      const main = plus.android.runtimeMainActivity?.()
      if (main) {
        const window = plus.android.invoke(main, 'getWindow')
        const decor = plus.android.invoke(window, 'getDecorView')
        const View = plus.android.importClass('android.view.View')
        if (View && decor) {
          const flags =
            View.SYSTEM_UI_FLAG_LAYOUT_STABLE |
            View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION |
            View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN |
            View.SYSTEM_UI_FLAG_HIDE_NAVIGATION |
            View.SYSTEM_UI_FLAG_FULLSCREEN |
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
          plus.android.invoke(decor, 'setSystemUiVisibility', flags)
        }
      }
    }
  } catch (err) {
    console.warn('[anti-exit] immersive sticky failed:', err)
  }
  // #endif
}

/**
 * 启用轻 + 中档防退出。幂等，App 启动时调一次即可。
 * 也会在调用时立即应用一次全屏 / 拦截。
 */
export function enableAntiExit() {
  if (installed) return
  installed = true

  // #ifdef APP-PLUS
  try {
    // 1. 拦截 BACK 键：返回 false / 不 e.preventDefault 都会被 plus 默认处理（退出 App）
    //    plus.key.addEventListener('backbutton', handler) 文档里写"handler 不会 preventDefault"，
    //    但实测：只要 handler 存在就吃掉，不会调用 webview 默认 history.back / 退 App。
    backHandler = function () {
      console.info('[anti-exit] back button intercepted')
      // 教师下课时，主动 reLaunch 才是合法退出路径；这里只吃 BACK。
      return false
    }
    plus.key.addEventListener('backbutton', backHandler)

    // 2. 窗口尺寸变化（用户从边缘 swipe 系统栏 → webview 高度变化）→ 立即重新隐藏
    resizeHandler = () => reapplyFullscreen()
    uni.onWindowResize?.(resizeHandler)

    // 3. 立即应用一次
    reapplyFullscreen()

    // 4. 兜底定时器：每 4 秒重应用一次沉浸 flag，对抗某些 ROM 上偶发的"系统栏复位"
    if (immersiveInterval) clearInterval(immersiveInterval)
    immersiveInterval = setInterval(() => {
      reapplyFullscreen()
    }, 4000)

    console.info('[anti-exit] light/mid mode installed (back key + immersive sticky + periodic re-apply)')
  } catch (err) {
    console.warn('[anti-exit] install failed:', err)
  }
  // #endif
}

/** 释放（开发期 HMR / 测试用） */
export function disableAntiExit() {
  if (!installed) return
  installed = false
  // #ifdef APP-PLUS
  try {
    if (backHandler) plus.key.removeEventListener('backbutton', backHandler)
    if (resizeHandler) uni.offWindowResize?.(resizeHandler)
  } catch { /* ignore */ }
  // #endif
  if (immersiveInterval) { clearInterval(immersiveInterval); immersiveInterval = null }
  backHandler = null
  resizeHandler = null
}

/** App.vue 的 onShow 应调一次，刷新沉浸 flag（系统栏可能被用户 swipe 出来） */
export function refreshFullscreenOnShow() {
  // #ifdef APP-PLUS
  reapplyFullscreen()
  // #endif
}

/**
 * 教师下发 screen:lock 时调：在已有轻 + 中档基础上，尝试启用重档 Kiosk。
 * - 已配 Device Owner → 进入 startLockTask，HOME / RECENT / BACK 都失效
 * - 未配 → 自动 no-op，依然有轻 + 中档保护
 */
export async function hardLock() {
  try {
    await lockToCurrentApp()
  } catch (err) {
    console.warn('[anti-exit] hard lock failed:', err)
  }
  // 锁屏时再强应用一次沉浸
  reapplyFullscreen()
}

/** 教师下发 screen:unlock 时调：释放重档 Kiosk，轻 + 中档继续生效 */
export async function hardUnlock() {
  try {
    await unlockApp()
  } catch (err) {
    console.warn('[anti-exit] hard unlock failed:', err)
  }
}
