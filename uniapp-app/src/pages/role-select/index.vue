<template>
  <view class="role-page">
    <view class="head">
      <text class="title">选择登录身份</text>
      <text class="desc">{{ session.user?.name || '当前账号' }} 有多个可用身份</text>
    </view>

    <view class="roles">
      <button v-if="session.roles.includes('teacher')" class="role-card" @tap="selectRole('teacher')">
        <Icon name="graduation-cap" size="xl" tone="primary" />
        <view>
          <text class="role-title">教师工作台</text>
          <text class="role-desc">接管大屏、选择课程、发起课堂互动</text>
        </view>
        <Icon name="chevron-right" size="md" tone="muted" />
      </button>

      <button v-if="session.roles.includes('student')" class="role-card" @tap="selectRole('student')">
        <Icon name="user" size="xl" tone="primary" />
        <view>
          <text class="role-title">学生课堂</text>
          <text class="role-desc">加入课堂、答题互动、查看错题与课后任务</text>
        </view>
        <Icon name="chevron-right" size="md" tone="muted" />
      </button>
    </view>

    <button class="logout" @tap="logout">退出重新登录</button>
  </view>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import Icon from '@/components/ui/Icon.vue'
import { useSessionStore, type AppRole } from '@/stores/session'

const session = useSessionStore()

onMounted(() => {
  session.hydrate()
  if (!session.user) uni.reLaunch({ url: '/pages/login/index' })
})

function selectRole(role: AppRole) {
  session.selectRole(role)
  uni.reLaunch({
    url: role === 'teacher'
      ? '/pages/course-select/index'
      : '/pages/student/join/index',
  })
}

function logout() {
  session.logout()
  uni.reLaunch({ url: '/pages/login/index' })
}
</script>

<style scoped lang="scss">
.role-page {
  min-height: 100vh;
  padding: 64rpx 32rpx;
  background: #f6f8fb;
}

.head {
  margin-bottom: 32rpx;
}

.title {
  display: block;
  font-size: 40rpx;
  font-weight: 800;
  color: #0f172a;
}

.desc {
  display: block;
  margin-top: 10rpx;
  font-size: 26rpx;
  color: #64748b;
}

.roles {
  display: flex;
  flex-direction: column;
  gap: 22rpx;
}

.role-card {
  width: 100%;
  padding: 30rpx;
  border-radius: 24rpx;
  background: #fff;
  border: 1rpx solid #e2e8f0;
  display: grid;
  grid-template-columns: 72rpx 1fr 36rpx;
  gap: 22rpx;
  align-items: center;
  text-align: left;
  box-shadow: 0 12rpx 30rpx rgba(15, 23, 42, 0.06);
}

.role-title {
  display: block;
  font-size: 30rpx;
  font-weight: 700;
  color: #0f172a;
}

.role-desc {
  display: block;
  margin-top: 8rpx;
  font-size: 24rpx;
  color: #64748b;
  line-height: 1.5;
}

.logout {
  margin-top: 36rpx;
  height: 78rpx;
  color: #64748b;
  font-size: 26rpx;
}
</style>
