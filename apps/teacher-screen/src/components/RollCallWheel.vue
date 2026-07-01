<template>
  <div class="rollcall-overlay">
    <div class="rollcall-card">
      <div class="rc-head">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#ffd666" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m8 12 3 3 5-6"/></svg>
        <h2>随机点名</h2>
      </div>

      <div class="rc-stage" :class="{ done: phase === 'done' }">
        <span class="rc-name">{{ displayName }}</span>
        <span v-if="phase === 'done'" class="rc-congrats">🎉 恭喜被选中</span>
        <span v-else class="rc-rolling">抽取中…</span>
      </div>

      <div class="rc-candidates">
        <span
          v-for="(c, i) in candidates"
          :key="c.id"
          class="rc-chip"
          :class="{ active: i === highlightIndex, winner: phase === 'done' && c.id === result?.studentId }"
        >{{ c.name }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'

interface Candidate { id: string; name: string }
interface RollResult {
  studentId: string
  studentName: string
  candidates: Candidate[]
}

const props = defineProps<{ result: RollResult | null }>()
const emit = defineEmits<{ close: [] }>()

const highlightIndex = ref(0)
const phase = ref<'spinning' | 'done'>('spinning')

const candidates = computed<Candidate[]>(() => props.result?.candidates || [])
const displayName = computed(() => {
  if (phase.value === 'done') return props.result?.studentName || '—'
  return candidates.value[highlightIndex.value]?.name || '…'
})

let spinTimer: ReturnType<typeof setTimeout> | null = null
let closeTimer: ReturnType<typeof setTimeout> | null = null

function clearTimers() {
  if (spinTimer) { clearTimeout(spinTimer); spinTimer = null }
  if (closeTimer) { clearTimeout(closeTimer); closeTimer = null }
}

function start() {
  clearTimers()
  phase.value = 'spinning'
  const list = candidates.value
  if (list.length === 0) {
    phase.value = 'done'
    scheduleClose()
    return
  }
  const targetIndex = Math.max(0, list.findIndex(c => c.id === props.result?.studentId))
  let interval = 60
  highlightIndex.value = Math.floor(Math.random() * list.length)

  const step = () => {
    highlightIndex.value = (highlightIndex.value + 1) % list.length
    interval *= 1.12
    if (interval > 320) {
      // 落定到中奖者
      highlightIndex.value = targetIndex
      phase.value = 'done'
      scheduleClose()
      return
    }
    spinTimer = setTimeout(step, interval)
  }
  spinTimer = setTimeout(step, interval)
}

function scheduleClose() {
  closeTimer = setTimeout(() => emit('close'), 4500)
}

watch(() => props.result, (r) => { if (r) start() }, { immediate: true })

onMounted(() => { if (props.result) start() })
onUnmounted(clearTimers)
</script>

<style scoped lang="scss">
.rollcall-overlay {
  position: fixed;
  inset: 0;
  z-index: 80;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48px;
  background: radial-gradient(circle at 50% 35%, rgba(140, 90, 20, 0.4), rgba(6, 10, 31, 0.85));
  animation: rc-fade 0.3s ease;
}

@keyframes rc-fade { from { opacity: 0; } to { opacity: 1; } }

.rollcall-card {
  width: min(860px, 100%);
  padding: 40px 48px 44px;
  border-radius: 28px;
  background: rgba(15, 20, 48, 0.95);
  border: 1px solid rgba(255, 214, 102, 0.3);
  box-shadow: 0 30px 90px -20px rgba(0, 0, 0, 0.6);
  text-align: center;
}

.rc-head {
  display: flex; align-items: center; justify-content: center; gap: 10px;
  margin-bottom: 24px;
  h2 { margin: 0; font-size: 24px; font-weight: 700; color: #ffd666; }
}

.rc-stage {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 32px 20px;
  margin-bottom: 28px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.04);
  transition: all 0.3s ease;

  &.done {
    background: linear-gradient(135deg, rgba(255, 214, 102, 0.2), rgba(250, 173, 20, 0.1));
    border: 1px solid rgba(255, 214, 102, 0.4);
  }
}

.rc-name {
  font-size: 72px;
  font-weight: 800;
  color: #fff;
  line-height: 1.1;
  letter-spacing: 2px;
}
.rc-stage.done .rc-name {
  color: #ffd666;
  text-shadow: 0 0 30px rgba(255, 214, 102, 0.5);
  animation: rc-pop 0.5s ease;
}
@keyframes rc-pop { 0% { transform: scale(0.7); } 60% { transform: scale(1.12); } 100% { transform: scale(1); } }

.rc-rolling { font-size: 15px; color: rgba(255, 255, 255, 0.45); }
.rc-congrats { font-size: 18px; color: #ffd666; font-weight: 700; }

.rc-candidates {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
  max-height: 200px;
  overflow: hidden;
}

.rc-chip {
  padding: 6px 14px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.55);
  font-size: 15px;
  transition: all 0.1s ease;

  &.active {
    background: rgba(65, 120, 255, 0.3);
    color: #fff;
    transform: scale(1.12);
  }
  &.winner {
    background: #ffd666;
    color: #874d00;
    font-weight: 800;
    transform: scale(1.15);
  }
}
</style>
