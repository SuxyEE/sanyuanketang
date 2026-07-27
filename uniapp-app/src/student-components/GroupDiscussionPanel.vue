<template>
  <view class="group-discussion">
    <view class="head">
      <view class="info">
        <view class="info-title-row">
          <button class="back-btn" @tap="$emit('back')">
            <Icon name="chevron-left" size="md" />
          </button>
          <view class="info-icon-wrap"><Icon name="users" size="sm" tone="primary" /></view>
          <text class="title">{{ group.name }} · 小组讨论</text>
        </view>
        <text class="topic">{{ group.topic || '开放讨论 · 围绕本节课主题展开' }}</text>
      </view>
      <view v-if="remainingTime > 0" class="timer">
        <Icon name="clock" size="xs" tone="primary" />
        <text class="timer-text">{{ formatTime(remainingTime) }}</text>
      </view>
    </view>

    <view class="members">
      <view
        v-for="m in group.members"
        :key="m.id"
        class="member-chip"
        :class="{ me: m.id === studentId }"
      >
        <view class="initial">
          <text>{{ m.name?.[0] || '?' }}</text>
        </view>
        <text class="name">{{ m.name }}{{ m.id === studentId ? ' · 我' : '' }}</text>
      </view>
    </view>

    <scroll-view scroll-y class="chat-area" :scroll-top="scrollTop">
      <view
        v-for="(msg, idx) in messages"
        :key="idx"
        class="msg"
        :class="{ mine: msg.isMine, ai: msg.isAi, system: msg.isSystem }"
      >
        <view class="msg-head">
          <view class="author-chip" :class="{ ai: msg.isAi, system: msg.isSystem }">
            <Icon
              :name="msg.isAi ? 'sparkles' : msg.isSystem ? 'info' : 'user'"
              size="xs"
            />
            <text class="author">{{ msg.author }}</text>
          </view>
          <text class="time">{{ msg.time }}</text>
        </view>
        <view class="body">
          <text>{{ msg.content }}</text>
        </view>
      </view>
    </scroll-view>

    <view class="input-bar">
      <view class="ai-tip" v-if="showAiTip" @tap="prefillAi">
        <Icon name="sparkles" size="xs" tone="secondary" />
        <text>输入 <text class="hl">@AI</text> 可向 AI 提问</text>
      </view>
      <view class="input-row">
        <input
          v-model="inputText"
          class="input"
          placeholder="输入讨论内容，@AI 开头可询问 AI"
          confirm-type="send"
          :adjust-position="false"
          @input="checkAiMention"
          @confirm="send"
        />
        <Button
          variant="primary"
          size="md"
          icon-left="send"
          :disabled="!inputText.trim()"
          aria-label="发送讨论内容"
          @tap="send"
        >
          发送
        </Button>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { useSocket } from '@/student-sockets/useSocket'
import { useStudentStore } from '@/stores/student'
import { RoomEvent } from '@/shared/wsEvents'
import type { GroupData } from '@/shared/types'
import Icon from '@/student-components/ui/Icon.vue'
import Button from '@/student-components/ui/Button.vue'

const props = defineProps<{
  group: GroupData
  studentId: string
  studentName: string
}>()

defineEmits<{ back: [] }>()

const { getSocket } = useSocket()
const store = useStudentStore()

interface ChatMessage {
  author: string
  content: string
  time: string
  isMine: boolean
  isAi: boolean
  isSystem?: boolean
}

const messages = ref<ChatMessage[]>([
  {
    author: '系统提示',
    content: '小组讨论已开始，请围绕主题积极交流。',
    time: formatHm(),
    isMine: false,
    isAi: false,
    isSystem: true,
  },
])
const inputText = ref('')
const showAiTip = ref(true)
const scrollTop = ref(0)
const remainingTime = ref(10 * 60)

let timer: ReturnType<typeof setInterval> | null = null

