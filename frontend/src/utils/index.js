import dayjs from 'dayjs'

export function formatDateTime(date) {
  if (!date) return '-'
  return dayjs(date).format('YYYY-MM-DD HH:mm')
}

export function formatDate(date) {
  if (!date) return '-'
  return dayjs(date).format('YYYY-MM-DD')
}

export function getLastNDays(n) {
  const days = []
  for (let i = n - 1; i >= 0; i--) {
    days.push(dayjs().subtract(i, 'day').format('MM-DD'))
  }
  return days
}

export function parseJSONSafe(str) {
  try {
    return JSON.parse(str)
  } catch (e) {
    return null
  }
}

export function formatDuration(start, end) {
  if (!start || !end) return '-'
  return `${formatDateTime(start)} ~ ${dayjs(end).format('HH:mm')}`
}
