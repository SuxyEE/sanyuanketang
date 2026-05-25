import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'CourseSelect',
      component: () => import('../views/CourseSelect.vue'),
    },
    {
      path: '/classroom',
      name: 'TeacherControl',
      component: () => import('../views/TeacherControl.vue'),
    },
  ],
})

export default router
