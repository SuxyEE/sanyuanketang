<template>
  <div class="broadcast-dialog" role="dialog" aria-label="广播消息">
    <div class="panel-header">
      <h3>广播消息</h3>
      <button class="close-btn" @click="$emit('close')" aria-label="关闭">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>

    <div class="panel-body">
      <p class="hint">消息将实时推送到所有学生端和大屏端</p>
      <textarea
        v-model="message"
        placeholder="输入广播内容..."
        rows="4"
        maxlength="200"
      ></textarea>
      <div class="char-count">{{ message.length }}/200</div>

      <div class="recent-list">
        <h4>快捷消息</h4>
        <button
          v-for="msg in quickMessages"
          :key="msg"
          class="quick-btn"
          @click="message = msg"
        >{{ msg }}</button>
      </div>

      <button
        class="send-btn"
        :disabled="!message.trim()"
        @click="sendBroadcast"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>
        发送广播
      </button>

      <div v-if="sent" class="sent-feedback">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#52c41a" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
        已发送
      </div>

      <div class="recent-list" v-if="recentMessages.length > 0">
        <h4>最近发送</h4>
        <div v-for="(r, i) in recentMessages" :key="i" class="recent-item">
          <span class="recent-text">{{ r.text }}</span>
          <span class="recent-time">{{ r.time }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const emit = defineEmits<{ close: []; send: [message: string] }>()

const message = ref('')
const sent = ref(false)
const recentMessages = ref<{ text: string; time: string }[]>([])

const quickMessages = [
  '请大家安静，注意听讲',
  '现在开始答题，限时5分钟',
  '请完成后举手示意',
  '下课前请提交今天的作业',
  '请打开课件第3页',
]

function sendBroadcast() {
  if (!message.value.trim()) return
  emit('send', message.value.trim())

  recentMessages.value.unshift({
    text: message.value.trim(),
    time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
  })

  sent.value = true
  message.value = ''
  setTimeout(() => { sent.value = false }, 2000)
}
</script>

<style scoped lang="scss">
.broadcast-dialog {
  position: fixed;
  inset: 0;
  z-index: 100;
  background: var(--bg-card);
  display: flex;
  flex-direction: column;
  animation: slideUp 0.25s ease-out;
}

@keyframes slideUp {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
  h3 { font-size: 17px; font-weight: 700; }
}

.close-btn {
  width: 44px; height: 44px; border-radius: 50%; border: none;
  background: var(--bg-page); color: var(--text-secondary);
  display: flex; align-items: center; justify-content: center; cursor: pointer;
}

.panel-body {
  flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 16px;
}

.hint { font-size: 13px; color: var(--text-muted); }

textarea {
  width: 100%; padding: 14px; border: 2px solid var(--border); border-radius: 12px;
  font-size: 15px; resize: none; outline: none; font-family: inherit;
  min-height: 100px;
  &:focus { border-color: var(--primary); }
}

.char-count {
  text-align: right; font-size: 11px; color: var(--text-muted); margin-top: -10px;
}

.quick-btn {
  display: inline-block;
  padding: 8px 14px; margin: 0 6px 6px 0;
  border: 1px solid var(--border); border-radius: 20px;
  background: var(--bg-page); font-size: 12px; color: var(--text-secondary);
  cursor: pointer; transition: all 0.2s;
  &:active { background: var(--primary-light); border-color: var(--primary); color: var(--primary); }
}

.send-btn {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  width: 100%; padding: 16px; border: none; border-radius: 16px;
  background: linear-gradient(135deg, #1677ff, #4096ff);
  color: #fff; font-size: 16px; font-weight: 700; cursor: pointer;
  min-height: 52px; transition: all 0.2s;
  &:disabled { opacity: 0.4; }
  &:active:not(:disabled) { transform: scale(0.98); }
}

.sent-feedback {
  display: flex; align-items: center; justify-content: center; gap: 6px;
  color: #52c41a; font-size: 14px; font-weight: 500;
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

.recent-list {
  h4 { font-size: 13px; color: var(--text-primary); font-weight: 600; margin-bottom: 8px; }
}

.recent-item {
  display: flex; justify-content: space-between; align-items: center;
  padding: 10px 12px; background: var(--bg-page); border-radius: 10px;
  margin-bottom: 6px;
  .recent-text { font-size: 13px; color: var(--text-primary); flex: 1; }
  .recent-time { font-size: 11px; color: var(--text-muted); margin-left: 10px; }
}
</style>
