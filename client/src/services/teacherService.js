import api from './api'

// Thin wrapper around every /api/teacher/* endpoint, mirroring the
// pattern established in adminService.js. Ownership is enforced entirely
// server-side (via req.teacher, resolved from the JWT) — nothing here
// ever sends a teacherId.

const toQueryString = (params = {}) => {
  const clean = Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''),
  )
  const qs = new URLSearchParams(clean).toString()
  return qs ? `?${qs}` : ''
}

export async function getDashboardStats() {
  return (await api.get('/teacher/dashboard/stats')).data.data
}

export async function getSubjects(params) {
  return (await api.get(`/teacher/subjects${toQueryString(params)}`)).data.data
}

export async function getClasses(params) {
  return (await api.get(`/teacher/classes${toQueryString(params)}`)).data.data
}

export async function getClassRoster(subjectId) {
  return (await api.get(`/teacher/classes/${subjectId}/students`)).data.data
}

export async function getClassrooms() {
  return (await api.get('/teacher/classrooms')).data.data
}

export async function getCourses() {
  return (await api.get('/teacher/courses')).data.data
}

export async function getTimetable() {
  return (await api.get('/teacher/timetable')).data.data
}

export async function getTodayTimetable() {
  return (await api.get('/teacher/timetable/today')).data.data
}

export async function getAttendanceSessions(params) {
  return (await api.get(`/teacher/attendance/sessions${toQueryString(params)}`)).data.data
}

export async function createAttendanceSession(payload) {
  return (await api.post('/teacher/attendance/sessions', payload)).data
}

export async function getAttendanceSession(id) {
  return (await api.get(`/teacher/attendance/sessions/${id}`)).data.data
}

export async function markAttendance(sessionId, records) {
  return (await api.post(`/teacher/attendance/sessions/${sessionId}/mark`, { records })).data
}

export async function completeSession(sessionId, payload = {}) {
  return (await api.post(`/teacher/attendance/sessions/${sessionId}/complete`, payload)).data
}

export async function getClassAttendance(subjectId) {
  return (await api.get(`/teacher/attendance/class/${subjectId}`)).data.data
}

export async function getProfile() {
  return (await api.get('/teacher/profile')).data.data
}

export async function updateProfile(payload) {
  return (await api.put('/teacher/profile', payload)).data
}

export async function changePassword(payload) {
  return (await api.put('/teacher/profile/password', payload)).data
}

// --- Computer Vision (Phase 7) ---

export async function getFaceStatus(studentId) {
  return (await api.get(`/teacher/face-profiles/status/${studentId}`)).data.data
}

export async function registerFace(studentId, descriptors) {
  return (await api.post('/teacher/face-profiles', { student: studentId, descriptors })).data
}

export async function recognizeFace(sessionId, descriptor, options = {}) {
  const payload = { descriptor }
  if (typeof options.commit === 'boolean') {
    payload.commit = options.commit
  }
  return (await api.post(`/teacher/attendance/sessions/${sessionId}/recognize`, payload)).data
}


// --- Students & Face Registration ---

export async function getTeacherStudents(params) {
  return (await api.get(`/teacher/students${toQueryString(params)}`)).data.data
}

export async function getTeacherStudent(id) {
  return (await api.get(`/teacher/students/${id}`)).data.data
}

export async function registerStudentWithFace(payload) {
  return (await api.post('/teacher/students/register', payload)).data
}

// --- Analytics (Phase 9) ---

export async function getAnalyticsOverview(params) {
  return (await api.get(`/teacher/analytics/overview${toQueryString(params)}`)).data.data
}

// --- Notifications ---

export async function getTeacherNotifications(params) {
  return (await api.get(`/teacher/notifications${toQueryString(params)}`)).data.data
}

export async function getTeacherNotificationUnreadCount() {
  return (await api.get('/teacher/notifications/unread-count')).data.data
}

export async function getTeacherNotification(id) {
  return (await api.get(`/teacher/notifications/${id}`)).data.data
}

export async function markNotificationRead(id) {
  return (await api.patch(`/teacher/notifications/${id}/read`)).data
}

export async function markAllNotificationsRead() {
  return (await api.patch('/teacher/notifications/read-all')).data
}

// --- Reports ---

export async function getTeacherReports(params) {
  return (await api.get(`/teacher/reports${toQueryString(params)}`)).data.data
}

export async function getReportFilterOptions() {
  return (await api.get('/teacher/reports/filter-options')).data.data
}

export async function getReportSessionDetail(sessionId) {
  return (await api.get(`/teacher/reports/session/${sessionId}`)).data.data
}

export async function getReportStudentDetail(studentId) {
  return (await api.get(`/teacher/reports/student/${studentId}`)).data.data
}

// --- OD & Leave ---
export async function getODLeaveRequests(params) {
  return (await api.get(`/od-leave/requests${toQueryString(params)}`)).data.data
}

export async function reviewODLeaveRequest(id, payload) {
  return (await api.patch(`/od-leave/${id}/review`, payload)).data
}

export async function getSessionExceptions(sessionId) {
  return (await api.get(`/od-leave/session-exceptions/${sessionId}`)).data.data
}

