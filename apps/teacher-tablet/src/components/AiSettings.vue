<template>
  <div class="ai-settings" role="dialog" aria-label="AI 设置">
    <div class="panel-header">
      <h3>AI 设置</h3>
      <button class="close-btn" @click="$emit('close')" aria-label="关闭">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>

    <div class="panel-body">
      <div class="hint-card">
        <p>选择你想用的 AI 模型，配置只保存在本机浏览器，不会同步给其他教师。<br/>留空 = 使用服务端默认（一般是 .env 中配置的免费教学 key）。</p>
      </div>

      <div v-if="loading" class="loading-state">
        <div class="loading-spinner"></div>
        <p>正在加载 provider 列表…</p>
      </div>

      <template v-else>
        <div class="form-group">
          <label class="form-label">厂商（Provider）</label>
          <div class="provider-grid">
            <button
              v-for="p in providers"
              :key="p.id"
              class="provider-card"
              :class="{ active: selectedProvider === p.id }"
              @click="selectProvider(p.id)"
            >
              <span class="provider-name">{{ p.name }}</span>
              <span v-if="p.requiresApiKey" class="provider-tag key-required">需 key</span>
              <span v-else class="provider-tag local">本地</span>
            </button>
            <button
              class="provider-card"
              :class="{ active: selectedProvider === '' }"
              @click="selectProvider('')"
            >
              <span class="provider-name">服务端默认</span>
              <span class="provider-tag default">免配置</span>
            </button>
          </div>
        </div>

        <div v-if="selectedProvider && currentProvider" class="form-group">
          <label class="form-label">模型</label>
          <div class="model-list">
            <button
              v-for="m in currentProvider.models"
              :key="m.id"
              class="model-card"
              :class="{ active: selectedModel === m.id }"
              @click="selectedModel = m.id"
            >
              <div class="model-row">
                <span class="model-name">{{ m.name }}</span>
                <div class="model-caps">
                  <span v-if="m.capabilities.streaming" title="支持流式" class="cap-chip">流式</span>
                  <span v-if="m.capabilities.tools" title="支持工具" class="cap-chip">工具</span>
                  <span v-if="m.capabilities.vision" title="支持图像识别" class="cap-chip vision">视觉</span>
                </div>
              </div>
              <p class="model-meta">
                <span v-if="m.contextWindow">上下文 {{ formatTokens(m.contextWindow) }}</span>
                <span v-if="m.outputWindow">/ 输出 {{ formatTokens(m.outputWindow) }}</span>
              </p>
            </button>
          </div>
        </div>

        <div v-if="selectedProvider && currentProvider?.requiresApiKey" class="form-group">
          <label class="form-label" for="ai-key">API Key</label>
          <div class="key-input-wrapper">
            <input
              id="ai-key"
              v-model="apiKey"
              :type="showKey ? 'text' : 'password'"
              placeholder="留空 = 用服务端 .env 中的默认 key"
              autocomplete="off"
            />
            <button class="key-toggle" @click="showKey = !showKey" :aria-label="showKey ? '隐藏' : '显示'">
              <svg v-if="!showKey" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
            </button>
          </div>
          <p class="form-hint">仅存于本机浏览器 localStorage，不会上传到任何服务器以外的位置</p>
        </div>

        <div v-if="selectedProvider && currentProvider" class="form-group">
          <label class="form-label" for="ai-base">Base URL（可选）</label>
          <input
            id="ai-base"
            v-model="baseUrl"
            type="text"
            :placeholder="currentProvider.defaultBaseUrl"
            autocomplete="off"
          />
          <div v-if="currentProvider.alternateBaseUrls && currentProvider.alternateBaseUrls.length > 0" class="alt-urls">
            <span class="alt-label">快捷选择：</span>
            <button
              v-for="alt in currentProvider.alternateBaseUrls"
              :key="alt.url"
              class="alt-btn"
              @click="baseUrl = alt.url"
            >{{ alt.label }}</button>
          </div>
        </div>

        <div class="action-row">
          <button class="btn-secondary" :disabled="testing" @click="onTest">
            <span v-if="testing" class="btn-spinner"></span>
            {{ testing ? '测试中…' : '测试连接' }}
          </button>
          <button class="btn-secondary danger" @click="onReset">恢复默认</button>
          <button class="btn-primary" @click="onSave">保存</button>
        </div>

        <div v-if="testResult" class="test-result" :class="testResult.ok ? 'ok' : 'err'">
          <strong>{{ testResult.ok ? '✅ 连接成功' : '❌ 连接失败' }}</strong>
          <p>{{ testResult.message }}</p>
        </div>

        <div class="current-status">
          <h4>当前生效配置</h4>
          <p>模型：<code>{{ settings.model || '（服务端默认）' }}</code></p>
          <p>API Key：<code>{{ settings.apiKey ? mask(settings.apiKey) : '（服务端默认）' }}</code></p>
          <p>Base URL：<code>{{ settings.baseUrl || '（provider 默认）' }}</code></p>
          <p v-if="settings.updatedAt" class="updated">上次修改：{{ formatTime(settings.updatedAt) }}</p>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useAiSettings } from '../composables/useAiSettings'
