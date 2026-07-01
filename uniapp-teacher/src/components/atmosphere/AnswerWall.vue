<template>
  <view v-if="open" class="modal-mask" @tap="close">
    <view class="modal-card" @tap.stop>
      <view class="modal-head">
        <text class="modal-title">{{ activeWall ? '答案上墙 · 进行中' : '发起答案上墙' }}</text>
        <button class="close-btn" @tap="close">
          <Icon name="x" size="md" />
        </button>
      </view>

      <!-- 发起阶段 -->
      <view v-if="!activeWall" class="form">
        <textarea
          v-model="prompt"
          class="textarea"
          placeholder="输入题干 / 问题，例如：用一句话概括本节课你的收获"
          maxlength="200"
        />
        <view class="option-row">
          <text class="option-label">提交形式：</text>
          <view class="segmented">
            <button :class="{ active: !allowImage }" @tap="allowImage = false">仅文字</button>
            <button :class="{ active: allowImage }" @tap="allowImage = true">文字 + 图片</button>
          </view>
        </view>
        <view class="hint-box">发起后学生端可提交答案；你可实时「精选」优秀答案上墙展示。</view>
        <Button block icon-left="send" @tap="openWall">发起答案上墙</Button>
      </view>

      <!-- 进行中阶段 -->
      <view v-else class="form">
        <view class="live-head">
          <view class="live-dot"></view>
          <text class="live-question">{{ activeWall.prompt || '答案上墙' }}</text>
        </view>
        <view class="live-meta">
          <text class="live-total">{{ items.length }} 条提交 · 精选 {{ pickedCount }} 条</text>
          <view class="segmented compact">
            <button :class="{ active: !onlyPicked }" @tap="onlyPicked = false">全部</button>
            <button :class="{ active: onlyPicked }" @tap="onlyPicked = true">仅精选</button>
          </view>
        </view>

        <scroll-view scroll-y class="wall-list">
          <view
            v-for="it in shownItems"
            :key="it.id"
            class="wall-item"
            :class="{ picked: it.picked }"
          >
            <view class="wi-head">
              <text class="wi-name">{{ it.studentName }}</text>
              <view v-if="it.picked" class="wi-badge">
                <Icon name="check" size="xs" tone="inverse" />
                <text>已精选</text>
              </view>
            </view>
            <text v-if="it.text" class="wi-text">{{ it.text }}</text>
            <image v-if="it.image" :src="it.image" class="wi-image" mode="aspectFit" />
            <button class="wi-pick" :class="{ on: it.picked }" @tap="pickItem(it)">
              <Icon :name="it.picked ? 'x' : 'check'" size="sm" :tone="it.picked ? 'muted' : 'primary'" />
              <text>{{ it.picked ? '取消精选' : '精选上墙' }}</text>
            </button>
          </view>
          <view v-if="shownItems.length === 0" class="wall-empty">
            <text>{{ onlyPicked ? '还没有精选的答案' : '等待学生提交答案…' }}</text>
          </view>
        </scroll-view>

        <view class="live-actions">
          <Button variant="danger" block icon-left="stop-circle" @tap="closeWall">结束答案上墙</Button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import Icon from '@/components/ui/Icon.vue'
import Button from '@/components/ui/Button.vue'
import { RoomEvent } from '@/shared/wsEvents'
import { useRoomSocket } from '@/composables/useRoomSocket'

interface WallItem {
  id: string
  studentId: string
  studentName: string
  text?: string
  image?: string
  picked: boolean
  ts: number
}
interface ActiveWall {
  wallId: string
  prompt: string
  allowImage: boolean
}

defineProps<{ open: boolean }>()
const emit = defineEmits<{ 'update:open': [boolean] }>()

const prompt = ref('')
const allowImage = ref(false)
const activeWall = ref<ActiveWall | null>(null)
const items = ref<WallItem[]>([])
const onlyPicked = ref(false)

const pickedCount = computed(() => items.value.filter((i) => i.picked).length)
const shownItems = computed(() => (onlyPicked.value ? items.value.filter((i) => i.picked) : items.value))

