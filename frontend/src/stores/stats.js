import { defineStore } from 'pinia'
import request from '@/utils/request'

export const useStatsStore = defineStore('stats', {
  state: () => ({
    dashboard: {
      totalCourses: 0,
      monthlyBookings: 0,
      avgAttendance: 0,
      avgRating: 0,
      bookingTrend: [],
      attendanceByCourse: [],
      ratingDistribution: [],
      todos: []
    },
    feedbackStats: {
      avgRating: 0,
      ratingDistribution: [],
      feedbackList: []
    }
  }),
  actions: {
    async fetchDashboard() {
      try {
        const data = await request.get('/stats/dashboard')
        this.dashboard = { ...this.dashboard, ...data }
        return this.dashboard
      } catch (e) {
        return this.dashboard
      }
    },
    async fetchFeedbackStats(courseId) {
      try {
        const data = await request.get(`/stats/feedback/${courseId}`)
        this.feedbackStats = { ...this.feedbackStats, ...data }
        return this.feedbackStats
      } catch (e) {
        return this.feedbackStats
      }
    }
  }
})
