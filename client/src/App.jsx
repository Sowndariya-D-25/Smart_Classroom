import { Suspense, lazy } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import ProtectedRoute from './routes/ProtectedRoute'
import RoleRoute from './routes/RoleRoute'
import DashboardRedirect from './routes/DashboardRedirect'
import DashboardLayout from './components/layout/DashboardLayout'
import LoadingScreen from './components/LoadingScreen'

import Landing from './pages/Landing'
import Login from './pages/Login'
import AdminSetup from './pages/AdminSetup'
import ComingSoon from './pages/ComingSoon'
import NotFound from './pages/NotFound'
import AdminDashboard from './pages/admin/AdminDashboard'
import Students from './pages/admin/Students'
import Teachers from './pages/admin/Teachers'
import AcademicManagement from './pages/admin/AcademicManagement'
import Departments from './pages/admin/Departments'
import Classrooms from './pages/admin/Classrooms'
import AdminSettings from './pages/admin/Settings'
import AdminProfile from './pages/admin/Profile'
import TeacherDashboard from './pages/teacher/TeacherDashboard'
import TeacherSubjects from './pages/teacher/Subjects'
import TeacherClasses from './pages/teacher/Classes'
import TeacherTimetable from './pages/teacher/Timetable'
import AttendanceHistory from './pages/teacher/AttendanceHistory'
import StartAttendance from './pages/teacher/StartAttendance'
import MarkAttendance from './pages/teacher/MarkAttendance'
import ClassAttendance from './pages/teacher/ClassAttendance'
import TeacherProfile from './pages/teacher/Profile'
import FaceRoster from './pages/teacher/FaceRoster'
import StudentDashboard from './pages/student/StudentDashboard'
import StudentSubjects from './pages/student/Subjects'
import StudentTimetable from './pages/student/Timetable'
import StudentAttendance from './pages/student/Attendance'
import StudentAttendanceHistory from './pages/student/AttendanceHistory'
import StudentNotifications from './pages/student/Notifications'
import StudentProfile from './pages/student/Profile'
import TeacherNotifications from './pages/teacher/Notifications'
import AdminAnnouncements from './pages/admin/Announcements'
import AdminTimetable from './pages/admin/Timetable'
import AdminAttendance from './pages/admin/Attendance'

// Lazy-loaded: face-api.js and recharts (Analytics/Reports) are large,
// browser-only-needed libraries — fetched only when a page that
// actually uses them is visited, not on every initial app load.
const FaceRegistration = lazy(() => import('./pages/teacher/FaceRegistration'))
const FaceAttendance = lazy(() => import('./pages/teacher/FaceAttendance'))
const TeacherAnalytics = lazy(() => import('./pages/teacher/Analytics'))
const TeacherReports = lazy(() => import('./pages/teacher/Reports'))
const StudentAnalytics = lazy(() => import('./pages/student/Analytics'))
const AdminAnalytics = lazy(() => import('./pages/admin/Analytics'))
const AdminReports = lazy(() => import('./pages/admin/Reports'))


