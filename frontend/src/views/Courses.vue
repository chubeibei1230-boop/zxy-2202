<template>
  <div class="courses-page">
    <div class="page-header card-shadow" style="padding: 20px; background: #fff; border-radius: 12px; margin-bottom: 20px;">
      <div class="page-title" style="margin-bottom: 20px;">
        <el-icon :size="22"><Collection /></el-icon>
        课程列表
      </div>

      <el-form :inline="true" :model="filterForm" class="filter-form">
        <el-form-item label="主题">
          <el-input
            v-model="filterForm.keyword"
            placeholder="搜索课程主题/讲师"
            clearable
            :prefix-icon="Search"
            style="width: 220px;"
          />
        </el-form-item>
        <el-form-item label="讲师">
          <el-input
            v-model="filterForm.instructor"
            placeholder="输入讲师姓名"
            clearable
            style="width: 160px;"
          />
        </el-form-item>
        <el-form-item label="状态">
          <el-select
            v-model="filterForm.statuses"
            multiple
            placeholder="选择状态"
            collapse-tags
            collapse-tags-tooltip
            style="width: 220px;"
          >
            <el-option
              v-for="item in STATUS_OPTIONS"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="日期范围">
          <el-date-picker
            v-model="filterForm.dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            value-format="YYYY-MM-DD"
            style="width: 260px;"
          />
        </el-form-item>
        <el-form-item label="反馈等级">
          <el-rate
            v-model="filterForm.minRating"
            :max="5"
            allow-half
            show-text
            text-color="#67C23A"
            :texts="['不限', '1星+', '2星+', '3星+', '4星+', '5星']"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :icon="Search" @click="handleSearch">查询</el-button>
          <el-button :icon="Refresh" @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </div>

    <div class="card-shadow" style="padding: 20px; background: #fff; border-radius: 12px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
        <div>
          <span style="color: #909399; font-size: 14px;">共</span>
          <el-tag type="primary" size="small" style="margin: 0 4px;">{{ filteredCourses.length }}</el-tag>
          <span style="color: #909399; font-size: 14px;">门课程</span>
          <el-tag type="warning" size="small" effect="plain" style="margin-left: 12px;">
            <el-icon :size="11"><Connection /></el-icon>
            候补总人数 {{ totalWaitlistCount }}
          </el-tag>
        </div>
        <div>
          <el-radio-group v-model="viewMode" size="default">
            <el-radio-button label="table">
              <el-icon><Grid /></el-icon>
              表格
            </el-radio-button>
            <el-radio-button label="card">
              <el-icon><Menu /></el-icon>
              卡片
            </el-radio-button>
          </el-radio-group>
        </div>
      </div>

      <template v-if="viewMode === 'table'">
        <el-table :data="filteredCourses" stripe v-loading="courseStore.loading" style="width: 100%;">
          <el-table-column prop="title" label="课程主题" min-width="200">
            <template #default="{ row }">
              <el-link type="primary" @click="goDetail(row)">
                <el-icon><Reading /></el-icon>
                {{ row.title }}
              </el-link>
            </template>
          </el-table-column>
          <el-table-column prop="instructor" label="讲师" width="120" />
          <el-table-column label="时间" width="220">
            <template #default="{ row }">
              <div style="font-size: 13px; color: #606266;">
                <div><el-icon :size="12"><Calendar /></el-icon> {{ formatDate(row.start_time) }}</div>
                <div style="color: #909399; margin-top: 2px;">{{ formatDurationShort(row.start_time, row.end_time) }}</div>
              </div>
            </template>
          </el-table-column>
          <el-table-column prop="location" label="教室区域" width="120">
            <template #default="{ row }">
              <el-icon :size="14"><Location /></el-icon>
              {{ row.location || row.classroom_area || '-' }}
            </template>
          </el-table-column>
          <el-table-column label="容量/已约/候补" width="180">
            <template #default="{ row }">
              <el-progress
                :percentage="Math.min(100, Math.round((row.booked_count || 0) / (row.capacity || 1) * 100))"
                :stroke-width="10"
                :text-inside="true"
                :color="progressColor(row)"
              />
              <div style="font-size: 12px; color: #909399; text-align: center; margin-top: 4px;">
                {{ row.booked_count || 0 }} / {{ row.capacity || 0 }}
              </div>
              <div style="display: flex; justify-content: center; gap: 4px; margin-top: 4px; flex-wrap: wrap;">
                <el-tag v-if="row.waitlist_count > 0" type="warning" size="small" effect="plain">
                  <el-icon :size="11"><Connection /></el-icon>
                  候补 {{ row.waitlist_count }}
                </el-tag>
                <el-tag v-if="row.waitlist_in_fill > 0" type="danger" size="small" effect="plain">
                  补位中 {{ row.waitlist_in_fill }}
                </el-tag>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="我的状态" width="140" v-if="userStore.isStudent">
            <template #default="{ row }">
              <el-tag v-if="row.user_waitlist_status === 'waiting'" type="info" effect="light" round>
                <el-icon :size="12"><Clock /></el-icon>
                候补中
              </el-tag>
              <el-tag v-else-if="row.user_waitlist_status === 'notified'" type="warning" effect="dark" round>
                <el-icon :size="12"><BellFilled /></el-icon>
                补位中
              </el-tag>
              <el-tag v-else-if="row.user_booking_id" type="success" effect="light" round>
                <el-icon :size="12"><Check /></el-icon>
                已预约
              </el-tag>
              <span v-else style="color: #c0c4cc;">-</span>
            </template>
          </el-table-column>
          <el-table-column label="状态" width="110">
            <template #default="{ row }">
              <el-tag :type="STATUS_MAP[row.status]?.type || 'info'" effect="light" round>
                {{ STATUS_MAP[row.status]?.label || row.status }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="平均评分" width="110" align="center">
            <template #default="{ row }">
              <div v-if="row.avg_rating">
                <el-rate
                  :model-value="row.avg_rating"
                  disabled
                  size="small"
                  show-score
                  text-color="#ff9900"
                  score-template="{value}"
                />
              </div>
              <span v-else style="color: #c0c4cc;">暂无</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="280" fixed="right" align="center">
            <template #default="{ row }">
              <el-button type="primary" link size="small" @click="goDetail(row)">
                <el-icon><View /></el-icon>
                详情
              </el-button>

              <template v-if="userStore.isStudent">
                <el-button
                  v-if="canBook(row)"
                  type="success"
                  link
                  size="small"
                  @click="handleBook(row)"
                >
                  <el-icon><Check /></el-icon>
                  预约
                </el-button>
                <el-button
                  v-else-if="row.user_booking_id"
                  type="warning"
                  link
                  size="small"
                  @click="handleCancelBook(row)"
                >
                  <el-icon><Close /></el-icon>
                  取消
                </el-button>
                <el-button
                  v-if="canJoinWaitlist(row)"
                  type="warning"
                  link
                  size="small"
                  @click="handleJoinWaitlist(row)"
                >
                  <el-icon><Connection /></el-icon>
                  候补
                </el-button>
                <el-button
                  v-else-if="row.user_waitlist_id && row.user_waitlist_status === 'waiting'"
                  type="info"
                  link
                  size="small"
                  @click="handleLeaveWaitlist(row)"
                >
                  <el-icon><Close /></el-icon>
                  退候补
                </el-button>
              </template>

              <template v-if="userStore.isAdmin">
                <el-button type="warning" link size="small" @click="handleEdit(row)">
                  <el-icon><Edit /></el-icon>
                  编辑
                </el-button>
                <el-button type="danger" link size="small" @click="handleDelete(row)">
                  <el-icon><Delete /></el-icon>
                  删除
                </el-button>
              </template>
            </template>
          </el-table-column>
        </el-table>
      </template>

      <template v-else>
        <el-row :gutter="20">
          <el-col :span="8" v-for="course in filteredCourses" :key="course.id" style="margin-bottom: 20px;">
            <el-card shadow="hover" class="course-card" :body-style="{ padding: 0 }">
              <div class="card-header">
                <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                  <el-tag :type="STATUS_MAP[course.status]?.type || 'info'" effect="dark" size="small" round>
                    {{ STATUS_MAP[course.status]?.label || course.status }}
                  </el-tag>
                  <el-tag
                    v-if="userStore.isStudent && (course.user_booking_id || course.user_waitlist_status)"
                    class="card-my-status"
                    :type="course.user_waitlist_status === 'waiting' ? 'info' : course.user_waitlist_status === 'notified' ? 'warning' : 'success'"
                    :effect="course.user_waitlist_status === 'notified' ? 'dark' : 'light'"
                    size="small"
                    round
                  >
                    <el-icon v-if="course.user_waitlist_status === 'waiting'" :size="11"><Clock /></el-icon>
                    <el-icon v-else-if="course.user_waitlist_status === 'notified'" :size="11"><BellFilled /></el-icon>
                    <el-icon v-else-if="course.user_booking_id" :size="11"><Check /></el-icon>
                    {{ course.user_waitlist_status === 'waiting' ? '候补中' : course.user_waitlist_status === 'notified' ? '补位中' : '已预约' }}
                  </el-tag>
                </div>
                <span class="card-instructor">
                  <el-icon><User /></el-icon>
                  {{ course.instructor }}
                </span>
              </div>
              <div class="card-body">
                <div class="card-title" @click="goDetail(course)">
                  <el-icon><Reading /></el-icon>
                  {{ course.title }}
                </div>
                <div class="card-meta">
                  <div><el-icon :size="13"><Calendar /></el-icon> {{ formatDate(course.start_time) }}</div>
                  <div><el-icon :size="13"><Location /></el-icon> {{ course.location || course.classroom_area || '待定' }}</div>
                  <div><el-icon :size="13"><Clock /></el-icon> {{ formatDurationShort(course.start_time, course.end_time) }}</div>
                </div>
                <div class="card-progress">
                  <div style="display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 12px;">
                    <span style="color: #606266;">预约进度</span>
                    <span style="color: #909399;">{{ course.booked_count || 0 }} / {{ course.capacity || 0 }}</span>
                  </div>
                  <el-progress
                    :percentage="Math.min(100, Math.round((course.booked_count || 0) / (course.capacity || 1) * 100))"
                    :stroke-width="6"
                    :color="progressColor(course)"
                  />
                  <div style="display: flex; gap: 4px; margin-top: 8px; flex-wrap: wrap;">
                    <el-tag v-if="course.waitlist_count > 0" type="warning" size="small" effect="plain">
                      <el-icon :size="10"><Connection /></el-icon>
                      候补 {{ course.waitlist_count }}
                    </el-tag>
                    <el-tag v-if="course.waitlist_in_fill > 0" type="danger" size="small" effect="plain">
                      补位中 {{ course.waitlist_in_fill }}
                    </el-tag>
                  </div>
                </div>
                <div v-if="course.avg_rating" class="card-rating">
                  <el-rate :model-value="course.avg_rating" disabled size="small" show-score text-color="#ff9900" score-template="{value}分" />
                </div>
              </div>
              <div class="card-footer">
                <el-button type="primary" size="small" @click="goDetail(course)">
                  <el-icon><View /></el-icon>
                  详情
                </el-button>
                <template v-if="userStore.isStudent">
                  <el-button
                    v-if="canBook(course)"
                    type="success"
                    size="small"
                    @click="handleBook(course)"
                  >
                    <el-icon><Check /></el-icon>
                    立即预约
                  </el-button>
                  <el-button
                    v-else-if="course.user_booking_id"
                    type="warning"
                    size="small"
                    @click="handleCancelBook(course)"
                  >
                    <el-icon><Close /></el-icon>
                    取消预约
                  </el-button>
                  <el-button
                    v-if="canJoinWaitlist(course)"
                    type="warning"
                    size="small"
                    @click="handleJoinWaitlist(course)"
                  >
                    <el-icon><Connection /></el-icon>
                    候补
                  </el-button>
                  <el-button
                    v-else-if="course.user_waitlist_id && course.user_waitlist_status === 'waiting'"
                    type="info"
                    size="small"
                    @click="handleLeaveWaitlist(course)"
                  >
                    <el-icon><Close /></el-icon>
                    退候补
                  </el-button>
                </template>
              </div>
            </el-card>
          </el-col>
        </el-row>
      </template>

      <el-empty v-if="filteredCourses.length === 0 && !courseStore.loading" description="暂无课程数据" :image-size="100" />
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useCourseStore } from '@/stores/course'
import { useUserStore } from '@/stores/user'
import { STATUS_MAP, STATUS_OPTIONS } from '@/constants'
import { formatDate, formatDuration } from '@/utils'
import dayjs from 'dayjs'
import isBetween from 'dayjs/plugin/isBetween'
import {
  Collection, Search, Refresh, Reading, Calendar, Location, Clock,
  User, View, Check, Close, Edit, Delete, Grid, Menu, Connection, BellFilled
} from '@element-plus/icons-vue'

