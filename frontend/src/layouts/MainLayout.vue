<template>
  <el-container class="main-layout">
    <el-aside width="220px" class="sidebar">
      <div class="logo">
        <el-icon :size="28"><Reading /></el-icon>
        <span>社区中心</span>
      </div>
      <el-menu
        :default-active="activeMenu"
        router
        background-color="transparent"
        text-color="#c0c4cc"
        active-text-color="#409EFF"
        class="sidebar-menu"
      >
        <el-menu-item index="/dashboard">
          <el-icon><DataBoard /></el-icon>
          <span>仪表盘</span>
        </el-menu-item>
        <el-menu-item index="/my-bookings">
          <el-icon><Tickets /></el-icon>
          <span>我的预约</span>
        </el-menu-item>
        <el-menu-item index="/courses">
          <el-icon><Collection /></el-icon>
          <span>课程列表</span>
        </el-menu-item>
        <el-menu-item v-if="showOnSite" index="/on-site">
          <el-icon><Check /></el-icon>
          <span>现场确认</span>
        </el-menu-item>
        <el-menu-item index="/feedback-stats">
          <el-icon><Histogram /></el-icon>
          <span>反馈统计</span>
        </el-menu-item>
        <el-menu-item v-if="userStore.isAdmin" index="/settings">
          <el-icon><Setting /></el-icon>
          <span>管理设置</span>
        </el-menu-item>
      </el-menu>
    </el-aside>

    <el-container>
      <el-header class="header">
        <div class="header-left">
          <el-breadcrumb separator="/">
            <el-breadcrumb-item :to="{ path: '/dashboard' }">首页</el-breadcrumb-item>
            <el-breadcrumb-item v-if="$route.meta.title">{{ $route.meta.title }}</el-breadcrumb-item>
          </el-breadcrumb>
        </div>
        <div class="header-right">
          <el-dropdown @command="handleCommand">
            <div class="user-info">
              <el-avatar :size="32" :icon="UserFilled" />
              <span class="username">{{ userStore.userInfo?.username || '用户' }}</span>
              <el-tag :type="roleTagType" size="small">{{ roleLabel }}</el-tag>
              <el-icon><ArrowDown /></el-icon>
            </div>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="profile">
                  <el-icon><User /></el-icon>
                  个人信息
                </el-dropdown-item>
                <el-dropdown-item command="logout" divided>
                  <el-icon><SwitchButton /></el-icon>
                  退出登录
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </el-header>

      <el-main class="main-content">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { ElMessageBox, ElMessage } from 'element-plus'
import { ROLE_MAP } from '@/constants'
import { UserFilled, Tickets } from '@element-plus/icons-vue'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const activeMenu = computed(() => route.path)
const showOnSite = computed(() => userStore.isAssistant || userStore.isAdmin)

const roleLabel = computed(() => {
  const role = userStore.role
  return ROLE_MAP[role]?.label || '未知'
})

const roleTagType = computed(() => {
  const role = userStore.role
  if (role === 'admin') return 'danger'
  if (role === 'assistant') return 'warning'
  return 'success'
})

function handleCommand(cmd) {
  if (cmd === 'logout') {
    ElMessageBox.confirm('确定要退出登录吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    }).then(() => {
      userStore.logout()
      ElMessage.success('已退出登录')
      router.push('/login')
    }).catch(() => {})
  } else if (cmd === 'profile') {
    ElMessage.info('个人信息功能开发中')
  }
}
</script>

<style scoped>
.main-layout {
  height: 100vh;
}

.sidebar {
  background: linear-gradient(180deg, #1f2d3d 0%, #1a2332 100%);
  color: #fff;
  display: flex;
  flex-direction: column;
}

.logo {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  font-size: 18px;
  font-weight: 600;
  color: #fff;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.sidebar-menu {
  border: none;
  flex: 1;
  padding: 16px 0;
}

.sidebar-menu .el-menu-item {
  height: 48px;
  line-height: 48px;
  margin: 4px 12px;
  border-radius: 8px;
}

.sidebar-menu .el-menu-item:hover {
  background-color: rgba(64, 158, 255, 0.1);
}

.sidebar-menu .el-menu-item.is-active {
  background-color: rgba(64, 158, 255, 0.2);
}

.header {
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #ebeef5;
  padding: 0 24px;
}

.header-right {
  display: flex;
  align-items: center;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  padding: 8px 12px;
  border-radius: 8px;
  transition: background-color 0.2s;
}

.user-info:hover {
  background-color: #f5f7fa;
}

.username {
  font-weight: 500;
  color: #303133;
}

.main-content {
  background-color: #f5f7fa;
  padding: 24px;
  overflow-y: auto;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
