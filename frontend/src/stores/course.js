import { defineStore } from 'pinia'
import request from '@/utils/request'

export const useCourseStore = defineStore('course', {
  state: () => ({
    courses: [],
    currentCourse: null,
    loading: false
  }),
  actions: {
    async fetchCourses(params = {}) {
      this.loading = true
      try {
        const data = await request.get('/courses', { params })
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
    }
  }
})
