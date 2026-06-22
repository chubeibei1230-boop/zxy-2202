<template>
  <div class="my-bookings">
    <div class="page-header">
      <h2 class="page-title">
        <el-icon><Document /></el-icon>
        我的预约与候补
      </h2>
      <el-button type="primary" :icon="Refresh" @click="loadAll">刷新</el-button>
    </div>

    <el-tabs v-model="activeTab" class="main-tabs">
      <el-tab-pane label="我的预约" name="bookings">
        <div class="stats-row">
          <div class="mini-stat">
            <span class="mini-label">预约总数</span>
            <span class="mini-value booking-count">{{ myBookings.length }}</span>
          </div>
          <div class="mini-stat">
            <span class="mini-label">已预约</span>
            <span class="mini-value booked-count">{{ bookedCount }}</span>
          </div>
          <div class="mini-stat">
            <span class="mini-label">已到场</span>
            <span class="mini-value attended-count">{{ attendedCount }}</span>
          </div>
          <div class="mini-stat">
            <span class="mini-label">已取消</span>
            <span class="mini-value cancelled-count">{{ cancelledCount }}</span>
          </div>
        </div>

        <div v-if="loading" class="loading-wrap">
          <el-skeleton :rows="5" animated />
        </div>

        <el-table
          v-else
          :data="myBookings"
          stripe
          style="width: 100%;"
          empty-text="暂无预约记录"
        >
          <el-table-column label="课程" min-width="220">
            <template #default="{ row }">
              <div class="course-cell">
                <div class="course-title">{{ row.course?.title || '-' }}</div>
                <div class="course-meta">
                  <el-tag size="small" type="primary" effect="plain">{{ row.course?.instructor || '-' }}</el-tag>
                  <el-tag size="small" effect="plain">{{ row.course?.classroom_area || '-' }}</el-tag>
                </div>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="课程时间" min-width="180">
            <template #default="{ row }">
              <div class="time-cell">
                <div class="time-main">
                  <el-icon><Calendar /></el-icon>
                  {{ formatDate(row.course?.start_time) }}
                </div>
                <div class="time-sub">
                  {{ formatTime(row.course?.start_time) }} - {{ formatTime(row.course?.end_time) }}
                </div>
              </div>
            </template>
          </el-table-column>
          <el-table-column prop="booked_at" label="预约时间" width="180">
            <template #default="{ row }">
              <span>{{ formatDateTime(row.booked_at) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="状态" width="120">
            <template #default="{ row }">
              <el-tag :type="bookingStatusMap[row.status]?.type || 'info'" effect="dark">
                {{ bookingStatusMap[row.status]?.label || row.status }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="200" align="center">
            <template #default="{ row }">
              <el-button type="primary" link size="small" @click="goDetail(row.course_id)">
                查看详情
              </el-button>
              <el-button
                v-if="row.status === 'booked'"
                type="danger"
                link
                size="small"
                @click="handleCancelBooking(row)"
              >
                取消预约
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <el-tab-pane name="waitlists">
        <template #label>
          <span>
            我的候补
            <el-badge v-if="notifiedCount > 0" :value="notifiedCount" type="warning" class="wait-badge" />
          </span>
        </template>

        <div class="stats-row">
          <div class="mini-stat">
            <span class="mini-label">候补总数</span>
            <span class="mini-value wl-count">{{ myWaitlists.length }}</span>
          </div>
          <div class="mini-stat">
            <span class="mini-label">候补中</span>
            <span class="mini-value waiting-count">{{ waitingCount }}</span>
          </div>
          <div class="mini-stat">
            <span class="mini-label">补位待确认</span>
            <span class="mini-value notified-count-tag">{{ notifiedCount }}</span>
          </div>
          <div class="mini-stat">
            <span class="mini-label">已确认补位</span>
            <span class="mini-value confirmed-count">{{ confirmedCount }}</span>
          </div>
        </div>

        <div v-if="notifiedCount > 0" class="urgent-alert">
          <el-alert type="warning" :closable="false" show-icon>
            <template #title>
              您有 <strong>{{ notifiedCount }}</strong> 个补位机会待确认，请在限定时间内处理！
            </template>
          </el-alert>
        </div>

        <div v-if="loading" class="loading-wrap">
          <el-skeleton :rows="5" animated />
        </div>

        <el-table
          v-else
          :data="myWaitlists"
          stripe
          style="width: 100%;"
          empty-text="暂无候补记录"
        >
          <el-table-column label="课程" min-width="220">
            <template #default="{ row }">
              <div class="course-cell">
                <div class="course-title">{{ row.course?.title || '-' }}</div>
                <div class="course-meta">
                  <el-tag size="small" type="primary" effect="plain">{{ row.course?.instructor || '-' }}</el-tag>
                  <el-tag size="small" effect="plain">{{ row.course?.classroom_area || '-' }}</el-tag>
                </div>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="候补排名" width="120" align="center">
            <template #default="{ row }">
              <div v-if="row.status === 'waiting' || row.status === 'notified'" class="rank-cell">
                <span class="rank-badge">{{ row.position }}</span>
                <span class="rank-label">号</span>
              </div>
              <span v-else class="dim-text">-</span>
            </template>
          </el-table-column>
          <el-table-column prop="joined_at" label="加入时间" width="180">
            <template #default="{ row }">
              {{ formatDateTime(row.joined_at) }}
            </template>
          </el-table-column>
          <el-table-column label="状态" width="180">
            <template #default="{ row }">
              <div class="status-cell">
                <el-tag :type="waitlistStatusMap[row.status]?.type || 'info'" effect="dark">
                  {{ waitlistStatusMap[row.status]?.label || row.status }}
                </el-tag>
                <div v-if="row.status === 'notified' && row.expires_at" class="countdown">
                  <el-icon :size="14"><Timer /></el-icon>
                  <span>剩余 {{ getCountdown(row.expires_at) }}</span>
                </div>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="260" align="center">
            <template #default="{ row }">
              <el-button type="primary" link size="small" @click="goDetail(row.course_id)">
                查看详情
              </el-button>
              <el-button
                v-if="row.status === 'waiting' || row.status === 'notified'"
                type="info"
                link
                size="small"
                @click="handleLeaveWaitlist(row)"
              >
                退出候补
              </el-button>
              <el-button
                v-if="row.status === 'notified'"
                type="success"
                link
                size="small"
                @click="handleConfirmWaitlist(row)"
              >
                确认补位
              </el-button>
              <el-button
                v-if="row.status === 'notified'"
                type="danger"
                link
                size="small"
                @click="handleRejectWaitlist(row)"
              >
                拒绝补位
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useCourseStore } from '@/stores/course'
import { useUserStore } from '@/stores/user'
import { BOOKING_STATUS_MAP, WAITLIST_STATUS_MAP } from '@/constants'
import {
  Document, Refresh, Calendar, Timer
} from '@element-plus/icons-vue'
import dayjs from 'dayjs'

const router = useRouter()
const courseStore = useCourseStore()
const userStore = useUserStore()

const activeTab = ref('bookings')
const loading = ref(false)
const countdownTimer = ref(null)

const bookingStatusMap = BOOKING_STATUS_MAP
const waitlistStatusMap = WAITLIST_STATUS_MAP

const myBookings = computed(() => courseStore.myBookings || [])
const myWaitlists = computed(() => courseStore.myWaitlists || [])

const bookedCount = computed(() => myBookings.value.filter(b => b.status === 'booked').length)
const attendedCount = computed(() => myBookings.value.filter(b => b.status === 'attended').length)
const cancelledCount = computed(() => myBookings.value.filter(b => b.status === 'cancelled').length)
const waitingCount = computed(() => myWaitlists.value.filter(w => w.status === 'waiting').length)
const notifiedCount = computed(() => myWaitlists.value.filter(w => w.status === 'notified').length)
const confirmedCount = computed(() => myWaitlists.value.filter(w => w.status === 'confirmed').length)

function formatDate(s) {
  if (!s) return '-'
  return dayjs(s).format('YYYY-MM-DD')
}
function formatTime(s) {
  if (!s) return '-'
  return dayjs(s).format('HH:mm')
}
function formatDateTime(s) {
  if (!s) return '-'
  return dayjs(s).format('YYYY-MM-DD HH:mm')
}

function getCountdown(expiresAt) {
  if (!expiresAt) return '--'
  const diff = dayjs(expiresAt).diff(dayjs(), 'second')
  if (diff <= 0) return '已超时'
  const m = Math.floor(diff / 60)
  const s = diff % 60
  return `${m}分${s}秒`
}

function startCountdown() {
  stopCountdown()
  countdownTimer.value = setInterval(() => {
    myWaitlists.value.filter(w => w.status === 'notified').forEach(w => {
      const diff = dayjs(w.expires_at).diff(dayjs(), 'second')
      if (diff <= 0) {
        loadAll()
      }
    })
  }, 1000)
}

function stopCountdown() {
  if (countdownTimer.value) {
    clearInterval(countdownTimer.value)
    countdownTimer.value = null
  }
}

async function loadAll() {
  loading.value = true
  try {
    if (userStore.isStudent) {
      await Promise.all([
        courseStore.fetchMyBookings(),
        courseStore.fetchMyWaitlists()
      ])
    } else {
      await courseStore.fetchMyBookings()
    }
  } finally {
    loading.value = false
  }
  if (notifiedCount.value > 0) {
    startCountdown()
  }
}

function goDetail(courseId) {
  router.push(`/courses/${courseId}`)
}

async function handleCancelBooking(row) {
  try {
    await ElMessageBox.confirm(`确定取消《${row.course?.title || '该课程'}》的预约吗？`, '确认取消', {
      type: 'warning',
      confirmButtonText: '确定取消',
      cancelButtonText: '再想想'
    })
    await courseStore.cancelBooking(row.id)
    ElMessage.success('已取消预约')
    await loadAll()
  } catch (e) {}
}

async function handleLeaveWaitlist(row) {
  try {
    await ElMessageBox.confirm(`确定退出《${row.course?.title || '该课程'}》的候补队列吗？`, '确认退出', {
      type: 'warning',
      confirmButtonText: '确定退出',
      cancelButtonText: '再等等'
    })
    await courseStore.leaveWaitlist(row.id)
    ElMessage.success('已退出候补队列')
    await loadAll()
  } catch (e) {}
}

async function handleConfirmWaitlist(row) {
  try {
    await ElMessageBox.confirm(
      `确定确认《${row.course?.title || '该课程'}》的补位吗？确认后将转为正式预约。`,
      '确认补位',
      {
        type: 'success',
        confirmButtonText: '确认补位',
        cancelButtonText: '再想想'
      }
    )
    await courseStore.confirmWaitlist(row.id)
    ElMessage.success('补位成功，已转为正式预约')
    activeTab.value = 'bookings'
    await loadAll()
  } catch (e) {}
}

async function handleRejectWaitlist(row) {
  try {
    await ElMessageBox.confirm(
      `确定拒绝《${row.course?.title || '该课程'}》的补位机会吗？拒绝后名额将顺延给下一位候补。`,
      '拒绝补位',
      {
        type: 'warning',
        confirmButtonText: '确定拒绝',
        cancelButtonText: '再想想',
        confirmButtonClass: 'el-button--danger'
      }
    )
    await courseStore.rejectWaitlist(row.id)
    ElMessage.success('已拒绝补位，名额将顺延给下一位候补')
    await loadAll()
  } catch (e) {}
}

onMounted(() => {
  loadAll()
})

onBeforeUnmount(() => {
  stopCountdown()
})
</script>

<style scoped>
.my-bookings {
  padding: 0;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.page-title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: #303133;
  display: flex;
  align-items: center;
  gap: 8px;
}

.main-tabs :deep(.el-tabs__header) {
  background: #fff;
  padding: 0 16px;
  border-radius: 8px;
  margin-bottom: 16px;
}

.wait-badge {
  margin-left: 6px;
}

.stats-row {
  display: flex;
  gap: 16px;
  margin-bottom: 16px;
}

.mini-stat {
  flex: 1;
  background: #fff;
  padding: 16px 20px;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.mini-label {
  font-size: 13px;
  color: #909399;
}

.mini-value {
  font-size: 26px;
  font-weight: 700;
  color: #303133;
}

.booking-count { color: #409EFF; }
.booked-count { color: #67C23A; }
.attended-count { color: #E6A23C; }
.cancelled-count { color: #909399; }
.wl-count { color: #409EFF; }
.waiting-count { color: #909399; }
.notified-count-tag { color: #E6A23C; }
.confirmed-count { color: #67C23A; }

.urgent-alert {
  margin-bottom: 16px;
}

.loading-wrap {
  background: #fff;
  padding: 20px;
  border-radius: 8px;
}

.course-cell {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.course-title {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}

.course-meta {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.time-cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.time-main {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: #303133;
}

.time-sub {
  font-size: 12px;
  color: #909399;
}

.rank-cell {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 2px;
}

.rank-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 32px;
  height: 32px;
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: #fff;
  border-radius: 50%;
  font-size: 16px;
  font-weight: 700;
}

.rank-label {
  font-size: 12px;
  color: #909399;
}

.dim-text {
  color: #c0c4cc;
}

.status-cell {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.countdown {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #E6A23C;
  font-weight: 500;
}
</style>
