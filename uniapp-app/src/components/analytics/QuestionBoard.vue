<template>
  <view class="qb-card">
    <!-- 头部：标题 + 总数 + 未读徽标 + 全部已读 -->
    <view class="qb-head">
      <Icon name="help-circle" size="sm" tone="primary" />
      <text class="qb-title">学生提问</text>
      <text class="qb-count">{{ total }} 条</text>
      <view v-if="unreadCount > 0" class="qb-badge">
        <text class="qb-badge-num">{{ unreadCount }}</text>
        <text class="qb-badge-txt">未读</text>
      </view>
      <view class="qb-spacer" />
      <view v-if="unreadCount > 0" class="qb-readall" hover-class="qb-press" @tap="markAllRead">
        <Icon name="check" size="xs" tone="success" />
        <text class="qb-readall-txt">全部已读</text>
      </view>
    </view>

    <!-- 筛选 / 排序控制条 -->
    <view class="qb-toolbar">
      <view class="qb-seg">
        <view class="qb-seg-btn" :class="{ active: sortMode === 'time' }" hover-class="qb-press" @tap="sortMode = 'time'">
          <Icon name="clock" size="xs" :tone="sortMode === 'time' ? 'primary' : 'muted'" />
          <text class="qb-seg-txt">时间</text>
        </view>
        <view class="qb-seg-btn" :class="{ active: sortMode === 'page' }" hover-class="qb-press" @tap="sortMode = 'page'">
          <Icon name="file-text" size="xs" :tone="sortMode === 'page' ? 'primary' : 'muted'" />
          <text class="qb-seg-txt">页码</text>
        </view>
      </view>
      <view class="qb-chip" :class="{ active: unreadOnly }" hover-class="qb-press" @tap="unreadOnly = !unreadOnly">
        <text class="qb-chip-txt">仅未读</text>
      </view>
    </view>

    <!-- 页码筛选 chips -->
    <scroll-view v-if="pages.length > 1" class="qb-pages" scroll-x :show-scrollbar="false">
      <view class="qb-pages-inner">
        <view class="qb-chip" :class="{ active: pageFilter === null }" hover-class="qb-press" @tap="pageFilter = null">
          <text class="qb-chip-txt">全部</text>
        </view>
        <view
          v-for="p in pages"
          :key="p"
          class="qb-chip"
          :class="{ active: pageFilter === p }"
          hover-class="qb-press"
          @tap="pageFilter = p"
        >
          <text class="qb-chip-txt">P{{ p }}</text>
        </view>
      </view>
    </scroll-view>

    <!-- 提问列表（可滚动） -->
    <scroll-view v-if="filtered.length > 0" class="qb-list" scroll-y :show-scrollbar="false">
      <view
        v-for="q in filtered"
        :key="keyOf(q)"
        class="qb-item"
        :class="{ unread: !isRead(q) }"
        hover-class="qb-item-press"
        @tap="toggleRead(q)"
      >
        <view class="qb-item-meta">
          <view v-if="!isRead(q)" class="qb-dot" />
          <text class="qb-name">{{ q.studentName || '匿名' }}</text>
          <text class="qb-page">P{{ q.slideIndex }}</text>
          <view class="qb-spacer" />
          <text class="qb-time">{{ formatTime(q.time) }}</text>
          <Icon v-if="isRead(q)" name="check-circle" size="xs" tone="success" />
        </view>
        <text class="qb-text">{{ q.text }}</text>

        <!-- 回复入口：@tap.stop 避免触发列表项的已读切换 -->
        <view class="qb-reply" @tap.stop>
          <view v-if="replyingKey === keyOf(q)" class="qb-reply-edit">
            <input
              v-model="replyText"
              class="qb-reply-input"
              type="text"
              placeholder="输入回复，学生端将收到"
              confirm-type="send"
              @confirm="sendReply(q)"
            />
            <view class="qb-reply-btn primary" hover-class="qb-press" @tap="sendReply(q)">
              <Icon name="send" size="xs" tone="inverse" />
              <text class="qb-reply-btn-txt on">发送</text>
            </view>
            <view class="qb-reply-icon" hover-class="qb-press" @tap="cancelReply">
              <Icon name="x" size="xs" tone="muted" />
            </view>
          </view>
          <view v-else class="qb-reply-bar">
            <view v-if="isReplied(q)" class="qb-replied">
              <Icon name="check-circle" size="xs" tone="success" />
              <text class="qb-replied-txt">已回复</text>
            </view>
            <view class="qb-spacer" />
            <view class="qb-reply-btn" hover-class="qb-press" @tap="startReply(q)">
              <Icon name="message-square" size="xs" tone="primary" />
              <text class="qb-reply-btn-txt">{{ isReplied(q) ? '追加回复' : '回复' }}</text>
            </view>
          </view>
        </view>
      </view>
    </scroll-view>

    <!-- 空态（被筛选清空时） -->
    <view v-else class="qb-empty">
      <Icon name="check-circle" size="lg" tone="success" />
      <text class="qb-empty-txt">{{ unreadOnly ? '暂无未读提问' : '当前筛选无提问' }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Icon from '@/components/ui/Icon.vue'
import { useClassroomStore, type QuestionItem } from '@/stores/classroom'
import { RoomEvent } from '@/shared/wsEvents'
import { useRoomSocket } from '@/composables/useRoomSocket'

const store = useClassroomStore()
const { emit: wsEmit } = useRoomSocket()

// 本地「已读 / 已处理」标记（前端状态即可，不落库）
const readKeys = ref<Set<string>>(new Set())
const sortMode = ref<'time' | 'page'>('time')
const pageFilter = ref<number | null>(null)
const unreadOnly = ref(false)

// 本地「已回复」标记 + 当前展开回复框的提问
const repliedKeys = ref<Set<string>>(new Set())
const replyingKey = ref<string | null>(null)
const replyText = ref('')

function keyOf(q: QuestionItem) {
  return `${q.studentId}|${q.time}|${q.slideIndex}`
}
function isRead(q: QuestionItem) {
  return readKeys.value.has(keyOf(q))
}
function toggleRead(q: QuestionItem) {
  const k = keyOf(q)
  if (readKeys.value.has(k)) readKeys.value.delete(k)
  else readKeys.value.add(k)
}
function markAllRead() {
  for (const q of store.questions) readKeys.value.add(keyOf(q))
}

function isReplied(q: QuestionItem) {
  return repliedKeys.value.has(keyOf(q))
}
function startReply(q: QuestionItem) {
  const k = keyOf(q)
  // 再次点击同一条则收起
  if (replyingKey.value === k) {
    replyingKey.value = null
    return
  }
  replyingKey.value = k
  replyText.value = ''
}
function cancelReply() {
  replyingKey.value = null
  replyText.value = ''
}
function sendReply(q: QuestionItem) {
  const text = replyText.value.trim()
  if (!text) {
    uni.showToast({ title: '请输入回复内容', icon: 'none' })
    return
  }
  // 契约对齐后端 handleQuestionReply：{ studentId, questionId?, text }
  wsEmit(RoomEvent.QuestionReply, { studentId: q.studentId, text })
  const k = keyOf(q)
  repliedKeys.value.add(k)
  readKeys.value.add(k) // 回复即视为已处理，兼容未读逻辑
  replyingKey.value = null
  replyText.value = ''
  uni.showToast({ title: '回复已发送', icon: 'success' })
}

function timeVal(q: QuestionItem) {
  const t = Date.parse(q.time)
  return Number.isNaN(t) ? 0 : t
}

const total = computed(() => store.questions.length)
const unreadCount = computed(() =>
  store.questions.reduce((n, q) => n + (isRead(q) ? 0 : 1), 0),
)
const pages = computed(() => {
  const s = new Set<number>()
  for (const q of store.questions) s.add(q.slideIndex ?? 0)
  return Array.from(s).sort((a, b) => a - b)
})
const filtered = computed(() => {
  let list = store.questions.slice()
  if (pageFilter.value !== null) list = list.filter((q) => (q.slideIndex ?? 0) === pageFilter.value)
  if (unreadOnly.value) list = list.filter((q) => !isRead(q))
  if (sortMode.value === 'page') {
    list.sort((a, b) => (a.slideIndex ?? 0) - (b.slideIndex ?? 0) || timeVal(b) - timeVal(a))
  } else {
    list.sort((a, b) => timeVal(b) - timeVal(a))
  }
  return list
})

function formatTime(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

// 下课 / 重置后 store.questions 清空，同步清掉本地已读标记与失效筛选
watch(
  () => store.questions.length,
  (n) => {
    if (n === 0) {
      readKeys.value.clear()
      repliedKeys.value.clear()
      replyingKey.value = null
      replyText.value = ''
      pageFilter.value = null
      unreadOnly.value = false
    }
  },
)
// 当前页码筛选项在数据变化后已不存在时，回退到「全部」
watch(pages, (list) => {
  if (pageFilter.value !== null && !list.includes(pageFilter.value)) pageFilter.value = null
})
</script>

<style scoped lang="scss">
@import '@/styles/variables.scss';

.qb-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-4);
  border: 2rpx solid var(--color-outline-variant);
  border-radius: var(--radius-xl);
  background: var(--color-surface);
  box-shadow: var(--elevation-1);
}

