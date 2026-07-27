<template>
  <div class="oidc-page">
    <template v-if="error">
      <el-result icon="warning" title="统一登录未完成" :sub-title="error">
        <template #extra>
          <el-button type="primary" @click="router.replace('/login')">返回登录页</el-button>
        </template>
      </el-result>
    </template>
    <template v-else>
      <el-icon class="is-loading" :size="28"><Loading /></el-icon>
      <p>正在完成登录…</p>
    </template>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Loading } from '@element-plus/icons-vue'
import { redeemShuzhouTicket, safeReturnPath } from '@/lib/oidc'

const route = useRoute()
const router = useRouter()
const error = ref('')

onMounted(async () => {
  const ssoError = typeof route.query.sso_error === 'string' ? route.query.sso_error : ''
  if (ssoError) {
    error.value = ssoError
    return
  }

  const ticket = typeof route.query.ticket === 'string' ? route.query.ticket : ''
  if (!ticket) {
    error.value = '缺少登录票据，请重新从智慧校园进入'
    return
  }

  try {
    const session = await redeemShuzhouTicket(ticket)
    localStorage.setItem('admin_token', session.accessToken)
    localStorage.setItem('admin_user_name', session.user.name)
    if (session.user.tenantId) localStorage.setItem('snyuan_tenant_id', session.user.tenantId)
    if (session.user.schoolId) localStorage.setItem('snyuan_school_id', session.user.schoolId)
    router.replace(safeReturnPath(route.query.return_to))
  } catch (err: any) {
    localStorage.removeItem('admin_token')
    error.value = err?.message || '统一登录失败，请重试'
  }
})
</script>

<style scoped>
.oidc-page {
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  background: #f5f7fa;
}

.oidc-page p {
  margin: 0;
  font-size: 15px;
  color: #606266;
}
</style>