dayjs.extend(isBetween)

const router = useRouter()
const courseStore = useCourseStore()
const userStore = useUserStore()

const viewMode = ref('table')

const filterForm = reactive({
  keyword: '',
  instructor: '',
  statuses: [],
  dateRange: [],
  minRating: 0
})

const mockCourses = [
  { id: 1, title: '瑜伽入门班（第3期）', instructor: '李老师', start_time: '2026-06-25 09:00:00', end_time: '2026-06-25 10:30:00', location: 'A区活动室', capacity: 20, booked_count: 15, status: 'bookable', avg_rating: 4.5, user_booking_id: null, waitlist_count: 3, waitlist_in_fill: 0, user_waitlist_id: null, user_waitlist_status: null },
  { id: 2, title: '摄影技巧进阶班', instructor: '王老师', start_time: '2026-06-24 14:00:00', end_time: '2026-06-24 16:00:00', location: 'B区多功能厅', capacity: 15, booked_count: 15, status: 'full', avg_rating: 4.8, user_booking_id: 101, waitlist_count: 5, waitlist_in_fill: 1, user_waitlist_id: null, user_waitlist_status: null },
  { id: 3, title: '少儿绘画启蒙班', instructor: '张老师', start_time: '2026-06-26 15:30:00', end_time: '2026-06-26 17:00:00', location: 'C区画室', capacity: 25, booked_count: 8, status: 'pending', avg_rating: null, user_booking_id: null, waitlist_count: 0, waitlist_in_fill: 0, user_waitlist_id: null, user_waitlist_status: null },
  { id: 4, title: '书法基础班（第2期）', instructor: '赵老师', start_time: '2026-06-20 10:00:00', end_time: '2026-06-20 11:30:00', location: 'A区活动室', capacity: 18, booked_count: 18, status: 'ongoing', avg_rating: 4.2, user_booking_id: 102, waitlist_count: 8, waitlist_in_fill: 2, user_waitlist_id: 201, user_waitlist_status: 'waiting' },
  { id: 5, title: '古典舞入门课', instructor: '陈老师', start_time: '2026-06-18 19:00:00', end_time: '2026-06-18 20:30:00', location: 'B区舞蹈室', capacity: 16, booked_count: 16, status: 'completed', avg_rating: 4.9, user_booking_id: null, waitlist_count: 4, waitlist_in_fill: 0, user_waitlist_id: 202, user_waitlist_status: 'notified' },
  { id: 6, title: '茶艺品鉴课', instructor: '刘老师', start_time: '2026-06-27 14:30:00', end_time: '2026-06-27 16:30:00', location: 'D区茶室', capacity: 12, booked_count: 0, status: 'suspended', avg_rating: null, user_booking_id: null, waitlist_count: 0, waitlist_in_fill: 0, user_waitlist_id: null, user_waitlist_status: null }
]

