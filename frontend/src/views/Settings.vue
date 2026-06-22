<template>
  <div class="settings-page">
    <el-tabs v-model="activeTab" class="main-tabs">
      <el-tab-pane label="课程管理" name="courses">
        <div class="card-shadow" style="padding: 20px; background: #fff; border-radius: 12px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <div class="page-title" style="margin-bottom: 0;">
              <el-icon :size="22"><Setting /></el-icon>
              课程管理
            </div>
            <el-button type="primary" :icon="Plus" size="default" @click="openCreateDialog">
              新建课程
            </el-button>
          </div>

          <el-table :data="courseList" stripe v-loading="loading" style="width: 100%;">
            <el-table-column prop="id" label="ID" width="60" />
            <el-table-column prop="title" label="课程主题" min-width="200">
              <template #default="{ row }">
                <el-link type="primary" @click="$router.push(`/courses/${row.id}`)">
                  {{ row.title }}
                </el-link>
              </template>
            </el-table-column>
            <el-table-column prop="instructor" label="讲师" width="120" />
            <el-table-column label="时间" width="220">
              <template #default="{ row }">
                <div style="font-size: 13px; line-height: 1.5;">
                  <div>{{ formatDate(row.start_time) }}</div>
                  <div style="color: #909399;">{{ formatTimeRange(row.start_time, row.end_time) }}</div>
                </div>
              </template>
            </el-table-column>
            <el-table-column prop="location" label="教室区域" width="130" />
            <el-table-column label="容量" width="100">
              <template #default="{ row }">{{ row.booked_count || 0 }}/{{ row.capacity }}</template>
            </el-table-column>
            <el-table-column label="反馈模板" width="100" align="center">
              <template #default="{ row }">
                <el-tag v-if="row.feedback_template && Object.keys(row.feedback_template).length" type="info" size="small">
                  已配置
                </el-tag>
                <span v-else style="color: #c0c4cc;">默认</span>
              </template>
            </el-table-column>
            <el-table-column label="状态" width="110">
              <template #default="{ row }">
                <el-tag :type="STATUS_MAP[row.status]?.type || 'info'" effect="light" round>
                  {{ STATUS_MAP[row.status]?.label || row.status }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="200" fixed="right" align="center">
              <template #default="{ row }">
                <el-button type="primary" link size="small" @click="$router.push(`/courses/${row.id}`)">
                  <el-icon><View /></el-icon>详情
                </el-button>
                <el-button type="warning" link size="small" @click="openEditDialog(row)">
                  <el-icon><Edit /></el-icon>编辑
                </el-button>
                <el-button type="danger" link size="small" @click="handleDelete(row)">
                  <el-icon><Delete /></el-icon>删除
                </el-button>
              </template>
            </el-table-column>
          </el-table>

          <el-pagination
            v-model:current-page="page"
            v-model:page-size="pageSize"
            :page-sizes="[10, 20, 50, 100]"
            :total="total"
            layout="total, sizes, prev, pager, next, jumper"
            style="margin-top: 20px; justify-content: flex-end; display: flex;"
          />
        </div>
      </el-tab-pane>

      <el-tab-pane label="系统设置" name="system">
        <div class="card-shadow" style="padding: 20px; background: #fff; border-radius: 12px;">
          <div class="page-title" style="margin-bottom: 20px;">
            <el-icon :size="22"><Tools /></el-icon>
            系统设置
          </div>
          <el-descriptions title="基础配置" :column="1" border size="default">
            <el-descriptions-item label="系统名称">社区中心管理系统</el-descriptions-item>
            <el-descriptions-item label="版本">v1.0.0</el-descriptions-item>
            <el-descriptions-item label="API 基础地址">http://localhost:8161/api</el-descriptions-item>
            <el-descriptions-item label="前端端口">8931</el-descriptions-item>
          </el-descriptions>
          <el-alert
            style="margin-top: 20px;"
            type="info"
            :closable="false"
            show-icon
            title="系统说明"
            description="更多系统设置功能开发中，敬请期待。"
          />
        </div>
      </el-tab-pane>
    </el-tabs>

    <el-dialog
      v-model="dialogVisible"
      :title="isEdit ? '编辑课程' : '新建课程'"
      width="820px"
      :close-on-click-modal="false"
    >
      <el-form
        ref="courseFormRef"
        :model="courseForm"
        :rules="formRules"
        label-width="110px"
        class="course-form"
      >
        <el-row :gutter="20">
          <el-col :span="16">
            <el-form-item label="课程主题" prop="title">
              <el-input v-model="courseForm.title" placeholder="请输入课程主题/名称" maxlength="100" show-word-limit />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="授课讲师" prop="instructor">
              <el-input v-model="courseForm.instructor" placeholder="输入讲师姓名" maxlength="50" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="20">
          <el-col :span="24">
            <el-form-item label="课程时间" prop="timeRange">
              <el-date-picker
                v-model="courseForm.timeRange"
                type="datetimerange"
                range-separator="至"
                start-placeholder="开始时间"
                end-placeholder="结束时间"
                value-format="YYYY-MM-DD HH:mm:ss"
                style="width: 100%;"
              />
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="20">
          <el-col :span="8">
            <el-form-item label="教室区域" prop="location">
              <el-select v-model="courseForm.location" placeholder="选择或输入" allow-create filterable style="width: 100%;">
                <el-option v-for="loc in locationOptions" :key="loc" :label="loc" :value="loc" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="课程容量" prop="capacity">
              <el-input-number v-model="courseForm.capacity" :min="1" :max="200" style="width: 100%;" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="课程状态" prop="status">
              <el-select v-model="courseForm.status" placeholder="选择状态" style="width: 100%;">
                <el-option
                  v-for="item in STATUS_OPTIONS"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                >
                  <el-tag :type="item.type" size="small" effect="light">
                    {{ item.label }}
                  </el-tag>
                </el-option>
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="课程描述">
          <el-input
            v-model="courseForm.description"
            type="textarea"
            :rows="3"
            placeholder="简要描述课程内容、适合人群等（选填）"
            maxlength="500"
            show-word-limit
          />
        </el-form-item>

        <el-divider content-position="left">
          <el-icon><EditPen /></el-icon>
          反馈模板配置
        </el-divider>

        <el-form-item label="反馈模板">
          <el-input
            v-model="feedbackTemplateStr"
            type="textarea"
            :rows="8"
            placeholder='请输入 JSON 格式的反馈模板，例如：&#10;{&#10;  "questions": [&#10;    "内容是否清晰易懂？",&#10;    "是否推荐给朋友？"&#10;  ]&#10;}'
            maxlength="5000"
            show-word-limit
          />
        </el-form-item>
        <div v-if="templateError" style="color: #F56C6C; font-size: 12px; margin: -10px 0 10px 110px;">
          {{ templateError }}
        </div>

        <el-form-item label="快速模板">
          <div style="display: flex; flex-wrap: wrap; gap: 8px;">
            <el-tag
              v-for="(tpl, idx) in presetTemplates"
              :key="idx"
              style="cursor: pointer; padding: 6px 10px;"
              effect="plain"
              @click="applyTemplate(tpl)"
            >
              {{ tpl.name }}
            </el-tag>
          </div>
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">
          {{ isEdit ? '保存修改' : '创建课程' }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, nextTick, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useCourseStore } from '@/stores/course'
import { STATUS_MAP, STATUS_OPTIONS } from '@/constants'
import { formatDate, parseJSONSafe } from '@/utils'
import dayjs from 'dayjs'
import {
  Setting, Plus, View, Edit, Delete, Tools, EditPen
} from '@element-plus/icons-vue'

const route = useRoute()
const courseStore = useCourseStore()

const activeTab = ref('courses')
const loading = ref(false)
const page = ref(1)
const pageSize = ref(10)
const total = ref(0)

const dialogVisible = ref(false)
const isEdit = ref(false)
const submitting = ref(false)
const courseFormRef = ref(null)

const locationOptions = ['A区活动室', 'B区多功能厅', 'C区画室', 'D区茶室', 'B区舞蹈室', 'E区会议室']

const presetTemplates = [
  {
    name: '默认问卷',
    value: { questions: ['内容是否清晰易懂？', '讲师讲解是否专业？', '是否推荐给朋友？'] }
  },
  {
    name: '运动健身类',
    value: { questions: ['动作难度是否合适？', '是否感到身体舒展？', '会继续参与后续课程吗？'] }
  },
  {
    name: '艺术兴趣类',
    value: { questions: ['内容是否有创意？', '作品是否满意？', '对环境和氛围满意吗？'] }
  },
  {
    name: '技能讲座类',
    value: { questions: ['知识是否实用？', '节奏是否合适？', '希望获得哪些进阶内容？'] }
  }
]

const mockList = [
  { id: 1, title: '瑜伽入门班（第3期）', instructor: '李老师', start_time: '2026-06-25 09:00:00', end_time: '2026-06-25 10:30:00', location: 'A区活动室', capacity: 20, booked_count: 15, status: 'bookable', description: '', feedback_template: { questions: ['动作难度是否合适？'] } },
  { id: 2, title: '摄影技巧进阶班', instructor: '王老师', start_time: '2026-06-24 14:00:00', end_time: '2026-06-24 16:00:00', location: 'B区多功能厅', capacity: 15, booked_count: 15, status: 'full', description: '', feedback_template: null },
  { id: 3, title: '少儿绘画启蒙班', instructor: '张老师', start_time: '2026-06-26 15:30:00', end_time: '2026-06-26 17:00:00', location: 'C区画室', capacity: 25, booked_count: 8, status: 'pending', description: '', feedback_template: { questions: ['作品是否满意？'] } },
  { id: 4, title: '书法基础班（第2期）', instructor: '赵老师', start_time: '2026-06-20 10:00:00', end_time: '2026-06-20 11:30:00', location: 'A区活动室', capacity: 18, booked_count: 18, status: 'ongoing', description: '', feedback_template: null },
  { id: 5, title: '古典舞入门课', instructor: '陈老师', start_time: '2026-06-18 19:00:00', end_time: '2026-06-18 20:30:00', location: 'B区舞蹈室', capacity: 16, booked_count: 16, status: 'completed', description: '', feedback_template: { questions: ['对环境满意吗？'] } },
  { id: 6, title: '茶艺品鉴课', instructor: '刘老师', start_time: '2026-06-27 14:30:00', end_time: '2026-06-27 16:30:00', location: 'D区茶室', capacity: 12, booked_count: 0, status: 'suspended', description: '', feedback_template: null }
]

const courseList = ref([...mockList])
total.value = courseList.value.length

const defaultForm = {
  id: null,
  title: '',
  instructor: '',
  timeRange: [],
  location: '',
  capacity: 20,
  status: 'bookable',
  description: '',
  feedback_template: null
}

const courseForm = reactive({ ...defaultForm })
const feedbackTemplateStr = ref('')
const templateError = ref('')

watch(feedbackTemplateStr, v => {
  if (!v || !v.trim()) {
    templateError.value = ''
    return
  }
  const parsed = parseJSONSafe(v)
  templateError.value = parsed ? '' : 'JSON 格式不正确，请检查语法'
})

const formRules = {
  title: [{ required: true, message: '请输入课程主题', trigger: 'blur' }],
  instructor: [{ required: true, message: '请输入讲师姓名', trigger: 'blur' }],
  timeRange: [{ required: true, message: '请选择课程时间', trigger: 'change' }],
  location: [{ required: true, message: '请选择或输入教室区域', trigger: 'change' }],
  capacity: [{ required: true, message: '请输入课程容量', trigger: 'blur' }],
  status: [{ required: true, message: '请选择课程状态', trigger: 'change' }]
}

function formatTimeRange(start, end) {
  if (!start || !end) return '-'
  return `${dayjs(start).format('HH:mm')} - ${dayjs(end).format('HH:mm')}`
}

function openCreateDialog() {
  isEdit.value = false
  Object.assign(courseForm, defaultForm)
  feedbackTemplateStr.value = JSON.stringify(presetTemplates[0].value, null, 2)
  templateError.value = ''
  dialogVisible.value = true
}

function openEditDialog(row) {
  isEdit.value = true
  Object.assign(courseForm, {
    id: row.id,
    title: row.title,
    instructor: row.instructor,
    timeRange: [row.start_time, row.end_time],
    location: row.location,
    capacity: row.capacity,
    status: row.status,
    description: row.description || '',
    feedback_template: row.feedback_template || null
  })
  feedbackTemplateStr.value = row.feedback_template
    ? JSON.stringify(row.feedback_template, null, 2)
    : ''
  templateError.value = ''
  dialogVisible.value = true
}

function applyTemplate(tpl) {
  feedbackTemplateStr.value = JSON.stringify(tpl.value, null, 2)
  templateError.value = ''
}

async function handleSubmit() {
  if (!courseFormRef.value) return
  await courseFormRef.value.validate(async (valid) => {
    if (!valid) return
    if (feedbackTemplateStr.value?.trim() && templateError.value) return
    submitting.value = true
    try {
      let template = null
      if (feedbackTemplateStr.value?.trim()) {
        template = parseJSONSafe(feedbackTemplateStr.value)
        if (!template) {
          templateError.value = 'JSON 格式不正确'
          submitting.value = false
          return
        }
      }

      const payload = {
        title: courseForm.title,
        instructor: courseForm.instructor,
        start_time: courseForm.timeRange[0],
        end_time: courseForm.timeRange[1],
        location: courseForm.location,
        capacity: courseForm.capacity,
        status: courseForm.status,
        description: courseForm.description,
        feedback_template: template
      }

      if (isEdit.value) {
        await courseStore.updateCourse(courseForm.id, payload)
        const idx = courseList.value.findIndex(x => x.id === courseForm.id)
        if (idx > -1) {
          courseList.value[idx] = { ...courseList.value[idx], ...payload, id: courseForm.id }
        }
        ElMessage.success('课程修改成功')
      } else {
        const newId = Math.max(...courseList.value.map(x => x.id), 0) + 1
        courseList.value.unshift({
          id: newId,
          ...payload,
          booked_count: 0
        })
        total.value = courseList.value.length
        ElMessage.success('课程创建成功')
      }
      dialogVisible.value = false
    } catch (e) {
    } finally {
      submitting.value = false
    }
  })
}

async function handleDelete(row) {
  try {
    await ElMessageBox.confirm(
      `确定删除课程「${row.title}」吗？此操作不可恢复。`,
      '删除确认',
      { type: 'error', confirmButtonText: '删除', cancelButtonText: '取消' }
    )
    try {
      await courseStore.deleteCourse(row.id)
      courseList.value = courseList.value.filter(x => x.id !== row.id)
      total.value = courseList.value.length
      ElMessage.success('删除成功')
    } catch (e) {
      courseList.value = courseList.value.filter(x => x.id !== row.id)
      total.value = courseList.value.length
      ElMessage.success('删除成功（模拟）')
    }
  } catch {}
}

onMounted(async () => {
  await courseStore.fetchCourses()
  if (courseStore.courses?.length) {
    courseList.value = [...courseStore.courses]
    total.value = courseList.value.length
  }
  const editId = Number(route.query.editId)
  if (editId) {
    const target = courseList.value.find(x => x.id === editId)
    await nextTick()
    if (target) openEditDialog(target)
  }
})
</script>

<style scoped>
.settings-page { padding: 0; }

.page-title {
  font-size: 22px;
  font-weight: 600;
  color: #303133;
  display: flex;
  align-items: center;
  gap: 10px;
}

.main-tabs :deep(.el-tabs__header) {
  margin-bottom: 20px;
  background: #fff;
  padding: 0 20px;
  border-radius: 12px 12px 0 0;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.06);
}

.card-shadow {
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.06);
  border-radius: 0 0 12px 12px;
  border: none;
}

.course-form {
  padding-top: 10px;
}
</style>
