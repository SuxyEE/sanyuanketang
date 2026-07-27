import { computed, ref } from 'vue'
import {
  fallbackPlatformConfig,
  fetchPlatformConfig,
  getPlatformRuntimeHint,
  type PlatformPublicConfig,
  type PlatformRuntimeHint,
} from '@/api/platform'

const config = ref<PlatformPublicConfig>(fallbackPlatformConfig)
const loading = ref(false)
const loaded = ref(false)
const error = ref<string | null>(null)

function applyBranding(next: PlatformPublicConfig) {
  const root = document.documentElement
  const brand = next.branding || next
  if (brand.primaryColor) root.style.setProperty('--color-brand-500', brand.primaryColor)
  if (brand.aiColor) root.style.setProperty('--color-ai-500', brand.aiColor)
  if (brand.siderBackground) root.style.setProperty('--color-sider-bg', brand.siderBackground)
  document.title = `${next.productName} · ${next.schoolName}`
}

export function usePlatformConfig() {
  async function load(force = false) {
    if (loaded.value && !force) return config.value
    loading.value = true
    error.value = null
    try {
      const next = await fetchPlatformConfig()
      config.value = next
      applyBranding(next)
    } catch (err: any) {
      error.value = err?.message || String(err)
      config.value = fallbackPlatformConfig
      applyBranding(fallbackPlatformConfig)
    } finally {
      loaded.value = true
      loading.value = false
    }
    return config.value
  }

  return {
    config,
    loading,
    loaded,
    error,
    runtimeHint: computed<PlatformRuntimeHint>(() => getPlatformRuntimeHint()),
    productName: computed(() => config.value.productName || config.value.branding?.productName || '智慧课堂'),
    schoolName: computed(() => config.value.schoolName || config.value.branding?.schoolName || '未配置学校'),
    logoText: computed(() => config.value.branding?.logoText || '课'),
    logoUrl: computed(() => config.value.branding?.logoUrl || ''),
    load,
  }
}
