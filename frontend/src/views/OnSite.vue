<template>
  <div class="on-site-page">
    <div class="page-header card-shadow" style="padding: 20px; background: #fff; border-radius: 12px; margin-bottom: 20px;">
      <div class="page-title" style="margin-bottom: 16px;">
        <el-icon :size="22"><Check /></el-icon>
        现场确认
      </div>

      <el-form :inline="true" :model="selector">
        <el-form-item label="选择课程">
          <el-select
            v-model="selector.courseId"
            placeholder="请选择进行中/待开课课程"
            filterable
            style="width: 420px;"
            @change="handleSelectCourse"
          >
            <el-option
              v-for="c in availableCourses"
              :key="c.id"
              :label="`${c.title} · ${STATUS_MAP[c.status].label} · ${formatDate(c.start_time)}`"
              :value="c.id"
            >
              <span>{{ c.title }}</span>
              <el-tag :type="STATUS_MAP[c.status].type" size="small" style="margin-left: 8px;">
                {{ STATUS_MAP[c.status].label }}
              </el-tag>
              <span style="float: right; color: #909399; font-size: 12px;">
                {{ formatDateTime(c.start_time) }}
              </span>
            </el-option>
          </el-select>
        </el-form-item>
      </el-form>
    </div>

    <div v-if="!selectedCourse" class="card-shadow" style="padding: 60px; background: #fff; border-radius: 12px; text-align: center;">
      <el-empty description="请先在上方选择要进行现场确认的课程" :image-size="120">
        <template #image>
          <el-icon :size="80" color="#c0c4cc"><Tickets /></el-icon>
        </template>
      </el-empty>
    </div>

    <template v-else>
      <el-row :gutter="20">
        <el-col :span="16">
          <el-card shadow="never" class="card-shadow" style="margin-bottom: 20px;">
            <template #header>
              <div class="card-header-bar">
                <el-icon><UserFilled /></el-icon>
                <span>到场确认（共 {{ attendanceList.length }} 位学员）</span>
                <div style="display: flex; gap: 8px;">
                  <el-button size="small" :icon="Check" type="success" @click="markAll('present')">全部到场</el-button>
                  <el-button size="small" :icon="Close" type="danger" @click="markAll('absent')">全部缺席</el-button>
                  <el-button size="small" :icon="RefreshLeft" @click="resetAll">重置</el-button>
                </div>
              </div>
            </template>

            <div class="attendance-stats">
              <div class="stat present">
                <el-icon :size="22"><CircleCheck /></el-icon>
                <div>
                  <div class="num">{{ presentCount }}</div>
                  <div class="lbl">已到场</div>
                </div>
              </div>
              <div class="stat absent">
                <el-icon :size="22"><CircleClose /></el-icon>
                <div>
                  <div class="num">{{ absentCount }}</div>
                  <div class="lbl">缺席</div>
                </div>
              </div>
              <div class="stat pending">
                <el-icon :size="22"><QuestionFilled /></el-icon>
                <div>
                  <div class="num">{{ pendingCount }}</div>
                  <div class="lbl">待确认</div>
                </div>
              </div>
              <div class="stat rate">
                <el-icon :size="22"><DataLine /></el-icon>
                <div>
                  <div class="num">{{ attendanceRate }}%</div>
                  <div class="lbl">预计到场率</div>
                </div>
              </div>
            </div>

            <el-table :data="attendanceList" stripe style="margin-top: 16px;">
              <el-table-column label="序号" width="60" type="index" />
              <el-table-column label="学员" min-width="180">
                <template #default="{ row }">
                  <div style="display: flex; align-items: center; gap: 10px;">
                    <el-avatar :size="32">{{ row.student_name?.charAt(0) }}</el-avatar>
                    <div>
                      <div style="font-weight: 500;">{{ row.student_name }}</div>
                      <div style="font-size: 12px; color: #909399;">{{ row.phone }}</div>
                    </div>
                  </div>
                </template>
              </el-table-column>
              <el-table-column label="预约时间" width="160">
                <template #default="{ row }">
                  {{ formatDateTime(row.booking_time) }}
                </template>
              </el-table-column>
              <el-table-column label="到场状态" width="140">
                <template #default="{ row }">
                  <el-radio-group v-model="row.attendance_status" size="default">
                    <el-radio-button value="present">到场</el-radio-button>
                    <el-radio-button value="absent">缺席</el-radio-button>
                  </el-radio-group>
                </template>
              </el-table-column>
              <el-table-column label="签到方式" width="120">
                <template #default="{ row }">
                  <el-tag v-if="row.attendance_status === 'present'" type="success" size="small">
                    {{ row.check_in_method || '现场确认' }}
                  </el-tag>
                  <span v-else style="color: #c0c4cc;">-</span>
                </template>
              </el-table-column>
              <el-table-column label="备注">
                <template #default="{ row }">
                  <el-input
                    v-model="row.remark"
                    placeholder="添加备注（请假、迟到等）"
                    size="small"
                    clearable
                  />
                </template>
              </el-table-column>
            </el-table>
          </el-card>
        </el-col>

        <el-col :span="8">
          <el-card shadow="never" class="card-shadow" style="margin-bottom: 20px;">
            <template #header>
              <div class="card-header-bar">
                <el-icon><Reading /></el-icon>
                <span>课程信息</span>
              </div>
            </template>
            <div class="course-info">
              <h3 style="margin: 0 0 12px;">{{ selectedCourse.title }}</h3>
              <div class="info-row">
                <el-icon><User /></el-icon>
                <span class="k">讲师</span>
                <span class="v">{{ selectedCourse.instructor }}</span>
              </div>
              <div class="info-row">
                <el-icon><Location /></el-icon>
                <span class="k">教室</span>
                <span class="v">{{ selectedCourse.location || selectedCourse.classroom_area || '-' }}</span>
              </div>
              <div class="info-row">
                <el-icon><Calendar /></el-icon>
                <span class="k">时间</span>
                <span class="v">{{ formatDuration(selectedCourse.start_time, selectedCourse.end_time) }}</span>
              </div>
              <div class="info-row">
                <el-icon><Tickets /></el-icon>
                <span class="k">预约/容量</span>
                <span class="v">{{ selectedCourse.booked_count }} / {{ selectedCourse.capacity }}</span>
              </div>
              <el-divider style="margin: 14px 0;" />
              <div class="info-row">
                <el-tag :type="STATUS_MAP[selectedCourse.status].type" effect="dark" round>
                  {{ STATUS_MAP[selectedCourse.status].label }}
                </el-tag>
              </div>
            </div>
          </el-card>

          <el-card shadow="never" class="card-shadow" style="margin-bottom: 20px;">
            <template #header>
              <div class="card-header-bar">
                <el-icon><Box /></el-icon>
                <span>物料准备 & 异常说明</span>
              </div>
            </template>
            <el-form :model="summaryForm" label-position="top">
              <el-form-item label="物料准备清单">
                <el-input
                  v-model="summaryForm.materials"
                  type="textarea"
                  :rows="4"
                  placeholder="请列出本次课程使用的所有物料，例如：瑜伽垫20张、音响设备一套..."
                  maxlength="1000"
                  show-word-limit
                />
              </el-form-item>
              <el-form-item label="异常情况说明">
                <el-input
                  v-model="summaryForm.exceptions"
                  type="textarea"
                  :rows="3"
                  placeholder="学员缺席、设备故障、临时调整等情况说明..."
                  maxlength="1000"
                  show-word-limit
                />
              </el-form-item>
              <el-form-item label="实际时长（分钟）">
                <el-input-number
                  v-model="summaryForm.actual_duration"
                  :min="0"
                  :max="600"
                  style="width: 100%;"
                />
              </el-form-item>
              <el-form-item label="实际参与人数">
                <el-input-number
                  v-model="summaryForm.actual_attendance"
                  :min="0"
                  :max="999"
                  style="width: 100%;"
                />
              </el-form-item>
            </el-form>
          </el-card>

          <el-card shadow="never" class="card-shadow" style="margin-bottom: 20px;">
            <template #header>
              <div class="card-header-bar">
                <el-icon><Edit /></el-icon>
                <span>结课摘要</span>
                <el-tag type="warning" size="small">选填</el-tag>
              </div>
            </template>
            <el-input
              v-model="summaryForm.summary"
              type="textarea"
              :rows="5"
              placeholder="请记录本次课程的整体情况、学习效果、学员表现、改进建议等..."
              maxlength="2000"
              show-word-limit
            />
          </el-card>

          <div class="action-buttons">
            <el-button size="large" :icon="Folder" style="flex: 1;" @click="handleSave">
              保存草稿
            </el-button>
            <el-button
              size="large"
              type="primary"
              :icon="Check"
              style="flex: 1;"
              @click="handleSubmit"
              :loading="submitting"
            >
              提交结课摘要
            </el-button>
          </div>
        </el-col>
      </el-row>
    </template>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useCourseStore } from '@/stores/course'
