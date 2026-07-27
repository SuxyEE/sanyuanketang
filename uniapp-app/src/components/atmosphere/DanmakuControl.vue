<template>
  <view class="danmaku-root">
    <!-- 控制面板 -->
    <view v-if="open" class="modal-mask" @tap="close">
      <view class="modal-card" @tap.stop>
        <view class="modal-head">
          <text class="modal-title">弹幕</text>
          <button class="close-btn" @tap="close"><Icon name="x" size="md" /></button>
        </view>

        <view class="form">
          <view class="switch-card" :class="{ on: enabled }" @tap="toggle">
            <view class="switch-info">
              <Icon name="message-square" size="lg" :tone="enabled ? 'primary' : 'muted'" />
              <view>
                <text class="switch-title">{{ enabled ? '弹幕已开启' : '弹幕已关闭' }}</text>
                <text class="switch-desc">{{ enabled ? '学生发送的弹幕会滚动显示在大屏' : '开启后学生可发送弹幕互动' }}</text>
              </view>
            </view>
            <view class="switch-track" :class="{ on: enabled }">
              <view class="switch-thumb"></view>
            </view>
          </view>

          <Button variant="secondary" block icon-left="trash" @tap="clearAll">清空当前弹幕</Button>

          <view class="recent">
            <text class="recent-title">最近弹幕（{{ recent.length }}）</text>
            <view v-if="recent.length === 0" class="recent-empty"><text>暂无弹幕</text></view>
            <view v-else class="recent-list">
              <view v-for="d in recent" :key="d.id" class="recent-item">
                <text class="recent-author">{{ d.studentName || '匿名' }}</text>
                <text class="recent-text">{{ d.text }}</text>
              </view>
            </view>
          </view>
        </view>
      </view>
    </view>

    <!-- 教师端飘弹幕预览层 -->
    <view v-if="enabled && floating.length > 0" class="danmaku-layer">
      <text
        v-for="d in floating"
        :key="d.id"
        class="danmaku-item"
        :style="{ top: d.top + 'rpx', animationDuration: d.duration + 'ms', color: d.color || '#1f2933' }"
      >{{ d.studentName ? d.studentName + '：' : '' }}{{ d.text }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onUnmounted } from 'vue'
import Icon from '@/components/ui/Icon.vue'
import Button from '@/components/ui/Button.vue'
import { RoomEvent } from '@/shared/wsEvents'
import { useRoomSocket } from '@/composables/useRoomSocket'

interface Danmaku { id: string; text: string; studentName?: string; color?: string }

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ 'update:open': [boolean] }>()

const enabled = ref(false)
const recent = ref<Danmaku[]>([])
const floating = ref<(Danmaku & { top: number; duration: number })[]>([])
let lane = 0

const { emit: wsEmit } = useRoomSocket({
  [RoomEvent.DanmakuPush]: (data: any) => onPush(data),
  // late-join / 多端同步：后端回放弹幕开关状态
  [RoomEvent.DanmakuToggle]: (data: any) => {
    if (data && typeof data.enabled === 'boolean') enabled.value = data.enabled
  },
})

function toggle() {
  enabled.value = !enabled.value
  wsEmit(RoomEvent.DanmakuToggle, { enabled: enabled.value })
  uni.showToast({ title: enabled.value ? '弹幕已开启' : '弹幕已关闭', icon: 'none' })
}

function clearAll() {
  wsEmit(RoomEvent.DanmakuClear, {})
  floating.value = []
  uni.showToast({ title: '已清空弹幕', icon: 'none' })
}

