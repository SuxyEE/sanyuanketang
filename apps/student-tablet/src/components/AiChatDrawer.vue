<template>
  <transition name="drawer">
    <div v-if="visible" class="ai-drawer" role="dialog" aria-label="AI学习助手">
      <div class="drawer-header">
        <div class="header-left">
          <span class="ai-avatar" v-html="botIcon" aria-hidden="true"></span>
          <div>
            <h3>AI 学习助手</h3>
            <p class="context-hint">当前讲到：第{{ currentSlide }}页</p>
          </div>
        </div>
        <button class="close-btn" @click="$emit('close')" aria-label="关闭AI助手">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      <div class="drawer-body" ref="chatContainer">
        <div class="quick-actions">
          <button
            v-for="q in quickQuestions"
            :key="q"
            class="quick-btn"
            @click="sendQuickQuestion(q)"
          >
            {{ q }}
          </button>
        </div>

        <div
          v-for="(msg, idx) in messages"
          :key="idx"
          class="chat-msg"
          :class="msg.role"
        >
          <div class="msg-avatar">
            <span v-if="msg.role === 'user'">我</span>
            <span v-else v-html="botIconSmall" aria-hidden="true"></span>
          </div>
          <div class="msg-bubble">
            <div v-if="msg.role === 'assistant'" class="msg-text md-body" v-html="renderMarkdown(msg.content)"></div>
            <p v-else class="msg-text">{{ msg.content }}</p>
            <div v-if="msg.role === 'assistant' && msg.sources" class="msg-sources">
              <span class="source-tag" v-for="s in msg.sources" :key="s">{{ s }}</span>
            </div>
            <div class="msg-footer">
              <span class="msg-time">{{ msg.time }}</span>
              <TtsButton v-if="msg.role === 'assistant'" :text="stripMarkdown(msg.content)" />
            </div>
          </div>
        </div>

        <div v-if="streamingMessage" class="chat-msg assistant">
          <div class="msg-avatar"><span v-html="botIconSmall" aria-hidden="true"></span></div>
          <div class="msg-bubble">
            <div class="msg-text streaming">{{ streamingMessage.content }}<span class="cursor-blink" aria-hidden="true">▋</span></div>
          </div>
        </div>

        <div v-if="isTyping && !streamingMessage" class="chat-msg assistant">
          <div class="msg-avatar"><span v-html="botIconSmall" aria-hidden="true"></span></div>
          <div class="msg-bubble typing">
            <span class="dot"></span><span class="dot"></span><span class="dot"></span>
          </div>
        </div>
      </div>

      <div class="drawer-input">
        <div class="input-row">
          <input
            v-model="inputText"
            placeholder="问AI关于当前课程的问题..."
            @keyup.enter="sendMessage"
            aria-label="输入问题"
          />
          <button
            class="send-btn"
            @click="sendMessage"
            :disabled="!inputText.trim()"
            aria-label="发送"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </button>
        </div>
        <div class="input-hint">AI 结合当前课件内容回答，仅供学习参考</div>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { ref, nextTick, watch, onUnmounted } from 'vue'
import { icons } from '@snyuan/shared'
import { useSocket } from '../composables/useSocket'
import { useMarkdown } from '../composables/useMarkdown'
import TtsButton from './TtsButton.vue'

