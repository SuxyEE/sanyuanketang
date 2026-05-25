<template>
  <div class="roll-call" role="dialog" aria-label="点名">
    <div class="panel-header">
      <h3>课堂点名</h3>
      <button class="close-btn" @click="$emit('close')" aria-label="关闭">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>

    <div class="panel-body">
      <div class="mode-toggle">
        <button
          class="mode-btn"
          :class="{ active: mode === 'random' }"
          @click="mode = 'random'"
        >
          随机点名
        </button>
        <button
          class="mode-btn"
          :class="{ active: mode === 'manual' }"
          @click="mode = 'manual'"
        >
          手动选择
        </button>
      </div>

      <div v-if="mode === 'random'" class="random-area">
        <div class="random-display" :class="{ rolling: isRolling }">
          <transition name="fade" mode="out-in">
            <div :key="displayName" class="selected-name">{{ displayName }}</div>
          </transition>
        </div>
        <button class="roll-btn" @click="startRoll" :disabled="isRolling">
          {{ isRolling ? '抽取中...' : selectedStudent ? '再抽一次' : '开始随机点名' }}
        </button>
      </div>

      <div v-else class="manual-area">
        <input
          v-model="searchText"
          class="search-input"
          placeholder="搜索学生姓名..."
          aria-label="搜索学生"
        />
        <div class="student-grid">
          <button
            v-for="s in filteredStudents"
            :key="s.id"
            class="student-card"
            :class="{ selected: selectedStudent?.id === s.id, offline: s.state === 'offline' }"
            @click="selectStudent(s)"
          >
            <span class="stu-name">{{ s.name }}</span>
            <span class="stu-state" :class="s.state">{{ stateLabel(s.state) }}</span>
          </button>
        </div>
      </div>

      <div v-if="selectedStudent && !isRolling" class="result-card">
        <div class="result-label">被点到的同学</div>
        <div class="result-name">{{ selectedStudent.name }}</div>
        <div class="result-actions">
          <button class="action-btn" @click="focusSelected">通知该学生</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue'
import { useClassroomStore } from '../stores/classroom'

const store = useClassroomStore()
const emit = defineEmits<{ close: []; focus: [payload: { studentId: string; studentName: string }] }>()

const mode = ref<'random' | 'manual'>('random')
const isRolling = ref(false)
const selectedStudent = ref<{ id: string; name: string } | null>(null)
const displayName = ref('?')
const searchText = ref('')
let rollTimer: ReturnType<typeof setInterval> | null = null

const filteredStudents = computed(() => {
  if (!searchText.value) return store.students
  return store.students.filter(s => s.name.includes(searchText.value))
})

function stateLabel(state: string) {
  const map: Record<string, string> = {
    online: '在线', working: '做题中', submitted: '已提交', offline: '离线'
  }
  return map[state] || state
}

function selectStudent(s: any) {
  selectedStudent.value = { id: s.id, name: s.name }
}

function startRoll() {
  const onlineStudents = store.students.filter(s => s.state !== 'offline')
  if (onlineStudents.length === 0) return

  if (rollTimer) clearInterval(rollTimer)
  isRolling.value = true
  selectedStudent.value = null

  let count = 0
  const maxCount = 15
  rollTimer = setInterval(() => {
    const random = onlineStudents[Math.floor(Math.random() * onlineStudents.length)]
    displayName.value = random.name
    count++

    if (count >= maxCount) {
      if (rollTimer) { clearInterval(rollTimer); rollTimer = null }
      isRolling.value = false
      const finalPick = onlineStudents.find(s => s.name === displayName.value) || onlineStudents[0]
      selectedStudent.value = { id: finalPick.id, name: finalPick.name }
    }
  }, 120)
}

function focusSelected() {
  if (!selectedStudent.value) return
  emit('focus', { studentId: selectedStudent.value.id, studentName: selectedStudent.value.name })
}

onUnmounted(() => {
  if (rollTimer) clearInterval(rollTimer)
})
</script>

<style scoped lang="scss">
.roll-call {
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

.panel-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.mode-toggle {
  display: flex;
  gap: 8px;
  padding: 4px;
  background: var(--bg-page);
  border-radius: var(--radius-md);
}

.mode-btn {
  flex: 1;
  padding: 10px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-secondary);
  cursor: pointer;
  min-height: 44px;
  transition: all 0.2s;

  &.active {
    background: var(--bg-card);
    color: var(--primary);
    font-weight: 600;
    box-shadow: var(--shadow-sm);
  }
}

.random-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
  padding: 32px 0;
}

.random-display {
  width: 180px;
  height: 180px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--primary-light), var(--primary-bg));
  border: 3px solid var(--primary);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;

  &.rolling {
    animation: pulse 0.3s ease infinite alternate;
    border-color: var(--warning, #faad14);
  }
}

@keyframes pulse {
  from { transform: scale(1); }
  to { transform: scale(1.05); }
}

.selected-name {
  font-size: 28px;
  font-weight: 700;
  color: var(--primary);
}

.fade-enter-active, .fade-leave-active {
  transition: all 0.1s ease;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

.roll-btn {
  padding: 14px 48px;
  border: none;
  border-radius: var(--radius-lg);
  background: linear-gradient(135deg, var(--primary), #4096ff);
  color: #fff;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  min-height: 48px;
  transition: all 0.2s;

  &:disabled { opacity: 0.6; }
  &:not(:disabled):active { transform: scale(0.97); }
}

.search-input {
  width: 100%;
  padding: 12px 16px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  font-size: 14px;
  outline: none;
  min-height: 44px;

  &:focus { border-color: var(--primary); }
}

.student-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  max-height: 300px;
  overflow-y: auto;
}

.student-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 12px 8px;
  border: 2px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--bg-card);
  cursor: pointer;
  min-height: 44px;
  transition: all 0.2s;

  &.selected {
    border-color: var(--primary);
    background: var(--primary-light);
  }

  &.offline {
    opacity: 0.4;
  }

  .stu-name {
    font-size: 12px;
    font-weight: 500;
    color: var(--text-primary);
  }

  .stu-state {
    font-size: 10px;
    &.online { color: var(--success, #52c41a); }
    &.working { color: var(--warning, #faad14); }
    &.submitted { color: var(--success, #52c41a); }
    &.offline { color: var(--text-muted); }
  }
}

.result-card {
  padding: 20px;
  background: linear-gradient(135deg, var(--primary-light), var(--primary-bg));
  border: 1px solid rgba(22, 119, 255, 0.2);
  border-radius: var(--radius-lg);
  text-align: center;

  .result-label {
    font-size: 12px;
    color: var(--text-secondary);
    margin-bottom: 8px;
  }

  .result-name {
    font-size: 24px;
    font-weight: 700;
    color: var(--primary);
    margin-bottom: 12px;
  }

  .action-btn {
    padding: 8px 20px;
    border: 1px solid var(--primary);
    border-radius: var(--radius-md);
    background: transparent;
    color: var(--primary);
    font-size: 13px;
    cursor: pointer;
    min-height: 44px;

    &:active { background: var(--primary-light); }
  }
}
</style>