import request from '@/utils/request'
import { STATUS_MAP } from '@/constants'
import { formatDateTime, formatDuration, formatDate } from '@/utils'
import dayjs from 'dayjs'
import {
  Check, Close, Tickets, UserFilled, RefreshLeft, CircleCheck, CircleClose,
  QuestionFilled, DataLine, Reading, User, Location, Calendar, Box, Edit, Folder
} from '@element-plus/icons-vue'

const route = useRoute()
const courseStore = useCourseStore()

const submitting = ref(false)

const selector = reactive({
  courseId: Number(route.query.courseId) || null
})

const availableCourses = ref([
  { id: 1, title: '瑜伽入门班（第3期）', instructor: '李老师', status: 'ongoing', start_time: '2026-06-25 09:00:00', end_time: '2026-06-25 10:30:00', location: 'A区活动室', capacity: 20, booked_count: 15 },
  { id: 4, title: '书法基础班（第2期）', instructor: '赵老师', status: 'ongoing', start_time: '2026-06-20 10:00:00', end_time: '2026-06-20 11:30:00', location: 'A区活动室', capacity: 18, booked_count: 18 },
  { id: 3, title: '少儿绘画启蒙班', instructor: '张老师', status: 'pending', start_time: '2026-06-26 15:30:00', end_time: '2026-06-26 17:00:00', location: 'C区画室', capacity: 25, booked_count: 8 }
])

