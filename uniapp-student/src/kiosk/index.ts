/**
 * Android Kiosk（强控制 / 单应用锁定）能力 JS 侧 API。
 *
 * 实际 native 实现走 UTS 插件：
 *   - 包名 `uni_modules/snyuan-kiosk/utssdk/app-android/index.uts`
 *   - 调用 Android Device Admin API：startLockTask / stopLockTask / setLockTaskPackages
 *   - 调用 KeyguardManager / WindowManager 关锁屏 / 全屏
 *
 * 本文件只是 JS 侧的"调用门面"：在没有 UTS 插件时，所有方法都 no-op，避免 H5 / iOS 报错。
 *
 * 用法：
 *   import { ensureKioskOnLaunch, lockToCurrentApp, unlockApp } from '@/kiosk'
 *   await ensureKioskOnLaunch()        // 启动时尝试进入 kiosk
 *   await lockToCurrentApp()           // 教师"锁屏"时调用
 *   await unlockApp()                  // 教师"解锁"时调用
 */

/* eslint-disable @typescript-eslint/no-unused-vars */

interface KioskNative {
  isDeviceOwner(): boolean | Promise<boolean>
  startLockTask(): boolean | Promise<boolean>
  stopLockTask(): boolean | Promise<boolean>
  setKeyguardDisabled(disabled: boolean): boolean | Promise<boolean>
  setSystemUiVisibility(opts: { hideStatusBar?: boolean; hideNavBar?: boolean }): boolean | Promise<boolean>
  setScreenAlwaysOn(on: boolean): boolean | Promise<boolean>
  /** 禁用通知栏下拉（仅 Device Owner 模式生效） */
  setStatusBarDisabled?(disabled: boolean): boolean | Promise<boolean>
  /** 获取设备信息（用于诊断 kiosk 是否生效） */
  diagnose(): {
    isDeviceOwner: boolean
    isInLockTask: boolean
    isKeyguardDisabled: boolean
    sdkInt: number
    model: string
    manufacturer: string
  } | Promise<{
    isDeviceOwner: boolean
    isInLockTask: boolean
    isKeyguardDisabled: boolean
    sdkInt: number
    model: string
    manufacturer: string
  }>
}

/**
 * 尝试加载 UTS 插件 `snyuan-kiosk`。
 *
 * 加载顺序：
 *   1. `uni.requireNativePlugin('snyuan-kiosk')` —— 走 HBuilderX 老插件市场打包路径
 *   2. `require('@/uni_modules/snyuan-kiosk')` —— UTS 插件新规范 · 我们项目用这条
 *      （文件位于 `src/uni_modules/snyuan-kiosk/utssdk/app-android/index.uts`）
 *
 * 任何一条加载失败都 swallow，返回 null。H5 / iOS / 小程序自动走 no-op。
 */
function getKioskNative(): KioskNative | null {
  // #ifdef APP-PLUS
  try {
    // @ts-ignore
    const native1 = typeof uni !== 'undefined' && (uni as any).requireNativePlugin
      ? (uni as any).requireNativePlugin('snyuan-kiosk')
      : null
    if (native1 && typeof native1.startLockTask === 'function') return native1 as KioskNative

    // UTS 插件正路径
    // @ts-ignore
    const native2 = require('@/uni_modules/snyuan-kiosk') as any
    // UTS 导出的方法直接挂在模块对象上，没有 .default
    if (native2 && typeof native2.startLockTask === 'function') return native2 as KioskNative
    if (native2?.default && typeof native2.default.startLockTask === 'function') return native2.default as KioskNative
  } catch (err) {
    console.warn('[kiosk] native plugin load failed:', err)
  }
  // #endif
  return null
}

/**
 * App 启动时调用：
 *   1. 屏幕常亮
 *   2. 隐藏状态栏 / 导航栏
 *   3. 如果已配 Device Owner，自动 startLockTask
 * 任何步骤失败都 swallow，不影响主流程（H5 / 未配 kiosk 的 Android 都能跑）
 */
export async function ensureKioskOnLaunch(): Promise<void> {
  const native = getKioskNative()
  if (!native) {
    console.info('[kiosk] native plugin not available, running in non-kiosk mode')
    return
  }
  try {
    await native.setScreenAlwaysOn(true)
    await native.setSystemUiVisibility({ hideStatusBar: true, hideNavBar: true })
    const isOwner = await native.isDeviceOwner()
    if (isOwner) {
      await native.startLockTask()
      console.info('[kiosk] started lock task as device owner')
    } else {
      console.warn('[kiosk] not device owner — kiosk lock unavailable. 请按 docs/KIOSK-SETUP.md 配置')
    }
  } catch (err) {
    console.warn('[kiosk] ensureOnLaunch error:', err)
  }
}

/**
 * 教师下发 screen:lock 时调用（学生侧加固）。
 * Device Owner 模式下叠加禁用 status bar 下拉，防止学生通过通知栏切走。
 */
export async function lockToCurrentApp(): Promise<void> {
  const native = getKioskNative()
  if (!native) return
  try {
    await native.setKeyguardDisabled(true)
    await native.startLockTask()
    if (typeof native.setStatusBarDisabled === 'function') {
      await native.setStatusBarDisabled(true)
    }
  } catch (err) {
    console.warn('[kiosk] lockToCurrentApp error:', err)
  }
}

/** 教师下发 screen:unlock 时调用 */
export async function unlockApp(): Promise<void> {
  const native = getKioskNative()
  if (!native) return
  try {
    if (typeof native.setStatusBarDisabled === 'function') {
      await native.setStatusBarDisabled(false)
    }
    await native.stopLockTask()
  } catch (err) {
    console.warn('[kiosk] unlockApp error:', err)
  }
}

/** 诊断面板（教师端可调，确认 kiosk 是否真生效） */
export async function diagnoseKiosk() {
  const native = getKioskNative()
  if (!native) {
    return { ok: false, reason: 'native plugin not available（H5 / 未装 snyuan-kiosk）' }
  }
  try {
    const info = await native.diagnose()
    return { ok: true, info }
  } catch (err: any) {
    return { ok: false, reason: err?.message || String(err) }
  }
}
