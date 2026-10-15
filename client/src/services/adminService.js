import api from './api'

// Thin wrapper around every /api/admin/* endpoint. Pages call these
// instead of touching Axios directly, so there's one place to update if
// an endpoint shape ever changes.

const toQueryString = (params = {}) => {
  const clean = Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''),
  )
  const qs = new URLSearchParams(clean).toString()
  return qs ? `?${qs}` : ''
}

export async function getDashboardStats() {
  const res = await api.get('/admin/dashboard/stats')
  return res.data.data
}

function resourceService(resourceKey, basePath) {
  return {
    list: async (params) => (await api.get(`${basePath}${toQueryString(params)}`)).data.data,
    get: async (id) => (await api.get(`${basePath}/${id}`)).data.data[resourceKey],
    create: async (payload) => (await api.post(basePath, payload)).data,
    update: async (id, payload) => (await api.put(`${basePath}/${id}`, payload)).data,
    updateStatus: async (id, isActive) => (await api.patch(`${basePath}/${id}/status`, { isActive })).data,
    remove: async (id) => (await api.delete(`${basePath}/${id}`)).data,
  }
}

export const studentsApi = {
  ...resourceService('student', '/admin/students'),
  get: async (id) => (await api.get(`/admin/students/${id}`)).data.data,
  getSections: async (params) => (await api.get(`/admin/students/sections${toQueryString(params)}`)).data.data,
}
export const teachersApi = resourceService('teacher', '/admin/teachers')
export const subjectsApi = resourceService('subject', '/admin/subjects')
export const coursesApi = resourceService('course', '/admin/courses')
export const classroomsApi = resourceService('classroom', '/admin/classrooms')
export const departmentsApi = {
  list: async () => (await api.get('/admin/departments')).data.data,
}
export const announcementsApi = {
  ...resourceService('announcement', '/admin/announcements'),
  publish: async (id) => (await api.patch(`/admin/announcements/${id}/publish`)).data,
}

// --- Timetable ---
export const timetableApi = {
  list: async (params) => (await api.get(`/admin/timetable${toQueryString(params)}`)).data.data,
  get: async (id) => (await api.get(`/admin/timetable/${id}`)).data.data,
  getOptions: async () => (await api.get('/admin/timetable/options')).data.data,
  create: async (payload) => (await api.post('/admin/timetable', payload)).data,
  update: async (id, payload) => (await api.put(`/admin/timetable/${id}`, payload)).data,
  remove: async (id) => (await api.delete(`/admin/timetable/${id}`)).data,
}

// --- Attendance ---
export const adminAttendanceApi = {
  getStats: async () => (await api.get('/admin/attendance/stats')).data.data,
  listSessions: async (params) => (await api.get(`/admin/attendance/sessions${toQueryString(params)}`)).data.data,
  getOptions: async () => (await api.get('/admin/attendance/options')).data.data,
  getSessionDetail: async (id) => (await api.get(`/admin/attendance/sessions/${id}`)).data.data,
  deleteSession: async (id) => (await api.delete(`/admin/attendance/sessions/${id}`)).data,
  deleteRecord: async (id) => (await api.delete(`/admin/attendance/records/${id}`)).data,
}

// --- Analytics ---
export const adminAnalyticsApi = {
  getOverview: async (params) => {
    const query = typeof params === 'string' ? { range: params } : (params || {})
    return (await api.get(`/admin/analytics/overview${toQueryString(query)}`)).data.data
  },
}

// --- Reports ---
export const adminReportsApi = {
  getReports: async (params) => (await api.get(`/admin/reports${toQueryString(params)}`)).data.data,
  getOptions: async () => (await api.get('/admin/reports/options')).data.data,
  getSessionDetail: async (id) => (await api.get(`/admin/reports/session/${id}`)).data.data,
  getStudentDetail: async (id) => (await api.get(`/admin/reports/student/${id}`)).data.data,
}

// --- Settings (Legacy compatibility) ---
export const adminSettingsApi = {
  getProfile: async () => (await api.get('/admin/settings/profile')).data.data,
  updateProfile: async (payload) => (await api.put('/admin/settings/profile', payload)).data,
  changePassword: async (payload) => (await api.put('/admin/settings/password', payload)).data,
}

// --- Admin Personal Profile & Security ---
export const adminProfileApi = {
  getProfile: async () => (await api.get('/admin/profile')).data.data,
  updateProfile: async (payload) => (await api.put('/admin/profile', payload)).data,
  changePassword: async (payload) => (await api.put('/admin/profile/password', payload)).data,
}

// --- OD & Leave Management ---
export const adminODLeaveApi = {
  getRequests: async (params) => (await api.get(`/od-leave/requests${toQueryString(params)}`)).data.data,
  reviewRequest: async (id, payload) => (await api.patch(`/od-leave/${id}/review`, payload)).data,
}

