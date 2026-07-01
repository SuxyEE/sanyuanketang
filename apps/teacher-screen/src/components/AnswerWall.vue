<template>
  <transition name="aw-fade">
    <div v-if="wall" class="aw-screen">
      <div class="aw-panel">
        <header class="aw-header">
          <div class="aw-title-block">
            <span class="aw-kicker">答案上墙 · 作品墙</span>
            <h1 class="aw-prompt">{{ wall.prompt || '学生作品展示' }}</h1>
          </div>
          <div class="aw-meta">
            <div class="aw-meta-item">
              <span class="aw-meta-num">{{ wall.items.length }}</span>
              <span class="aw-meta-label">已提交</span>
            </div>
            <div v-if="pickedCount > 0" class="aw-meta-item">
              <span class="aw-meta-num gold">{{ pickedCount }}</span>
              <span class="aw-meta-label">精选</span>
            </div>
          </div>
        </header>

        <div v-if="wall.items.length === 0" class="aw-empty">
          <div class="aw-empty-icon">✍️</div>
          <span>等待学生提交作品…</span>
        </div>

        <transition-group v-else tag="div" name="aw-card" class="aw-grid">
          <div
            v-for="it in wall.items"
            :key="it.id"
            class="aw-card"
            :class="{ picked: it.picked }"
          >
            <div v-if="it.picked" class="aw-pick-badge">★ 精选</div>
            <div v-if="it.image" class="aw-card-img">
              <img :src="it.image" :alt="it.studentName" />
            </div>
            <p v-if="it.text" class="aw-card-text">{{ it.text }}</p>
            <div class="aw-card-foot">
              <span class="aw-avatar">{{ nameInitial(it.studentName) }}</span>
              <span class="aw-name">{{ it.studentName }}</span>
            </div>
          </div>
        </transition-group>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { RoomEvent } from '@snyuan/shared'
import { useSocket } from '../composables/useSocket'

interface WallItemData {
  id: string
  studentId: string
  studentName: string
  text?: string
  image?: string
  picked: boolean
  ts: number
}
interface WallState {
  wallId: string
  prompt: string
  allowImage: boolean
  items: WallItemData[]
}

// 只“搭车”使用大屏已建立的 socket 单例，不自己 connect（不影响连接引用计数）
const { socket } = useSocket()
// socket 存进 ref 后其 .value 会被 Vue 解包，直接从 ref 派生类型，避免与原始 Socket 类型不匹配
type SocketLike = (typeof socket)['value']

const wall = ref<WallState | null>(null)
const pickedCount = computed(() => (wall.value ? wall.value.items.filter((i) => i.picked).length : 0))

function nameInitial(name: string) {
  return (name || '匿').trim().charAt(0)
}

function normalizeItem(raw: any): WallItemData {
  return {
    id: String(raw?.id ?? ''),
    studentId: String(raw?.studentId ?? ''),
    studentName: raw?.studentName || '匿名',
    text: raw?.text || '',
    image: raw?.image || '',
    picked: !!raw?.picked,
    ts: Number(raw?.ts) || Date.now(),
  }
}

// 收 WallOpen：展开墙（题干）
function onWallOpen(data: any) {
  if (!data?.wallId) return
  wall.value = {
    wallId: String(data.wallId),
    prompt: data.prompt || '',
    allowImage: !!data.allowImage,
    items: [],
  }
}
// 收 WallItem：新卡片追加（同 id 则更新）
function onWallItem(data: any) {
  if (!wall.value || !data?.item || String(data.wallId) !== wall.value.wallId) return
  const it = normalizeItem(data.item)
  if (!it.id) return
  const idx = wall.value.items.findIndex((x) => x.id === it.id)
  if (idx >= 0) wall.value.items[idx] = it
  else wall.value.items.push(it)
}
// 收 WallPick：更新精选高亮
function onWallPick(data: any) {
  if (!wall.value || !data || String(data.wallId) !== wall.value.wallId) return
  const it = wall.value.items.find((x) => x.id === String(data.id))
  if (it) it.picked = !!data.picked
}
// 收 WallClose：收起
function onWallClose(data: any) {
  if (!wall.value) return
  if (!data || data.wallId == null || String(data.wallId) === wall.value.wallId) wall.value = null
}
// late-join / 重连：room:joined 快照 data.activeWall 恢复全量
function onRoomJoined(data: any) {
  const aw = data?.activeWall
  if (aw && aw.wallId != null) {
    wall.value = {
      wallId: String(aw.wallId),
      prompt: aw.prompt || '',
      allowImage: !!aw.allowImage,
      items: Array.isArray(aw.items) ? aw.items.map(normalizeItem) : [],
    }
  } else {
    wall.value = null
  }
}
// 下课 / 新开课：清掉残留的墙
function onLessonReset() {
  wall.value = null
}

const boundEvents: [string, (...args: any[]) => void][] = [
  [RoomEvent.WallOpen, onWallOpen],
  [RoomEvent.WallItem, onWallItem],
  [RoomEvent.WallPick, onWallPick],
  [RoomEvent.WallClose, onWallClose],
  [RoomEvent.Joined, onRoomJoined],
  [RoomEvent.LessonEnd, onLessonReset],
  [RoomEvent.LessonStart, onLessonReset],
]