const filteredCourses = computed(() => {
  const courses = courseStore.courses?.length ? courseStore.courses : mockCourses
  return courses.filter(c => {
    if (filterForm.keyword) {
      const kw = filterForm.keyword.toLowerCase()
      if (!c.title?.toLowerCase().includes(kw) && !c.instructor?.toLowerCase().includes(kw)) return false
    }
    if (filterForm.instructor) {
      if (!c.instructor?.includes(filterForm.instructor)) return false
    }
    if (filterForm.statuses?.length) {
      if (!filterForm.statuses.includes(c.status)) return false
    }
    if (filterForm.dateRange?.length === 2) {
      const start = dayjs(filterForm.dateRange[0])
      const end = dayjs(filterForm.dateRange[1]).endOf('day')
      const cStart = dayjs(c.start_time)
      if (!cStart.isBetween(start, end, null, '[]')) return false
    }
    if (filterForm.minRating > 0) {
      if (!c.avg_rating || c.avg_rating < filterForm.minRating) return false
    }
    return true
  })
})

const totalWaitlistCount = computed(() => {
  return filteredCourses.value.reduce((sum, c) => sum + (c.waitlist_count || 0), 0)
})

function canBook(course) {
  return (course.status === 'bookable') && !course.user_booking_id && (course.booked_count || 0) < (course.capacity || 0)
}

