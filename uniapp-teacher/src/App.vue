<script setup lang="ts">
import { onLaunch, onShow, onHide } from '@dcloudio/uni-app'

onLaunch(() => {
  console.log('[TeacherApp] launched')
  // #ifdef APP-PLUS
  plus.navigator.setFullscreen(true)
  plus.navigator.hideSystemNavigation()
  // #endif
})

onShow(() => {
  console.log('[TeacherApp] foregrounded')
  // #ifdef APP-PLUS
  plus.navigator.setFullscreen(true)
  plus.navigator.hideSystemNavigation()
  // #endif
})

onHide(() => {
  console.log('[TeacherApp] backgrounded')
})
</script>

<style lang="scss">
@import '@/styles/variables.scss';

page {
  background: var(--color-bg);
  font-family: -apple-system, "PingFang SC", "Microsoft YaHei", "Helvetica Neue", Arial, sans-serif;
  color: var(--color-text-primary);
  font-size: var(--font-body);
  line-height: var(--line-height-normal);
}

view,
text,
button,
input,
textarea,
image,
scroll-view {
  box-sizing: border-box;
}

button {
  padding: 0;
  margin: 0;
  background: transparent;
  border: 0;
}

button::after {
  border: 0;
}
</style>
