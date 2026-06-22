import { createRouter, createWebHistory } from 'vue-router'
import { useUserStore } from '@/stores/user'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/Login.vue'),
    meta: { requiresAuth: false }
  },
  {
    path: '/',
    component: () => import('@/layouts/MainLayout.vue'),
    redirect: '/dashboard',
    children: [
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('@/views/Dashboard.vue'),
        meta: { requiresAuth: true, title: '首页仪表盘' }
      },
      {
        path: 'my-bookings',
        name: 'MyBookings',
        component: () => import('@/views/MyBookings.vue'),
        meta: { requiresAuth: true, title: '我的预约' }
      },
      {
        path: 'waitlist-center',
        name: 'WaitlistCenter',
        component: () => import('@/views/WaitlistCenter.vue'),
        meta: { requiresAuth: true, roles: ['student'], title: '候补通知中心' }
      },
      {
        path: 'courses',
        name: 'Courses',
        component: () => import('@/views/Courses.vue'),
        meta: { requiresAuth: true, title: '课程列表' }
      },
      {
        path: 'courses/:id',
        name: 'CourseDetail',
        component: () => import('@/views/CourseDetail.vue'),
        meta: { requiresAuth: true, title: '课程详情' }
      },
      {
        path: 'on-site',
        name: 'OnSite',
        component: () => import('@/views/OnSite.vue'),
        meta: { requiresAuth: true, roles: ['assistant', 'admin'], title: '现场确认' }
      },
      {
        path: 'feedback-stats',
        name: 'FeedbackStats',
        component: () => import('@/views/FeedbackStats.vue'),
        meta: { requiresAuth: true, title: '反馈统计' }
      },
      {
        path: 'settings',
        name: 'Settings',
        component: () => import('@/views/Settings.vue'),
        meta: { requiresAuth: true, roles: ['admin'], title: '管理设置' }
      }
    ]
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  const userStore = useUserStore()

  if (to.meta.requiresAuth !== false && !userStore.isLoggedIn) {
    next({ path: '/login', query: { redirect: to.fullPath } })
    return
  }

  if (to.path === '/login' && userStore.isLoggedIn) {
    next('/dashboard')
    return
  }

  if (to.meta.roles && to.meta.roles.length > 0) {
    if (!to.meta.roles.includes(userStore.role)) {
      next('/dashboard')
      return
    }
  }

  next()
})

export default router