// 子组件 onMounted 早于父页面 connect()，故 watch socket 单例出现 / 重建后再绑定
let bound: SocketLike = null
function unbind() {
  if (!bound) return
  for (const [evt, h] of boundEvents) bound.off(evt, h)
  bound = null
}
function bind(s: SocketLike) {
  if (!s || bound === s) return
  if (bound) unbind()
  for (const [evt, h] of boundEvents) s.on(evt, h)
  bound = s
}
watch(socket, (s) => bind(s), { immediate: true })
onBeforeUnmount(unbind)
</script>

<style scoped lang="scss">
.aw-screen {
  position: fixed;
  inset: 0;
  z-index: 45;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
  background: radial-gradient(circle at 50% 22%, rgba(22, 63, 140, 0.5), rgba(6, 10, 31, 0.94));
}

.aw-panel {
  width: min(1600px, 100%);
  max-height: 100%;
  display: flex;
  flex-direction: column;
  background: rgba(15, 20, 48, 0.94);
  border: 1px solid rgba(120, 170, 255, 0.24);
  border-radius: 28px;
  padding: 32px 44px 40px;
  box-shadow: 0 30px 90px -20px rgba(0, 0, 0, 0.6);
}

/* ---- 头部 ---- */
.aw-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
  padding-bottom: 20px;
  margin-bottom: 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}
.aw-kicker {
  font-size: 15px;
  font-weight: 600;
  color: #7fb0ff;
  letter-spacing: 1px;
}
.aw-prompt {
  margin: 8px 0 0;
  font-size: 36px;
  font-weight: 800;
  color: #fff;
  line-height: 1.25;
}
.aw-meta {
  display: flex;
  gap: 36px;
  flex-shrink: 0;
}
.aw-meta-item {
  display: flex;
  flex-direction: column;
  align-items: center;
}
.aw-meta-num {
  font-size: 48px;
  font-weight: 800;
  color: #4da3ff;
  line-height: 1;
  font-variant-numeric: tabular-nums;
  &.gold { color: #ffd666; }
}
.aw-meta-label {
  margin-top: 6px;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.55);
}

/* ---- 空态 ---- */
.aw-empty {
  flex: 1;
  min-height: 300px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  color: rgba(255, 255, 255, 0.55);
  font-size: 22px;
}
.aw-empty-icon { font-size: 64px; }

/* ---- 卡片墙（网格 / 瀑布）---- */
.aw-grid {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  grid-auto-flow: row dense;
  gap: 18px;
  align-content: start;
  padding-right: 6px;

  &::-webkit-scrollbar { width: 6px; }
  &::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.16); border-radius: 4px; }
}

.aw-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 18px 20px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.09);
  border-radius: 18px;
  transition: box-shadow 0.35s ease, border-color 0.35s ease, background 0.35s ease;

  /* picked=true：精选高亮放大（跨 2 列、金色描边 + 辉光） */
  &.picked {
    grid-column: span 2;
    background: linear-gradient(135deg, rgba(255, 214, 102, 0.16), rgba(250, 173, 20, 0.08));
    border-color: rgba(255, 214, 102, 0.55);
    box-shadow: 0 0 0 1px rgba(255, 214, 102, 0.4), 0 18px 48px -16px rgba(250, 173, 20, 0.6);

    .aw-card-text { font-size: 22px; }
    .aw-card-img { max-height: 360px; }
    .aw-name { color: #ffe58f; }
  }
}

.aw-pick-badge {
  position: absolute;
  top: -12px;
  left: 16px;
  padding: 4px 14px;
  border-radius: 999px;
  background: linear-gradient(135deg, #ffd666, #faad14);
  color: #7a4b00;
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 1px;
  box-shadow: 0 6px 16px -4px rgba(250, 173, 20, 0.6);
}

.aw-card-img {
  width: 100%;
  max-height: 240px;
  border-radius: 12px;
  overflow: hidden;
  background: rgba(0, 0, 0, 0.25);

  img {
    width: 100%;
    height: 100%;
    max-height: inherit;
    object-fit: contain;
    display: block;
  }
}

.aw-card-text {
  margin: 0;
  font-size: 18px;
  line-height: 1.55;
  color: rgba(255, 255, 255, 0.92);
  white-space: pre-wrap;
  word-break: break-word;
}

.aw-card-foot {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: auto;
}
.aw-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(65, 120, 255, 0.24);
  color: #a9c8ff;
  font-size: 15px;
  font-weight: 700;
  flex-shrink: 0;
}
.aw-name {
  font-size: 15px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.78);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ---- 动画 ---- */
.aw-fade-enter-active,
.aw-fade-leave-active { transition: opacity 0.35s ease; }
.aw-fade-enter-from,
.aw-fade-leave-to { opacity: 0; }

.aw-card-enter-active { transition: opacity 0.4s ease, transform 0.4s cubic-bezier(0.22, 1, 0.36, 1); }
.aw-card-enter-from { opacity: 0; transform: translateY(24px) scale(0.94); }
.aw-card-move { transition: transform 0.4s cubic-bezier(0.22, 1, 0.36, 1); }

@media (max-width: 1024px) {
  .aw-panel { padding: 24px 28px 32px; }
  .aw-prompt { font-size: 28px; }
  .aw-meta { gap: 24px; }
  .aw-meta-num { font-size: 36px; }
  .aw-grid { grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); }
}
</style>
