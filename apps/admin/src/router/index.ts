import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'Login',
      component: () => import('../views/Login.vue'),
    },
    {
      path: '/',
      component: () => import('../layout/MainLayout.vue'),
      redirect: '/dashboard',
      children: [
        { path: 'dashboard', name: 'Dashboard', component: () => import('../views/Dashboard.vue'), meta: { title: '仪表盘' } },
        { path: 'courses', name: 'Courses', component: () => import('../views/Courses.vue'), meta: { title: '课程管理' } },
        { path: 'monitor', name: 'Monitor', component: () => import('../views/Monitor.vue'), meta: { title: '实时监控' } },
        { path: 'reports', name: 'Reports', component: () => import('../views/Reports.vue'), meta: { title: '数据报告' } },
        { path: 'users', name: 'Users', component: () => import('../views/Users.vue'), meta: { title: '用户管理' } },
      ],
    },
  ],
})

export default router
