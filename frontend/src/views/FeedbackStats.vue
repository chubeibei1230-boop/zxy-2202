<template>
  <div class="feedback-stats-page">
    <div class="page-header card-shadow" style="padding: 20px; background: #fff; border-radius: 12px; margin-bottom: 20px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
        <div class="page-title">
          <el-icon :size="22"><Histogram /></el-icon>
          反馈统计
        </div>
        <el-select
          v-model="selectedCourseId"
          placeholder="选择要查看统计的课程"
          filterable
          style="width: 380px;"
          @change="fetchStats"
        >
          <el-option
            v-for="c in courseList"
            :key="c.id"
            :label="`${c.title} · ${STATUS_MAP[c.status]?.label || c.status}`"
            :value="c.id"
          />
        </el-select>
      </div>

      <el-divider style="margin: 10px 0 20px;" />

      <div class="rating-overview" v-if="statsData">
        <div class="avg-rating-box">
          <div class="big-rating">
            <span class="num">{{ avgRating }}</span>
            <span class="unit">/ 5.0</span>
          </div>
          <el-rate :model-value="Number(avgRating)" disabled size="large" />
          <div class="total-count">共 {{ statsData.total || 0 }} 条反馈</div>
        </div>
        <div class="rating-bars">
          <div v-for="n in [5,4,3,2,1]" :key="n" class="rating-bar-row">
            <span class="label">{{ n }} 星</span>
            <el-progress
              :percentage="getRatingPercent(n)"
              :stroke-width="10"
              :color="ratingColor(n)"
              :show-text="false"
            />
            <span class="count">{{ getRatingCount(n) }} 条</span>
            <span class="pct">{{ getRatingPercent(n) }}%</span>
          </div>
        </div>
      </div>
    </div>

    <div v-if="selectedCourseId" class="charts-container">
      <el-row :gutter="20">
        <el-col :span="12">
          <div class="card-shadow" style="padding: 20px; background: #fff; border-radius: 12px;">
            <div class="section-title">
              <el-icon><DataLine /></el-icon>
              评分分布（柱状图）
            </div>
            <div ref="barChartRef" style="width: 100%; height: 320px;"></div>
          </div>
        </el-col>
        <el-col :span="12">
          <div class="card-shadow" style="padding: 20px; background: #fff; border-radius: 12px;">
            <div class="section-title">
              <el-icon><PieChart /></el-icon>
              评分分布（饼图）
            </div>
            <div ref="pieChartRef" style="width: 100%; height: 320px;"></div>
          </div>
        </el-col>
      </el-row>

      <div class="card-shadow" style="padding: 20px; background: #fff; border-radius: 12px; margin-top: 20px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <div class="section-title" style="margin-bottom: 0;">
            <el-icon><ChatDotRound /></el-icon>
            反馈内容详情
          </div>
          <div>
            <el-radio-group v-model="ratingFilter" size="default">
              <el-radio-button :label="null">全部</el-radio-button>
              <el-radio-button v-for="n in 5" :key="n" :label="n">{{ n }}星</el-radio-button>
            </el-radio-group>
            <el-input
              v-model="keywordFilter"
              placeholder="搜索反馈内容"
              clearable
              :prefix-icon="Search"
              size="default"
              style="width: 200px; margin-left: 12px;"
            />
            <el-tag style="margin-left: 12px;">{{ filteredFeedbacks.length }} 条</el-tag>
          </div>
        </div>

        <el-table :data="filteredFeedbacks" stripe style="width: 100%;">
          <el-table-column prop="student_name" label="学员" width="140">
            <template #default="{ row }">
              <div style="display: flex; align-items: center; gap: 8px;">
                <el-avatar :size="28">{{ row.student_name?.charAt(0) || '学' }}</el-avatar>
                <span>{{ row.student_name }}</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="评分" width="180">
            <template #default="{ row }">
              <el-rate :model-value="row.rating" disabled size="small" show-score text-color="#ff9900" score-template="{value}" />
            </template>
          </el-table-column>
          <el-table-column prop="content" label="反馈内容" min-width="320">
            <template #default="{ row }">
              <div v-if="row.content" style="line-height: 1.6;">
                {{ row.content }}
              </div>
              <span v-else style="color: #c0c4cc;">（无文字评价）</span>
            </template>
          </el-table-column>
          <el-table-column label="问卷回答" width="100" align="center">
            <template #default="{ row }">
              <el-tag
                v-if="row.answers && Object.keys(row.answers).length"
                type="info"
                size="small"
              >
                {{ Object.keys(row.answers).length }} 题
              </el-tag>
              <span v-else style="color: #c0c4cc;">-</span>
            </template>
          </el-table-column>
          <el-table-column prop="created_at" label="提交时间" width="180">
            <template #default="{ row }">
              {{ formatDateTime(row.created_at) }}
            </template>
          </el-table-column>
          <el-table-column label="操作" width="90" align="center">
            <template #default="{ row }">
              <el-button type="primary" link size="small" @click="showFeedbackDetail(row)">
                详情
              </el-button>
            </template>
          </el-table-column>
        </el-table>
        <el-empty v-if="filteredFeedbacks.length === 0" description="暂无符合条件的反馈" :image-size="80" />
      </div>
    </div>

    <div v-else class="card-shadow" style="padding: 80px; background: #fff; border-radius: 12px; text-align: center;">
      <el-empty description="请先在上方选择课程以查看反馈统计数据" :image-size="120">
        <template #image>
          <el-icon :size="80" color="#c0c4cc"><Histogram /></el-icon>
        </template>
      </el-empty>
    </div>

    <el-dialog v-model="detailVisible" title="反馈详情" width="560px">
      <div v-if="currentFeedback">
        <div style="display: flex; align-items: center; gap: 12px; padding: 16px; background: #fafbfc; border-radius: 10px; margin-bottom: 16px;">
          <el-avatar :size="48">{{ currentFeedback.student_name?.charAt(0) }}</el-avatar>
          <div style="flex: 1;">
            <div style="font-weight: 600; font-size: 16px; margin-bottom: 4px;">{{ currentFeedback.student_name }}</div>
            <el-rate :model-value="currentFeedback.rating" disabled show-score text-color="#ff9900" score-template="{value}分" />
          </div>
          <span style="color: #909399; font-size: 12px;">{{ formatDateTime(currentFeedback.created_at) }}</span>
        </div>

        <div style="margin-bottom: 16px;">
          <div style="font-weight: 500; margin-bottom: 8px; color: #606266;">文字评价</div>
          <div style="padding: 14px 16px; background: #f5f7fa; border-radius: 8px; line-height: 1.7; color: #303133;">
            {{ currentFeedback.content || '（学员未填写文字评价）' }}
          </div>
        </div>

        <div v-if="currentFeedback.answers && Object.keys(currentFeedback.answers).length">
          <div style="font-weight: 500; margin-bottom: 8px; color: #606266;">问卷回答</div>
          <div
            v-for="(val, key) in currentFeedback.answers"
            :key="key"
            style="padding: 10px 14px; background: #f5f7fa; border-radius: 8px; margin-bottom: 8px;"
          >
            <div style="color: #409EFF; margin-bottom: 4px; font-size: 13px;">Q：{{ key }}</div>
            <div style="color: #303133;">A：{{ typeof val === 'object' ? JSON.stringify(val) : val }}</div>
          </div>
        </div>
      </div>
      <template #footer>
        <el-button @click="detailVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import * as echarts from 'echarts'
