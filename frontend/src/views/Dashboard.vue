<template>
  <div class="dashboard">
    <el-row :gutter="20" class="stat-row">
      <el-col :span="6" v-for="(stat, idx) in statCards" :key="idx">
        <div class="stat-card">
          <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <div>
              <div class="stat-label">{{ stat.label }}</div>
              <div class="stat-value">{{ stat.value }}</div>
              <div class="stat-trend" :class="stat.trend > 0 ? 'trend-up' : 'trend-down'">
                <el-icon v-if="stat.trend > 0"><CaretTop /></el-icon>
                <el-icon v-else><CaretBottom /></el-icon>
                {{ Math.abs(stat.trend) }}% 较上月
              </div>
            </div>
            <div class="stat-icon" :style="{ background: stat.color }">
              <el-icon :size="24">
                <component :is="stat.icon" />
              </el-icon>
            </div>
          </div>
        </div>
      </el-col>
    </el-row>

    <el-row :gutter="20" class="chart-row" style="margin-top: 20px;">
      <el-col :span="14">
        <div class="card-shadow" style="padding: 20px; background: #fff;">
          <div class="section-title">
            <el-icon><TrendCharts /></el-icon>
            近7天预约趋势
          </div>
          <div ref="trendChartRef" style="width: 100%; height: 320px;"></div>
        </div>
      </el-col>
      <el-col :span="10">
        <div class="card-shadow" style="padding: 20px; background: #fff;">
          <div class="section-title">
            <el-icon><DataLine /></el-icon>
            各课程到场率
          </div>
          <div ref="attendanceChartRef" style="width: 100%; height: 320px;"></div>
        </div>
      </el-col>
    </el-row>

    <el-row :gutter="20" class="chart-row" style="margin-top: 20px;">
      <el-col :span="10">
        <div class="card-shadow" style="padding: 20px; background: #fff;">
          <div class="section-title">
            <el-icon><PieChart /></el-icon>
            反馈评分分布
          </div>
          <div ref="ratingChartRef" style="width: 100%; height: 320px;"></div>
        </div>
      </el-col>
      <el-col :span="14">
        <div class="card-shadow" style="padding: 20px; background: #fff;">
          <div class="section-title" style="display: flex; justify-content: space-between; align-items: center;">
            <span>
              <el-icon><Warning /></el-icon>
              待处理事项
            </span>
            <el-tag type="danger" size="small">{{ todoList.length }} 项待处理</el-tag>
          </div>
          <el-table :data="todoList" stripe style="width: 100%;">
            <el-table-column prop="type" label="类型" width="140">
              <template #default="{ row }">
                <el-tag :type="row.tagType" size="small" effect="dark">
                  <el-icon style="margin-right: 4px;"><component :is="row.icon" /></el-icon>
                  {{ row.typeLabel }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="title" label="内容" />
            <el-table-column prop="course" label="关联课程" width="180" />
            <el-table-column label="操作" width="120" align="center">
              <template #default="{ row }">
                <el-button type="primary" link size="small" @click="handleTodo(row)">
                  立即处理
                </el-button>
              </template>
            </el-table-column>
          </el-table>
          <el-empty v-if="todoList.length === 0" description="暂无待处理事项" :image-size="80" />
        </div>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, computed, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import * as echarts from 'echarts'
import { useStatsStore } from '@/stores/stats'
import { useCourseStore } from '@/stores/course'
import { useUserStore } from '@/stores/user'
import { getLastNDays } from '@/utils'
import {
  DataBoard, Calendar, UserFilled, Star, CaretTop, CaretBottom,
  TrendCharts, DataLine, PieChart, Warning, Bell,
  WarningFilled, CircleClose, Grid, Edit, Connection, Clock
} from '@element-plus/icons-vue'

const router = useRouter()
const statsStore = useStatsStore()
const courseStore = useCourseStore()
const userStore = useUserStore()

const trendChartRef = ref(null)
const attendanceChartRef = ref(null)
const ratingChartRef = ref(null)
let trendChart = null
let attendanceChart = null
let ratingChart = null

const dashboard = computed(() => statsStore.dashboard)
const waitlistSummary = computed(() => courseStore.waitlistSummary)

const statCards = computed(() => [
  {
    label: '总课程数',
    value: dashboard.value.totalCourses || 0,
    trend: 12,
    color: 'linear-gradient(135deg, #667eea, #764ba2)',
    icon: DataBoard
  },
  {
    label: '本月预约',
    value: dashboard.value.monthlyBookings || 0,
    trend: 23,
    color: 'linear-gradient(135deg, #f093fb, #f5576c)',
    icon: Calendar
  },
  {
    label: '平均到场率',
    value: `${dashboard.value.avgAttendance || 0}%`,
    trend: 5,
    color: 'linear-gradient(135deg, #4facfe, #00f2fe)',
    icon: UserFilled
  },
  {
    label: '平均反馈评分',
    value: (dashboard.value.avgRating || 0).toFixed(1),
    trend: -2,
    color: 'linear-gradient(135deg, #fa709a, #fee140)',
    icon: Star
  }
])

const todoList = computed(() => {
  const todos = []
  
  if (userStore.isStudent) {
    const notified = waitlistSummary.value?.pending_notifications || []
    for (const item of notified) {
      todos.push({
        type: 'waitlist_notified',
        typeLabel: '补位待确认',
        tagType: 'warning',
        icon: WarningFilled,
        title: `「${item.course_title}」有补位名额待确认，请尽快处理`,
        course: item.course_title,
        courseId: item.course_id,
        waitlistId: item.id,
        priority: 'high'
      })
    }
    
    const waitingCount = waitlistSummary.value?.waiting || 0
    if (waitingCount > 0) {
      todos.push({
        type: 'waitlist_waiting',
        typeLabel: '候补中',
        tagType: 'info',
        icon: Clock,
        title: `您有 ${waitingCount} 门课程正在候补队列中`,
        course: '-',
        priority: 'normal'
      })
    }
  } else {
    const coursesWithWaitlist = waitlistSummary.value?.courses_with_waitlist || []
    for (const c of coursesWithWaitlist.slice(0, 3)) {
      todos.push({
        type: 'course_waitlist',
        typeLabel: '候补队列',
        tagType: 'info',
        icon: Connection,
        title: `「${c.title}」有 ${c.waiting_count} 人候补、${c.notified_count} 人补位中`,
        course: c.title,
        courseId: c.id,
        priority: c.waiting_count > 5 ? 'high' : 'normal'
      })
    }
    
    const totalWaiting = waitlistSummary.value?.total_waiting || 0
    if (totalWaiting > 0) {
      todos.push({
        type: 'waitlist_overview',
        typeLabel: '候补总览',
        tagType: 'info',
        icon: Grid,
        title: `系统共有 ${totalWaiting} 人在候补队列中`,
        course: '全部课程',
        priority: 'normal'
      })
    }
  }
  
  const systemTodos = dashboard.value.todos || []
  if (systemTodos.length > 0) {
    todos.push(...systemTodos)
  }
  
  if (todos.length === 0) {
    if (userStore.isStudent) {
      todos.push({
        type: 'no_waitlist',
        typeLabel: '暂无候补',
        tagType: 'info',
        icon: Bell,
        title: '您目前没有候补中的课程，快去看看感兴趣的课程吧',
        course: '-'
      })
    } else {
      todos.push({
        type: 'no_waitlist',
        typeLabel: '暂无候补',
        tagType: 'info',
        icon: Bell,
        title: '当前没有课程有候补队列',
        course: '-'
      })
    }
  }
  
  return todos
})

function initTrendChart() {
  if (!trendChartRef.value) return
  trendChart = echarts.init(trendChartRef.value)
  const days = getLastNDays(7)
  const bookingTrend = dashboard.value.bookingTrend?.length
    ? dashboard.value.bookingTrend
    : [12, 19, 25, 18, 32, 28, 45]

  trendChart.setOption({
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(255,255,255,0.95)',
      borderColor: '#ebeef5',
      textStyle: { color: '#303133' }
    },
    grid: { left: 40, right: 20, top: 30, bottom: 30 },
    xAxis: {
      type: 'category',
      data: days,
      boundaryGap: false,
      axisLine: { lineStyle: { color: '#ebeef5' } },
      axisLabel: { color: '#909399' }
    },
    yAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: '#f2f6fc' } },
      axisLabel: { color: '#909399' }
    },
    series: [{
      name: '预约数',
      type: 'line',
      smooth: true,
      data: bookingTrend,
      symbol: 'circle',
      symbolSize: 8,
      lineStyle: { width: 3, color: '#667eea' },
      itemStyle: { color: '#667eea', borderWidth: 2, borderColor: '#fff' },
      areaStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: 'rgba(102, 126, 234, 0.4)' },
          { offset: 1, color: 'rgba(102, 126, 234, 0.05)' }
        ])
      }
    }]
  })
}

