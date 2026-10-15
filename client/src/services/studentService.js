import api from './api'

// Mirrors the shape of adminService.js/teacherService.js. Every call
// here is scoped to the authenticated student on the backend — nothing
// in this file ever sends a studentId.

const toQueryString = (params = {}) => {
  const clean = Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''),
  )
  const qs = new URLSearchParams(clean).toString()
  return qs ? `?${qs}` : ''
}

// --- Attendance ---
export async function getMyAttendanceSummary() {
  return (await api.get('/student/attendance')).data.data
}

export async function getMyAttendanceHistory(params) {
  return (await api.get(`/student/attendance/history${toQueryString(params)}`)).data.data
}

// --- Analytics ---
export async function getAnalyticsOverview() {
  return (await api.get('/student/analytics/overview')).data.data
}

// --- Dashboard ---
export async function getStudentDashboardStats() {
  return (await api.get('/student/dashboard/summary')).data.data
}

// --- Subjects ---
export async function getMySubjects() {
  return (await api.get('/student/subjects')).data.data
}

export async function getMySubjectDetail(subjectId) {
  return (await api.get(`/student/subjects/${subjectId}`)).data.data
}

// --- Timetable ---
export async function getMyTimetable(params) {
  return (await api.get(`/student/timetable${toQueryString(params)}`)).data.data
}

export async function getTodayTimetable() {
  return (await api.get('/student/timetable/today')).data.data
}

// --- Notifications ---
export async function getStudentNotifications(params) {
  return (await api.get(`/student/notifications${toQueryString(params)}`)).data.data
}

export async function markNotificationRead(id) {
  return (await api.patch(`/student/notifications/${id}/read`)).data
}

export async function markAllNotificationsRead() {
  return (await api.patch('/student/notifications/read-all')).data
}

export async function getStudentNotificationUnreadCount() {
  return (await api.get('/student/notifications/unread-count')).data.data
}

// --- Profile ---
export async function getStudentProfile() {
  return (await api.get('/student/profile')).data.data
}

export async function updateStudentProfile(payload) {
  return (await api.put('/student/profile', payload)).data
}

export async function changeStudentPassword(payload) {
  return (await api.put('/student/password', payload)).data
}

// --- OD & Leave ---
export async function applyODLeave(payload) {
  return (await api.post('/od-leave/apply', payload)).data
}

export async function getMyODLeaveRequests(params) {
  return (await api.get(`/od-leave/my-requests${toQueryString(params)}`)).data.data
}