import { useToast } from '../composables/useToast'

interface ModelInfo {
  id: string
  name: string
  contextWindow?: number
  outputWindow?: number
  capabilities: { streaming: boolean; tools: boolean; vision: boolean }
}

interface ProviderInfo {
  id: string
  name: string
  defaultBaseUrl: string
  requiresApiKey: boolean
  alternateBaseUrls?: { label: string; url: string }[]
  models: ModelInfo[]
}

defineEmits<{ close: [] }>()

const { settings, save, reset, getRequestConfig } = useAiSettings()
const { toastSuccess, toastInfo, toastError } = useToast()

const providers = ref<ProviderInfo[]>([])
const loading = ref(true)
const selectedProvider = ref('')
const selectedModel = ref('')
const apiKey = ref('')
const baseUrl = ref('')
const showKey = ref(false)
const testing = ref(false)
const testResult = ref<{ ok: boolean; message: string } | null>(null)

const currentProvider = computed(
  () => providers.value.find(p => p.id === selectedProvider.value) || null,
)

const apiBase = computed(() => {
  // teacher-tablet (3002) → server 3000
  const host = window.location.hostname || 'localhost'
  return `http://${host}:3000/api/v1`
})

onMounted(async () => {
  try {
    const res = await fetch(`${apiBase.value}/ai/providers`)
    const data = await res.json()
    if (data?.success && Array.isArray(data.data)) {
      providers.value = data.data
    }
    if (settings.model) {
      const dot = settings.model.indexOf(':')
      if (dot > 0) {
        selectedProvider.value = settings.model.slice(0, dot)
        selectedModel.value = settings.model.slice(dot + 1)
      }
    }
    apiKey.value = settings.apiKey
    baseUrl.value = settings.baseUrl
  } catch (err) {
    console.error('[AiSettings] load providers failed:', err)
    toastError('加载 provider 列表失败，请检查网络或服务端')
  } finally {
    loading.value = false
  }
})

watch(selectedProvider, () => {
  // 选 provider 时，如果没选模型，自动选第一个
  if (selectedProvider.value && currentProvider.value && !selectedModel.value) {
    selectedModel.value = currentProvider.value.models[0]?.id || ''
  }
  // 切换 provider，重置模型选择
  if (currentProvider.value && !currentProvider.value.models.find(m => m.id === selectedModel.value)) {
    selectedModel.value = currentProvider.value.models[0]?.id || ''
  }
  testResult.value = null
})

