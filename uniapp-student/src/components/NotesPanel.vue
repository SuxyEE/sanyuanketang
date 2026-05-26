<template>
  <view class="notes-drawer">
    <view class="mask" @tap="emit('close')"></view>
    <view class="body">
      <view class="head">
        <view class="title-wrap">
          <view class="title-icon-wrap"><Icon name="notebook" size="md" tone="primary" /></view>
          <view class="title-text">
            <text class="title">我的笔记</text>
            <text class="sub">本次课堂记录与教师广播</text>
          </view>
        </view>
        <view class="head-actions">
          <Button
            variant="secondary"
            size="sm"
            icon-left="download"
            aria-label="导出全部笔记"
            @tap="exportNotes"
          >
            导出
          </Button>
          <IconButton icon="x" size="md" aria-label="关闭笔记面板" @tap="emit('close')" />
        </view>
      </view>

      <view class="tabs" role="tablist">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          class="tab"
          :class="{ active: activeTab === tab.key }"
          hover-class="tab-hover"
          :hover-stay-time="60"
          :aria-selected="activeTab === tab.key"
          role="tab"
          @tap="activeTab = tab.key as 'notes' | 'broadcasts'"
        >
          <Icon :name="tab.icon" size="sm" :tone="activeTab === tab.key ? 'primary' : ''" />
          <text class="tab-label">{{ tab.label }}</text>
          <text v-if="tab.count > 0" class="tab-badge">{{ tab.count }}</text>
        </button>
      </view>

      <scroll-view scroll-y class="content" :scroll-top="scrollTop">
        <view v-if="activeTab === 'notes'" class="notes-tab">
          <view class="editor">
            <textarea
              v-model="noteInput"
              class="textarea"
              :placeholder="`记录第 ${store.currentSlide} 页的重点…`"
              :auto-height="true"
              :adjust-position="false"
            />
            <view class="editor-foot">
              <text class="char-count">{{ noteInput.length }} / 500</text>
              <Button
                variant="primary"
                size="sm"
                icon-left="check"
                :disabled="!noteInput.trim()"
                @tap="saveNote"
              >
                保存笔记
              </Button>
            </view>
          </view>

          <view v-if="notes.length === 0" class="empty-tab">
            <view class="empty-icon"><Icon name="notebook" size="2xl" tone="muted" /></view>
            <text class="empty-title">还没有笔记</text>
            <text class="empty-desc">遇到重点可以随时记录下来</text>
          </view>

          <view v-for="(n, idx) in notes" :key="idx" class="note-card">
            <view class="note-head">
              <Tag tone="primary" size="sm" icon="file-text">第 {{ n.slideIndex }} 页</Tag>
              <text class="time">{{ n.time }}</text>
            </view>
            <text class="note-body">{{ n.content }}</text>
          </view>
        </view>

        <view v-else-if="activeTab === 'broadcasts'" class="bcast-tab">
          <view v-if="store.broadcastHistory.length === 0" class="empty-tab">
            <view class="empty-icon"><Icon name="megaphone" size="2xl" tone="muted" /></view>
            <text class="empty-title">暂无教师广播</text>
            <text class="empty-desc">老师推送广播时会出现在这里</text>
          </view>
          <view v-for="b in store.broadcastHistory" :key="b.id" class="bcast-item">
            <view class="bcast-meta">
              <view class="from-chip">
                <Icon name="megaphone" size="xs" tone="secondary" />
                <text>{{ b.from || '教师' }}</text>
              </view>
              <text class="time">{{ b.time }}</text>
            </view>
            <text class="bcast-content">{{ b.message }}</text>
          </view>
        </view>
      </scroll-view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useStudentStore } from '@/stores/student'
import Icon from '@/components/ui/Icon.vue'
import IconButton from '@/components/ui/IconButton.vue'
import Button from '@/components/ui/Button.vue'
import Tag from '@/components/ui/Tag.vue'
import type { IconName } from '@/icons'

interface NoteItem {
  slideIndex: number
  content: string
  time: string
}

const emit = defineEmits<{ close: [] }>()
const store = useStudentStore()

const activeTab = ref<'notes' | 'broadcasts'>('notes')
const noteInput = ref('')
const notes = ref<NoteItem[]>([])
const scrollTop = ref(0)

const tabs = computed<Array<{ key: string; label: string; icon: IconName; count: number }>>(() => [
  { key: 'notes', label: '我的笔记', icon: 'notebook', count: notes.value.length },
  { key: 'broadcasts', label: '历史广播', icon: 'megaphone', count: store.broadcastHistory.length },
])

const storageKey = computed(() => `snyuan_notes_${store.studentId}`)

function loadNotes() {
  try {
    const raw = uni.getStorageSync(storageKey.value)
    notes.value = raw ? JSON.parse(raw) : []
  } catch { notes.value = [] }
}

function saveAll() {
  try { uni.setStorageSync(storageKey.value, JSON.stringify(notes.value)) } catch { /* ignore */ }
}

function saveNote() {
  const text = noteInput.value.trim()
  if (!text) return
  notes.value.unshift({
    slideIndex: store.currentSlide,
    content: text,
    time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
  })
  if (notes.value.length > 200) notes.value.length = 200
  noteInput.value = ''
  saveAll()
  uni.showToast({ title: '已保存', icon: 'success', duration: 1200 })
}