/** Strip markdown so the TTS engine reads natural prose, not the syntax. */
function stripMarkdown(md: string): string {
  return (md || '')
    .replace(/```[\s\S]*?```/g, '（一段代码）')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    .replace(/^>\s?/gm, '')
    .replace(/\|/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const { renderMarkdown } = useMarkdown()

const SOURCE_ID = 'ai-chat-drawer'

const props = defineProps<{
  visible: boolean
  currentSlide: number
  courseName: string
}>()

defineEmits<{ close: [] }>()

const { socket } = useSocket()
const botIcon = icons.bot
const botIconSmall = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" y1="16" x2="8" y2="16"/><line x1="16" y1="16" x2="16" y2="16"/></svg>'

const inputText = ref('')
const isTyping = ref(false)
const chatContainer = ref<HTMLElement>()

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  time: string
  sources?: string[]
}

const messages = ref<ChatMessage[]>([
  {
    role: 'assistant',
    content: `你好！我是AI学习助手，正在跟随「${props.courseName}」的课程内容。有任何不懂的地方随时问我！`,
    time: now(),
    sources: ['课程知识库'],
  },
])

const quickQuestions = ref([
  '这页的重点是什么？',
  '能举个实际案例吗？',
  '这个怎么操作？',
  '帮我总结一下',
])

function now() {
  return new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

function scrollToBottom() {
  nextTick(() => {
    if (chatContainer.value) {
      chatContainer.value.scrollTop = chatContainer.value.scrollHeight
    }
  })
}

function sendQuickQuestion(q: string) {
  inputText.value = q
  sendMessage()
}

const streamingMessage = ref<ChatMessage | null>(null)
let timeoutId: ReturnType<typeof setTimeout> | null = null

function onAiResponse(data: { content: string; sources?: string[]; source?: string }) {
  if (data.source && data.source !== SOURCE_ID) return
  clearAiTimeout()
  isTyping.value = false
  streamingMessage.value = null
  messages.value.push({
    role: 'assistant',
    content: data.content,
    time: now(),
    sources: data.sources,
  })
  scrollToBottom()
}

function onAiStream(data: { chunk: string; done: boolean; fullContent?: string; source?: string }) {
  if (data.source && data.source !== SOURCE_ID) return
  if (data.done) {
    clearAiTimeout()
    isTyping.value = false
    const finalContent = data.fullContent || streamingMessage.value?.content || ''
    streamingMessage.value = null
    if (finalContent.trim()) {
      messages.value.push({
        role: 'assistant',
        content: finalContent,
        time: now(),
        sources: ['AI大模型'],
      })
    }
    scrollToBottom()
  } else {
    isTyping.value = false
    if (!streamingMessage.value) {
      streamingMessage.value = { role: 'assistant', content: '', time: now() }
    }
    streamingMessage.value.content += data.chunk
    scrollToBottom()
  }
}

function bindListeners() {
  const s = socket.value
  if (!s) return
  s.off('ai:response', onAiResponse)
  s.off('ai:stream', onAiStream)
  s.on('ai:response', onAiResponse)
  s.on('ai:stream', onAiStream)
}

function clearAiTimeout() {
  if (timeoutId) {
    clearTimeout(timeoutId)
    timeoutId = null
  }
}

function sendMessage() {
  const text = inputText.value.trim()
  if (!text) return

  messages.value.push({
    role: 'user',
    content: text,
    time: now(),
  })

  inputText.value = ''
  isTyping.value = true
  streamingMessage.value = null
  scrollToBottom()

  bindListeners()

  const s = socket.value
  if (s?.connected) {
    s.emit('ai:chat', {
      message: text,
      courseContext: props.courseName,
      slideIndex: props.currentSlide,
      history: messages.value.slice(-6).map(m => ({ role: m.role, content: m.content })),
      stream: true,
      source: SOURCE_ID,
    })

    clearAiTimeout()
    timeoutId = setTimeout(() => {
      timeoutId = null
      if (isTyping.value && !streamingMessage.value) {
        isTyping.value = false
        messages.value.push({
          role: 'assistant',
          content: '抱歉，AI助手暂时未能回复。请稍后重试或直接向老师提问。',
          time: now(),
        })
        scrollToBottom()
      }
    }, 15000)
  } else {
    isTyping.value = false
    messages.value.push({
      role: 'assistant',
      content: `抱歉，当前未连接到服务器。请检查网络后重试。`,
      time: now(),
    })
    scrollToBottom()
  }
}

watch(() => props.visible, (val) => {
  if (val) {
    scrollToBottom()
    bindListeners()
  }
})

onUnmounted(() => {
  clearAiTimeout()
  const s = socket.value
  s?.off('ai:response', onAiResponse)
  s?.off('ai:stream', onAiStream)
})
</script>

<style scoped lang="scss">
.drawer-enter-active,
.drawer-leave-active {
  transition: transform 0.25s ease-out;
}
.drawer-enter-from,
.drawer-leave-to {
  transform: translateY(100%);
}

.ai-drawer {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 70vh;
  z-index: 200;
  background: var(--bg-card);
  border-top-left-radius: 20px;
  border-top-right-radius: 20px;
  box-shadow: 0 -8px 32px rgba(0, 0, 0, 0.12);
  display: flex;
  flex-direction: column;
}

.drawer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);

  .header-left {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .ai-avatar {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: linear-gradient(135deg, #1677ff, #52c41a);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;

    :deep(svg) { width: 18px; height: 18px; }
  }

  h3 {
    font-size: 15px;
    font-weight: 700;
    color: var(--text-primary);
  }

  .context-hint {
    font-size: 11px;
    color: var(--primary);
    margin-top: 1px;
  }
}

.close-btn {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: none;
  background: var(--bg-page);
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.drawer-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  -webkit-overflow-scrolling: touch;
}

.quick-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border);
}

.quick-btn {
  padding: 8px 14px;
  border: 1px solid var(--border);
  border-radius: 20px;
  background: var(--bg-card);
  font-size: 12px;
  color: var(--primary);
  cursor: pointer;
  min-height: 36px;
  transition: all 0.2s;
  white-space: nowrap;

  &:active {
    background: var(--primary-light, #e6f4ff);
    border-color: var(--primary);
  }
}

.chat-msg {
  display: flex;
  gap: 10px;
  animation: fadeIn 0.25s ease;

  &.user {
    flex-direction: row-reverse;

    .msg-avatar {
      background: var(--primary);
    }

    .msg-bubble {
      background: var(--primary-light, #e6f4ff);
      border: 1px solid rgba(22, 119, 255, 0.12);
    }
  }

  &.assistant {
    .msg-avatar {
      background: linear-gradient(135deg, #1677ff, #52c41a);
    }

    .msg-bubble {
      background: var(--bg-page);
      border: 1px solid var(--border);
    }
  }
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}

.msg-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: #fff;
  font-size: 12px;
  font-weight: 700;

  :deep(svg) { width: 14px; height: 14px; }
}

.msg-bubble {
  max-width: 80%;
  padding: 12px 14px;
  border-radius: 12px;

  &.typing {
    display: flex;
    gap: 4px;
    align-items: center;
    padding: 14px 20px;

    .dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--text-muted);
      animation: typingDot 1s ease infinite;

      &:nth-child(2) { animation-delay: 0.15s; }
      &:nth-child(3) { animation-delay: 0.3s; }
    }
  }
}

