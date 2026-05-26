import { createRouter, createWebHistory } from 'vue-router'

// 部署时挂在 /screen/，dev 时是 /，BASE_URL 由 Vite 注入
const BASE_URL = (import.meta as any).env?.BASE_URL ?? '/'

const router = createRouter({
  history: createWebHistory(BASE_URL),
  routes: [
    {
      path: '/',
      name: 'ClassroomScreen',
      component: () => import('../views/ClassroomScreen.vue'),
    },
  ],
})

export default router
