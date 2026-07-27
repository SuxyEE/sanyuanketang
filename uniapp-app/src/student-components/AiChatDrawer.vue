<template>
  <view class="ai-drawer">
    <view class="drawer-mask" @tap="emit('close')"></view>
    <view class="drawer-body">
      <view class="drawer-head">
        <view class="title-wrap">
          <view class="title-icon-wrap"><Icon name="sparkles" size="md" tone="secondary" /></view>
          <view class="title-text">
            <text class="title">AI 学习助手</text>
            <text class="sub">基于本节课件实时答疑</text>
          </view>
        </view>
        <IconButton icon="x" size="md" aria-label="关闭 AI 答疑" @tap="emit('close')" />
      </view>

      <scroll-view scroll-y class="messages" :scroll-top="scrollTop">
        <view v-if="store.aiMessages.length === 0 && !streaming" class="empty-hint">
          <view class="empty-icon"><Icon name="sparkle-dot" size="2xl" tone="muted" /></view>
          <text class="empty-title">向 AI 提一个问题吧</text>
          <text class="empty-desc">可询问课件、知识点、题目解析等</text>
        </view>

        <view
          v-for="(msg, idx) in store.aiMessages"
          :key="idx"
          class="msg"
          :class="msg.role"
        >
          <view class="msg-meta">
            <view class="role-chip">
              <Icon
                :name="msg.role === 'user' ? 'user' : 'sparkles'"
                size="xs"
                :tone="msg.role === 'user' ? 'primary' : 'secondary'"
              />
              <text>{{ msg.role === 'user' ? '我' : 'AI' }}</text>
            </view>
            <text class="msg-time">{{ msg.time }}</text>
          </view>
          <view class="msg-body">
            <rich-text
              v-if="msg.role === 'assistant'"
              class="md-body"
              :nodes="renderMarkdown(msg.content)"
            />
            <text v-else>{{ msg.content }}</text>
          </view>
        </view>

        <view v-if="streaming" class="msg assistant">
          <view class="msg-meta">
            <view class="role-chip">
              <Icon name="sparkles" size="xs" tone="secondary" />
              <text>AI</text>
            </view>
            <view class="msg-time typing">
              <view class="typing-dot"></view>
              <view class="typing-dot"></view>
              <view class="typing-dot"></view>
              <text class="typing-text">生成中</text>
            </view>
          </view>
          <view class="msg-body">
            <rich-text
              v-if="streamBuffer"
              class="md-body"
              :nodes="renderMarkdown(streamBuffer)"
            />
            <text v-else class="stream-placeholder">正在生成回答…</text>
          </view>
        </view>
      </scroll-view>

      <view class="input-bar" :style="{ paddingBottom: `max(var(--space-3), var(--safe-bottom))` }">
        <input
          v-model="inputText"
          class="input"
          placeholder="输入你的问题，例如：第 3 页的公式如何推导？"
          confirm-type="send"
          :adjust-position="false"
          @confirm="send"
        />
        <Button
          variant="primary"
          size="md"
          :icon-left="streaming ? undefined : 'send'"
          :disabled="!inputText.trim() || streaming"
          :loading="streaming"
          aria-label="发送问题"
          @tap="send"
        >
          {{ streaming ? '生成中' : '发送' }}
        </Button>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, nextTick } from 'vue'
import { useStudentStore } from '@/stores/student'
import { useSocket } from '@/student-sockets/useSocket'
import { RoomEvent } from '@/shared/wsEvents'
import { useMarkdown } from '@/composables/useMarkdown'
import Icon from '@/student-components/ui/Icon.vue'
import IconButton from '@/student-components/ui/IconButton.vue'
import Button from '@/student-components/ui/Button.vue'

const { renderMarkdown } = useMarkdown()

const emit = defineEmits<{ close: [] }>()
const store = useStudentStore()
const { getSocket } = useSocket()

const inputText = ref('')
const streaming = ref(false)
const streamBuffer = ref('')
const scrollTop = ref(0)

