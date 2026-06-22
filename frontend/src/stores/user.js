import { defineStore } from 'pinia'
import request from '@/utils/request'

export const useUserStore = defineStore('user', {
  state: () => ({
    token: localStorage.getItem('token') || '',
    userInfo: JSON.parse(localStorage.getItem('userInfo') || 'null')
  }),
  getters: {
    isLoggedIn: (state) => !!state.token,
    role: (state) => state.userInfo?.role || '',
    userId: (state) => state.userInfo?.id || null,
    isAdmin: (state) => state.userInfo?.role === 'admin',
    isAssistant: (state) => state.userInfo?.role === 'assistant',
    isStudent: (state) => state.userInfo?.role === 'student'
  },
  actions: {
    async login(username, password, role) {
      try {
        const data = await request.post('/auth/login', { username, password, role })
        this.token = data.token
        this.userInfo = data.user
        localStorage.setItem('token', data.token)
        localStorage.setItem('userInfo', JSON.stringify(data.user))
        return data
      } catch (e) {
        throw e
      }
    },
    logout() {
      this.token = ''
      this.userInfo = null
      localStorage.removeItem('token')
      localStorage.removeItem('userInfo')
    }
  }
})
