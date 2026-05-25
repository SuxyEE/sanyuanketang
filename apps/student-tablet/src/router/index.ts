import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'JoinClassroom',
      component: () => import('../views/JoinClassroom.vue'),
    },
    {
      path: '/classroom',
      name: 'StudentMain',
      component: () => import('../views/StudentMain.vue'),
    },
    {
      path: '/after-class',
      name: 'AfterClass',
      component: () => import('../views/AfterClass.vue'),
    },
  ],
})

export default router