const selectedCourse = computed(() =>
  availableCourses.value.find(c => c.id === selector.courseId) || null
)

const attendanceList = ref([])

const summaryForm = reactive({
  materials: '',
  exceptions: '',
  actual_duration: 90,
  actual_attendance: 0,
  summary: ''
})

const presentCount = computed(() => attendanceList.value.filter(x => x.attendance_status === 'present').length)
const absentCount = computed(() => attendanceList.value.filter(x => x.attendance_status === 'absent').length)
const pendingCount = computed(() => attendanceList.value.filter(x => !x.attendance_status || x.attendance_status === 'pending').length)
const attendanceRate = computed(() => {
  const total = attendanceList.value.length
  if (total === 0) return 0
  return Math.round(presentCount.value / total * 100)
})

watch(presentCount, v => { summaryForm.actual_attendance = v })

async function handleSelectCourse(id) {
  if (!id) {
    attendanceList.value = []
    return
  }
  try {
    const data = await request.get('/bookings', { params: { course_id: id } })
    const bookings = (data.bookings || []).filter(b => b.status !== 'cancelled')
    attendanceList.value = bookings.map(b => {
      let status = 'pending'
      if (b.status === 'attended') status = 'present'
      else if (b.status === 'no_show') status = 'absent'
      return {
        id: b.id,
        booking_id: b.id,
        student_name: b.user?.name || b.user?.username || '学员',
        phone: b.user?.phone || '',
        booking_time: b.booked_at,
        attendance_status: status,
        check_in_method: status === 'present' ? '系统记录' : '',
        remark: ''
      }
    })
  } catch (e) {
    attendanceList.value = []
  }
  nextTick(() => {
    summaryForm.actual_attendance = presentCount.value
  })
}