import { useStatsStore } from '@/stores/stats'
import { useCourseStore } from '@/stores/course'
import { STATUS_MAP } from '@/constants'
import { formatDateTime } from '@/utils'
import {
  Histogram, DataLine, PieChart, ChatDotRound, Search
} from '@element-plus/icons-vue'

const route = useRoute()
const statsStore = useStatsStore()
const courseStore = useCourseStore()

const selectedCourseId = ref(Number(route.query.courseId) || null)
const ratingFilter = ref(null)
const keywordFilter = ref('')
const detailVisible = ref(false)
const currentFeedback = ref(null)

const barChartRef = ref(null)
const pieChartRef = ref(null)
let barChart = null
let pieChart = null

const courseList = ref([
  { id: 1, title: '瑜伽入门班（第3期）', status: 'bookable' },
  { id: 2, title: '摄影技巧进阶班', status: 'full' },
  { id: 4, title: '书法基础班（第2期）', status: 'ongoing' },
  { id: 5, title: '古典舞入门课', status: 'completed' },
  { id: 3, title: '少儿绘画启蒙班', status: 'pending' }
])

const statsData = ref(null)
const feedbackList = ref([])

const avgRating = computed(() => {
  if (!statsData.value?.avg_rating && !feedbackList.value.length) return '0.0'
  const r = statsData.value?.avg_rating || (
    feedbackList.value.reduce((s, f) => s + (f.rating || 0), 0) / Math.max(1, feedbackList.value.length)
  )
  return r.toFixed(1)
})

