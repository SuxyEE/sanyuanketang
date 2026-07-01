<template>
  <div class="login-page">
    <div class="login-card">
      <div class="login-logo">
        <span class="logo-emoji" aria-hidden="true">
          <img src="/logo.png" alt="三元课堂" width="56" height="56" style="object-fit: contain;" />
        </span>
        <h1>集美工业职业学院</h1>
        <p>三元课堂 · AI 智能教学系统</p>
      </div>
      <el-form ref="formRef" :model="form" :rules="rules" class="login-form" size="large" @submit.prevent>
        <el-form-item prop="username">
          <el-input v-model="form.username" placeholder="请输入用户名" prefix-icon="User" autocomplete="username" />
        </el-form-item>
        <el-form-item prop="password">
          <el-input
            v-model="form.password"
            placeholder="请输入密码"
            prefix-icon="Lock"
            type="password"
            show-password
            autocomplete="current-password"
            @keyup.enter="handleLogin"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" native-type="submit" class="login-btn" @click="handleLogin" :loading="loading">
            登 录
          </el-button>
        </el-form-item>
      </el-form>
      <p class="demo-hint">演示账号：<code>admin</code> / <code>admin</code></p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { login as apiLogin } from '../api/auth'

const router = useRouter()
const loading = ref(false)
const formRef = ref<FormInstance | null>(null)
const form = reactive({ username: '', password: '' })

const rules: FormRules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
}

async function handleLogin() {
  if (!formRef.value) return
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return
  loading.value = true
  try {
    const result = await apiLogin(form.username.trim(), form.password)
    if (!result.ok) {
      ElMessage.error(result.message || '用户名或密码错误')
      return
    }
    localStorage.setItem('admin_token', result.token)
    localStorage.setItem('admin_user_name', result.userName || form.username.trim())
    ElMessage.success('登录成功')
    router.push('/dashboard')
  } finally {
    loading.value = false
  }
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

.demo-hint {
  text-align: center;
  font-size: 12px;
  color: #909399;
  margin: 12px 0 0;
}

.demo-hint code {
  background: #f4f4f5;
  padding: 1px 6px;
  border-radius: 4px;
  color: #1677ff;
  font-family: 'SFMono-Regular', Consolas, monospace;
  margin: 0 2px;
}
</style>
