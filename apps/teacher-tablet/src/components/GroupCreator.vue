<template>
  <div class="group-creator" role="dialog" aria-label="分组讨论">
    <div class="panel-header">
      <h3>分组讨论</h3>
      <button class="close-btn" @click="$emit('close')" aria-label="关闭">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>

    <div class="panel-body">
      <div class="form-group">
        <label>分组策略</label>
        <div class="strategy-cards">
          <button
            v-for="s in strategies"
            :key="s.value"
            class="strategy-card"
            :class="{ active: strategy === s.value }"
            @click="strategy = s.value"
          >
            <span class="strategy-icon" v-html="s.icon" aria-hidden="true"></span>
            <span class="strategy-name">{{ s.label }}</span>
            <span class="strategy-desc">{{ s.desc }}</span>
          </button>
        </div>
      </div>

      <div class="form-group">
        <label>分组数量</label>
        <div class="count-selector">
          <button class="count-btn" @click="groupCount = Math.max(2, groupCount - 1)" aria-label="减少">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </button>
          <span class="count-value">{{ groupCount }} 组</span>
          <button class="count-btn" @click="groupCount = Math.min(12, groupCount + 1)" aria-label="增加">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </button>
        </div>
        <p class="hint">{{ studentTotal > 0 ? `每组约 ${perGroupCount} 人（共 ${studentTotal} 名学生）` : '当前还没有学生加入' }}</p>
      </div>

      <div class="form-group">
        <label>讨论主题（可选）</label>
        <textarea v-model="topic" rows="2" placeholder="输入讨论主题..."></textarea>
      </div>

      <div class="form-group">
        <label>讨论时长</label>
        <div class="time-options">
          <button
            v-for="t in durations"
            :key="t"
            class="time-chip"
            :class="{ active: duration === t }"
            @click="duration = t"
          >
            {{ t }}分钟
          </button>
        </div>
      </div>

      <div class="preview-box">
        <div class="preview-title">分组预览</div>
        <div class="preview-groups">
          <div v-for="i in groupCount" :key="i" class="preview-group-card">
            <span class="group-label">第{{ i }}组</span>
            <span class="group-count">~{{ perGroupCount }}人</span>
          </div>
        </div>
      </div>
    </div>

    <div class="panel-actions">
      <button class="btn-secondary" @click="$emit('close')">取消</button>
      <button v-if="store.activeDiscussion" class="btn-danger" @click="endDiscussion">
        结束当前分组讨论
      </button>
      <button v-else class="btn-primary" @click="startDiscussion">
        开始分组讨论
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { icons } from '@snyuan/shared'
import { useClassroomStore } from '../stores/classroom'
import { useSocket } from '../composables/useSocket'
import { useToast } from '../composables/useToast'

const emit = defineEmits<{
  close: []
  start: [data: any]
}>()

const store = useClassroomStore()
const { socket } = useSocket()
const { toastInfo, toastError } = useToast()
const strategy = ref('random')
const groupCount = ref(2)
const topic = ref('')
const duration = ref(10)

const studentTotal = computed(() => store.totalCount)
const perGroupCount = computed(() => studentTotal.value > 0 ? Math.ceil(studentTotal.value / groupCount.value) : 0)

const strategies = [
  { value: 'random', label: '随机分组', desc: '系统自动随机分配', icon: icons.refresh },
  { value: 'ability', label: '能力分组', desc: '按掌握度均衡分配', icon: icons.barChart },
  { value: 'manual', label: '手动分组', desc: '教师自行指定', icon: icons.edit },
]

const durations = [5, 10, 15, 20, 30]

function startDiscussion() {
  emit('start', {
    strategy: strategy.value,
    groupCount: groupCount.value,
    topic: topic.value,
    duration: duration.value,
  })
  emit('close')
}

function endDiscussion() {
  const s = socket.value
  if (!s?.connected) {
    toastError('未连接服务器')
    return
  }
  s.emit('group:dissolve', {})
  store.setActiveDiscussion(null)
  toastInfo('已结束分组讨论')
  emit('close')
}
</script>

<style scoped lang="scss">
.group-creator {
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

  h3 { font-size: 17px; font-weight: 700; color: var(--text-primary); }
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
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  -webkit-overflow-scrolling: touch;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;

  label {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-primary);
  }

  textarea {
    padding: 12px 14px;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    font-size: 14px;
    outline: none;
    resize: vertical;
    line-height: 1.5;
    min-height: 44px;

    &:focus { border-color: var(--primary); }
  }
}

.strategy-cards {
  display: flex;
  gap: 8px;
}

.strategy-card {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 14px 8px;
  border: 2px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--bg-card);
  cursor: pointer;
  min-height: 80px;
  transition: all 0.2s;

  &.active {
    border-color: var(--primary);
    background: var(--primary-light);
  }

  .strategy-icon {
    display: flex;
    color: var(--primary);
    :deep(svg) { width: 22px; height: 22px; }
  }

  .strategy-name {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .strategy-desc {
    font-size: 10px;
    color: var(--text-muted);
    text-align: center;
  }
}

.count-selector {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 24px;
}

.count-btn {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: 2px solid var(--border);
  background: var(--bg-card);
  color: var(--primary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;

  &:active { background: var(--primary-light); }
}

.count-value {
  font-size: 24px;
  font-weight: 700;
  color: var(--primary);
  min-width: 60px;
  text-align: center;
}

.hint {
  font-size: 12px;
  color: var(--text-muted);
  text-align: center;
}

.time-options {
  display: flex;
  gap: 8px;
}

.time-chip {
  flex: 1;
  padding: 10px;
  border: 2px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--bg-card);
  font-size: 13px;
  color: var(--text-secondary);
  cursor: pointer;
  min-height: 44px;
  transition: all 0.2s;

  &.active {
    border-color: var(--primary);
    color: var(--primary);
    background: var(--primary-light);
  }
}

.preview-box {
  padding: 14px;
  background: var(--bg-page);
  border-radius: var(--radius-lg);

  .preview-title {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-secondary);
    margin-bottom: 10px;
  }
}

.preview-groups {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.preview-group-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 10px;
  background: var(--bg-card);
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);

  .group-label {
    font-size: 12px;
    font-weight: 600;
    color: var(--primary);
  }

  .group-count {
    font-size: 10px;
    color: var(--text-muted);
  }
}

.panel-actions {
  display: flex;
  gap: 10px;
  padding: 12px 20px;
  padding-bottom: calc(12px + var(--safe-bottom));
  border-top: 1px solid var(--border);
}

.btn-secondary {
  flex: 1;
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--bg-card);
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  min-height: 48px;

  &:active { background: var(--bg-page); }
}

.btn-danger {
  flex: 1.5;
  padding: 14px;
  border: none;
  border-radius: var(--radius-md);
  background: linear-gradient(135deg, #cf1322, #ff4d4f);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  min-height: 48px;

  &:hover { background: linear-gradient(135deg, #a8071a, #cf1322); }
}

.btn-primary {
  flex: 1.5;
  padding: 14px;
  border: none;
  border-radius: var(--radius-md);
  background: linear-gradient(135deg, var(--primary), #4096ff);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  min-height: 48px;
  transition: all 0.2s;

  &:active { transform: scale(0.98); }
}
</style>
