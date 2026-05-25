<template>
  <div class="group-discussion">
    <div class="group-header">
      <div class="group-info">
        <h3>第{{ groupId }}组 · 小组讨论</h3>
        <p class="topic">{{ topic || '开放讨论' }}</p>
      </div>
      <div class="timer" v-if="remainingTime > 0">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        {{ formatTime(remainingTime) }}
      </div>
    </div>

    <div class="members-bar">
      <div
        v-for="m in members"
        :key="m.id"
        class="member-chip"
        :class="{ ai: m.isAi, leader: m.isLeader }"
      >
        <span v-if="m.isAi" class="member-icon" v-html="botIcon" aria-hidden="true"></span>
        <span v-else class="member-initial">{{ m.name[0] }}</span>
        <span class="member-name">{{ m.name }}</span>
      </div>
    </div>

    <div class="chat-area" ref="chatArea">
      <div
        v-for="(msg, idx) in chatMessages"
        :key="idx"
        class="disc-msg"
        :class="{ mine: msg.isMine, ai: msg.isAi }"
      >
        <div class="msg-head">
          <span class="msg-author" :class="{ ai: msg.isAi }">{{ msg.author }}</span>
          <span class="msg-time">{{ msg.time }}</span>
        </div>
        <div class="msg-body">
          <div v-if="msg.isAi" class="md-body" v-html="renderMarkdown(msg.content)"></div>
          <p v-else>{{ msg.content }}</p>
        </div>
      </div>
    </div>

    <div class="input-area">
      <div class="ai-tip" v-if="showAiTip" @click="inputText = '@AI '">
        输入 <strong>@AI</strong> 可以向AI助手提问
      </div>
      <div class="input-row">
        <input
          v-model="inputText"
          placeholder="输入讨论内容... (输入@AI向AI提问)"
          @keyup.enter="sendDiscussionMsg"
          @input="checkAiMention"
          aria-label="讨论输入"
        />
        <button class="send-btn" @click="sendDiscussionMsg" :disabled="!inputText.trim()" aria-label="发送">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onUnmounted } from 'vue'
import { icons } from '@snyuan/shared'
import { useSocket } from '../composables/useSocket'
import { useMarkdown } from '../composables/useMarkdown'
import { useStudentStore } from '../stores/student'

const { renderMarkdown } = useMarkdown()
const studentStore = useStudentStore()

const props = defineProps<{
  groupId: number
  topic: string
  members: { id: string; name: string }[]
  duration: number
}>()

const { socket } = useSocket()

const botIcon = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/></svg>'

const inputText = ref('')
const showAiTip = ref(true)
const chatArea = ref<HTMLElement>()
const remainingTime = ref(props.duration * 60)

interface DiscMsg {
  author: string
  content: string
  time: string
  isMine: boolean
  isAi: boolean
}

const members = computed(() => {
  const real = (props.members || []).map((m, idx) => ({
    id: m.id,
    name: m.id === studentStore.studentId ? `我（${m.name}）` : m.name,
    isLeader: idx === 0,
    isAi: false,
  }))
  return [...real, { id: 'ai', name: 'AI 引导员', isLeader: false, isAi: true }]
})

const chatMessages = ref<DiscMsg[]>([
  { author: '系统', content: `讨论主题：${props.topic || '开放讨论'}。讨论时长 ${props.duration} 分钟，输入 @AI 可以请 AI 引导员加入讨论。`, time: now(), isMine: false, isAi: false },
  { author: 'AI 引导员', content: `大家好！我是本次讨论的 AI 引导员。围绕主题「${props.topic || '开放讨论'}」，请大家先各自分享一下想法。如有疑问，输入 @AI + 你的问题即可。`, time: now(), isMine: false, isAi: true },
])

