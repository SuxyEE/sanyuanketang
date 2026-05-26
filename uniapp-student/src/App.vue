<script setup lang="ts">
import { onLaunch, onShow, onHide } from '@dcloudio/uni-app'
import { ensureKioskOnLaunch } from './kiosk'
import { enableAntiExit, refreshFullscreenOnShow } from './composables/useAntiExit'
import { hintIfPortrait } from './composables/useOrientation'

onLaunch(() => {
  console.log('[App] launched')
  // 安装 anti-exit 层：拦 BACK 键 + 沉浸式 sticky + 重应用全屏（轻 + 中档，无插件依赖）
  enableAntiExit()
  // 启动时尝试进入 kiosk 重档（仅 Android Device Owner + UTS 插件 snyuan-kiosk 生效；其他端 no-op）
  ensureKioskOnLaunch().catch(err => console.warn('[kiosk] launch hook failed:', err))
  setTimeout(hintIfPortrait, 800)
})

onShow(() => {
  console.log('[App] foregrounded')
  refreshFullscreenOnShow()
})

onHide(() => {
  console.log('[App] backgrounded')
  // 学生切走时立即告诉后端"我溜了" — 后端可推给教师 toast
  // 实现见 sockets/useSocket.ts 中 reportFocusLost()
})
</script>

<style lang="scss">
/* 全局基础变量 + reset */
@import '@/styles/variables.scss';

page {
  background: var(--color-bg);
  font-family: -apple-system, "PingFang SC", "Microsoft YaHei", "Helvetica Neue", Arial, sans-serif;
  color: var(--color-text-primary);
  font-size: var(--font-body);
  line-height: var(--line-height-normal);
}

view, text, button, input, image { box-sizing: border-box; }
button { padding: 0; margin: 0; background: transparent; border: 0; }
button::after { border: 0; }
</style>
