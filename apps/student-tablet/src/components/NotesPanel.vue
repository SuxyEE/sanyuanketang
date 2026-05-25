<template>
  <transition name="drawer">
    <div v-if="visible" class="notes-panel" role="dialog" aria-label="课堂笔记">
      <div class="panel-header">
        <div class="header-left">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          <h3>课堂笔记</h3>
          <span class="note-count">{{ notes.length }} 条</span>
        </div>
        <button class="close-btn" @click="$emit('close')" aria-label="关闭">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      <div class="quick-tags">
        <button v-for="tag in quickTags" :key="tag" class="quick-tag" @click="addQuickNote(tag)">
          {{ tag }}
        </button>
      </div>

      <div class="note-input-area">
        <textarea
          v-model="noteText"
          placeholder="记录课堂笔记..."
          @keydown.ctrl.enter="addNote"
          rows="2"
        ></textarea>
        <div class="input-footer">
          <span class="slide-hint">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/></svg>
            P{{ currentSlide }}
          </span>
          <button class="add-btn" @click="addNote" :disabled="!noteText.trim()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            添加
          </button>
        </div>
      </div>

      <div class="notes-body">
        <div v-if="notes.length === 0" class="empty-state">
          <p>还没有笔记</p>
          <p class="sub">点击快捷标签或输入内容开始记录</p>
        </div>

        <div v-for="slideIdx in sortedSlideIndexes" :key="slideIdx" class="note-group">
          <div class="group-header">
            <span class="group-label">第 {{ slideIdx }} 页</span>
            <span class="group-count">{{ (groupedNotes[slideIdx] || []).length }} 条</span>
          </div>
          <div v-for="note in (groupedNotes[slideIdx] || [])" :key="note.id" class="note-card">
            <div class="note-content">{{ note.content }}</div>
            <div class="note-footer">
              <span class="note-time">{{ note.time }}</span>
              <button class="delete-btn" @click="deleteNote(note.id)" aria-label="删除笔记">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="panel-footer">
        <button class="export-btn" @click="exportNotes" :disabled="notes.length === 0">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          导出笔记
        </button>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'

interface Note {
  id: string
  content: string
  slideIndex: number
  time: string
  timestamp: number
}

const props = defineProps<{
  visible: boolean
  currentSlide: number
  courseName: string
}>()

defineEmits<{ close: [] }>()

const noteText = ref('')
const quickTags = ['重点', '不懂', '需要复习', '有趣', '易错点']

const storageKey = computed(() => `snyuan_student_notes:${encodeURIComponent(props.courseName || 'default')}`)

function loadNotes(): Note[] {
  try {
    const saved = localStorage.getItem(storageKey.value)
    return saved ? JSON.parse(saved) : []
  } catch { return [] }
}

function saveNotes() {
  localStorage.setItem(storageKey.value, JSON.stringify(notes.value))
}

const notes = ref<Note[]>(loadNotes())

const groupedNotes = computed(() => {
  const map: Record<number, Note[]> = {}
  const sorted = [...notes.value].sort((a, b) => b.timestamp - a.timestamp)
  for (const note of sorted) {
    if (!map[note.slideIndex]) map[note.slideIndex] = []
    map[note.slideIndex].push(note)
  }
  return map
})

const sortedSlideIndexes = computed(() =>
  Object.keys(groupedNotes.value).map(Number).sort((a, b) => a - b),
)

const currentSlideNoteCount = computed(() =>
  notes.value.filter(n => n.slideIndex === props.currentSlide).length
)

function formatTime() {
  return new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

function addNote() {
  if (!noteText.value.trim()) return
  notes.value.push({
    id: `note-${Date.now()}`,
    content: noteText.value.trim(),
    slideIndex: props.currentSlide,
    time: formatTime(),
    timestamp: Date.now(),
  })
  noteText.value = ''
  saveNotes()
}

function addQuickNote(tag: string) {
  notes.value.push({
    id: `note-${Date.now()}`,
    content: `【${tag}】`,
    slideIndex: props.currentSlide,
    time: formatTime(),
    timestamp: Date.now(),
  })
  saveNotes()
}

function deleteNote(id: string) {
  notes.value = notes.value.filter(n => n.id !== id)
  saveNotes()
}

function exportNotes() {
  const grouped = groupedNotes.value
  let text = `${props.courseName} - 课堂笔记\n${'='.repeat(40)}\n\n`

  for (const slide of sortedSlideIndexes.value) {
    const noteList = grouped[slide] || []
    text += `--- 第 ${slide} 页 ---\n`
    for (const note of noteList) {
      text += `[${note.time}] ${note.content}\n`
    }
    text += '\n'
  }

  navigator.clipboard.writeText(text).then(() => {
    alert('笔记已复制到剪贴板')
  })
}

defineExpose({ currentSlideNoteCount })

watch(() => props.visible, (val) => {
  if (val) notes.value = loadNotes()
})

watch(() => props.courseName, () => {
  notes.value = loadNotes()
})
</script>

<style scoped lang="scss">
.drawer-enter-active, .drawer-leave-active { transition: transform 0.25s ease-out; }
.drawer-enter-from, .drawer-leave-to { transform: translateY(100%); }

.notes-panel {
  position: fixed;
  bottom: 0; left: 0; right: 0;
  height: 70vh; z-index: 200;
  background: var(--bg-card);
  border-top-left-radius: 20px;
  border-top-right-radius: 20px;
  box-shadow: 0 -8px 32px rgba(0, 0, 0, 0.12);
  display: flex; flex-direction: column;
}

.panel-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 16px 20px; border-bottom: 1px solid var(--border);

  .header-left { display: flex; align-items: center; gap: 8px; }
  h3 { font-size: 15px; font-weight: 700; color: var(--text-primary); margin: 0; }
  .note-count { font-size: 11px; color: var(--text-muted); padding: 2px 8px; background: var(--bg-page); border-radius: 10px; }
}

