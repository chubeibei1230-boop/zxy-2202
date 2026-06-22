import { defineStore } from 'pinia'
import request from '@/utils/request'

export const useCourseStore = defineStore('course', {
  state: () => ({
    courses: [],
    currentCourse: null,
    loading: false,
    myWaitlists: [],
    courseWaitlist: [],
    waitlistStats: null,
    waitlistLogs: []
  }),
  actions: {
    async fetchCourses(params = {}) {
      this.loading = true
      try {
        const query = {}
        if (params.keyword) query.keyword = params.keyword
        if (params.instructor) query.instructor = params.instructor
        if (params.statuses && params.statuses.length) query.statuses = params.statuses
        if (params.status) query.status = params.status
        if (params.dateRange && params.dateRange.length === 2) {
          query.start_date = params.dateRange[0]
          query.end_date = params.dateRange[1]
        }
        if (params.start_date) query.start_date = params.start_date
        if (params.end_date) query.end_date = params.end_date
        if (params.minRating) query.min_rating = params.minRating
        const data = await request.get('/courses', { params: query })
        this.courses = data.courses || data || []
        return this.courses
      } finally {
        this.loading = false
      }
    },
    async fetchCourseDetail(id) {
      this.loading = true
      try {
        const data = await request.get(`/courses/${id}`)
        this.currentCourse = data
        return data
      } finally {
        this.loading = false
      }
    },
    async createCourse(payload) {
      return await request.post('/courses', payload)
    },
    async updateCourse(id, payload) {
      return await request.put(`/courses/${id}`, payload)
    },
    async deleteCourse(id) {
      return await request.delete(`/courses/${id}`)
    },
    async bookCourse(courseId) {
      return await request.post(`/bookings`, { course_id: courseId })
    },
    async cancelBooking(bookingId) {
      return await request.delete(`/bookings/${bookingId}`)
    },
    async joinWaitlist(courseId) {
      return await request.post(`/waitlists/course/${courseId}/join`)
    },
    async leaveWaitlist(waitlistId) {
      return await request.post(`/waitlists/${waitlistId}/leave`)
    },
    async confirmWaitlist(waitlistId) {
      return await request.post(`/waitlists/${waitlistId}/confirm`)
    },
    async rejectWaitlist(waitlistId) {
      return await request.post(`/waitlists/${waitlistId}/reject`)
    },
    async fetchMyWaitlists() {
      const data = await request.get('/waitlists/my')
      this.myWaitlists = data.waitlists || []
      return this.myWaitlists
    },
    async fetchCourseWaitlist(courseId) {
      const data = await request.get(`/waitlists/course/${courseId}`)
      this.courseWaitlist = data.waitlists || []
      this.waitlistStats = data.stats || null
      return data
    },
    async fetchMyWaitlistStatus(courseId) {
      const data = await request.get(`/waitlists/course/${courseId}/my-status`)
      return data
    },
    async adminRemoveWaitlist(waitlistId, reason) {
      return await request.delete(`/waitlists/${waitlistId}/admin-remove`, { data: { reason } })
    },
    async fetchWaitlistLogs(courseId) {
      const data = await request.get(`/waitlists/course/${courseId}/logs`)
      this.waitlistLogs = data.logs || []
      return this.waitlistLogs
    }
  }
})