function exportNotes() {
  if (notes.value.length === 0) {
    uni.showToast({ title: '暂无笔记可导出', icon: 'none' })
    return
  }
  const text = notes.value
    .map(n => `[第${n.slideIndex}页 · ${n.time}] ${n.content}`)
    .join('\n')
  // #ifdef APP-PLUS
  uni.setClipboardData({ data: text })
  // #endif
  // #ifdef H5
  if (navigator.clipboard) navigator.clipboard.writeText(text)
  // #endif
  uni.showToast({ title: '已复制到剪贴板', icon: 'success' })
}

onMounted(loadNotes)
watch(() => store.studentId, loadNotes)
</script>

<style lang="scss" scoped>
@import '@/styles/variables.scss';

.notes-drawer {
  position: fixed;
  inset: 0;
  z-index: 500;
}

.mask {
  position: absolute;
  inset: 0;
  background: var(--color-scrim);
  animation: scrim-fade-in var(--duration-base) var(--ease-decelerate);
}

.body {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 80%;
  max-width: 720rpx;
  background: var(--color-surface);
  display: flex;
  flex-direction: column;
  box-shadow: var(--elevation-4);
  padding-top: var(--safe-top);
  animation: drawer-slide-in var(--duration-med) var(--ease-decelerate);
}

@media (min-aspect-ratio: 1/1) {
  .body { width: 50%; max-width: 720rpx; }
}

.head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-5) var(--space-6);
  border-bottom: 2rpx solid var(--color-outline-variant);
  gap: var(--space-3);
}

.title-wrap {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-width: 0;
  flex: 1;
}

.title-icon-wrap {
  width: 72rpx;
  height: 72rpx;
  border-radius: var(--radius-md);
  background: var(--color-primary-container);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.title-text {
  display: flex;
  flex-direction: column;
  gap: 2rpx;
  min-width: 0;
}

.title {
  font-size: var(--font-title-sm);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
}

.sub {
  font-size: var(--font-caption);
  color: var(--color-text-tertiary);
}

.head-actions {
  display: flex;
  gap: var(--space-2);
  align-items: center;
}

.tabs {
  display: flex;
  gap: var(--space-2);
  padding: 0 var(--space-5);
  border-bottom: 2rpx solid var(--color-outline-variant);
}

.tab {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-4) var(--space-3);
  font-size: var(--font-label);
  color: var(--color-text-secondary);
  border: 0;
  background: transparent;
  border-bottom: 4rpx solid transparent;
  font-weight: var(--font-weight-medium);
  transition: color var(--duration-base) var(--ease-standard),
              border-color var(--duration-base) var(--ease-standard);
  min-height: 88rpx;

  &::after { border: 0 !important; }

  &.active {
    color: var(--color-primary);
    border-color: var(--color-primary);
    font-weight: var(--font-weight-bold);
  }
}

.tab-hover {
  color: var(--color-text-primary);
}

.tab-label { color: inherit; }

.tab-badge {
  font-size: var(--font-overline);
  padding: 0 var(--space-2);
  height: 32rpx;
  min-width: 32rpx;
  border-radius: var(--radius-full);
  background: var(--color-primary-container);
  color: var(--color-on-primary-container);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: var(--font-weight-bold);
  font-variant-numeric: tabular-nums;
}

.content {
  flex: 1;
  padding: var(--space-4) var(--space-5);
  padding-bottom: max(var(--space-4), var(--safe-bottom));
}

.editor {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  margin-bottom: var(--space-5);
}

.textarea {
  width: 100%;
  padding: var(--space-4);
  background: var(--color-surface-variant);
  border: 2rpx solid var(--color-outline);
  border-radius: var(--radius-lg);
  font-size: var(--font-body);
  line-height: var(--line-height-normal);
  box-sizing: border-box;
  min-height: 144rpx;
  color: var(--color-text-primary);
  transition: border-color var(--duration-base) var(--ease-standard);
  &:focus-within { border-color: var(--color-primary); }
}

.editor-foot {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.char-count {
  font-size: var(--font-caption);
  color: var(--color-text-tertiary);
  font-variant-numeric: tabular-nums;
}

/* —— 笔记卡片 / 广播条目 —— */
.note-card,
.bcast-item {
  margin-bottom: var(--space-3);
  padding: var(--space-4);
  background: var(--color-surface-variant);
  border-radius: var(--radius-md);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.note-head,
.bcast-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.from-chip {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-2);
  background: var(--color-secondary-container);
  color: var(--color-on-secondary-container);
  border-radius: var(--radius-sm);
  font-size: var(--font-overline);
  font-weight: var(--font-weight-bold);
}

.time {
  font-size: var(--font-overline);
  color: var(--color-text-tertiary);
  font-variant-numeric: tabular-nums;
}

.note-body,
.bcast-content {
  font-size: var(--font-body);
  color: var(--color-text-primary);
  line-height: var(--line-height-normal);
}

.empty-tab {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-9) var(--space-5);
  gap: var(--space-3);
  text-align: center;
}

.empty-icon {
  width: 144rpx;
  height: 144rpx;
  border-radius: var(--radius-full);
  background: var(--color-surface-variant);
  display: flex;
  align-items: center;
  justify-content: center;
}

.empty-title {
  font-size: var(--font-title-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.empty-desc {
  font-size: var(--font-caption);
  color: var(--color-text-tertiary);
}

@keyframes scrim-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes drawer-slide-in {
  from { transform: translateX(32rpx); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}
</style>
