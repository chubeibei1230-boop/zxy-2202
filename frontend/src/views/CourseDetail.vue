<template>
  <div class="course-detail">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
      <div>
        <el-button :icon="ArrowLeft" link @click="$router.back()">返回列表</el-button>
      </div>
      <div>
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
              {{ course.location || '-' }}
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
              <el-icon><WarningFilled /></el-icon>
              <span>操作区</span>
            </div>
          </template>

          <div v-if="userStore.isStudent">
            <el-alert
              v-if="!course.user_booking_id"
              title="您尚未预约此课程"
              type="info"
              :closable="false"
              show-icon
            />
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
import { ref, reactive, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useCourseStore } from '@/stores/course'
import { useUserStore } from '@/stores/user'
import request from '@/utils/request'
import { STATUS_MAP, ATTENDANCE_STATUS } from '@/constants'
import { formatDateTime } from '@/utils'
import dayjs from 'dayjs'
import {
  ArrowLeft, Check, Close, Edit, Reading, User, Location, Calendar, Clock,
  UserFilled, Tickets, ChatDotRound, Document, Box, Warning, WarningFilled,
  Star, Histogram
} from '@element-plus/icons-vue'

const route = useRoute()
const router = useRouter()
const courseStore = useCourseStore()
const userStore = useUserStore()

const ratingFilter = ref(null)

const feedbackForm = reactive({
  rating: 5,
  content: ''
})

const course = ref({
  id: Number(route.params.id),
  title: '瑜伽入门班（第3期）',
  instructor: '李老师',
  location: 'A区活动室',
  start_time: '2026-06-25 09:00:00',
  end_time: '2026-06-25 10:30:00',
  capacity: 20,
  booked_count: 15,
  status: 'bookable',
  avg_rating: 4.5,
  feedback_count: 12,
  user_booking_id: null,
  feedback_template: { questions: ['内容是否清晰易懂？', '是否推荐给朋友？'] }
})

const bookings = ref([
  { id: 1, student_name: '张小明', booking_time: '2026-06-20 10:15:00', attendance_status: 'present', phone: '138****1234' },
  { id: 2, student_name: '李小红', booking_time: '2026-06-20 11:02:00', attendance_status: 'present', phone: '139****5678' },
  { id: 3, student_name: '王小华', booking_time: '2026-06-21 09:30:00', attendance_status: 'absent', phone: '137****9012' },
  { id: 4, student_name: '赵小强', booking_time: '2026-06-21 14:45:00', attendance_status: 'pending', phone: '136****3456' },
  { id: 5, student_name: '孙小美', booking_time: '2026-06-22 08:20:00', attendance_status: 'present', phone: '135****7890' }
])

const feedbacks = ref([
  { id: 1, student_name: '张同学', rating: 5, content: '老师讲解非常细致，动作纠正到位，受益匪浅！', created_at: '2026-06-21 12:00:00', answers: { '内容是否清晰易懂？': '非常清晰', '是否推荐给朋友？': '强烈推荐' } },
  { id: 2, student_name: '李同学', rating: 4, content: '整体不错，希望增加一些进阶动作的讲解。', created_at: '2026-06-21 14:30:00', answers: { '内容是否清晰易懂？': '比较清晰', '是否推荐给朋友？': '会推荐' } },
  { id: 3, student_name: '王同学', rating: 5, content: '教室环境很好，老师很有耐心。', created_at: '2026-06-22 09:15:00', answers: {} }
])

const summary = ref({
  actual_duration: 90,
  actual_attendance: 14,
  materials: '瑜伽垫20张、瑜伽砖10块、音响系统一套、饮用水两箱',
  exceptions: '学员王小华因家中有事提前请假离场',
  summary: '本次课程整体进展顺利，学员反馈积极。基础动作掌握较好，下节课计划增加平衡性训练。',
  submitted_by: '助教 小李',
  created_at: '2026-06-25 11:00:00'
})

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
  (course.value.booked_count || 0) < (course.value.capacity || 0)
)

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

async function handleBook() {
  try {
    await courseStore.bookCourse(course.value.id)
    ElMessage.success('预约成功')
    course.value.user_booking_id = Date.now()
    course.value.booked_count += 1
  } catch (e) {}
}

async function handleCancelBook() {
  ElMessageBox.confirm('确定要取消预约吗？', '提示', { type: 'warning' }).then(async () => {
    try {
      await courseStore.cancelBooking(course.value.user_booking_id)
      ElMessage.success('已取消预约')
      course.value.user_booking_id = null
      course.value.booked_count = Math.max(0, course.value.booked_count - 1)
    } catch (e) {}
  }).catch(() => {})
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
      student_name: userStore.userInfo?.username || '我',
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

onMounted(async () => {
  try {
    const data = await courseStore.fetchCourseDetail(route.params.id)
    if (data) course.value = { ...course.value, ...data }
  } catch (e) {}
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