function selectProvider(id: string) {
  selectedProvider.value = id
  if (!id) {
    selectedModel.value = ''
    apiKey.value = ''
    baseUrl.value = ''
  }
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`
  return String(n)
}

function mask(s: string): string {
  if (s.length <= 8) return '****'
  return s.slice(0, 4) + '****' + s.slice(-4)
}

function formatTime(ts: number): string {
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function onSave() {
  const model = selectedProvider.value && selectedModel.value
    ? `${selectedProvider.value}:${selectedModel.value}`
    : ''
  save({ model, apiKey: apiKey.value.trim(), baseUrl: baseUrl.value.trim() })
  toastSuccess('AI 设置已保存（仅本机生效）')
}

function onReset() {
  if (!confirm('恢复为服务端默认配置？这会清除你存在本机的 key 与模型选择。')) return
  reset()
  selectedProvider.value = ''
  selectedModel.value = ''
  apiKey.value = ''
  baseUrl.value = ''
  testResult.value = null
  toastInfo('已恢复为服务端默认')
}

async function onTest() {
  testing.value = true
  testResult.value = null
  try {
    // 临时构造一份请求（不读 settings，直接用当前表单值）
    const config: Record<string, string> = {}
    if (selectedProvider.value && selectedModel.value) {
      config.model = `${selectedProvider.value}:${selectedModel.value}`
    }
    if (apiKey.value.trim()) config.apiKey = apiKey.value.trim()
    if (baseUrl.value.trim()) config.baseUrl = baseUrl.value.trim()

    const body = { message: '请用一句话自我介绍。', courseContext: 'AI 设置连接测试', slideIndex: 1, ...config }

    const t0 = Date.now()
    const ctrl = new AbortController()
    const tid = setTimeout(() => ctrl.abort(), 30_000)
    const res = await fetch(`${apiBase.value}/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    })
    clearTimeout(tid)
    const data = await res.json()
    const elapsed = Date.now() - t0

    if (data?.success && data?.data?.content) {
      const preview = String(data.data.content).slice(0, 80)
      testResult.value = { ok: true, message: `${elapsed} ms · ${preview}${data.data.content.length > 80 ? '…' : ''}` }
    } else {
      testResult.value = { ok: false, message: data?.error || '服务端未返回有效内容' }
    }
  } catch (err: any) {
    testResult.value = { ok: false, message: err?.name === 'AbortError' ? '超时（>30s）' : (err?.message || String(err)) }
  } finally {
    testing.value = false
  }
}
</script>

<style scoped lang="scss">
.ai-settings {
  position: fixed; inset: 0; z-index: 100;
  background: var(--bg-card); display: flex; flex-direction: column;
  animation: slideUp 0.25s ease-out;
}

@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }

.panel-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 16px 20px; border-bottom: 1px solid var(--border);
  h3 { font-size: 17px; font-weight: 700; }
}

.close-btn {
  width: 36px; height: 36px; border-radius: 50%; border: none;
  background: var(--bg-page); color: var(--text-secondary);
  display: flex; align-items: center; justify-content: center; cursor: pointer;
  &:active { background: var(--border); }
}

.panel-body { flex: 1; overflow-y: auto; padding: 16px 20px; display: flex; flex-direction: column; gap: 16px; }

.hint-card {
  background: linear-gradient(135deg, rgba(22, 119, 255, 0.06), rgba(82, 196, 26, 0.04));
  border: 1px solid rgba(22, 119, 255, 0.18);
  border-radius: 12px; padding: 12px 14px;
  p { font-size: 12px; color: var(--text-secondary); margin: 0; line-height: 1.6; }
}