.close-btn {
  width: 44px; height: 44px; border-radius: 50%; border: none;
  background: var(--bg-page); color: var(--text-secondary);
  display: flex; align-items: center; justify-content: center; cursor: pointer;
}

.quick-tags {
  display: flex; gap: 6px; padding: 12px 20px; overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.quick-tag {
  padding: 6px 14px; border: 1px solid var(--border); border-radius: 16px;
  background: var(--bg-card); font-size: 12px; color: var(--primary);
  cursor: pointer; white-space: nowrap; min-height: 32px; transition: all 0.2s;

  &:active { background: var(--primary-light); border-color: var(--primary); transform: scale(0.95); }
}

.note-input-area {
  padding: 0 20px 12px; border-bottom: 1px solid var(--border);

  textarea {
    width: 100%; padding: 10px 14px; border: 1px solid var(--border);
    border-radius: 12px; font-size: 14px; outline: none; resize: none;
    font-family: inherit; background: var(--bg-page);
    &:focus { border-color: var(--primary); background: var(--bg-card); }
  }

  .input-footer { display: flex; justify-content: space-between; align-items: center; margin-top: 8px; }

  .slide-hint {
    display: flex; align-items: center; gap: 4px;
    font-size: 11px; color: var(--text-muted);
  }

  .add-btn {
    display: flex; align-items: center; gap: 4px;
    padding: 6px 14px; border: none; border-radius: 16px;
    background: var(--primary); color: #fff; font-size: 12px; font-weight: 600;
    cursor: pointer; min-height: 32px; transition: all 0.2s;
    &:disabled { opacity: 0.3; }
    &:not(:disabled):active { transform: scale(0.95); }
  }
}

.notes-body {
  flex: 1; overflow-y: auto; padding: 16px 20px;
  -webkit-overflow-scrolling: touch;
}

.empty-state {
  text-align: center; padding: 40px 0; color: var(--text-muted);
  p { margin: 0; font-size: 14px; }
  .sub { font-size: 12px; margin-top: 4px; }
}

.note-group { margin-bottom: 16px; }

.group-header {
  display: flex; align-items: center; gap: 8px; margin-bottom: 8px;

  .group-label {
    font-size: 12px; font-weight: 600; color: var(--primary);
    padding: 2px 10px; background: var(--primary-light); border-radius: 10px;
  }
  .group-count { font-size: 11px; color: var(--text-muted); }
}

.note-card {
  padding: 10px 14px; background: var(--bg-page); border-radius: 10px;
  margin-bottom: 6px; animation: fadeIn 0.2s ease;

  .note-content { font-size: 14px; color: var(--text-primary); line-height: 1.5; }

  .note-footer {
    display: flex; justify-content: space-between; align-items: center; margin-top: 6px;
    .note-time { font-size: 10px; color: var(--text-muted); }
  }

  .delete-btn {
    width: 28px; height: 28px; border-radius: 50%; border: none;
    background: transparent; color: var(--text-muted);
    display: flex; align-items: center; justify-content: center; cursor: pointer;
    &:active { background: #fff1f0; color: var(--danger); }
  }
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}

.panel-footer {
  padding: 12px 20px; padding-bottom: calc(12px + var(--safe-bottom));
  border-top: 1px solid var(--border);
}

.export-btn {
  width: 100%; display: flex; align-items: center; justify-content: center; gap: 6px;
  padding: 12px; border: 1px solid var(--border); border-radius: 12px;
  background: var(--bg-card); color: var(--text-primary); font-size: 13px; font-weight: 500;
  cursor: pointer; min-height: 44px; transition: all 0.2s;
  &:disabled { opacity: 0.3; }
  &:active { background: var(--bg-page); }
}
</style>
