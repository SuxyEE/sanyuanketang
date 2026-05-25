<template>
  <div class="login-page">
    <div class="login-card">
      <div class="login-logo">
        <span class="logo-emoji">🎓</span>
        <h1>集美工业职业学院</h1>
        <p>智慧课堂管理平台</p>
      </div>
      <el-form :model="form" class="login-form" size="large">
        <el-form-item>
          <el-input v-model="form.username" placeholder="请输入用户名" prefix-icon="User" />
        </el-form-item>
        <el-form-item>
          <el-input v-model="form.password" placeholder="请输入密码" prefix-icon="Lock" type="password" show-password />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" class="login-btn" @click="handleLogin" :loading="loading">
            登 录
          </el-button>
        </el-form-item>
      </el-form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const loading = ref(false)
const form = reactive({ username: '', password: '' })

function handleLogin() {
  if (!form.username || !form.password) {
    return
  }
  loading.value = true
  setTimeout(() => {
    loading.value = false
    if (form.username === 'admin' && form.password === 'admin') {
      localStorage.setItem('admin_token', 'demo-token')
      router.push('/dashboard')
    } else {
      localStorage.setItem('admin_token', 'demo-token')
      router.push('/dashboard')
    }
  }, 600)
}
</script>

<style scoped>
.login-page {
  width: 100vw;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.login-card {
  width: 400px;
  padding: 48px 40px;
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
}

.login-logo {
  text-align: center;
  margin-bottom: 36px;
}

.logo-emoji {
  font-size: 48px;
  display: block;
  margin-bottom: 12px;
}

.login-logo h1 {
  font-size: 20px;
  color: #1a1a2e;
  margin: 0 0 4px 0;
}

.login-logo p {
  font-size: 14px;
  color: #999;
  margin: 0;
}

.login-btn {
  width: 100%;
  height: 44px;
  font-size: 16px;
}
</style>