.loading-state { text-align: center; padding: 40px 0; color: var(--text-muted); }
.loading-spinner {
  width: 28px; height: 28px; border: 3px solid var(--border); border-top-color: var(--primary);
  border-radius: 50%; margin: 0 auto 12px; animation: spin 0.7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.form-group { display: flex; flex-direction: column; gap: 8px; }
.form-label { font-size: 13px; font-weight: 600; color: var(--text-primary); }
.form-hint { font-size: 11px; color: var(--text-muted); margin: 4px 0 0; }

.provider-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.provider-card {
  display: flex; flex-direction: column; align-items: flex-start; gap: 4px;
  padding: 10px 12px; border: 1px solid var(--border); border-radius: 12px;
  background: #fff; cursor: pointer; transition: all 0.2s;
  &.active { border-color: var(--primary); background: var(--primary-light); }
  .provider-name { font-size: 13px; font-weight: 600; color: var(--text-primary); }
  .provider-tag {
    font-size: 10px; padding: 1px 6px; border-radius: 8px;
    &.key-required { background: #fff1f0; color: #cf1322; }
    &.local { background: #f6ffed; color: #389e0d; }
    &.default { background: #e6f4ff; color: #1677ff; }
  }
}

.model-list { display: flex; flex-direction: column; gap: 6px; }
.model-card {
  text-align: left; padding: 10px 12px; border: 1px solid var(--border); border-radius: 10px;
  background: #fff; cursor: pointer; transition: all 0.2s;
  &.active { border-color: var(--primary); background: var(--primary-light); }
}
.model-row { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.model-name { font-size: 13px; font-weight: 600; color: var(--text-primary); }
.model-caps { display: flex; gap: 4px; }
.cap-chip {
  font-size: 10px; padding: 1px 6px; border-radius: 8px;
  background: #f0f5ff; color: #1677ff;
  &.vision { background: #f9f0ff; color: #722ed1; }
}
.model-meta { font-size: 11px; color: var(--text-muted); margin: 4px 0 0; }

.key-input-wrapper { position: relative; }
.key-input-wrapper input {
  width: 100%; padding: 10px 40px 10px 12px;
  border: 1px solid var(--border); border-radius: 10px;
  font-size: 13px; font-family: 'Cascadia Code', 'Consolas', monospace;
  &:focus { border-color: var(--primary); outline: none; }
}
.key-toggle {
  position: absolute; right: 6px; top: 50%; transform: translateY(-50%);
  width: 32px; height: 32px; border: none; background: transparent;
  display: flex; align-items: center; justify-content: center;
  color: var(--text-secondary); cursor: pointer;
}

input[type="text"] {
  width: 100%; padding: 10px 12px;
  border: 1px solid var(--border); border-radius: 10px;
  font-size: 13px; font-family: inherit;
  &:focus { border-color: var(--primary); outline: none; }
}

.alt-urls { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; }
.alt-label { font-size: 11px; color: var(--text-muted); align-self: center; }
.alt-btn {
  font-size: 11px; padding: 2px 8px; border-radius: 8px;
  border: 1px solid var(--border); background: #fff; cursor: pointer; color: var(--text-secondary);
  &:hover { border-color: var(--primary); color: var(--primary); }
}

.action-row { display: flex; gap: 8px; padding-top: 4px; }
.btn-primary, .btn-secondary {
  flex: 1; padding: 11px; border: none; border-radius: 10px;
  font-size: 13px; font-weight: 600; cursor: pointer; min-height: 42px;
  display: flex; align-items: center; justify-content: center; gap: 6px;
}
.btn-primary { background: linear-gradient(135deg, var(--primary), #4096ff); color: #fff; }
.btn-secondary {
  background: var(--bg-page); color: var(--text-primary); border: 1px solid var(--border);
  &.danger { color: #cf1322; }
}
.btn-secondary:disabled { opacity: 0.6; cursor: wait; }

.btn-spinner {
  width: 14px; height: 14px; border: 2px solid rgba(0,0,0,0.15); border-top-color: var(--text-primary);
  border-radius: 50%; animation: spin 0.7s linear infinite;
}

.test-result {
  border-radius: 10px; padding: 10px 12px;
  &.ok { background: #f6ffed; border: 1px solid #b7eb8f; color: #389e0d; }
  &.err { background: #fff1f0; border: 1px solid #ffa39e; color: #cf1322; }
  strong { font-size: 13px; }
  p { font-size: 11px; margin: 4px 0 0; line-height: 1.5; word-break: break-word; }
}

.current-status {
  background: var(--bg-page); border-radius: 10px; padding: 12px 14px;
  h4 { font-size: 12px; font-weight: 600; margin: 0 0 6px; color: var(--text-secondary); }
  p { font-size: 12px; color: var(--text-primary); margin: 2px 0; }
  code { font-family: 'Cascadia Code', 'Consolas', monospace; font-size: 11px; background: rgba(0,0,0,0.04); padding: 1px 5px; border-radius: 4px; }
  .updated { font-size: 10px; color: var(--text-muted); margin-top: 6px; }
}
</style>
