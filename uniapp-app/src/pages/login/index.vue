<template>
  <view class="login-page">
    <view class="brand">
      <view class="logo"><Icon name="logo" size="xl" /></view>
      <text class="title">三元课堂</text>
      <text class="subtitle">统一 App · 登录后自动进入对应工作台</text>
    </view>

    <view class="panel">
      <view class="field">
        <text class="label">账号</text>
        <input v-model="username" class="input" placeholder="教师账号 / 学生账号 / 手机号" />
      </view>
      <view class="field">
        <text class="label">密码</text>
        <input v-model="password" class="input" password placeholder="请输入密码" />
      </view>

      <Button block icon-right="arrow-right" :loading="session.loading" @tap="handleLogin">登录</Button>

      <view class="demo-row">
        <button class="demo-btn" @tap="demoLogin('teacher')">
          <Icon name="graduation-cap" size="sm" />
          <text>教师演示</text>
        </button>
        <button class="demo-btn" @tap="demoLogin('student')">
          <Icon name="user" size="sm" />
          <text>学生演示</text>
        </button>
      </view>
    </view>

    <view class="tips">
      <view class="tip"><Icon name="check-circle" size="sm" tone="success" /><text>教师进入课程选择和课堂控制</text></view>
      <view class="tip"><Icon name="lock" size="sm" tone="primary" /><text>学生课堂模式才启用专注锁屏</text></view>
      <view class="tip"><Icon name="users" size="sm" tone="primary" /><text>多角色账号登录后可选择身份</text></view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import Button from '@/components/ui/Button.vue'
import Icon from '@/components/ui/Icon.vue'
import { useSessionStore, type AppRole } from '@/stores/session'

const session = useSessionStore()
const username = ref('')
const password = ref('')

onMounted(() => {
  session.hydrate()
  if (session.user?.activeRole) routeToRole(session.user.activeRole)
})

async function handleLogin() {
  try {
    const user = await session.login(username.value, password.value)
    if (user.roles.length > 1 && !user.activeRole) {
      uni.redirectTo({ url: '/pages/role-select/index' })
      return
    }
    routeToRole(user.activeRole || user.roles[0])
  } catch (err: any) {
    uni.showToast({ title: err?.message || '登录失败', icon: 'none' })
  }
}

function demoLogin(role: AppRole) {
  session.loginAs(role)
  routeToRole(role)
}

function routeToRole(role: AppRole) {
  uni.reLaunch({
    url: role === 'teacher'
      ? '/pages/course-select/index'
      : '/pages/student/join/index',
  })
}
</script>

<style scoped lang="scss">
.login-page {
  min-height: 100vh;
  padding: 56rpx 36rpx;
  background: linear-gradient(180deg, #eef4ff 0%, #f8fafc 44%, #ffffff 100%);
}

.brand {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12rpx;
  margin: 32rpx 0 42rpx;
}

.logo {
  width: 88rpx;
  height: 88rpx;
  border-radius: 24rpx;
  background: #2563eb;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
}

.title {
  font-size: 44rpx;
  font-weight: 800;
  color: #0f172a;
}

.subtitle {
  font-size: 26rpx;
  color: #64748b;
}

.panel {
  padding: 34rpx;
  border: 1rpx solid #e2e8f0;
  border-radius: 24rpx;
  background: #fff;
  box-shadow: 0 20rpx 44rpx rgba(15, 23, 42, 0.08);
}

.field {
  margin-bottom: 24rpx;
}

.label {
  display: block;
  margin-bottom: 10rpx;
  font-size: 24rpx;
  color: #475569;
  font-weight: 600;
}

.input {
  height: 92rpx;
  padding: 0 24rpx;
  border: 1rpx solid #dbe4f0;
  border-radius: 16rpx;
  background: #f8fafc;
  font-size: 30rpx;
  color: #0f172a;
}

.demo-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 18rpx;
  margin-top: 24rpx;
}

.demo-btn {
  height: 76rpx;
  border-radius: 16rpx;
  background: #f1f5f9;
  color: #334155;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10rpx;
  font-size: 26rpx;
}

.tips {
  margin-top: 32rpx;
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.tip {
  display: flex;
  align-items: center;
  gap: 12rpx;
  color: #475569;
  font-size: 25rpx;
}
</style>
