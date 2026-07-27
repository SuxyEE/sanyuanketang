import { createRouter, createWebHistory } from 'vue-router'

// 部署时挂在 /admin/，dev 时是 /，BASE_URL 由 Vite 注入
const BASE_URL = (import.meta as any).env?.BASE_URL ?? '/'

const router = createRouter({
  history: createWebHistory(BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'Login',
      component: () => import('../views/Login.vue'),
    },
    // 统一登录的两个免鉴权路由：/oidc/start 发起，/oidc/callback 用一次性票据换课堂会话
    {
      path: '/oidc/start',
      name: 'OidcStart',
      component: () => import('../views/oidc/Start.vue'),
      meta: { noAuth: true },
    },
    {
      path: '/oidc/callback',
      name: 'OidcCallback',
      component: () => import('../views/oidc/Callback.vue'),
      meta: { noAuth: true },
    },
    {
      path: '/',
      component: () => import('../layout/MainLayout.vue'),
      redirect: '/dashboard',
      children: [
        { path: 'dashboard', name: 'Dashboard', component: () => import('../views/Dashboard.vue'), meta: { title: '仪表盘' } },
        { path: 'ai', name: 'AiGovernance', component: () => import('../views/AiGovernance.vue'), meta: { title: 'AI 治理' } },
        { path: 'classes', name: 'Classes', component: () => import('../views/Classes.vue'), meta: { title: '班级管理' } },
        { path: 'classes/:classId', name: 'ClassDetail', component: () => import('../views/ClassDetail.vue'), meta: { title: '班级详情' } },
        { path: 'students/:studentId', name: 'StudentProfile', component: () => import('../views/StudentProfile.vue'), meta: { title: '学生画像' } },
        { path: 'courses', name: 'Courses', component: () => import('../views/Courses.vue'), meta: { title: '课程管理' } },
        { path: 'monitor', name: 'Monitor', component: () => import('../views/Monitor.vue'), meta: { title: '实时监控' } },
        { path: 'monitor/:roomId', name: 'ClassroomLive', component: () => import('../views/ClassroomLive.vue'), meta: { title: '课堂详情' } },
        { path: 'reports', name: 'Reports', component: () => import('../views/Reports.vue'), meta: { title: '数据报告' } },
        { path: 'users', name: 'Users', component: () => import('../views/Users.vue'), meta: { title: '用户管理' } },
      ],
    },
  ],
})

export default router