.qb-spacer { flex: 1; }

/* 头部 */
.qb-head {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
.qb-title {
  font-size: var(--font-title-sm);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
}
.qb-count {
  font-size: var(--font-caption);
  color: var(--color-text-secondary);
}
.qb-badge {
  display: flex;
  align-items: center;
  gap: 4rpx;
  padding: 2rpx 12rpx;
  border-radius: var(--radius-pill);
  background: var(--color-danger-container);
}
.qb-badge-num {
  font-size: var(--font-caption);
  font-weight: var(--font-weight-bold);
  color: var(--color-danger);
  font-variant-numeric: tabular-nums;
}
.qb-badge-txt {
  font-size: var(--font-overline);
  color: var(--color-danger);
}
.qb-readall {
  display: flex;
  align-items: center;
  gap: 4rpx;
  padding: 6rpx 14rpx;
  border-radius: var(--radius-pill);
  background: var(--color-success-container);
}
.qb-readall-txt {
  font-size: var(--font-caption);
  font-weight: var(--font-weight-semibold);
  color: var(--color-success);
}

/* 工具条 */
.qb-toolbar {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
.qb-seg {
  display: flex;
  align-items: center;
  gap: 2rpx;
  padding: 3rpx;
  border-radius: var(--radius-md);
  background: var(--color-surface-variant);
}
.qb-seg-btn {
  display: flex;
  align-items: center;
  gap: 4rpx;
  padding: 6rpx 16rpx;
  border-radius: var(--radius-sm);
  &.active {
    background: var(--color-surface-raised);
    box-shadow: var(--elevation-1);
  }
}
.qb-seg-txt {
  font-size: var(--font-caption);
  color: var(--color-text-secondary);
  .qb-seg-btn.active & { color: var(--color-text-primary); font-weight: var(--font-weight-semibold); }
}

.qb-chip {
  display: flex;
  align-items: center;
  padding: 6rpx 18rpx;
  border-radius: var(--radius-pill);
  background: var(--color-surface-variant);
  &.active {
    background: var(--color-primary-container);
  }
}
.qb-chip-txt {
  font-size: var(--font-caption);
  color: var(--color-text-secondary);
  .qb-chip.active & { color: var(--color-on-primary-container); font-weight: var(--font-weight-semibold); }
}

/* 页码筛选行 */
.qb-pages { width: 100%; white-space: nowrap; }
.qb-pages-inner {
  display: flex;
  gap: var(--space-2);
  padding-bottom: 4rpx;
}

/* 列表 */
.qb-list {
  max-height: 520rpx;
}
.qb-item {
  display: flex;
  flex-direction: column;
  gap: 6rpx;
  padding: var(--space-3);
  margin-bottom: var(--space-2);
  border-radius: var(--radius-md);
  background: var(--color-surface-variant);
  &.unread {
    background: var(--color-primary-container);
  }
}
.qb-item-press { opacity: 0.7; }
.qb-item-meta {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
.qb-dot {
  width: 12rpx;
  height: 12rpx;
  border-radius: var(--radius-full);
  background: var(--color-primary);
  flex-shrink: 0;
}
.qb-name {
  font-size: var(--font-caption);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  max-width: 220rpx;
}
.qb-page {
  padding: 0 10rpx;
  font-size: var(--font-overline);
  color: var(--color-text-secondary);
  background: var(--color-surface-raised);
  border-radius: var(--radius-pill);
}
.qb-time {
  font-size: var(--font-overline);
  color: var(--color-text-tertiary);
  font-variant-numeric: tabular-nums;
}
.qb-text {
  font-size: var(--font-label);
  color: var(--color-text-primary);
  line-height: 1.45;
}

/* 空态 */
.qb-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-4) var(--space-2);
}
.qb-empty-txt {
  font-size: var(--font-caption);
  color: var(--color-text-secondary);
}

/* 回复入口 */
.qb-reply { margin-top: 4rpx; }
.qb-reply-bar,
.qb-reply-edit {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
.qb-reply-input {
  flex: 1;
  min-height: 56rpx;
  padding: 6rpx var(--space-3);
  background: var(--color-surface-raised);
  border: 2rpx solid var(--color-outline);
  border-radius: var(--radius-md);
  font-size: var(--font-caption);
  color: var(--color-text-primary);
}
.qb-reply-btn {
  display: flex;
  align-items: center;
  gap: 4rpx;
  padding: 6rpx 18rpx;
  border-radius: var(--radius-pill);
  background: var(--color-surface-raised);
  &.primary { background: var(--color-primary); }
}
.qb-reply-btn-txt {
  font-size: var(--font-caption);
  font-weight: var(--font-weight-semibold);
  color: var(--color-primary);
  &.on { color: var(--color-text-on-color); }
}
.qb-reply-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56rpx;
  height: 56rpx;
  border-radius: var(--radius-md);
  background: var(--color-surface-variant);
}
.qb-replied {
  display: flex;
  align-items: center;
  gap: 4rpx;
}
.qb-replied-txt {
  font-size: var(--font-overline);
  color: var(--color-success);
}

.qb-press { opacity: 0.6; }
</style>
