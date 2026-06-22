<template>
  <div class="waitlist-center">
    <div class="page-header">
      <h2 class="page-title">
        <el-icon><Bell /></el-icon>
        候补通知中心
      </h2>
      <el-tag size="large" :type="activeTab === 'notified' ? 'warning' : 'info'">
        {{ activeTab === 'notified' ? `待确认 ${notifiedCount}` : `候补中 ${waitingCount}` }}
      </el-tag>
    </div>

    <el-tabs v-model="activeTab" class="waitlist-tabs">
      <el-tab-pane label="待确认通知" name="notified">
        <template #label>
          <span class="tab-label">
            <el-icon><WarningFilled /></el-icon>
            待确认通知
            <el-badge v-if="notifiedCount > 0" :value="notifiedCount" class="tab-badge" />
          </span>
        </template>

        <div v-if="notifiedList.length === 0" class="empty-state">
          <el-empty description="暂无待确认的补位通知" :image-size="100">
            <template #image>
              <el-icon :size="60" color="#c0c4cc"><Bell /></el-icon>
            </template>
          </el-empty>
        </div>

        <div v-else class="notification-list">
          <div
            v-for="item in notifiedList"
            :key="item.id"
            class="notification-card card-shadow"
          >
            <div class="notification-header">
              <div class="notification-icon warning">
                <el-icon><WarningFilled /></el-icon>
              </div>
              <div class="notification-info">
                <div class="notification-title">
                  补位机会待确认
                  <el-tag type="warning" size="small" effect="dark">紧急</el-tag>
                </div>
                <div class="notification-time">
                  通知时间：{{ formatDateTime(item.notified_at) }}
                </div>
              </div>
              <div class="countdown-box">
                <div class="countdown-label">剩余确认时间</div>
                <div class="countdown-time" :class="{ urgent: getCountdown(item.id) <= 300 }">
                  {{ formatCountdown(getCountdown(item.id)) }}
                </div>
                <el-progress
                  type="dashboard"
                  :percentage="getCountdownPercent(item)"
                  :width="50"
                  :stroke-width="6"
                  :color="getCountdown(item.id) <= 300 ? '#F56C6C' : '#E6A23C'"
                />
              </div>
            </div>

            <div class="course-info-box">
              <div class="course-title">{{ item.course.title }}</div>
              <div class="course-meta">
                <span class="meta-item">
                  <el-icon><User /></el-icon>
                  {{ item.course.instructor }}
                </span>
                <span class="meta-item">
                  <el-icon><Calendar /></el-icon>
                  {{ formatDateTime(item.course.start_time) }}
                </span>
                <span class="meta-item">
                  <el-icon><Location /></el-icon>
                  {{ item.course.classroom_area || '-' }}
                </span>
              </div>
            </div>

            <div class="notification-actions">
              <el-button type="success" :icon="Check" size="large" @click="handleConfirm(item)">
                确认补位
              </el-button>
              <el-button type="danger" :icon="Close" size="large" @click="handleReject(item)">
                放弃名额
              </el-button>
              <el-button type="info" :icon="View" size="large" @click="goToCourse(item.course_id)">
                查看课程
              </el-button>
            </div>
          </div>
        </div>
      </el-tab-pane>

      <el-tab-pane label="候补队列" name="waiting">
        <template #label>
          <span class="tab-label">
            <el-icon><Clock /></el-icon>
            候补队列
            <el-tag v-if="waitingCount > 0" type="info" size="small" style="margin-left: 6px;">{{ waitingCount }}</el-tag>
          </span>
        </template>

        <div v-if="waitingList.length === 0" class="empty-state">
          <el-empty description="暂无候补中的课程" :image-size="100">
            <template #image>
              <el-icon :size="60" color="#c0c4cc"><Connection /></el-icon>
            </template>
            <el-button type="primary" @click="$router.push('/courses')">去看看课程</el-button>
          </el-empty>
        </div>

        <div v-else class="waitlist-grid">
          <div
            v-for="item in waitingList"
            :key="item.id"
            class="waitlist-card card-shadow"
          >
            <div class="waitlist-rank">
              <div class="rank-number">#{{ item.position }}</div>
              <div class="rank-label">当前排名</div>
            </div>
            <div class="waitlist-content">
              <div class="course-title">{{ item.course.title }}</div>
              <div class="course-meta">
                <span class="meta-item">
                  <el-icon><User /></el-icon>
                  {{ item.course.instructor }}
                </span>
                <span class="meta-item">
                  <el-icon><Calendar /></el-icon>
                  {{ formatDateTime(item.course.start_time) }}
                </span>
              </div>
              <div class="waitlist-status">
                <el-tag type="info" effect="light">
                  <el-icon style="margin-right: 4px;"><Clock /></el-icon>
                  候补中
                </el-tag>
                <span class="join-time">
                  加入时间：{{ formatDateTime(item.joined_at) }}
                </span>
              </div>
            </div>
            <div class="waitlist-actions">
              <el-button type="primary" link @click="goToCourse(item.course_id)">
                查看详情
              </el-button>
              <el-popconfirm
                title="确定要退出候补队列吗？"
                confirm-button-text="退出"
                cancel-button-text="再想想"
                @confirm="handleLeave(item)"
              >
                <template #reference>
                  <el-button type="danger" link>退出候补</el-button>
                </template>
              </el-popconfirm>
            </div>
          </div>
        </div>
      </el-tab-pane>

      <el-tab-pane label="历史记录" name="history">
        <template #label>
          <span class="tab-label">
            <el-icon><Document /></el-icon>
            历史记录
          </span>
        </template>

        <el-table :data="historyList" stripe class="history-table">
          <el-table-column prop="course.title" label="课程名称" min-width="180" />
          <el-table-column label="状态" width="120">
            <template #default="{ row }">
              <el-tag :type="WAITLIST_STATUS_MAP[row.status]?.type || 'info'" size="small" round>
                {{ WAITLIST_STATUS_MAP[row.status]?.label || '-' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="joined_at" label="加入时间" width="170">
            <template #default="{ row }">{{ formatDateTime(row.joined_at) }}</template>
          </el-table-column>
          <el-table-column label="结束时间" width="170">
            <template #default="{ row }">
              <span v-if="row.status === 'confirmed'">{{ formatDateTime(row.confirmed_at) }}</span>
              <span v-else-if="row.status === 'rejected'">{{ formatDateTime(row.rejected_at) }}</span>
              <span v-else-if="row.status === 'expired'">{{ formatDateTime(row.rejected_at || row.expires_at) }}</span>
              <span v-else-if="row.status === 'removed'">{{ formatDateTime(row.removed_at) }}</span>
              <span v-else>-</span>
            </template>
          </el-table-column>
          <el-table-column label="说明" min-width="150">
            <template #default="{ row }">
              <span v-if="row.status === 'confirmed'">已成功补位</span>
              <span v-else-if="row.status === 'expired'">确认超时</span>
              <span v-else-if="row.status === 'rejected'">主动放弃补位</span>
              <span v-else-if="row.status === 'removed'">{{ row.removed_reason || '已移除' }}</span>
              <span v-else>-</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="100" align="center">
            <template #default="{ row }">
              <el-button type="primary" link size="small" @click="goToCourse(row.course_id)">
                查看
              </el-button>
            </template>
          </el-table-column>
        </el-table>
        <el-empty v-if="historyList.length === 0" description="暂无历史记录" :image-size="80" />
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useCourseStore } from '@/stores/course'
import { useUserStore } from '@/stores/user'
import { WAITLIST_STATUS_MAP, WAITLIST_CONFIRM_TIMEOUT_MINUTES } from '@/constants'
import { formatDateTime } from '@/utils'
import dayjs from 'dayjs'
import {
  Bell, WarningFilled, Check, Close, View, Clock, Connection,
  User, Calendar, Location, Document
} from '@element-plus/icons-vue'

const router = useRouter()
const courseStore = useCourseStore()
const userStore = useUserStore()

const activeTab = ref('notified')
const myWaitlists = ref([])
const countdownMap = reactive({})
let countdownTimer = null

const notifiedList = computed(() =>
  myWaitlists.value.filter(w => w.status === 'notified').sort((a, b) => new Date(a.expires_at) - new Date(b.expires_at))
)

const waitingList = computed(() =>
  myWaitlists.value.filter(w => w.status === 'waiting').sort((a, b) => new Date(a.joined_at) - new Date(b.joined_at))
)

const historyList = computed(() =>
  myWaitlists.value.filter(w => ['confirmed', 'rejected', 'expired', 'removed'].includes(w.status))
    .sort((a, b) => new Date(b.joined_at) - new Date(a.joined_at))
)

const notifiedCount = computed(() => notifiedList.value.length)
const waitingCount = computed(() => waitingList.value.length)

function getCountdown(id) {
  return countdownMap[id] || 0
}

function getCountdownPercent(item) {
  const total = WAITLIST_CONFIRM_TIMEOUT_MINUTES * 60
  const remaining = getCountdown(item.id)
  return Math.max(0, Math.round(remaining / total * 100))
}

function formatCountdown(seconds) {
  if (seconds <= 0) return '0分0秒'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}分${s.toString().padStart(2, '0')}秒`
}

function updateCountdowns() {
  const now = dayjs()
  for (const item of notifiedList.value) {
    const exp = dayjs(item.expires_at)
    const diff = exp.diff(now, 'second')
    countdownMap[item.id] = Math.max(0, diff)
  }
}

async function loadData() {
  try {
    await courseStore.fetchMyWaitlists()
    myWaitlists.value = courseStore.myWaitlists || []
    updateCountdowns()
  } catch (e) {
    ElMessage.error('加载失败')
  }
}

async function handleConfirm(item) {
  try {
    await ElMessageBox.confirm(
      `确定要确认「${item.course.title}」的补位名额吗？确认后将自动转为正式预约。`,
      '确认补位',
      { type: 'success', confirmButtonText: '确认补位', cancelButtonText: '再想想' }
    )
    const result = await courseStore.confirmWaitlist(item.id)
    ElMessage.success('补位成功！已转为正式预约')
    await loadData()
  } catch (e) {
    if (e?.response?.data?.message) {
      ElMessage.error(e.response.data.message)
      await loadData()
    }
  }
}

async function handleReject(item) {
  try {
    await ElMessageBox.confirm(
      `确定要放弃「${item.course.title}」的补位名额吗？放弃后名额将顺延给下一位候补学员，您将保留在原候补位置。`,
      '放弃补位确认',
      { type: 'warning', confirmButtonText: '放弃名额', cancelButtonText: '再想想' }
    )
    const result = await courseStore.rejectWaitlist(item.id)
    ElMessage.success(result?.message || '已放弃本次补位，保留候补位置')
    await loadData()
  } catch (e) {}
}

async function handleLeave(item) {
  try {
    await courseStore.leaveWaitlist(item.id)
    ElMessage.success('已退出候补队列')
    await loadData()
  } catch (e) {}
}

function goToCourse(courseId) {
  router.push(`/courses/${courseId}`)
}

onMounted(() => {
  loadData()
  countdownTimer = setInterval(() => {
    updateCountdowns()
    if (notifiedList.value.some(item => getCountdown(item.id) <= 0)) {
      loadData()
    }
  }, 1000)
})

onBeforeUnmount(() => {
  if (countdownTimer) {
    clearInterval(countdownTimer)
    countdownTimer = null
  }
})
</script>

<style scoped>
.waitlist-center {
  padding: 0;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.page-title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 22px;
  font-weight: 700;
  color: #303133;
  margin: 0;
}

.waitlist-tabs :deep(.el-tabs__header) {
  margin-bottom: 24px;
}

.tab-label {
  display: flex;
  align-items: center;
  gap: 6px;
}

.tab-badge {
  margin-left: 4px;
}

.empty-state {
  padding: 60px 0;
}

.notification-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.notification-card {
  background: #fff;
  border-radius: 12px;
  padding: 24px;
  border: 2px solid transparent;
  transition: all 0.3s;
}

.notification-card:hover {
  border-color: #E6A23C;
  box-shadow: 0 4px 20px rgba(230, 162, 60, 0.15);
}

.notification-header {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid #f2f6fc;
}

.notification-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  color: #fff;
  flex-shrink: 0;
}

.notification-icon.warning {
  background: linear-gradient(135deg, #E6A23C, #F0C78E);
}

.notification-info {
  flex: 1;
}

.notification-title {
  font-size: 18px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 6px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.notification-time {
  font-size: 13px;
  color: #909399;
}

.countdown-box {
  text-align: center;
  flex-shrink: 0;
  position: relative;
  width: 100px;
}

.countdown-label {
  font-size: 12px;
  color: #909399;
  margin-bottom: 4px;
}

.countdown-time {
  font-size: 20px;
  font-weight: 700;
  color: #E6A23C;
  font-family: 'Monaco', monospace;
}

.countdown-time.urgent {
  color: #F56C6C;
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

.countdown-box :deep(.el-progress) {
  position: absolute;
  top: -10px;
  right: -10px;
}

.course-info-box {
  background: #f5f7fa;
  border-radius: 10px;
  padding: 16px;
  margin-bottom: 16px;
}

.course-title {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 10px;
}

.course-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  font-size: 13px;
  color: #606266;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.notification-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}

.waitlist-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
  gap: 16px;
}

.waitlist-card {
  background: #fff;
  border-radius: 12px;
  padding: 20px;
  display: flex;
  gap: 16px;
  transition: all 0.3s;
  position: relative;
  overflow: hidden;
}

.waitlist-card::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 4px;
  background: linear-gradient(180deg, #409EFF, #667eea);
}

.waitlist-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.1);
}

.waitlist-rank {
  text-align: center;
  flex-shrink: 0;
  width: 60px;
}

.rank-number {
  font-size: 28px;
  font-weight: 700;
  color: #409EFF;
  line-height: 1.2;
}

.rank-label {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}

.waitlist-content {
  flex: 1;
  min-width: 0;
}

.waitlist-content .course-title {
  font-size: 15px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 8px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.waitlist-content .course-meta {
  font-size: 12px;
  color: #606266;
  margin-bottom: 10px;
}

.waitlist-status {
  display: flex;
  align-items: center;
  gap: 12px;
}

.join-time {
  font-size: 12px;
  color: #909399;
}

.waitlist-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex-shrink: 0;
}

.history-table {
  background: #fff;
  border-radius: 12px;
  overflow: hidden;
}

.card-shadow {
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.06);
}
</style>