function initAttendanceChart() {
  if (!attendanceChartRef.value) return
  attendanceChart = echarts.init(attendanceChartRef.value)
  const attendanceData = dashboard.value.attendanceByCourse?.length
    ? dashboard.value.attendanceByCourse
    : [
        { name: '瑜伽班', value: 85 },
        { name: '摄影班', value: 72 },
        { name: '绘画班', value: 95 },
        { name: '书法班', value: 68 },
        { name: '舞蹈班', value: 88 }
      ]

  attendanceChart.setOption({
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: 'rgba(255,255,255,0.95)',
      borderColor: '#ebeef5',
      textStyle: { color: '#303133' }
    },
    grid: { left: 60, right: 20, top: 30, bottom: 30 },
    xAxis: {
      type: 'category',
      data: attendanceData.map(d => d.name),
      axisLine: { lineStyle: { color: '#ebeef5' } },
      axisLabel: { color: '#909399', interval: 0, rotate: 0 }
    },
    yAxis: {
      type: 'value',
      max: 100,
      axisLabel: { formatter: '{value}%', color: '#909399' },
      splitLine: { lineStyle: { color: '#f2f6fc' } }
    },
    series: [{
      type: 'bar',
      data: attendanceData.map(d => ({
        value: d.value,
        itemStyle: {
          color: d.value >= 80
            ? new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: '#67C23A' },
                { offset: 1, color: '#95D475' }
              ])
            : d.value >= 60
              ? new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                  { offset: 0, color: '#E6A23C' },
                  { offset: 1, color: '#F0C78E' }
                ])
              : new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                  { offset: 0, color: '#F56C6C' },
                  { offset: 1, color: '#F9A7A7' }
                ]),
          borderRadius: [4, 4, 0, 0]
        }
      })),
      barWidth: '40%',
      label: {
        show: true,
        position: 'top',
        formatter: '{c}%',
        color: '#606266',
        fontSize: 12
      }
    }]
  })
}