@keyframes typingDot {
  0%, 100% { opacity: 0.3; transform: translateY(0); }
  50% { opacity: 1; transform: translateY(-3px); }
}

.msg-text {
  font-size: 14px;
  color: var(--text-primary);
  line-height: 1.65;
  margin: 0;

  &:not(.md-body) { white-space: pre-wrap; word-break: break-word; }
}

.cursor-blink {
  display: inline-block;
  animation: blink 0.85s step-end infinite;
  color: var(--primary);
  font-weight: 700;
  margin-left: 2px;
  font-size: 14px;
  line-height: 1;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

.md-body {
  word-break: break-word;
  :deep(p) { margin: 0 0 8px; line-height: 1.65; }
  :deep(p:last-child) { margin-bottom: 0; }
  :deep(strong) { font-weight: 700; color: var(--text-primary); }
  :deep(em) { font-style: italic; }
  :deep(del) { text-decoration: line-through; color: var(--text-muted); }
  :deep(a) {
    color: var(--primary);
    text-decoration: none;
    border-bottom: 1px solid rgba(22, 119, 255, 0.3);
    &:hover { border-bottom-color: var(--primary); }
  }
  :deep(ul), :deep(ol) {
    margin: 4px 0 8px;
    padding-left: 22px;
    li { margin: 2px 0; line-height: 1.65; }
  }
  :deep(ol) { list-style: decimal; }
  :deep(ul) { list-style: disc; }
  :deep(h1), :deep(h2), :deep(h3), :deep(h4), :deep(h5), :deep(h6) {
    font-weight: 700;
    margin: 10px 0 6px;
    line-height: 1.4;
    color: var(--text-primary);
  }
  :deep(h1) { font-size: 18px; }
  :deep(h2) { font-size: 16px; }
  :deep(h3) { font-size: 15px; }
  :deep(h4), :deep(h5), :deep(h6) { font-size: 14px; }
  :deep(code) {
    font-family: 'SFMono-Regular', 'Cascadia Code', Consolas, 'Liberation Mono', monospace;
    background: rgba(22, 119, 255, 0.08);
    color: #c41d7f;
    padding: 1px 6px;
    border-radius: 4px;
    font-size: 12.5px;
  }
  :deep(pre) {
    background: #f5f7fa;
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 10px 12px;
    margin: 6px 0;
    overflow-x: auto;
    code {
      background: transparent;
      color: var(--text-primary);
      padding: 0;
    }
  }
  :deep(blockquote) {
    margin: 6px 0;
    padding: 6px 12px;
    border-left: 3px solid var(--primary);
    background: rgba(22, 119, 255, 0.05);
    color: var(--text-secondary);
    border-radius: 0 6px 6px 0;
  }
  :deep(hr) {
    border: none;
    border-top: 1px solid var(--border);
    margin: 10px 0;
  }
  :deep(table) {
    border-collapse: collapse;
    width: 100%;
    margin: 6px 0;
    font-size: 13px;
    th, td { border: 1px solid var(--border); padding: 6px 10px; text-align: left; }
    th { background: rgba(22, 119, 255, 0.05); font-weight: 600; }
  }
}

.msg-sources {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  margin-top: 8px;
}

.source-tag {
  padding: 2px 8px;
  background: rgba(22, 119, 255, 0.08);
  border-radius: 10px;
  font-size: 10px;
  color: var(--primary);
}

.msg-footer {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
  flex-wrap: wrap;
}

.msg-time {
  display: block;
  font-size: 10px;
  color: var(--text-muted);
  margin-top: 6px;
  text-align: right;
}

.drawer-input {
  padding: 12px 20px;
  padding-bottom: calc(12px + var(--safe-bottom));
  border-top: 1px solid var(--border);

  .input-row {
    display: flex;
    gap: 8px;
  }

  input {
    flex: 1;
    padding: 12px 16px;
    border: 1px solid var(--border);
    border-radius: 24px;
    font-size: 14px;
    outline: none;
    background: var(--bg-page);
    min-height: 44px;
    transition: border-color 0.2s;

    &:focus { border-color: var(--primary); background: var(--bg-card); }
  }

  .send-btn {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    border: none;
    background: var(--primary);
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    flex-shrink: 0;
    transition: all 0.2s;

    &:disabled { opacity: 0.3; }
    &:not(:disabled):active { transform: scale(0.95); }
  }

  .input-hint {
    font-size: 10px;
    color: var(--text-muted);
    text-align: center;
    margin-top: 6px;
  }
}
</style>
