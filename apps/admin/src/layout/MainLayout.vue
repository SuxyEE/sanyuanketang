<template>
  <el-container class="layout-container">
    <el-aside :width="isCollapsed ? '64px' : '232px'" class="layout-aside">
      <div class="logo-area" :class="{ 'is-collapsed': isCollapsed }">
        <span class="logo-mark" aria-hidden="true">
          <svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" style="width: 100%; height: 100%; display: block;"><rect width="32" height="32" rx="7" fill="#2563eb"/><text x="16" y="23" font-size="20" text-anchor="middle" fill="#ffffff" font-family="sans-serif" font-weight="bold">三</text></svg>
        </span>
        <span v-show="!isCollapsed" class="logo-text">
          <span class="logo-name">三元课堂</span>
          <span class="logo-brand">管理后台</span>
        </span>
      </div>

      <el-menu
        :default-active="route.path"
        :collapse="isCollapsed"
        router
        class="aside-menu"
        background-color="transparent"
        text-color="rgba(255, 255, 255, 0.72)"
        active-text-color="#ffffff"
      >
        <el-menu-item index="/dashboard">
          <el-icon><DataBoard /></el-icon>
          <span>仪表盘</span>
        </el-menu-item>
        <el-menu-item index="/ai">
          <el-icon><MagicStick /></el-icon>
          <span>AI 治理</span>
        </el-menu-item>
        <el-menu-item index="/classes">
          <el-icon><School /></el-icon>
          <span>班级学情</span>
        </el-menu-item>
        <el-menu-item index="/courses">
          <el-icon><Reading /></el-icon>
          <span>课程管理</span>
        </el-menu-item>
        <el-menu-item index="/monitor">
          <el-icon><Monitor /></el-icon>
          <span>实时监控</span>
        </el-menu-item>
        <el-menu-item index="/reports">
          <el-icon><TrendCharts /></el-icon>
          <span>数据报告</span>
        </el-menu-item>
        <el-menu-item index="/users">
          <el-icon><User /></el-icon>
          <span>用户管理</span>
        </el-menu-item>
      </el-menu>

      <button class="collapse-btn" :aria-label="isCollapsed ? '展开侧边栏' : '收起侧边栏'" @click="isCollapsed = !isCollapsed">
        <el-icon v-if="isCollapsed"><Expand /></el-icon>
        <el-icon v-else><Fold /></el-icon>
      </button>
    </el-aside>

    <el-container>
      <el-header class="layout-header">
        <div class="header-left">
          <el-breadcrumb separator="/" class="breadcrumb">
            <el-breadcrumb-item :to="{ path: '/' }">首页</el-breadcrumb-item>
            <el-breadcrumb-item>{{ route.meta.title }}</el-breadcrumb-item>
          </el-breadcrumb>
        </div>

        <div class="header-right">
          <button class="icon-btn" aria-label="通知中心">
            <el-badge :value="3" :max="99" class="notif-badge">
              <el-icon :size="18"><Bell /></el-icon>
            </el-badge>
          </button>
          <el-dropdown>
            <div class="user-info" tabindex="0" aria-label="用户菜单">
              <el-avatar :size="32" class="user-avatar">管</el-avatar>
              <div class="user-text">
                <span class="user-name">管理员</span>
                <span class="user-role">超级管理员</span>
              </div>
              <el-icon class="user-arrow"><ArrowDown /></el-icon>
            </div>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item>个人设置</el-dropdown-item>
                <el-dropdown-item divided>退出登录</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </el-header>

      <el-main class="layout-main">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const isCollapsed = ref(false)
</script>

<style scoped>
.layout-container {
  height: 100vh;
}

/* ========== Aside ========== */
.layout-aside {
  background: linear-gradient(180deg, var(--color-sider-bg) 0%, var(--color-sider-bg-end) 100%);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-right: 1px solid rgba(255, 255, 255, 0.04);
  transition: width var(--duration-base) var(--ease-out);
}