function initRatingChart() {
  if (!ratingChartRef.value) return
  ratingChart = echarts.init(ratingChartRef.value)
  const dist = dashboard.value.ratingDistribution?.length
    ? dashboard.value.ratingDistribution
    : [
        { value: 8, name: '1星' },
        { value: 12, name: '2星' },
        { value: 35, name: '3星' },
        { value: 88, name: '4星' },
        { value: 142, name: '5星' }
      ]

  ratingChart.setOption({
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c}条 ({d}%)',
      backgroundColor: 'rgba(255,255,255,0.95)',
      borderColor: '#ebeef5',
      textStyle: { color: '#303133' }
    },
    legend: {
      orient: 'vertical',
      right: 10,
      top: 'center',
      textStyle: { color: '#606266' }
    },
    color: ['#F56C6C', '#E6A23C', '#909399', '#67C23A', '#409EFF'],
    series: [{
      type: 'pie',
      radius: ['45%', '72%'],
      center: ['38%', '50%'],
      avoidLabelOverlap: true,
      itemStyle: {
        borderRadius: 8,
        borderColor: '#fff',
        borderWidth: 3
      },
      label: {
        show: true,
        formatter: '{b}\n{d}%',
        color: '#606266',
        fontSize: 12
      },
      labelLine: { length: 10, length2: 10 },
      data: dist
    }]
  })
}

function handleTodo(row) {
  if (row.type === 'waitlist_notified') {
    router.push('/waitlist-center')
  } else if (row.type === 'waitlist_waiting') {
    router.push('/waitlist-center')
  } else if (row.type === 'course_waitlist' && row.courseId) {
    router.push(`/courses/${row.courseId}`)
  } else if (row.type === 'waitlist_overview') {
    router.push('/courses')
  } else {
    router.push('/courses')
  }
}

function handleResize() {
  trendChart?.resize()
  attendanceChart?.resize()
  ratingChart?.resize()
}

async function loadWaitlistSummary() {
  try {
    await courseStore.fetchWaitlistSummary()
  } catch (e) {}
}

onMounted(async () => {
  await statsStore.fetchDashboard()
  await loadWaitlistSummary()
  await nextTick()
  initTrendChart()
  initAttendanceChart()
  initRatingChart()
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  trendChart?.dispose()
  attendanceChart?.dispose()
  ratingChart?.dispose()
})
</script>

<style scoped>
.dashboard {
  padding: 0;
}

.stat-card {
  padding: 24px;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.06);
  transition: transform 0.2s, box-shadow 0.2s;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px 0 rgba(0, 0, 0, 0.1);
}

.stat-value {
  font-size: 32px;
  font-weight: 700;
  color: #303133;
  margin: 12px 0 8px;
}

.stat-label {
  font-size: 14px;
  color: #909399;
  font-weight: 500;
}

.stat-trend {
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 2px;
}

.trend-up {
  color: #67C23A;
}

.trend-down {
  color: #F56C6C;
}

.stat-icon {
  width: 52px;
  height: 52px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  flex-shrink: 0;
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
</style>
