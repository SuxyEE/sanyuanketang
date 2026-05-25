/**
 * Browser-native TTS composable（致敬 OpenMAIC playback/engine.ts 中的 Web Speech API 兼容性代码）。
 *
 * 解决三个浏览器坑：
 *   1. Chrome 长文本 > 15s 静音截断 → 按句切分顺序播放
 *   2. Firefox `pause/resume` 坏掉 → 用 `cancel + 保存剩余 chunks + 重 speak`
 *   3. Chrome 异步加载 voices → 等待 `voiceschanged` 事件
 *
 * 中英文自动识别：CJK 字符 > 30% 当中文 (zh-CN)，否则当英文 (en-US)。
 *
 * 用法：
 *   const { speak, stop, pause, resume, isSpeaking, isPaused, isSupported } = useTts()
 *   speak('要朗读的内容...')
 */

import { ref, onBeforeUnmount, readonly, type Ref } from 'vue'

const CJK_LANG_THRESHOLD = 0.3

let cachedVoices: SpeechSynthesisVoice[] | null = null

function isCjkDominant(text: string): boolean {
  if (!text) return false
  const cjkCount = (
    text.match(/[\u4e00-\u9fff\u3400-\u4dbf\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/g) || []
  ).length
  return cjkCount / text.length > CJK_LANG_THRESHOLD
}

/** Split into sentence-level chunks to dodge Chrome's silent 15s cutoff. */
function splitIntoChunks(text: string): string[] {
  const chunks = text
    .split(/(?<=[.!?。！？\n])\s*/)
    .map(s => s.trim())
    .filter(Boolean)
  return chunks.length > 0 ? chunks : [text]
}

async function ensureVoicesLoaded(): Promise<SpeechSynthesisVoice[]> {
  if (cachedVoices && cachedVoices.length > 0) return cachedVoices
  if (typeof window === 'undefined' || !window.speechSynthesis) return []
  let voices = window.speechSynthesis.getVoices()
  if (voices.length > 0) {
    cachedVoices = voices
    return voices
  }
  await new Promise<void>(resolve => {
    const onChange = () => {
      window.speechSynthesis.removeEventListener('voiceschanged', onChange)
      resolve()
    }
    window.speechSynthesis.addEventListener('voiceschanged', onChange)
    setTimeout(() => {
      window.speechSynthesis.removeEventListener('voiceschanged', onChange)
      resolve()
    }, 2000)
  })
  voices = window.speechSynthesis.getVoices()
  cachedVoices = voices
  return voices
}

export interface UseTtsOptions {
  /** 语速 0.1-10，默认 1 */
  rate?: number
  /** 音量 0-1，默认 1 */
  volume?: number
  /** 强制语言，例如 'zh-CN' / 'en-US'。不传则自动检测 */
  lang?: string
}

export interface UseTtsReturn {
  isSpeaking: Readonly<Ref<boolean>>
  isPaused: Readonly<Ref<boolean>>
  isSupported: Readonly<Ref<boolean>>
  speak: (text: string, opts?: UseTtsOptions) => Promise<void>
  stop: () => void
  pause: () => void
  resume: () => void
  toggle: (text: string, opts?: UseTtsOptions) => void
}

export function useTts(): UseTtsReturn {
  const isSpeaking = ref(false)
  const isPaused = ref(false)
  const isSupported = ref(
    typeof window !== 'undefined' && typeof window.speechSynthesis !== 'undefined',
  )

  let chunks: string[] = []
  let chunkIndex = 0
  let pausedChunks: string[] = []
  let currentRate = 1
  let currentVolume = 1
  let currentLang: string | undefined

  function cancelInternal() {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel()
    }
    chunks = []
    chunkIndex = 0
    pausedChunks = []
    isSpeaking.value = false
    isPaused.value = false
  }

  async function playChunk(): Promise<void> {
    if (chunkIndex >= chunks.length) {
      isSpeaking.value = false
      isPaused.value = false
      chunks = []
      return
    }

    const text = chunks[chunkIndex]
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = currentRate
    utterance.volume = currentVolume

    const voices = await ensureVoicesLoaded()
    const targetLang = currentLang || (isCjkDominant(text) ? 'zh-CN' : 'en-US')
    const voice =
      voices.find(v => v.lang === targetLang) ||
      voices.find(v => v.lang.startsWith(targetLang.split('-')[0]))
    if (voice) utterance.voice = voice
    utterance.lang = targetLang

    utterance.onend = () => {
      chunkIndex++
      if (isSpeaking.value && !isPaused.value) {
        playChunk()
      }
    }

    utterance.onerror = (event: SpeechSynthesisErrorEvent) => {
      if (event.error === 'canceled' || event.error === 'interrupted') {
        return
      }
      console.warn('[useTts] chunk error:', event.error)
      chunkIndex++
      if (isSpeaking.value && !isPaused.value) {
        playChunk()
      }
    }

    // Chrome bug workaround: cancel() before speak() to clear stale synthesis state.
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utterance)
  }

  async function speak(text: string, opts: UseTtsOptions = {}): Promise<void> {
    if (!isSupported.value || !text?.trim()) return

    cancelInternal()
    currentRate = opts.rate ?? 1
    currentVolume = opts.volume ?? 1
    currentLang = opts.lang
    chunks = splitIntoChunks(text.trim())
    chunkIndex = 0
    isSpeaking.value = true
    isPaused.value = false
    await playChunk()
  }

  function stop() {
    cancelInternal()
  }

  function pause() {
    if (!isSpeaking.value || isPaused.value) return
    isPaused.value = true
    // Firefox 不支持 pause/resume，所以保留剩余 chunks 用 cancel+re-speak 模式
    pausedChunks = chunks.slice(chunkIndex)
    window.speechSynthesis?.cancel()
  }

  function resume() {
    if (!isPaused.value) return
    isPaused.value = false
    if (pausedChunks.length > 0) {
      chunks = pausedChunks
      chunkIndex = 0
      pausedChunks = []
      isSpeaking.value = true
      playChunk()
    }
  }

  function toggle(text: string, opts?: UseTtsOptions) {
    if (isSpeaking.value && !isPaused.value) {
      stop()
    } else {
      speak(text, opts)
    }
  }

  onBeforeUnmount(() => {
    cancelInternal()
  })

  return {
    isSpeaking: readonly(isSpeaking),
    isPaused: readonly(isPaused),
    isSupported: readonly(isSupported),
    speak,
    stop,
    pause,
    resume,
    toggle,
  }
}