function toast(title: string, icon: 'success' | 'none' = 'none') {
  uni.showToast({ title, icon })
}

function normalizeItem(it: any): WallItem {
  return {
    id: String(it?.id || ''),
    studentId: String(it?.studentId || ''),
    studentName: String(it?.studentName || '匿名'),
    text: typeof it?.text === 'string' ? it.text : '',
    image: typeof it?.image === 'string' ? it.image : '',
    picked: it?.picked === true,
    ts: Number(it?.ts) || 0,
  }
}

const { emit: wsEmit } = useRoomSocket({
  // 后端回带权威 wallId 的 wall:open 广播：他人发起时新建、本地乐观态时回填 wallId
  [RoomEvent.WallOpen]: (data: any) => {
    if (!data?.wallId) return
    if (!activeWall.value) {
      activeWall.value = { wallId: data.wallId, prompt: data.prompt || '', allowImage: data.allowImage === true }
      items.value = []
      return
    }
    if (!activeWall.value.wallId) {
      activeWall.value.wallId = data.wallId
      if (data.prompt) activeWall.value.prompt = data.prompt
      activeWall.value.allowImage = data.allowImage === true
    }
  },
  [RoomEvent.WallItem]: (data: any) => {
    if (!activeWall.value || !data?.item) return
    if (data.wallId && activeWall.value.wallId && data.wallId !== activeWall.value.wallId) return
    const it = normalizeItem(data.item)
    if (!it.id || items.value.some((x) => x.id === it.id)) return
    items.value.push(it)
  },
  [RoomEvent.WallPick]: (data: any) => {
    if (!activeWall.value || !data?.id) return
    const it = items.value.find((x) => x.id === data.id)
    if (it) it.picked = data.picked !== false
  },
  [RoomEvent.WallClose]: () => {
    activeWall.value = null
    items.value = []
  },
  // late-join / 重连：用 room:joined.activeWall 快照恢复进行中的墙
  [RoomEvent.Joined]: (data: any) => {
    const w = data?.activeWall
    if (!w || !w.wallId) return
    activeWall.value = { wallId: w.wallId, prompt: w.prompt || '', allowImage: w.allowImage === true }
    items.value = Array.isArray(w.items) ? w.items.map(normalizeItem) : []
  },
})

function openWall() {
  const p = prompt.value.trim()
  if (!p) return toast('请输入题干')
  wsEmit(RoomEvent.WallOpen, { prompt: p, allowImage: allowImage.value })
  // 乐观进入进行中态，等 wall:open 广播回填权威 wallId
  activeWall.value = { wallId: '', prompt: p, allowImage: allowImage.value }
  items.value = []
  onlyPicked.value = false
  toast('答案上墙已发起', 'success')
}

function pickItem(it: WallItem) {
  if (!activeWall.value?.wallId) return
  const next = !it.picked
  it.picked = next // 乐观更新，后端 wall:pick 广播会确认
  wsEmit(RoomEvent.WallPick, { wallId: activeWall.value.wallId, id: it.id, picked: next })
}

function closeWall() {
  if (activeWall.value?.wallId) wsEmit(RoomEvent.WallClose, { wallId: activeWall.value.wallId })
  activeWall.value = null
  items.value = []
  prompt.value = ''
  toast('已结束答案上墙')
}

function close() {
  emit('update:open', false)
}
</script>

<style scoped lang="scss">
@import '@/styles/variables.scss';

.modal-mask {
  position: fixed;
  inset: 0;
  background: var(--color-scrim);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: var(--z-modal);
  padding: var(--space-5);
}
.modal-card {
  width: 92%;
  max-width: 720rpx;
  max-height: 84vh;
  overflow-y: auto;
  background: var(--color-surface-raised);
  border-radius: var(--radius-2xl);
  padding: var(--space-6);
  box-shadow: var(--elevation-4);
}
.modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-5);
}
.modal-title { font-size: var(--font-title-sm); font-weight: var(--font-weight-bold); color: var(--color-text-primary); }
.close-btn {
  width: 64rpx; height: 64rpx; min-height: 0; padding: 0;
  display: flex; align-items: center; justify-content: center;
  background: var(--color-surface-variant); border-radius: var(--radius-full);
  color: var(--color-text-secondary);
}
.form { display: flex; flex-direction: column; gap: var(--space-4); }