function formatHm() {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

async function send() {
  const text = inputText.value.trim()
  if (!text || streaming.value) return

  store.pushAiMessage({ role: 'user', content: text, time: formatHm() })
  inputText.value = ''
  await nextTick()
  scrollToBottom()

  const s = getSocket()
  if (!s) {
    store.pushAiMessage({ role: 'assistant', content: '未连接到服务器，请稍候重试。', time: formatHm() })
    return
  }

  streaming.value = true
  streamBuffer.value = ''
  const handler = (data: { chunk: string; done: boolean; fullContent?: string; error?: boolean }) => {
    if (data.error) {
      streaming.value = false
      streamBuffer.value = ''
      store.pushAiMessage({ role: 'assistant', content: '抱歉，AI 暂时无法回复。', time: formatHm() })
      s.off(RoomEvent.AiStream, handler)
      return
    }
    if (data.done) {
      streaming.value = false
      store.pushAiMessage({
        role: 'assistant',
        content: data.fullContent || streamBuffer.value || '（空回复）',
        time: formatHm(),
      })
      streamBuffer.value = ''
      s.off(RoomEvent.AiStream, handler)
      nextTick(scrollToBottom)
      return
    }
    streamBuffer.value += data.chunk
    nextTick(scrollToBottom)
  }
  s.on(RoomEvent.AiStream, handler)

  s.emit(RoomEvent.AiChat, {
    message: text,
    stream: true,
    source: 'student-tablet',
    history: store.aiMessages.slice(-10),
    slideIndex: store.currentSlide,
  })
}

function scrollToBottom() {
  scrollTop.value = 999999
}
</script>

<style lang="scss" scoped>
@import '@/styles/variables.scss';

.ai-drawer {
  position: fixed;
  inset: 0;
  z-index: 500;
}

.drawer-mask {
  position: absolute;
  inset: 0;
  background: var(--color-scrim);
  animation: scrim-fade-in var(--duration-base) var(--ease-decelerate);
}

.drawer-body {
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
  .drawer-body { width: 50%; max-width: 720rpx; }
}

.drawer-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-5) var(--space-6);
  border-bottom: 2rpx solid var(--color-outline-variant);
}

.title-wrap {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-width: 0;
}

