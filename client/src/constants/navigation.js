import {
  FiGrid,
  FiUsers,
  FiUserCheck,
  FiBook,
  FiLayers,
  FiHome,
  FiCalendar,
  FiCheckSquare,
  FiBarChart2,
  FiFileText,
  FiBell,
  FiSettings,
  FiUser,
  FiCamera,
} from 'react-icons/fi'

/**
 * Single source of truth for sidebar navigation, per role.
 * Consistently uses React Icons (react-icons/fi) for clean, professional stroke weight.
 */
export const navigationByRole = {
  admin: [
    {
      section: null,
      items: [
        { label: 'Dashboard', to: '/admin/dashboard', icon: FiGrid },
        { label: 'Students', to: '/admin/students', icon: FiUsers },
        { label: 'Teachers', to: '/admin/teachers', icon: FiUserCheck },
        { label: 'Academic Management', to: '/admin/academic-management', icon: FiBook },
        { label: 'Departments', to: '/admin/departments', icon: FiLayers },
        { label: 'Timetable', to: '/admin/timetable', icon: FiCalendar },
        { label: 'Attendance', to: '/admin/attendance', icon: FiCheckSquare },
        { label: 'Analytics', to: '/admin/analytics', icon: FiBarChart2 },
        { label: 'Announcements', to: '/admin/announcements', icon: FiBell },
        { label: 'Reports', to: '/admin/reports', icon: FiFileText },
      ],
    },
  ],

  teacher: [
    {
      section: null,
      items: [{ label: 'Dashboard', to: '/teacher/dashboard', icon: FiGrid }],
    },
    {
      section: 'Teaching & Students',
      items: [
        { label: 'My Subjects', to: '/teacher/subjects', icon: FiBook },
        { label: 'My Classes', to: '/teacher/classes', icon: FiUsers },
        { label: 'Register Student Face', to: '/teacher/students/register-face', icon: FiCamera },
        { label: 'Timetable', to: '/teacher/timetable', icon: FiCalendar },
      ],
    },
    {
      section: 'Attendance',
      items: [
        { label: 'Take Attendance', to: '/teacher/attendance/start', icon: FiCheckSquare },
        { label: 'Attendance History', to: '/teacher/attendance', icon: FiCheckSquare },
      ],
    },
    {
      section: 'Analytics',
      items: [
        { label: 'Class Analytics', to: '/teacher/analytics', icon: FiBarChart2 },
        { label: 'Reports', to: '/teacher/reports', icon: FiFileText },
      ],
    },
    {
      section: 'System',
      items: [
        { label: 'Notifications', to: '/teacher/notifications', icon: FiBell },
        { label: 'Profile', to: '/teacher/profile', icon: FiUser },
      ],
    },
  ],

  student: [
    {
      section: null,
      items: [{ label: 'Dashboard', to: '/student/dashboard', icon: FiGrid }],
    },
    {
      section: 'Academics',
      items: [
        { label: 'My Subjects', to: '/student/subjects', icon: FiBook },
        { label: 'Timetable', to: '/student/timetable', icon: FiCalendar },
      ],
    },
    {
      section: 'Attendance',
      items: [
        { label: 'My Attendance', to: '/student/attendance', icon: FiCheckSquare },
        { label: 'Attendance History', to: '/student/attendance/history', icon: FiCheckSquare },
      ],
    },
    {
      section: 'Analytics',
      items: [{ label: 'Attendance Analytics', to: '/student/analytics', icon: FiBarChart2 }],
    },
    {
      section: 'System',
      items: [
        { label: 'Notifications', to: '/student/notifications', icon: FiBell },
        { label: 'Profile', to: '/student/profile', icon: FiUser },
      ],
    },
  ],
}

export default navigationByRole