.textarea {
  width: 100%; box-sizing: border-box; padding: var(--space-3) var(--space-4);
  background: var(--color-surface-variant); border: 2rpx solid var(--color-outline);
  border-radius: var(--radius-md); font-size: var(--font-body); color: var(--color-text-primary);
  min-height: 132rpx;
}

.option-row { display: flex; align-items: center; flex-wrap: wrap; gap: var(--space-2); }
.option-label { font-size: var(--font-caption); color: var(--color-text-secondary); }

.segmented {
  display: flex; background: var(--color-surface-variant); border-radius: var(--radius-md); padding: 4rpx; flex: 1;
  button {
    flex: 1; min-height: 64rpx; line-height: 64rpx; background: transparent; border-radius: var(--radius-sm);
    font-size: var(--font-caption); color: var(--color-text-secondary);
    &.active { background: var(--color-surface); color: var(--color-primary); font-weight: var(--font-weight-semibold); box-shadow: var(--elevation-1); }
  }
  &.compact { flex: none; padding: 4rpx; button { min-height: 52rpx; line-height: 52rpx; padding: 0 var(--space-4); } }
}

.hint-box {
  padding: var(--space-3) var(--space-4); background: var(--color-primary-container);
  border-radius: var(--radius-md); font-size: var(--font-caption); color: var(--color-on-primary-container); line-height: 1.5;
}

.live-head { display: flex; align-items: center; gap: var(--space-3); }
.live-dot {
  width: 20rpx; height: 20rpx; border-radius: 50%; background: var(--color-danger); flex-shrink: 0;
  animation: pulse 1.2s ease-in-out infinite;
}
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
.live-question { font-size: var(--font-body); font-weight: var(--font-weight-semibold); color: var(--color-text-primary); }

.live-meta { display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); }
.live-total { font-size: var(--font-caption); color: var(--color-text-tertiary); }

.wall-list {
  max-height: 48vh;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.wall-item {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-4);
  margin-bottom: var(--space-3);
  background: var(--color-surface-variant);
  border: 2rpx solid transparent;
  border-radius: var(--radius-lg);
  &.picked {
    border-color: var(--color-warning);
    background: var(--color-warning-container);
  }
}
.wi-head { display: flex; align-items: center; justify-content: space-between; gap: var(--space-2); }
.wi-name { font-size: var(--font-label); font-weight: var(--font-weight-semibold); color: var(--color-text-primary); }
.wi-badge {
  display: inline-flex; align-items: center; gap: 4rpx;
  padding: 2rpx var(--space-2); border-radius: var(--radius-pill);
  background: var(--color-warning); 
  text { font-size: var(--font-overline); color: var(--color-text-on-color); font-weight: var(--font-weight-semibold); }
}
.wi-text { font-size: var(--font-body); color: var(--color-text-primary); line-height: 1.5; }
.wi-image {
  width: 100%; height: 360rpx; border-radius: var(--radius-md); background: var(--color-surface);
}
.wi-pick {
  align-self: flex-start;
  display: inline-flex; align-items: center; gap: var(--space-2);
  min-height: 56rpx; padding: 0 var(--space-4); margin: 0;
  background: var(--color-surface); border: 2rpx solid var(--color-primary); border-radius: var(--radius-pill);
  text { font-size: var(--font-caption); color: var(--color-primary); font-weight: var(--font-weight-semibold); }
  &.on { border-color: var(--color-outline); text { color: var(--color-text-secondary); } }
}
.wall-empty {
  padding: var(--space-7) 0; text-align: center;
  text { font-size: var(--font-caption); color: var(--color-text-tertiary); }
}

.live-actions { margin-top: var(--space-2); }
</style>