function formatHm() {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function formatTime(sec: number) {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function push(msg: ChatMessage) {
  messages.value.push(msg)
  if (messages.value.length > 100) messages.value.splice(0, 20)
  nextTick(() => { scrollTop.value = 999999 })
}

function checkAiMention() {
  showAiTip.value = !inputText.value.startsWith('@AI')
}

function prefillAi() {
  inputText.value = '@AI '
  showAiTip.value = false
}

function send() {
  const text = inputText.value.trim()
  if (!text) return
  const s = getSocket()
  if (!s) return

  push({ author: props.studentName, content: text, time: formatHm(), isMine: true, isAi: false })

  if (text.startsWith('@AI')) {
    const q = text.replace(/^@AI\s*/i, '').trim()
    s.emit(RoomEvent.AiChat, {
      message: q,
      source: 'group-discussion',
      groupId: props.group.id,
      slideIndex: store.currentSlide,
      stream: false,
    })
    push({ author: 'AI', content: '思考中…', time: formatHm(), isMine: false, isAi: true })
  } else {
    s.emit(RoomEvent.GroupMsg, { groupId: props.group.id, text })
  }
  inputText.value = ''
  showAiTip.value = true
}

function onGroupMsg(data: any) {
  if (data.groupId !== props.group.id) return
  if (data.studentId === props.studentId) return
  if (data.studentId === '__ai__' && data.originStudentId === props.studentId) return
  push({
    author: data.studentName,
    content: data.text,
    time: formatHm(),
    isMine: false,
    isAi: data.studentId === '__ai__',
  })
}

function onAiResp(data: any) {
  if (data.source !== 'group-discussion') return
  for (let i = messages.value.length - 1; i >= 0; i--) {
    if (messages.value[i].isAi && messages.value[i].content === '思考中…') {
      messages.value[i] = { ...messages.value[i], content: data.content || '（无回复）', time: formatHm() }
      return
    }
  }
  push({ author: 'AI', content: data.content || '（无回复）', time: formatHm(), isMine: false, isAi: true })
}

onMounted(() => {
  const s = getSocket()
  s?.on(RoomEvent.GroupMsg, onGroupMsg)
  s?.on(RoomEvent.AiResponse, onAiResp)

  timer = setInterval(() => {
    if (remainingTime.value > 0) remainingTime.value--
  }, 1000)
})

onUnmounted(() => {
  const s = getSocket()
  s?.off(RoomEvent.GroupMsg, onGroupMsg)
  s?.off(RoomEvent.AiResponse, onAiResp)
  if (timer) clearInterval(timer)
})
</script>

<style lang="scss" scoped>
@import '@/styles/variables.scss';

.group-discussion {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-4) var(--space-5);
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  box-shadow: var(--elevation-1);
  gap: var(--space-3);
}

.info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.back-btn {
  width: 56rpx;
  height: 56rpx;
  border-radius: var(--radius-full);
  background: var(--color-surface-variant);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  padding: 0;
  border: none;
  color: var(--color-text-primary);
}

.info-title-row {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
}

.info-icon-wrap {
  width: 48rpx;
  height: 48rpx;
  border-radius: var(--radius-sm);
  background: var(--color-primary-container);
  display: flex;
  align-items: center;
  justify-content: center;
}

.title {
  font-size: var(--font-body-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.topic {
  font-size: var(--font-caption);
  color: var(--color-text-secondary);
  padding-left: 56rpx;
}

.timer {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  background: var(--color-primary-container);
  color: var(--color-on-primary-container);
  border-radius: var(--radius-pill);
  flex-shrink: 0;
}

.timer-text {
  font-size: var(--font-body);
  font-weight: var(--font-weight-semibold);
  font-variant-numeric: tabular-nums;
}

.members {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  background: var(--color-surface);
  border-radius: var(--radius-md);
  box-shadow: var(--elevation-1);
}

.member-chip {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-1) var(--space-3) var(--space-1) var(--space-1);
  background: var(--color-surface-variant);
  border-radius: var(--radius-pill);

  &.me {
    background: var(--color-primary-container);
    color: var(--color-on-primary-container);
    .initial { background: var(--color-primary); }
  }
}

.initial {
  width: 48rpx;
  height: 48rpx;
  border-radius: var(--radius-full);
  background: var(--color-text-secondary);
  color: var(--color-text-on-color);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-caption);
  font-weight: var(--font-weight-bold);
}

.name {
  font-size: var(--font-caption);
  font-weight: var(--font-weight-medium);
}

.chat-area {
  flex: 1;
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  box-shadow: var(--elevation-1);
}

.msg {
  margin-bottom: var(--space-3);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.msg-head {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.author-chip {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-2);
  background: var(--color-surface-variant);
  color: var(--color-text-secondary);
  border-radius: var(--radius-sm);
  font-size: var(--font-overline);
  font-weight: var(--font-weight-bold);

  &.ai {
    background: var(--color-secondary-container);
    color: var(--color-on-secondary-container);
  }
  &.system {
    background: var(--color-warning-container);
    color: var(--color-on-warning-container);
  }
}

.time {
  font-size: var(--font-overline);
  color: var(--color-text-tertiary);
  font-variant-numeric: tabular-nums;
}

.body {
  padding: var(--space-3) var(--space-4);
  background: var(--color-surface-variant);
  border-radius: var(--radius-lg);
  font-size: var(--font-body);
  line-height: var(--line-height-normal);
  color: var(--color-text-primary);
  max-width: 85%;
}

.msg.mine .body {
  background: var(--color-primary-container);
  color: var(--color-on-primary-container);
  align-self: flex-end;
  border-bottom-right-radius: var(--radius-sm);
}

.msg.ai .body {
  background: var(--color-secondary-container);
  color: var(--color-on-secondary-container);
  border-bottom-left-radius: var(--radius-sm);
}

.msg.system .body {
  background: var(--color-warning-container);
  color: var(--color-on-warning-container);
  font-style: italic;
}

.input-bar {
  padding: var(--space-3) var(--space-4);
  padding-bottom: max(var(--space-3), var(--safe-bottom));
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  box-shadow: var(--elevation-1);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.ai-tip {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--font-caption);
  color: var(--color-text-tertiary);
  padding: var(--space-2) var(--space-3);

  .hl {
    color: var(--color-secondary);
    font-weight: var(--font-weight-bold);
    margin: 0 4rpx;
  }
}

.input-row {
  display: flex;
  gap: var(--space-3);
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
</style>
