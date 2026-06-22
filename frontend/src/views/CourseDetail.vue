<template>
  <div class="course-detail">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 12px;">
      <div>
        <el-button :icon="ArrowLeft" link @click="$router.back()">返回列表</el-button>
      </div>
      <div style="display: flex; gap: 8px; flex-wrap: wrap;">
        <template v-if="userStore.isStudent">
          <el-button
            v-if="canBook"
            type="success"
            :icon="Check"
            @click="handleBook"
          >
            立即预约
          </el-button>
          <el-button
            v-else-if="canJoinWaitlist"
            type="warning"
            :icon="Connection"
            @click="handleJoinWaitlist"
          >
            加入候补
          </el-button>
          <el-button
            v-else-if="course.user_waitlist && course.user_waitlist.status === 'waiting'"
            type="info"
            :icon="Clock"
            @click="handleLeaveWaitlist"
          >
            退出候补
          </el-button>
          <el-button
            v-else-if="course.user_booking_id"
            type="warning"
            :icon="Close"
            @click="handleCancelBook"
          >
            取消预约
          </el-button>
        </template>
        <template v-if="(userStore.isAssistant || userStore.isAdmin) && ['pending', 'ongoing'].includes(course.status)">
          <el-button type="primary" :icon="Tickets" @click="goOnSite">
            进入现场确认
          </el-button>
        </template>
        <template v-if="userStore.isAdmin">
          <el-button type="warning" :icon="Edit">编辑课程</el-button>
        </template>
      </div>
    </div>

    <el-alert
      v-if="myWaitlist && myWaitlist.status === 'notified'"
      :title="'您有一个补位机会待确认！剩余 ' + formatCountdown(countdownSeconds)"
      type="warning"
      :closable="false"
      show-icon
      style="margin-bottom: 20px;"
    >
      <template #default>
        <div style="display: flex; gap: 8px; margin-top: 8px; align-items: center;">
          <el-progress
            type="dashboard"
            :percentage="countdownPercent"
            :width="60"
            :stroke-width="8"
            color="#E6A23C"
          />
          <div>
            <div style="font-size: 14px; font-weight: 600; color: #E6A23C;">
              请在 {{ WAITLIST_CONFIRM_TIMEOUT_MINUTES }} 分钟内确认补位
            </div>
            <div style="font-size: 12px; color: #909399; margin-top: 4px;">
              超时或拒绝后，名额将自动顺延给下一位候补学员
            </div>
            <div style="margin-top: 8px; display: flex; gap: 8px;">
              <el-button type="success" size="small" :icon="Check" @click="handleConfirmWaitlist">
                确认补位
              </el-button>
              <el-button type="danger" size="small" :icon="Close" @click="handleRejectWaitlist">
                拒绝补位
              </el-button>
            </div>
          </div>
        </div>
      </template>
    </el-alert>

    <el-row :gutter="20">
      <el-col :span="16">
        <el-card shadow="never" class="info-card card-shadow">
          <template #header>
            <div class="card-header-bar">
              <el-icon :size="18"><Reading /></el-icon>
              <span>课程信息</span>
              <el-tag :type="STATUS_MAP[course.status]?.type || 'info'" effect="dark" round>
                {{ STATUS_MAP[course.status]?.label || '-' }}
              </el-tag>
            </div>
          </template>
          <h2 class="course-title">{{ course.title || '课程标题' }}</h2>
          <el-descriptions :column="2" border>
            <el-descriptions-item label="讲师">
              <el-icon><User /></el-icon>
              {{ course.instructor || '-' }}
            </el-descriptions-item>
            <el-descriptions-item label="教室区域">
              <el-icon><Location /></el-icon>
              {{ course.classroom_area || course.location || '-' }}
            </el-descriptions-item>
            <el-descriptions-item label="开始时间">
              <el-icon><Calendar /></el-icon>
              {{ formatDateTime(course.start_time) }}
            </el-descriptions-item>
            <el-descriptions-item label="结束时间">
              <el-icon><Clock /></el-icon>
              {{ formatDateTime(course.end_time) }}
            </el-descriptions-item>
            <el-descriptions-item label="课程容量">
              <el-icon><UserFilled /></el-icon>
              {{ course.capacity || 0 }} 人
            </el-descriptions-item>
            <el-descriptions-item label="已预约">
              <el-icon><Tickets /></el-icon>
              {{ course.booked_count || 0 }} 人
            </el-descriptions-item>
            <el-descriptions-item label="候补人数">
              <el-icon><Connection /></el-icon>
              <el-tag type="info" size="small" v-if="course.waitlist_waiting">{{ course.waitlist_waiting }} 人待补</el-tag>
              <el-tag type="warning" size="small" style="margin-left: 4px;" v-if="course.waitlist_in_fill">{{ course.waitlist_in_fill }} 人补位中</el-tag>
              <span v-if="!course.waitlist_waiting && !course.waitlist_in_fill" style="color: #909399;">暂无候补</span>
            </el-descriptions-item>
            <el-descriptions-item label="我的候补状态" v-if="userStore.isStudent && course.user_waitlist">
              <el-tag :type="WAITLIST_STATUS_MAP[course.user_waitlist.status]?.type || 'info'" effect="light" round>
                {{ WAITLIST_STATUS_MAP[course.user_waitlist.status]?.label || '-' }}
              </el-tag>
              <span v-if="myWaitlist && myWaitlist.position" style="margin-left: 8px; color: #909399;">
                排名第 {{ myWaitlist.position }} 位
              </span>
            </el-descriptions-item>
            <el-descriptions-item label="平均评分" :span="2">
              <el-rate
                v-if="course.avg_rating"
                :model-value="course.avg_rating"
                disabled
                show-score
                text-color="#ff9900"
                score-template="{value} 分"
              />
              <span v-else style="color: #c0c4cc;">暂无评分</span>
              <el-tag v-if="course.feedback_count" style="margin-left: 12px;" size="small">
                {{ course.feedback_count }} 条反馈
              </el-tag>
            </el-descriptions-item>
          </el-descriptions>

          <el-divider content-position="left">预约进度</el-divider>
          <el-progress
            :percentage="capacityPercent"
            :stroke-width="14"
            :color="capacityColor"
            :text-inside="false"
          />
          <div style="font-size: 13px; color: #909399; margin-top: 8px;">
            当前预约 {{ course.booked_count || 0 }} / {{ course.capacity || 0 }}，
            剩余 {{ Math.max(0, (course.capacity || 0) - (course.booked_count || 0)) }} 个名额
            <template v-if="course.waitlist_count > 0">
              ，候补队列 {{ course.waitlist_count }} 人
              <template v-if="course.waitlist_in_fill > 0">（其中 {{ course.waitlist_in_fill }} 人补位中）</template>
            </template>
          </div>

          <el-divider v-if="userStore.isStudent && course.user_waitlist" content-position="left">我的候补信息</el-divider>
          <div v-if="userStore.isStudent && course.user_waitlist" class="my-waitlist-box">
            <el-descriptions :column="2" border size="small">
              <el-descriptions-item label="候补排名">
                <el-tag type="primary" effect="dark" round>
                  第 {{ myWaitlist?.position || '-' }} 位
                </el-tag>
              </el-descriptions-item>
              <el-descriptions-item label="候补状态">
                <el-tag :type="WAITLIST_STATUS_MAP[course.user_waitlist.status]?.type || 'info'" effect="light" round>
                  {{ WAITLIST_STATUS_MAP[course.user_waitlist.status]?.label || '-' }}
                </el-tag>
              </el-descriptions-item>
              <el-descriptions-item label="加入时间">
                <el-icon :size="12"><Clock /></el-icon>
                {{ formatDateTime(course.user_waitlist.joined_at) }}
              </el-descriptions-item>
              <el-descriptions-item label="操作">
                <el-button
                  v-if="['waiting', 'notified'].includes(course.user_waitlist.status)"
                  type="danger"
                  link
                  size="small"
                  @click="handleLeaveWaitlist"
                >
                  退出候补
                </el-button>
              </el-descriptions-item>
            </el-descriptions>
          </div>
        </el-card>

        <el-card shadow="never" class="card-shadow" style="margin-top: 20px;">
          <template #header>
            <div class="card-header-bar">
              <el-icon :size="18"><Tickets /></el-icon>
              <span>预约学员列表</span>
              <el-tag size="small">{{ bookings.length }} 人</el-tag>
            </div>
          </template>
          <el-table :data="bookings" stripe size="default">
            <el-table-column label="序号" width="60" type="index" />
            <el-table-column prop="student_name" label="学员姓名" width="140">
              <template #default="{ row }">
                <el-icon><User /></el-icon>
                {{ row.student_name }}
              </template>
            </el-table-column>
            <el-table-column prop="booking_time" label="预约时间" width="180">
              <template #default="{ row }">
                {{ formatDateTime(row.booking_time) }}
              </template>
            </el-table-column>
            <el-table-column label="到场状态" width="120">
              <template #default="{ row }">
                <el-tag :type="ATTENDANCE_STATUS[row.attendance_status]?.type || 'info'" size="small" round>
                  {{ ATTENDANCE_STATUS[row.attendance_status]?.label || '待确认' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="phone" label="联系方式" />
            <el-table-column label="操作" width="100" align="center">
              <template #default="{ row }">
                <el-button type="primary" link size="small">联系</el-button>
              </template>
            </el-table-column>
          </el-table>
          <el-empty v-if="bookings.length === 0" description="暂无预约学员" :image-size="80" />
        </el-card>

        <el-card
          v-if="userStore.isAssistant || userStore.isAdmin"
          shadow="never"
          class="card-shadow"
          style="margin-top: 20px;"
        >
          <template #header>
            <div class="card-header-bar">
              <el-icon :size="18"><Connection /></el-icon>
              <span>候补队列管理</span>
              <div style="display: flex; gap: 8px;">
                <el-tag size="small" type="info" v-if="waitlistStats?.waiting">候补 {{ waitlistStats.waiting }} 人</el-tag>
                <el-tag size="small" type="warning" v-if="waitlistStats?.in_fill">补位中 {{ waitlistStats.in_fill }} 人</el-tag>
                <el-tag size="small" type="success" v-if="waitlistStats?.confirmed">已补位 {{ waitlistStats.confirmed }} 人</el-tag>
                <el-button size="small" :icon="Refresh" @click="loadWaitlistData">刷新</el-button>
              </div>
            </div>
          </template>
          <el-table :data="courseWaitlist" stripe size="default">
            <el-table-column label="候补序号" width="90" align="center">
              <template #default="{ row, $index }">
                <template v-if="row.status === 'waiting'">
                  <el-tag type="primary" effect="dark" round size="small">#{{ row.display_rank || ($index + 1) }}</el-tag>
                </template>
                <template v-else-if="row.status === 'notified'">
                  <el-tag type="warning" effect="dark" round size="small">补位中</el-tag>
                </template>
                <template v-else>
                  <el-tag type="success" effect="dark" round size="small">已补位</el-tag>
                </template>
              </template>
            </el-table-column>
            <el-table-column prop="user.name" label="学员姓名" width="120" />
            <el-table-column prop="user.phone" label="联系方式" width="140" />
            <el-table-column prop="joined_at" label="加入时间" width="170">
              <template #default="{ row }">{{ formatDateTime(row.joined_at) }}</template>
            </el-table-column>
            <el-table-column label="状态" width="120">
              <template #default="{ row }">
                <el-tag :type="WAITLIST_STATUS_MAP[row.status]?.type || 'info'" size="small" round>
                  {{ WAITLIST_STATUS_MAP[row.status]?.label || '-' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="补位通知" width="160" v-if="row => row.status === 'notified'">
              <template #default="{ row }">
                <div v-if="row.notified_at" style="font-size: 12px;">
                  <div style="color: #606266;">通知: {{ formatDateTime(row.notified_at) }}</div>
                  <div style="color: #E6A23C;">截止: {{ formatDateTime(row.expires_at) }}</div>
                </div>
                <span v-else style="color: #c0c4cc;">-</span>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="110" align="center">
              <template #default="{ row }">
                <el-popconfirm
                  title="确定移除该候补记录吗？"
                  confirm-button-text="移除"
                  cancel-button-text="取消"
                  @confirm="handleAdminRemove(row)"
                >
                  <template #reference>
                    <el-button type="danger" link size="small">移除</el-button>
                  </template>
                </el-popconfirm>
              </template>
            </el-table-column>
          </el-table>
          <el-empty v-if="courseWaitlist.length === 0" description="暂无候补学员" :image-size="80" />

          <el-divider v-if="waitlistLogs.length > 0" content-position="left">补位流转记录</el-divider>
          <el-timeline v-if="waitlistLogs.length > 0">
            <el-timeline-item
              v-for="log in waitlistLogs.slice(0, 10)"
              :key="log.id"
              :timestamp="formatDateTime(log.created_at)"
              :type="WAITLIST_ACTION_MAP[log.action]?.type || 'primary'"
              :hollow="log.action === 'expired' || log.action === 'rejected'"
            >
              <div style="font-size: 13px;">
                <el-tag :type="WAITLIST_ACTION_MAP[log.action]?.type || 'primary'" size="small" effect="light">
                  {{ WAITLIST_ACTION_MAP[log.action]?.label || log.action }}
                </el-tag>
                <span style="margin-left: 8px; color: #606266;">
                  学员「{{ log.user_name }}」
                </span>
                <span v-if="log.action_by_name" style="color: #909399; margin-left: 8px;">
                  - {{ log.action_by_name }}
                </span>
              </div>
            </el-timeline-item>
          </el-timeline>
        </el-card>

        <el-card shadow="never" class="card-shadow" style="margin-top: 20px;">
          <template #header>
            <div class="card-header-bar">
              <el-icon :size="18"><ChatDotRound /></el-icon>
              <span>学员反馈</span>
              <el-select v-model="ratingFilter" placeholder="筛选评分" size="small" clearable style="width: 120px;">
                <el-option v-for="n in 5" :key="n" :label="`${n} 星`" :value="n" />
              </el-select>
            </div>
          </template>
          <div class="feedback-list">
            <div v-for="fb in filteredFeedbacks" :key="fb.id" class="feedback-item">
              <div class="feedback-header">
                <el-avatar :size="36">{{ fb.student_name?.charAt(0) || '学' }}</el-avatar>
                <div class="feedback-info">
                  <div class="feedback-name">{{ fb.student_name }}</div>
                  <el-rate :model-value="fb.rating" disabled size="small" />
                </div>
                <span class="feedback-time">{{ formatDateTime(fb.created_at) }}</span>
              </div>
              <div v-if="fb.content" class="feedback-content">
                {{ fb.content }}
              </div>
              <div v-if="fb.answers && Object.keys(fb.answers).length" class="feedback-answers">
                <el-collapse>
                  <el-collapse-item title="查看问卷详情" name="1">
                    <div v-for="(val, key) in fb.answers" :key="key" class="answer-row">
                      <span class="answer-key">Q: {{ key }}</span>
                      <span class="answer-val">A: {{ typeof val === 'object' ? JSON.stringify(val) : val }}</span>
                    </div>
                  </el-collapse-item>
                </el-collapse>
              </div>
            </div>
          </div>
          <el-empty v-if="filteredFeedbacks.length === 0" description="暂无反馈数据" :image-size="80" />
        </el-card>
      </el-col>

      <el-col :span="8">
        <el-card shadow="never" class="card-shadow" v-if="summary">
          <template #header>
            <div class="card-header-bar">
              <el-icon :size="18"><Document /></el-icon>
              <span>结课摘要</span>
              <el-tag type="success" size="small">已结课</el-tag>
            </div>
          </template>
          <div class="summary-content">
            <div class="summary-section">
              <el-icon><Clock /></el-icon>
              <span class="label">实际时长</span>
              <span class="value">{{ summary.actual_duration || '-' }} 分钟</span>
            </div>
            <div class="summary-section">
              <el-icon><User /></el-icon>
              <span class="label">实际人数</span>
              <span class="value">{{ summary.actual_attendance || 0 }} 人</span>
            </div>
            <div class="summary-section">
              <el-icon><Box /></el-icon>
              <span class="label">物料准备</span>
            </div>
            <p class="summary-text">{{ summary.materials || '暂无记录' }}</p>
            <div class="summary-section">
              <el-icon><Warning /></el-icon>
              <span class="label">异常说明</span>
            </div>
            <p class="summary-text">{{ summary.exceptions || '无异常' }}</p>
            <div class="summary-section">
              <el-icon><Edit /></el-icon>
              <span class="label">总结</span>
            </div>
            <p class="summary-text">{{ summary.summary || '暂无总结' }}</p>
            <div class="summary-section" style="font-size: 12px; color: #909399;">
              提交人：{{ summary.submitted_by || '-' }} | {{ formatDateTime(summary.created_at) }}
            </div>
          </div>
        </el-card>

        <el-card shadow="never" class="card-shadow" style="margin-top: 20px;">
          <template #header>
            <div class="card-header-bar">
              <el-icon :size="18"><WarningFilled /></el-icon>
              <span>操作区</span>
            </div>
          </template>

          <div v-if="userStore.isStudent">
            <el-alert
              v-if="!course.user_booking_id && !course.user_waitlist"
              title="您尚未预约此课程"
              type="info"
              :closable="false"
              show-icon
            />
            <template v-else-if="course.user_waitlist?.status === 'waiting'">
              <el-alert title="您已加入候补队列，请耐心等待补位通知" type="info" :closable="false" show-icon />
              <div style="margin-top: 12px; padding: 12px; background: #ecf5ff; border-radius: 8px; font-size: 13px; color: #409EFF;">
                <el-icon><InfoFilled /></el-icon>
                当前候补排名：第 {{ myWaitlist?.position || '-' }} 位
              </div>
            </template>
            <template v-else-if="course.status === 'feedback_pending' || course.status === 'completed'">
              <h4 style="margin-top: 0; color: #606266;">
                <el-icon><Star /></el-icon>
                提交课程反馈
              </h4>
              <el-form :model="feedbackForm" label-position="top">
                <el-form-item label="总体评分">
                  <el-rate v-model="feedbackForm.rating" />
                </el-form-item>
                <el-form-item label="留言内容">
                  <el-input
                    v-model="feedbackForm.content"
                    type="textarea"
                    :rows="4"
                    placeholder="请分享您的学习体验和建议"
                    maxlength="500"
                    show-word-limit
                  />
                </el-form-item>
                <el-button type="primary" :icon="Check" style="width: 100%;" @click="submitFeedback">
                  提交反馈
                </el-button>
              </el-form>
            </template>
            <el-alert v-else title="请在课程结束后提交反馈" type="info" :closable="false" show-icon />
          </div>

          <div v-else-if="userStore.isAssistant || userStore.isAdmin">
            <div class="action-tips">
              <el-timeline>
                <el-timeline-item
                  v-for="(item, i) in actionItems"
                  :key="i"
                  :timestamp="item.time"
                  :type="item.type"
                  :hollow="item.hollow"
                >
                  {{ item.text }}
                </el-timeline-item>
              </el-timeline>
            </div>
            <el-button
              v-if="['pending', 'ongoing'].includes(course.status)"
              type="primary"
              :icon="Tickets"
              style="width: 100%; margin-bottom: 10px;"
              @click="goOnSite"
            >
              进行现场确认
            </el-button>
            <el-button
              v-if="userStore.isAdmin && course.status === 'completed'"
              :icon="Histogram"
              style="width: 100%;"
              @click="$router.push(`/feedback-stats?courseId=${course.id}`)"
            >
              查看反馈统计
            </el-button>
          </div>

          <div v-else>
            <el-empty description="无可用操作" :image-size="60" />
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useCourseStore } from '@/stores/course'
import { useUserStore } from '@/stores/user'
import request from '@/utils/request'
import { STATUS_MAP, ATTENDANCE_STATUS, WAITLIST_STATUS_MAP, WAITLIST_ACTION_MAP, WAITLIST_CONFIRM_TIMEOUT_MINUTES } from '@/constants'
import { formatDateTime } from '@/utils'
import dayjs from 'dayjs'
import {
  ArrowLeft, Check, Close, Edit, Reading, User, Location, Calendar, Clock,
  UserFilled, Tickets, ChatDotRound, Document, Box, Warning, WarningFilled,
  Star, Histogram, Connection, Refresh, InfoFilled
} from '@element-plus/icons-vue'

const route = useRoute()
const router = useRouter()
const courseStore = useCourseStore()
const userStore = useUserStore()

const ratingFilter = ref(null)
const countdownSeconds = ref(0)
let countdownTimer = null

const feedbackForm = reactive({
  rating: 5,
  content: ''
})

const course = ref({
  id: Number(route.params.id),
  title: '',
  instructor: '',
  location: '',
  start_time: '',
  end_time: '',
  capacity: 0,
  booked_count: 0,
  status: 'bookable',
  avg_rating: null,
  feedback_count: 0,
  waitlist_count: 0,
  waitlist_waiting: 0,
  waitlist_in_fill: 0,
  waitlist_confirmed: 0,
  user_booking_id: null,
  user_waitlist: null
})

const bookings = ref([])
const feedbacks = ref([])
const summary = ref(null)
const myWaitlist = ref(null)
const courseWaitlist = ref([])
const waitlistStats = ref(null)
const waitlistLogs = ref([])

const capacityPercent = computed(() =>
  Math.min(100, Math.round(((course.value.booked_count || 0) / (course.value.capacity || 1)) * 100))
)

const capacityColor = computed(() => {
  if (capacityPercent.value >= 90) return '#F56C6C'
  if (capacityPercent.value >= 70) return '#E6A23C'
  return '#67C23A'
})

const canBook = computed(() =>
  course.value.status === 'bookable' &&
  !course.value.user_booking_id &&
  !course.value.user_waitlist &&
  (course.value.booked_count || 0) < (course.value.capacity || 0)
)

const canJoinWaitlist = computed(() => {
  if (!userStore.isStudent) return false
  if (course.value.user_booking_id) return false
  if (course.value.user_waitlist) return false
  if (!['bookable', 'full', 'pending'].includes(course.value.status)) return false
  return (course.value.booked_count || 0) >= (course.value.capacity || 0)
})

const countdownPercent = computed(() => {
  const total = WAITLIST_CONFIRM_TIMEOUT_MINUTES * 60
  return Math.max(0, Math.round(countdownSeconds.value / total * 100))
})

const filteredFeedbacks = computed(() => {
  if (!ratingFilter.value) return feedbacks.value
  return feedbacks.value.filter(f => f.rating === ratingFilter.value)
})

const actionItems = computed(() => {
  const items = []
  items.push({ text: '课程创建', time: dayjs(course.value.start_time).subtract(7, 'day').format('MM-DD HH:mm'), type: 'primary', hollow: false })
  if ((course.value.booked_count || 0) > 0) {
    items.push({ text: `已有 ${course.value.booked_count} 位学员预约`, time: dayjs().format('MM-DD HH:mm'), type: 'success', hollow: false })
  }
  if ((course.value.waitlist_count || 0) > 0) {
    items.push({ text: `候补队列 ${course.value.waitlist_count} 人`, time: dayjs().format('MM-DD HH:mm'), type: 'warning', hollow: false })
  }
  if (['pending', 'ongoing'].includes(course.value.status)) {
    items.push({ text: '等待现场确认', time: '待执行', type: 'warning', hollow: true })
  }
  if (course.value.status === 'completed' || summary.value) {
    items.push({ text: '已结课并生成摘要', time: summary.value?.created_at ? dayjs(summary.value.created_at).format('MM-DD HH:mm') : '-', type: 'success', hollow: false })
  }
  if ((course.value.feedback_count || 0) > 0) {
    items.push({ text: `已收到 ${course.value.feedback_count} 条反馈`, time: dayjs().format('MM-DD HH:mm'), type: 'info', hollow: false })
  }
  return items
})

function formatCountdown(seconds) {
  if (seconds <= 0) return '0分0秒'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}分${s.toString().padStart(2, '0')}秒`
}

function startCountdown(expiresAt) {
  stopCountdown()
  if (!expiresAt) return
  const update = () => {
    const now = dayjs()
    const exp = dayjs(expiresAt)
    const diff = exp.diff(now, 'second')
    countdownSeconds.value = Math.max(0, diff)
    if (diff <= 0) {
      stopCountdown()
      loadMyWaitlistStatus()
    }
  }
  update()
  countdownTimer = setInterval(update, 1000)
}

function stopCountdown() {
  if (countdownTimer) {
    clearInterval(countdownTimer)
    countdownTimer = null
  }
}

async function handleBook() {
  try {
    await courseStore.bookCourse(course.value.id)
    ElMessage.success('预约成功')
    await refreshData()
  } catch (e) {}
}

async function handleCancelBook() {
  ElMessageBox.confirm('确定要取消预约吗？取消后名额可能被候补学员占用。', '提示', { type: 'warning' }).then(async () => {
    try {
      await courseStore.cancelBooking(course.value.user_booking_id)
      ElMessage.success('已取消预约')
      await refreshData()
    } catch (e) {}
  }).catch(() => {})
}

async function handleJoinWaitlist() {
  ElMessageBox.confirm(
    '确定要加入候补队列吗？当有名额释放时，将按候补顺序通知您补位，需在30分钟内确认。',
    '加入候补确认',
    { type: 'info', confirmButtonText: '加入候补', cancelButtonText: '取消' }
  ).then(async () => {
    try {
      await courseStore.joinWaitlist(course.value.id)
      ElMessage.success('已加入候补队列')
      await refreshData()
    } catch (e) {}
  }).catch(() => {})
}

async function handleLeaveWaitlist() {
  if (!myWaitlist.value?.id) return
  ElMessageBox.confirm('确定要退出候补队列吗？退出后如需再次候补需重新排队。', '提示', { type: 'warning' }).then(async () => {
    try {
      await courseStore.leaveWaitlist(myWaitlist.value.id)
      ElMessage.success('已退出候补队列')
      await refreshData()
    } catch (e) {}
  }).catch(() => {})
}

async function handleConfirmWaitlist() {
  if (!myWaitlist.value?.id) return
  try {
    const result = await courseStore.confirmWaitlist(myWaitlist.value.id)
    ElMessage.success('补位成功！已转为正式预约')
    stopCountdown()
    await refreshData()
  } catch (e) {
    if (e?.response?.data?.message) {
      ElMessage.error(e.response.data.message)
      await refreshData()
    }
  }
}

async function handleRejectWaitlist() {
  if (!myWaitlist.value?.id) return
  ElMessageBox.confirm(
    '确定要拒绝本次补位机会吗？拒绝后名额将顺延给下一位候补学员，您将保留在原候补位置。',
    '拒绝补位确认',
    { type: 'warning', confirmButtonText: '拒绝补位', cancelButtonText: '再想想' }
  ).then(async () => {
    try {
      const result = await courseStore.rejectWaitlist(myWaitlist.value.id)
      ElMessage.success(result?.message || '已拒绝本次补位，已保留候补位置')
      stopCountdown()
      await refreshData()
    } catch (e) {}
  }).catch(() => {})
}

async function handleAdminRemove(row) {
  try {
    await courseStore.adminRemoveWaitlist(row.id, '管理员移除')
    ElMessage.success('已移除候补记录')
    await loadWaitlistData()
  } catch (e) {}
}

async function submitFeedback() {
  if (!feedbackForm.rating) {
    ElMessage.warning('请选择评分')
    return
  }
  try {
    await request.post(`/feedbacks`, {
      course_id: course.value.id,
      rating: feedbackForm.rating,
      content: feedbackForm.content,
      answers: {}
    })
    ElMessage.success('反馈提交成功')
    feedbacks.value.unshift({
      id: Date.now(),
      student_name: userStore.userInfo?.name || '我',
      rating: feedbackForm.rating,
      content: feedbackForm.content,
      created_at: dayjs().format('YYYY-MM-DD HH:mm:ss'),
      answers: {}
    })
    feedbackForm.rating = 5
    feedbackForm.content = ''
  } catch (e) {}
}

function goOnSite() {
  router.push(`/on-site?courseId=${course.value.id}`)
}

async function loadBookings() {
  try {
    const data = await request.get('/bookings', { params: { course_id: course.value.id } })
    const bs = data.bookings || []
    bookings.value = bs.map(b => ({
      id: b.id,
      student_name: b.user?.name || '-',
      booking_time: b.booked_at,
      attendance_status: b.status === 'booked' ? 'pending' : (b.status === 'attended' ? 'present' : (b.status === 'no_show' ? 'absent' : 'pending')),
      phone: b.user?.phone || '-'
    }))
  } catch (e) {}
}

async function loadFeedbacks() {
  try {
    const data = await request.get('/feedbacks', { params: { course_id: course.value.id } })
    const fs = data.feedbacks || []
    feedbacks.value = fs.map(f => ({
      id: f.id,
      student_name: f.user?.name || f.user_name || '学员',
      rating: f.rating,
      content: typeof f.content === 'string' ? f.content : f.content?.comment || '',
      created_at: f.created_at,
      answers: typeof f.content === 'object' ? f.content : {}
    }))
  } catch (e) {}
}

async function loadMyWaitlistStatus() {
  if (!userStore.isStudent) return
  try {
    const data = await courseStore.fetchMyWaitlistStatus(course.value.id)
    myWaitlist.value = data.waitlist
    if (myWaitlist.value && myWaitlist.value.status === 'notified') {
      startCountdown(myWaitlist.value.expires_at)
    } else {
      stopCountdown()
    }
  } catch (e) {
    myWaitlist.value = null
    stopCountdown()
  }
}

async function loadWaitlistData() {
  if (!userStore.isAssistant && !userStore.isAdmin) return
  try {
    await courseStore.fetchCourseWaitlist(course.value.id)
    courseWaitlist.value = courseStore.courseWaitlist || []
    waitlistStats.value = courseStore.waitlistStats
    await courseStore.fetchWaitlistLogs(course.value.id)
    waitlistLogs.value = courseStore.waitlistLogs || []
  } catch (e) {}
}

async function refreshData() {
  const courseId = route.params.id
  try {
    const data = await courseStore.fetchCourseDetail(courseId)
    if (data?.course) course.value = { ...course.value, ...data.course }
  } catch (e) {}
  await Promise.all([
    loadBookings(),
    loadFeedbacks(),
    loadMyWaitlistStatus(),
    loadWaitlistData()
  ])
}

watch(() => course.value.user_waitlist?.status, (newVal, oldVal) => {
  if (newVal === 'notified' && myWaitlist.value?.status === 'notified') {
    startCountdown(myWaitlist.value.expires_at)
  }
})

onMounted(async () => {
  await refreshData()
})

onBeforeUnmount(() => {
  stopCountdown()
})
</script>

<style scoped>
.course-detail {
  padding: 0;
}

.card-shadow {
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.06);
  border-radius: 12px;
  border: none;
}

.card-header-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  color: #303133;
}

.card-header-bar > :nth-child(2) {
  flex: 1;
}

.course-title {
  font-size: 24px;
  font-weight: 700;
  color: #303133;
  margin: 0 0 20px;
}

.my-waitlist-box {
  background: #f0f9eb;
  padding: 14px;
  border-radius: 10px;
  border: 1px solid #e1f3d8;
}

.feedback-list {
  max-height: 600px;
  overflow-y: auto;
}

.feedback-item {
  padding: 16px;
  border-radius: 10px;
  background: #fafbfc;
  margin-bottom: 12px;
  border: 1px solid #f2f6fc;
}

.feedback-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;
}

.feedback-info {
  flex: 1;
}

.feedback-name {
  font-weight: 600;
  color: #303133;
  margin-bottom: 4px;
}

.feedback-time {
  font-size: 12px;
  color: #909399;
}

.feedback-content {
  color: #606266;
  line-height: 1.6;
  padding: 8px 12px;
  background: #fff;
  border-radius: 8px;
  border-left: 3px solid #409EFF;
}

.feedback-answers {
  margin-top: 10px;
}

.answer-row {
  padding: 6px 12px;
  font-size: 13px;
}

.answer-key {
  display: block;
  color: #909399;
  margin-bottom: 2px;
}

.answer-val {
  display: block;
  color: #606266;
}

.summary-content {
  color: #606266;
  line-height: 1.7;
}

.summary-section {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 10px 0 4px;
  color: #303133;
  font-weight: 500;
}

.summary-section .label {
  flex: 0 0 auto;
}

.summary-section .value {
  color: #409EFF;
  font-weight: 600;
  margin-left: auto;
}

.summary-text {
  padding: 10px 14px;
  background: #f5f7fa;
  border-radius: 8px;
  margin: 0 0 6px;
  font-size: 13px;
  color: #606266;
  white-space: pre-wrap;
}

.action-tips {
  margin-bottom: 16px;
}
</style>