export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Routes>
          {/* Public */}
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Navigate to="/login" replace />} />
          <Route path="/admin-setup" element={<AdminSetup />} />
          <Route path="/setup" element={<Navigate to="/admin-setup" replace />} />

          {/* Authenticated */}
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<DashboardRedirect />} />

            {/* Admin — full suite of administrative management, timetable, attendance, analytics, reports & profile */}
            <Route element={<RoleRoute allow={['admin']} />}>
              <Route path="/admin" element={<DashboardLayout />}>
                <Route index element={<Navigate to="dashboard" replace />} />
                <Route path="dashboard" element={<AdminDashboard />} />
                <Route path="students" element={<Students />} />
                <Route path="teachers" element={<Teachers />} />
                <Route path="academic-management" element={<AcademicManagement />} />
                <Route path="departments" element={<Departments />} />
                <Route path="subjects" element={<Navigate to="/admin/academic-management" replace />} />
                <Route path="courses" element={<Navigate to="/admin/academic-management" replace />} />
                <Route path="classrooms" element={<Classrooms />} />
                <Route path="timetable" element={<AdminTimetable />} />
                <Route path="attendance" element={<AdminAttendance />} />
                <Route
                  path="analytics"
                  element={
                    <Suspense fallback={<LoadingScreen label="Loading institutional analytics…" />}>
                      <AdminAnalytics />
                    </Suspense>
                  }
                />
                <Route
                  path="reports"
                  element={
                    <Suspense fallback={<LoadingScreen label="Loading institutional reports…" />}>
                      <AdminReports />
                    </Suspense>
                  }
                />
                <Route path="notifications" element={<Navigate to="/admin/announcements" replace />} />
                <Route path="announcements" element={<AdminAnnouncements />} />
                <Route path="profile" element={<AdminProfile />} />
                <Route path="settings" element={<AdminSettings />} />
                <Route path="*" element={<ComingSoon />} />
              </Route>
            </Route>

            {/* Teacher — real pages for the Phase 6 Teacher Module,
                "coming soon" for Reports/Notifications until their phase. */}
            <Route element={<RoleRoute allow={['teacher']} />}>
              <Route path="/teacher" element={<DashboardLayout />}>
                <Route index element={<Navigate to="dashboard" replace />} />
                <Route path="dashboard" element={<TeacherDashboard />} />
                <Route path="subjects" element={<TeacherSubjects />} />
                <Route path="classes" element={<TeacherClasses />} />
                <Route path="timetable" element={<TeacherTimetable />} />
                <Route path="attendance" element={<AttendanceHistory />} />
                <Route path="attendance/start" element={<StartAttendance />} />
                <Route path="attendance/session/:id" element={<MarkAttendance />} />
                <Route
                  path="attendance/session/:id/face"
                  element={
                    <Suspense fallback={<LoadingScreen label="Loading face recognition…" />}>
                      <FaceAttendance />
                    </Suspense>
                  }
                />
                <Route path="attendance/class/:subjectId" element={<ClassAttendance />} />
                <Route path="classes/:subjectId/faces" element={<FaceRoster />} />
                <Route
                  path="students/:studentId/face"
                  element={
                    <Suspense fallback={<LoadingScreen label="Loading face recognition…" />}>
                      <FaceRegistration />
                    </Suspense>
                  }
                />
                <Route
                  path="students/register-face"
                  element={
                    <Suspense fallback={<LoadingScreen label="Loading face registration…" />}>
                      <FaceRegistration />
                    </Suspense>
                  }
                />
                <Route
                  path="face-registration"
                  element={
                    <Suspense fallback={<LoadingScreen label="Loading face registration…" />}>
                      <FaceRegistration />
                    </Suspense>
                  }
                />
                <Route
                  path="analytics"
                  element={
                    <Suspense fallback={<LoadingScreen label="Loading analytics…" />}>
                      <TeacherAnalytics />
                    </Suspense>
                  }
                />
                <Route path="profile" element={<TeacherProfile />} />
                <Route path="notifications" element={<TeacherNotifications />} />
                <Route
                  path="reports"
                  element={
                    <Suspense fallback={<LoadingScreen label="Loading reports…" />}>
                      <TeacherReports />
                    </Suspense>
                  }
                />
                <Route path="*" element={<ComingSoon />} />
              </Route>
            </Route>

            {/* Student */}
            <Route element={<RoleRoute allow={['student']} />}>
              <Route path="/student" element={<DashboardLayout />}>
                <Route index element={<Navigate to="dashboard" replace />} />
                <Route path="dashboard" element={<StudentDashboard />} />
                <Route path="subjects" element={<StudentSubjects />} />
                <Route path="timetable" element={<StudentTimetable />} />
                <Route path="attendance" element={<StudentAttendance />} />
                <Route path="attendance/history" element={<StudentAttendanceHistory />} />
                <Route
                  path="analytics"
                  element={
                    <Suspense fallback={<LoadingScreen label="Loading analytics…" />}>
                      <StudentAnalytics />
                    </Suspense>
                  }
                />
                <Route path="notifications" element={<StudentNotifications />} />
                <Route path="profile" element={<StudentProfile />} />
                <Route path="*" element={<ComingSoon />} />
              </Route>
            </Route>
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </ToastProvider>
    </AuthProvider>
  )
}
