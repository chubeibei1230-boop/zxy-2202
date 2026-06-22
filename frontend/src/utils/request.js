import axios from 'axios'
import { ElMessage } from 'element-plus'
import router from '@/router'

const request = axios.create({
  baseURL: 'http://localhost:8161/api',
  timeout: 15000
})

request.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

request.interceptors.response.use(
  (response) => {
    return response.data
  },
  (error) => {
    if (error.response) {
      const { status } = error.response
      const { data } = error.response

      if (status === 401) {
        localStorage.removeItem('token')
        localStorage.removeItem('userInfo')
        ElMessage.error('登录已过期，请重新登录')
        router.push('/login')
        return Promise.reject(error)
      }

      if (status === 403) {
        ElMessage.error('没有权限访问该资源')
        return Promise.reject(error)
      }

      if (data && data.message) {
        ElMessage.error(data.message)
      } else {
        ElMessage.error(`请求失败：${status}`)
      }
    } else if (error.message) {
      ElMessage.error(error.message)
    } else {
      ElMessage.error('网络异常，请稍后重试')
    }
    return Promise.reject(error)
  }
)

export default request
