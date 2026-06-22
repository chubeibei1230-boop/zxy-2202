export const STATUS_MAP = {
  bookable: { label: '可预约', type: 'success' },
  full: { label: '已约满', type: 'warning' },
  pending: { label: '待开课', type: 'info' },
  ongoing: { label: '进行中', type: 'primary' },
  feedback_pending: { label: '待反馈', type: 'warning' },
  completed: { label: '已结课', type: 'info' },
  suspended: { label: '暂停开放', type: 'danger' }
}

export const WAITLIST_STATUS_MAP = {
  waiting: { label: '候补中', type: 'info' },
  notified: { label: '补位待确认', type: 'warning' },
  confirmed: { label: '已确认补位', type: 'success' },
  rejected: { label: '已拒绝补位', type: 'info' },
  expired: { label: '确认超时', type: 'danger' },
  removed: { label: '已移除', type: 'info' }
}

export const WAITLIST_ACTION_MAP = {
  joined: { label: '加入候补', type: 'primary' },
  left: { label: '退出候补', type: 'info' },
  notified: { label: '收到补位通知', type: 'warning' },
  confirmed: { label: '确认补位', type: 'success' },
  rejected: { label: '拒绝补位', type: 'info' },
  expired: { label: '补位超时', type: 'danger' },
  admin_removed: { label: '管理员移除', type: 'danger' }
}

export const ROLE_MAP = {
  student: { label: '学员', value: 'student' },
  assistant: { label: '助教', value: 'assistant' },
  admin: { label: '管理员', value: 'admin' }
}

export const ROLE_OPTIONS = [
  { label: '学员', value: 'student' },
  { label: '助教', value: 'assistant' },
  { label: '管理员', value: 'admin' }
]

export const STATUS_OPTIONS = Object.entries(STATUS_MAP).map(([key, val]) => ({
  label: val.label,
  value: key,
  type: val.type
}))

export const RATING_OPTIONS = [1, 2, 3, 4, 5]

export const ATTENDANCE_STATUS = {
  present: { label: '到场', type: 'success' },
  absent: { label: '缺席', type: 'danger' },
  pending: { label: '待确认', type: 'info' }
}

export const WAITLIST_CONFIRM_TIMEOUT_MINUTES = 30