function canJoinWaitlist(course) {
  return userStore.isStudent &&
    !course.user_booking_id &&
    !course.user_waitlist_id &&
    ['bookable', 'full', 'pending'].includes(course.status) &&
    (course.booked_count || 0) >= (course.capacity || 0)
}

function progressColor(row) {
  const pct = Math.round((row.booked_count || 0) / (row.capacity || 1) * 100)
  if (pct >= 90) return '#F56C6C'
  if (pct >= 70) return '#E6A23C'
  return '#67C23A'
}

function formatDurationShort(start, end) {
  if (!start || !end) return '-'
  return `${dayjs(start).format('HH:mm')}-${dayjs(end).format('HH:mm')}`
}

function goDetail(row) {
  router.push(`/courses/${row.id}`)
}

function handleSearch() {
  courseStore.fetchCourses(filterForm)
}

function handleReset() {
  filterForm.keyword = ''
  filterForm.instructor = ''
  filterForm.statuses = []
  filterForm.dateRange = []
  filterForm.minRating = 0
  courseStore.fetchCourses()
}

async function handleBook(course) {
  try {
    await courseStore.bookCourse(course.id)
    ElMessage.success('预约成功')
    course.user_booking_id = Date.now()
    course.booked_count = (course.booked_count || 0) + 1
  } catch (e) {}
}