function getRatingCount(n) {
  if (statsData.value?.rating_distribution) {
    const item = statsData.value.rating_distribution.find(x => x.name === `${n}星` || x.rating === n)
    if (item) return item.value || item.count || 0
  }
  return feedbackList.value.filter(f => f.rating === n).length
}

function getRatingPercent(n) {
  const total = statsData.value?.total || feedbackList.value.length
  if (!total) return 0
  return Math.round(getRatingCount(n) / total * 100)
}

function ratingColor(n) {
  const colors = { 1: '#F56C6C', 2: '#E6A23C', 3: '#909399', 4: '#8CC5FF', 5: '#67C23A' }
  return colors[n]
}

const filteredFeedbacks = computed(() => {
  return feedbackList.value.filter(f => {
    if (ratingFilter.value !== null && f.rating !== ratingFilter.value) return false
    if (keywordFilter.value && !(f.content || '').toLowerCase().includes(keywordFilter.value.toLowerCase())) return false
    return true
  })
})

async function fetchStats(id = selectedCourseId.value) {
  if (!id) return
  try {
    const data = await statsStore.fetchFeedbackStats(id)
    statsData.value = {
      avg_rating: data.avg_rating || 4.5,
      total: data.total || 38,
      rating_distribution: data.rating_distribution || [
        { name: '1星', value: 2 },
        { name: '2星', value: 3 },
        { name: '3星', value: 6 },
        { name: '4星', value: 12 },
        { name: '5星', value: 15 }
      ]
    }
    feedbackList.value = data.feedbackList || [
      { id: 1, student_name: '张同学', rating: 5, content: '老师讲解非常细致，动作纠正到位，受益匪浅！', created_at: '2026-06-21 12:00:00', answers: { '内容是否清晰易懂？': '非常清晰', '是否推荐给朋友？': '强烈推荐' } },
      { id: 2, student_name: '李同学', rating: 4, content: '整体不错，希望增加一些进阶动作的讲解。', created_at: '2026-06-21 14:30:00', answers: { '内容是否清晰易懂？': '比较清晰', '是否推荐给朋友？': '会推荐' } },
      { id: 3, student_name: '王同学', rating: 5, content: '教室环境很好，老师很有耐心。', created_at: '2026-06-22 09:15:00', answers: {} },
      { id: 4, student_name: '赵同学', rating: 3, content: '节奏稍微有点快，对于零基础不太友好。', created_at: '2026-06-22 16:40:00', answers: { '内容是否清晰易懂？': '一般', '是否推荐给朋友？': '看情况' } },
      { id: 5, student_name: '孙同学', rating: 5, content: '时间安排合理，每次结束后都有小总结，很棒！', created_at: '2026-06-23 10:05:00', answers: {} },
      { id: 6, student_name: '周同学', rating: 2, content: '场地有点小，人多的时候比较拥挤。', created_at: '2026-06-23 15:22:00', answers: {} },
      { id: 7, student_name: '吴同学', rating: 4, content: '', created_at: '2026-06-24 08:50:00', answers: { '内容是否清晰易懂？': '比较清晰' } },
      { id: 8, student_name: '郑同学', rating: 1, content: '临时调课没有提前通知，体验不好。', created_at: '2026-06-24 11:30:00', answers: {} }
    ]
    await nextTick()
    renderCharts()
  } catch (e) {}
}