function markAll(status) {
  attendanceList.value.forEach(x => {
    x.attendance_status = status
    x.check_in_method = status === 'present' ? '批量标记' : ''
  })
}

function resetAll() {
  attendanceList.value.forEach(x => {
    x.attendance_status = 'pending'
    x.check_in_method = ''
  })
}

async function handleSave() {
  await request.post(`/bookings/batch-attendance`, {
    course_id: selector.courseId,
    attendances: attendanceList.value.map(x => ({
      booking_id: x.id,
      status: x.attendance_status,
      remark: x.remark
    }))
  })
  ElMessage.success('到场信息已保存')
}

async function handleSubmit() {
  if (pendingCount.value > 0) {
    try {
      await ElMessageBox.confirm(
        `还有 ${pendingCount.value} 位学员未确认到场状态，是否仍然提交结课摘要？未确认将按缺席处理。`,
        '确认提交',
        { type: 'warning', confirmButtonText: '继续提交', cancelButtonText: '返回确认' }
      )
    } catch {
      return
    }
  }

  submitting.value = true
  try {
    const payload = {
      course_id: selector.courseId,
      actual_duration: summaryForm.actual_duration,
      actual_attendance: summaryForm.actual_attendance,
      materials: summaryForm.materials,
      exceptions: summaryForm.exceptions,
      summary: summaryForm.summary,
      attendances: attendanceList.value.map(x => ({
        booking_id: x.id,
        status: x.attendance_status || 'absent',
        remark: x.remark
      }))
    }
    await request.post(`/course-summaries`, payload)
    ElMessage.success('结课摘要提交成功！')
  } finally {
    submitting.value = false
  }
}

onMounted(async () => {
  await courseStore.fetchCourses({ status: ['pending', 'ongoing'] })
  if (courseStore.courses?.length) {
    const courseIds = new Set(availableCourses.value.map(c => c.id))
    const newCourses = courseStore.courses.filter(c => !courseIds.has(c.id)).map(c => ({
      ...c,
      location: c.location || c.classroom_area
    }))
    availableCourses.value = [...availableCourses.value, ...newCourses]
  }
  if (selector.courseId) {
    await handleSelectCourse(selector.courseId)
  }
})
</script>

<style scoped>
.on-site-page {
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

.attendance-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
}

.stat {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  border-radius: 10px;
  background: #fafbfc;
  border: 1px solid #f2f6fc;
}

.stat.present { color: #67C23A; background: #f0f9eb; border-color: #e1f3d8; }
.stat.absent { color: #F56C6C; background: #fef0f0; border-color: #fde2e2; }
.stat.pending { color: #E6A23C; background: #fdf6ec; border-color: #faecd8; }
.stat.rate { color: #409EFF; background: #ecf5ff; border-color: #d9ecff; }

.stat .num {
  font-size: 22px;
  font-weight: 700;
  line-height: 1.2;
}

.stat .lbl {
  font-size: 12px;
  opacity: 0.9;
}

.course-info {
  color: #606266;
  line-height: 2;
}

.course-info h3 {
  color: #303133;
}

.info-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}

.info-row .k {
  color: #909399;
  width: 70px;
}

.info-row .v {
  color: #303133;
  font-weight: 500;
  flex: 1;
}

.action-buttons {
  display: flex;
  gap: 12px;
  padding: 20px;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.06);
  position: sticky;
  bottom: 0;
}
</style>