async function handleCancelBook(course) {
  ElMessageBox.confirm(`确定要取消预约「${course.title}」吗？`, '提示', {
    type: 'warning',
    confirmButtonText: '确定取消',
    cancelButtonText: '返回'
  }).then(async () => {
    try {
      await courseStore.cancelBooking(course.user_booking_id)
      ElMessage.success('已取消预约')
      course.user_booking_id = null
      course.booked_count = Math.max(0, (course.booked_count || 0) - 1)
      courseStore.fetchCourses()
    } catch (e) {}
  }).catch(() => {})
}

async function handleJoinWaitlist(course) {
  try {
    await courseStore.joinWaitlist(course.id)
    ElMessage.success('候补成功')
    courseStore.fetchCourses()
  } catch (e) {}
}

async function handleLeaveWaitlist(course) {
  ElMessageBox.confirm(`确定要退出「${course.title}」的候补队列吗？`, '提示', {
    type: 'warning',
    confirmButtonText: '确定退出',
    cancelButtonText: '返回'
  }).then(async () => {
    try {
      await courseStore.leaveWaitlist(course.user_waitlist_id)
      ElMessage.success('已退出候补')
      courseStore.fetchCourses()
    } catch (e) {}
  }).catch(() => {})
}

function handleEdit(row) {
  router.push(`/settings?editId=${row.id}`)
}

function handleDelete(row) {
  ElMessageBox.confirm(`确定删除课程「${row.title}」吗？此操作不可恢复。`, '删除确认', {
    type: 'error',
    confirmButtonText: '删除',
    cancelButtonText: '取消'
  }).then(async () => {
    try {
      await courseStore.deleteCourse(row.id)
      ElMessage.success('删除成功')
      courseStore.fetchCourses()
    } catch (e) {}
  }).catch(() => {})
}

onMounted(() => {
  courseStore.fetchCourses()
})
</script>

<style scoped>
.courses-page {
  padding: 0;
}

.page-title {
  font-size: 22px;
  font-weight: 600;
  color: #303133;
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 0;
}

.filter-form :deep(.el-form-item) {
  margin-bottom: 0;
}

.course-card {
  border-radius: 12px;
  overflow: hidden;
  transition: transform 0.2s;
  border: 1px solid #ebeef5;
}

.course-card:hover {
  transform: translateY(-4px);
}

.card-header {
  padding: 14px 18px;
  background: linear-gradient(135deg, #f5f7fa, #ebeef5);
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #ebeef5;
}

.card-instructor {
  font-size: 13px;
  color: #606266;
  display: flex;
  align-items: center;
  gap: 4px;
}

.card-body {
  padding: 18px;
}

.card-title {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
}

.card-title:hover {
  color: #409EFF;
}

.card-meta {
  font-size: 13px;
  color: #606266;
  line-height: 2;
  margin-bottom: 16px;
}

.card-meta > div {
  display: flex;
  align-items: center;
  gap: 6px;
}

.card-progress {
  margin-bottom: 12px;
}

.card-rating {
  padding-top: 8px;
  border-top: 1px dashed #ebeef5;
}

.card-footer {
  padding: 14px 18px;
  border-top: 1px solid #ebeef5;
  background: #fafbfc;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
</style>