.logo-area {
  height: 64px;
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: 0 var(--space-5);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.logo-area.is-collapsed { justify-content: center; padding: 0; }

.logo-mark {
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.logo-text {
  display: flex;
  flex-direction: column;
  line-height: 1.2;
  min-width: 0;
}

.logo-name {
  color: #fff;
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-bold);
  letter-spacing: 0.02em;
}

.logo-brand {
  margin-top: 2px;
  font-size: 11px;
  color: var(--color-sider-text-mute);
  letter-spacing: 0.04em;
}

/* ----- Element Plus menu skin（覆盖默认深色样式） ----- */
.aside-menu {
  flex: 1;
  border-right: none;
  padding: var(--space-3) var(--space-3);
}

.aside-menu :deep(.el-menu-item) {
  height: 44px;
  line-height: 44px;
  border-radius: var(--radius-md);
  margin: 4px 0;
  padding-left: 14px !important;
  transition: background var(--duration-fast) var(--ease-out),
              color var(--duration-fast) var(--ease-out);
}

.aside-menu :deep(.el-menu-item:hover) {
  background: rgba(255, 255, 255, 0.06) !important;
  color: #fff !important;
}

.aside-menu :deep(.el-menu-item.is-active) {
  background: var(--color-sider-active-bg) !important;
  color: #fff !important;
  position: relative;
}

.aside-menu :deep(.el-menu-item.is-active::before) {
  content: '';
  position: absolute;
  left: -3px;
  top: 8px;
  bottom: 8px;
  width: 3px;
  border-radius: 0 var(--radius-xs) var(--radius-xs) 0;
  background: linear-gradient(180deg, #5b8def, #a370f7);
}

.aside-menu :deep(.el-menu-item .el-icon) {
  color: inherit;
  margin-right: var(--space-3);
}

.collapse-btn {
  appearance: none;
  background: transparent;
  border: none;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-sider-text-mute);
  cursor: pointer;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  transition: color var(--duration-fast) var(--ease-out),
              background var(--duration-fast) var(--ease-out);
}

.collapse-btn:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.05);
}

/* ========== Header ========== */
.layout-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 64px;
  padding: 0 var(--space-6);
  border-bottom: 1px solid var(--color-border-subtle);
  background: var(--color-bg-elevated);
  box-shadow: var(--shadow-xs);
}

.breadcrumb :deep(.el-breadcrumb__item) { font-size: var(--font-size-sm); }
.breadcrumb :deep(.el-breadcrumb__inner) { color: var(--color-text-tertiary); font-weight: var(--font-weight-regular); }
.breadcrumb :deep(.el-breadcrumb__item:last-child .el-breadcrumb__inner) {
  color: var(--color-text-primary);
  font-weight: var(--font-weight-semi);
}

.header-right {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.icon-btn {
  appearance: none;
  background: transparent;
  border: none;
  width: 36px;
  height: 36px;
  border-radius: var(--radius-md);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: background var(--duration-fast) var(--ease-out),
              color var(--duration-fast) var(--ease-out);
}

.icon-btn:hover { background: var(--color-bg-soft); color: var(--color-brand-600); }
.icon-btn:focus-visible { outline: none; box-shadow: var(--shadow-focus); }

.notif-badge :deep(.el-badge__content) {
  background: var(--color-danger-500);
  border: 2px solid var(--color-bg-elevated);
}

.user-info {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: 4px var(--space-2) 4px 4px;
  border-radius: var(--radius-full);
  cursor: pointer;
  transition: background var(--duration-fast) var(--ease-out);
}

.user-info:hover { background: var(--color-bg-soft); }
.user-info:focus-visible { outline: none; box-shadow: var(--shadow-focus); }

.user-avatar {
  background: linear-gradient(135deg, var(--color-brand-500), var(--color-ai-500));
  color: #fff;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semi);
}

.user-text {
  display: flex;
  flex-direction: column;
  line-height: 1.2;
}

.user-name {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semi);
  color: var(--color-text-primary);
}

.user-role {
  margin-top: 2px;
  font-size: 11px;
  color: var(--color-text-tertiary);
}

.user-arrow {
  color: var(--color-text-tertiary);
  font-size: 12px;
}

/* ========== Main ========== */
.layout-main {
  background: var(--color-bg-page);
  padding: var(--space-5);
  overflow-y: auto;
}

@media (max-width: 768px) {
  .user-text { display: none; }
  .layout-header { padding: 0 var(--space-4); }
  .layout-main   { padding: var(--space-4); }
}
</style>