function onPush(data: any) {
  if (!data || !data.text) return
  const item: Danmaku = {
    id: data.id || `dm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    text: String(data.text),
    studentName: data.studentName,
    color: data.color,
  }
  recent.value.unshift(item)
  if (recent.value.length > 30) recent.value.pop()

  if (!enabled.value) return
  lane = (lane + 1) % 6
  const top = 100 + lane * 68
  const duration = 7000 + Math.round(Math.random() * 3000)
  floating.value.push({ ...item, top, duration })
  if (floating.value.length > 60) floating.value.splice(0, floating.value.length - 60)
  setTimeout(() => {
    const idx = floating.value.findIndex((f) => f.id === item.id)
    if (idx >= 0) floating.value.splice(idx, 1)
  }, duration + 200)
}

function close() {
  emit('update:open', false)
}

onUnmounted(() => { floating.value = [] })
</script>

<style scoped lang="scss">
@import '@/styles/variables.scss';

.modal-mask {
  position: fixed; inset: 0; background: var(--color-scrim);
  display: flex; align-items: center; justify-content: center; z-index: var(--z-modal); padding: var(--space-5);
}
.modal-card {
  width: 92%; max-width: 640rpx; max-height: 84vh; overflow-y: auto; background: var(--color-surface-raised);
  border-radius: var(--radius-2xl); padding: var(--space-6); box-shadow: var(--elevation-4);
}
.modal-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-5); }
.modal-title { font-size: var(--font-title-sm); font-weight: var(--font-weight-bold); color: var(--color-text-primary); }
.close-btn {
  width: 64rpx; height: 64rpx; min-height: 0; padding: 0; display: flex; align-items: center; justify-content: center;
  background: var(--color-surface-variant); border-radius: var(--radius-full); color: var(--color-text-secondary);
}
.form { display: flex; flex-direction: column; gap: var(--space-4); }

.switch-card {
  display: flex; align-items: center; justify-content: space-between; gap: var(--space-3);
  padding: var(--space-4); background: var(--color-surface-variant); border: 2rpx solid transparent; border-radius: var(--radius-lg);
  &.on { border-color: var(--color-primary); background: var(--color-primary-container); }
}
.switch-info { display: flex; align-items: center; gap: var(--space-3); flex: 1; }
.switch-title { font-size: var(--font-label); font-weight: var(--font-weight-semibold); color: var(--color-text-primary); display: block; }
.switch-desc { font-size: var(--font-overline); color: var(--color-text-tertiary); line-height: 1.4; }
.switch-track {
  width: 88rpx; height: 48rpx; border-radius: var(--radius-pill); background: var(--color-outline); position: relative; flex-shrink: 0;
  transition: background-color var(--duration-base) var(--ease-standard);
  &.on { background: var(--color-primary); .switch-thumb { transform: translateX(40rpx); } }
}
.switch-thumb {
  width: 40rpx; height: 40rpx; border-radius: var(--radius-full); background: #fff; position: absolute; top: 4rpx; left: 4rpx;
  transition: transform var(--duration-base) var(--ease-standard); box-shadow: var(--elevation-1);
}

.recent { display: flex; flex-direction: column; gap: var(--space-2); }
.recent-title { font-size: var(--font-caption); font-weight: var(--font-weight-semibold); color: var(--color-text-secondary); }
.recent-empty { padding: var(--space-4); text-align: center; background: var(--color-surface-variant); border-radius: var(--radius-md); text { font-size: var(--font-caption); color: var(--color-text-tertiary); } }
.recent-list { display: flex; flex-direction: column; gap: 8rpx; max-height: 320rpx; overflow-y: auto; }
.recent-item { display: flex; gap: var(--space-2); padding: var(--space-2) var(--space-3); background: var(--color-surface-variant); border-radius: var(--radius-sm); }
.recent-author { font-size: var(--font-caption); color: var(--color-primary); flex-shrink: 0; }
.recent-text { font-size: var(--font-caption); color: var(--color-text-primary); word-break: break-word; }

.danmaku-layer { position: fixed; inset: 0; pointer-events: none; z-index: var(--z-overlay); overflow: hidden; }
.danmaku-item {
  position: absolute; left: 100%; white-space: nowrap; font-size: 32rpx; font-weight: var(--font-weight-semibold);
  padding: 4rpx var(--space-3); background: rgba(255, 255, 255, 0.7); border-radius: var(--radius-pill);
  animation-name: danmaku-move; animation-timing-function: linear; animation-fill-mode: forwards;
}
@keyframes danmaku-move {
  0% { transform: translateX(0); }
  100% { transform: translateX(-200vw); }
}
</style>