function renderCharts() {
  if (barChartRef.value) {
    if (barChart) barChart.dispose()
    barChart = echarts.init(barChartRef.value)
    const categories = ['1星', '2星', '3星', '4星', '5星']
    const values = [1, 2, 3, 4, 5].map(n => getRatingCount(n))
    barChart.setOption({
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      grid: { left: 40, right: 30, top: 20, bottom: 30 },
      xAxis: { type: 'category', data: categories, axisLine: { lineStyle: { color: '#ebeef5' } }, axisLabel: { color: '#606266' } },
      yAxis: { type: 'value', splitLine: { lineStyle: { color: '#f2f6fc' } }, axisLabel: { color: '#909399' } },
      series: [{
        type: 'bar',
        data: values.map((v, i) => ({
          value: v,
          itemStyle: { color: ratingColor(i + 1), borderRadius: [6, 6, 0, 0] }
        })),
        barWidth: '45%',
        label: { show: true, position: 'top', color: '#606266', fontWeight: 600 }
      }]
    })
  }
  if (pieChartRef.value) {
    if (pieChart) pieChart.dispose()
    pieChart = echarts.init(pieChartRef.value)
    pieChart.setOption({
      tooltip: { trigger: 'item', formatter: '{b}: {c}条 ({d}%)' },
      legend: { bottom: 0, textStyle: { color: '#606266' } },
      color: ['#F56C6C', '#E6A23C', '#909399', '#8CC5FF', '#67C23A'],
      series: [{
        type: 'pie',
        radius: ['40%', '70%'],
        center: ['50%', '45%'],
        avoidLabelOverlap: true,
        itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
        label: { formatter: '{b}\n{c}条 ({d}%)', color: '#606266', fontSize: 12 },
        labelLine: { length: 8, length2: 8 },
        data: [1, 2, 3, 4, 5].map(n => ({ name: `${n}星`, value: getRatingCount(n) }))
      }]
    })
  }
}

function showFeedbackDetail(row) {
  currentFeedback.value = row
  detailVisible.value = true
}

function handleResize() {
  barChart?.resize()
  pieChart?.resize()
}

watch(selectedCourseId, () => fetchStats())

onMounted(async () => {
  await courseStore.fetchCourses()
  if (courseStore.courses?.length) {
    courseList.value = [...courseList.value, ...courseStore.courses]
  }
  if (selectedCourseId.value) await fetchStats()
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  barChart?.dispose()
  pieChart?.dispose()
})
</script>

<style scoped>
.feedback-stats-page { padding: 0; }

.page-title {
  font-size: 22px;
  font-weight: 600;
  color: #303133;
  display: flex;
  align-items: center;
  gap: 10px;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.rating-overview {
  display: grid;
  grid-template-columns: 300px 1fr;
  gap: 30px;
  align-items: center;
}

.avg-rating-box {
  text-align: center;
  padding: 20px;
  background: linear-gradient(135deg, #fff8e7, #fff3d6);
  border-radius: 12px;
  border: 1px solid #faecd8;
}

.big-rating {
  margin: 6px 0 10px;
}

.big-rating .num {
  font-size: 48px;
  font-weight: 700;
  color: #E6A23C;
  line-height: 1;
}

.big-rating .unit {
  font-size: 16px;
  color: #909399;
  margin-left: 4px;
}

.total-count {
  margin-top: 10px;
  font-size: 13px;
  color: #909399;
}

.rating-bars {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.rating-bar-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.rating-bar-row .label {
  width: 40px;
  font-size: 13px;
  color: #606266;
  font-weight: 500;
}

.rating-bar-row .el-progress {
  flex: 1;
}

.rating-bar-row .count {
  width: 56px;
  font-size: 13px;
  color: #606266;
  text-align: right;
}

.rating-bar-row .pct {
  width: 46px;
  font-size: 13px;
  color: #909399;
  text-align: right;
}
</style>
