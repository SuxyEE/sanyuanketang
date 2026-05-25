import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'ClassroomScreen',
      component: () => import('../views/ClassroomScreen.vue'),
    },
  ],
})

export default router