function now() {
  return new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function scrollToBottom() {
  nextTick(() => {
    if (chatArea.value) chatArea.value.scrollTop = chatArea.value.scrollHeight
  })
}

function checkAiMention() {
  showAiTip.value = false
}

const GROUP_AI_SOURCE = `group-ai-${Math.random().toString(36).slice(2, 8)}`
let groupAiTimeout: ReturnType<typeof setTimeout> | null = null

function sendDiscussionMsg() {
  const text = inputText.value.trim()
  if (!text) return

  const s = socket.value
  if (s?.connected) {
    s.emit('group:msg', { groupId: String(props.groupId), text })
  } else {
    chatMessages.value.push({
      author: '我',
      content: text,
      time: now(),
      isMine: true,
      isAi: false,
    })
  }

  inputText.value = ''
  scrollToBottom()

  const isAiQuestion = text.includes('@AI') || text.includes('@ai')

  if (!isAiQuestion) return

  const question = text.replace(/@AI\s*/gi, '')
  if (s?.connected) {
    s.emit('ai:chat', {
      message: `学生在小组讨论中向你提问：${question}\n\n讨论主题：${props.topic}\n请以讨论引导者的身份回答，鼓励学生思考，给出引导性建议。`,
      courseContext: props.topic,
      source: GROUP_AI_SOURCE,
    })

    const handler = (data: { content: string; source?: string }) => {
      if (data.source && data.source !== GROUP_AI_SOURCE) return
      chatMessages.value.push({
        author: 'AI 引导员',
        content: data.content,
        time: now(),
        isMine: false,
        isAi: true,
      })
      scrollToBottom()
      s.off('ai:response', handler)
      if (groupAiTimeout) { clearTimeout(groupAiTimeout); groupAiTimeout = null }
    }
    s.on('ai:response', handler)

    if (groupAiTimeout) clearTimeout(groupAiTimeout)
    groupAiTimeout = setTimeout(() => {
      s.off('ai:response', handler)
      groupAiTimeout = null
      chatMessages.value.push({
        author: 'AI 引导员',
        content: 'AI 暂未响应，请稍后再问。',
        time: now(),
        isMine: false,
        isAi: true,
      })
      scrollToBottom()
    }, 20000)
  } else {
    setTimeout(() => {
      chatMessages.value.push({
        author: 'AI 引导员',
        content: `关于"${question}"，建议大家从多个角度思考这个问题。`,
        time: now(),
        isMine: false,
        isAi: true,
      })
      scrollToBottom()
    }, 1000)
  }
}

let timer: any

function onGroupMsg(data: { groupId: string; studentId: string; studentName: string; text: string; time: string }) {
  if (String(data.groupId) !== String(props.groupId)) return
  const isMine = data.studentId === studentStore.studentId
  const author = isMine ? '我' : data.studentName
  const lastSelf = chatMessages.value[chatMessages.value.length - 1]
  if (isMine && lastSelf && lastSelf.isMine && lastSelf.content === data.text) return
  chatMessages.value.push({
    author,
    content: data.text,
    time: new Date(data.time || Date.now()).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
    isMine,
    isAi: false,
  })
  scrollToBottom()
}

onMounted(() => {
  timer = setInterval(() => {
    if (remainingTime.value > 0) remainingTime.value--
  }, 1000)
  socket.value?.on('group:msg', onGroupMsg)
})

onUnmounted(() => {
  clearInterval(timer)
  if (groupAiTimeout) clearTimeout(groupAiTimeout)
  socket.value?.off('group:msg', onGroupMsg)
})
</script>

<style scoped lang="scss">
.group-discussion {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.group-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 16px;
  background: var(--bg-card);
  border-bottom: 1px solid var(--border);

  h3 { font-size: 15px; font-weight: 700; color: var(--text-primary); margin: 0; }
  .topic { font-size: 12px; color: var(--primary); margin: 2px 0 0; }

  .timer {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    background: #fff7e6;
    border-radius: 12px;
    font-size: 13px;
    font-weight: 600;
    color: #d46b08;
  }
}

.members-bar {
  display: flex;
  gap: 6px;
  padding: 10px 16px;
  overflow-x: auto;
  background: var(--bg-page);
  border-bottom: 1px solid var(--border);

  &::-webkit-scrollbar { display: none; }
}

.member-chip {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  background: var(--bg-card);
  border-radius: 16px;
  border: 1px solid var(--border);
  white-space: nowrap;
  flex-shrink: 0;

  &.ai {
    background: linear-gradient(135deg, rgba(22, 119, 255, 0.08), rgba(82, 196, 26, 0.08));
    border-color: rgba(22, 119, 255, 0.2);
  }

  &.leader { border-color: var(--primary); }

  .member-icon {
    display: flex;
    color: var(--primary);
  }

  .member-initial {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: var(--primary-light, #f6ffed);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    font-weight: 600;
    color: var(--primary);
  }

  .member-name {
    font-size: 12px;
    color: var(--text-primary);
  }
}

.chat-area {
  flex: 1;
  overflow-y: auto;
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  -webkit-overflow-scrolling: touch;
}

.disc-msg {
  .msg-head {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
  }

  .msg-author {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-secondary);

    &.ai { color: var(--primary); }
  }

  .msg-time {
    font-size: 10px;
    color: var(--text-muted);
  }

  .msg-body {
    padding: 10px 14px;
    border-radius: 12px;
    background: var(--bg-page);

    p {
      margin: 0;
      font-size: 14px;
      line-height: 1.6;
      color: var(--text-primary);
      white-space: pre-line;
    }

    .md-body {
      font-size: 14px; color: var(--text-primary); line-height: 1.65; word-break: break-word;
      :deep(p) { margin: 0 0 6px; white-space: normal; }
      :deep(p:last-child) { margin-bottom: 0; }
      :deep(strong) { font-weight: 700; }
      :deep(em) { font-style: italic; }
      :deep(a) { color: var(--primary); text-decoration: none; border-bottom: 1px solid rgba(22, 119, 255, 0.3); }
      :deep(ul), :deep(ol) { margin: 4px 0 6px; padding-left: 20px; }
      :deep(li) { margin: 2px 0; }
      :deep(ol) { list-style: decimal; }
      :deep(ul) { list-style: disc; }
      :deep(h1), :deep(h2), :deep(h3), :deep(h4) { font-weight: 700; margin: 6px 0 4px; line-height: 1.4; }
      :deep(h1) { font-size: 16px; }
      :deep(h2) { font-size: 15px; }
      :deep(h3), :deep(h4) { font-size: 14px; }
      :deep(code) { font-family: Consolas, monospace; background: rgba(22, 119, 255, 0.1); color: #c41d7f; padding: 1px 6px; border-radius: 4px; font-size: 12.5px; }
      :deep(pre) { background: rgba(0,0,0,0.04); border: 1px solid var(--border); border-radius: 6px; padding: 8px 10px; margin: 4px 0; overflow-x: auto; code { background: transparent; color: var(--text-primary); padding: 0; } }
      :deep(blockquote) { margin: 4px 0; padding: 4px 10px; border-left: 3px solid var(--primary); background: rgba(22, 119, 255, 0.04); color: var(--text-secondary); border-radius: 0 6px 6px 0; }
    }
  }

  &.mine .msg-body {
    background: var(--primary-light, #f6ffed);
    border: 1px solid rgba(82, 196, 26, 0.15);
  }

  &.ai .msg-body {
    background: linear-gradient(135deg, rgba(22, 119, 255, 0.06), rgba(82, 196, 26, 0.04));
    border: 1px solid rgba(22, 119, 255, 0.12);
  }
}

.input-area {
  padding: 10px 16px;
  padding-bottom: calc(10px + var(--safe-bottom));
  border-top: 1px solid var(--border);
  background: var(--bg-card);
}

.ai-tip {
  padding: 6px 12px;
  background: rgba(22, 119, 255, 0.06);
  border-radius: 8px;
  font-size: 11px;
  color: var(--text-secondary);
  margin-bottom: 8px;
  cursor: pointer;
  text-align: center;

  strong { color: var(--primary); }
}

.input-row {
  display: flex;
  gap: 8px;

  input {
    flex: 1;
    padding: 12px 16px;
    border: 1px solid var(--border);
    border-radius: 24px;
    font-size: 14px;
    outline: none;
    background: var(--bg-page);
    min-height: 44px;

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

    &:disabled { opacity: 0.3; }
    &:not(:disabled):active { transform: scale(0.95); }
  }
}
</style>
