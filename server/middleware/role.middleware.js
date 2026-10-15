/**
 * Role-based authorization. Must run after `protect` (needs req.user).
 *
 * Usage:
 *   router.get('/admin/students', protect, authorizeRoles('admin'), listStudents)
 *   router.get('/reports', protect, authorizeRoles('admin', 'teacher'), listReports)
 */
export const authorizeRoles =
  (...allowedRoles) =>
  (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      res.status(403)
      throw new Error('Forbidden: you do not have permission to access this resource')
    }
    next()
  }

export default authorizeRoles