.title-icon-wrap {
  width: 72rpx;
  height: 72rpx;
  border-radius: var(--radius-md);
  background: var(--color-secondary-container);
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

.messages {
  flex: 1;
  padding: var(--space-4) var(--space-5);
}

.empty-hint {
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

.msg {
  margin-bottom: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.msg-meta {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.role-chip {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-2);
  background: var(--color-surface-variant);
  border-radius: var(--radius-sm);
  font-size: var(--font-overline);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-secondary);
  .user & { color: var(--color-primary); }
  .assistant & { color: var(--color-secondary); }
}

.msg-time {
  font-size: var(--font-overline);
  color: var(--color-text-tertiary);
  font-variant-numeric: tabular-nums;
}

.msg-time.typing {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
}

.typing-dot {
  width: 8rpx;
  height: 8rpx;
  border-radius: var(--radius-full);
  background: var(--color-secondary);
  animation: bounce 900ms infinite ease-in-out;
}
.typing-dot:nth-child(2) { animation-delay: 120ms; }
.typing-dot:nth-child(3) { animation-delay: 240ms; }
.typing-text { margin-left: var(--space-1); color: var(--color-text-tertiary); }

.msg-body {
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-lg);
  font-size: var(--font-body);
  line-height: var(--line-height-normal);
}

.stream-placeholder {
  color: var(--color-text-tertiary);
  font-style: italic;
}

/* —— Markdown rich-text 内容样式 —— */
.md-body {
  display: block;
  font-size: var(--font-body);
  line-height: var(--line-height-normal);
  color: var(--color-text-primary);
  word-break: break-word;

  /* rich-text 不支持 :deep()，但 nodes 渲染出的标签会继承父级样式
     这里设置一些常用 CSS 变量驱动的颜色/间距，rich-text 在 H5 / App-Plus 都生效 */
}

/* H5 端：rich-text 内的 HTML 元素能被外部 CSS 影响（含 :deep 在 scoped 下） */
.md-body :deep(p) { margin: 0 0 12rpx; line-height: var(--line-height-normal); }
.md-body :deep(p:last-child) { margin-bottom: 0; }
.md-body :deep(strong) { font-weight: var(--font-weight-bold); color: var(--color-text-primary); }
.md-body :deep(em) { font-style: italic; }
.md-body :deep(del) { text-decoration: line-through; color: var(--color-text-tertiary); }
.md-body :deep(a) {
  color: var(--color-primary);
  text-decoration: none;
  border-bottom: 2rpx solid rgba(47, 107, 255, 0.3);
}
.md-body :deep(ul),
.md-body :deep(ol) {
  margin: 6rpx 0 10rpx;
  padding-left: 40rpx;
}
.md-body :deep(li) { margin: 4rpx 0; line-height: var(--line-height-normal); }
.md-body :deep(ol) { list-style: decimal; }
.md-body :deep(ul) { list-style: disc; }
.md-body :deep(h1),
.md-body :deep(h2),
.md-body :deep(h3),
.md-body :deep(h4),
.md-body :deep(h5),
.md-body :deep(h6) {
  font-weight: var(--font-weight-bold);
  margin: 16rpx 0 8rpx;
  line-height: 1.4;
  color: var(--color-text-primary);
}
.md-body :deep(h1) { font-size: var(--font-title); }
.md-body :deep(h2) { font-size: var(--font-title-sm); }
.md-body :deep(h3) { font-size: var(--font-body-lg); }
.md-body :deep(h4),
.md-body :deep(h5),
.md-body :deep(h6) { font-size: var(--font-body); }
.md-body :deep(code) {
  font-family: 'SFMono-Regular', 'Cascadia Code', Consolas, 'Liberation Mono', monospace;
  background: var(--color-surface-variant);
  color: var(--color-secondary);
  padding: 2rpx 12rpx;
  border-radius: var(--radius-xs);
  font-size: 26rpx;
}
.md-body :deep(pre) {
  background: var(--color-surface-variant);
  border: 2rpx solid var(--color-outline-variant);
  border-radius: var(--radius-md);
  padding: 16rpx 20rpx;
  margin: 12rpx 0;
  overflow-x: auto;
}
.md-body :deep(pre code) {
  background: transparent;
  color: var(--color-text-primary);
  padding: 0;
  font-size: 24rpx;
  line-height: 1.6;
}
.md-body :deep(blockquote) {
  margin: 10rpx 0;
  padding: 10rpx 20rpx;
  border-left: 6rpx solid var(--color-primary);
  background: var(--color-primary-container);
  color: var(--color-text-secondary);
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
}
.md-body :deep(hr) {
  border: none;
  border-top: 2rpx solid var(--color-outline-variant);
  margin: 16rpx 0;
}
.md-body :deep(table) {
  border-collapse: collapse;
  width: 100%;
  margin: 10rpx 0;
  font-size: 26rpx;
}
.md-body :deep(table th),
.md-body :deep(table td) {
  border: 2rpx solid var(--color-outline-variant);
  padding: 10rpx 14rpx;
  text-align: left;
}
.md-body :deep(table th) {
  background: var(--color-surface-variant);
  font-weight: var(--font-weight-semibold);
}

.msg.user .msg-body {
  background: var(--color-primary-container);
  color: var(--color-on-primary-container);
  align-self: flex-end;
  max-width: 85%;
  border-bottom-right-radius: var(--radius-sm);
}

.msg.assistant .msg-body {
  background: var(--color-surface-variant);
  color: var(--color-text-primary);
  align-self: flex-start;
  max-width: 90%;
  border-bottom-left-radius: var(--radius-sm);
}

.input-bar {
  display: flex;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-5);
  border-top: 2rpx solid var(--color-outline-variant);
  align-items: center;
}

.input {
  flex: 1;
  height: 88rpx;
  padding: 0 var(--space-5);
  background: var(--color-surface-variant);
  border: 2rpx solid var(--color-outline);
  border-radius: var(--radius-pill);
  font-size: var(--font-body);
  color: var(--color-text-primary);
  transition: border-color var(--duration-base) var(--ease-standard);
  &:focus-within { border-color: var(--color-primary); }
}

@keyframes scrim-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes drawer-slide-in {
  from { transform: translateX(32rpx); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}

@keyframes bounce {
  0%, 80%, 100% { transform: scale(0.6); opacity: 0.5; }
  40% { transform: scale(1); opacity: 1; }
}
</style>
