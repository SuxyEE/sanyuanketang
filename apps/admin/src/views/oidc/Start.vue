<template>
  <div class="oidc-page">
    <el-icon class="is-loading" :size="28"><Loading /></el-icon>
    <p>正在跳转到书舟统一登录…</p>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { Loading } from '@element-plus/icons-vue'
import { startShuzhouLogin } from '@/lib/oidc'

const route = useRoute()

onMounted(() => {
  startShuzhouLogin(route.query.return_to)
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
  color: #606266;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.oidc-page p {
  margin: 0;
  font-size: 15px;
  color: #fff;
}

.oidc-page :deep(.el-icon) {
  color: #fff;
}
</style>
