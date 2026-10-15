import asyncHandler from '../../utils/asyncHandler.js'
import { Course, Subject, Teacher, Student } from '../../models/index.js'

const normalizeDept = (d) => {
  if (!d) return ''
  const trimmed = String(d).trim()
  if (/^(computer science|cse|c\.s\.e\.|cse department)$/i.test(trimmed)) {
    return 'CSE'
  }
  return trimmed
}

const matchesDept = (docDept, targetDept) => {
  if (!docDept || !targetDept) return false
  return normalizeDept(docDept).toLowerCase() === normalizeDept(targetDept).toLowerCase()
}

// GET /api/admin/departments
export const getDepartments = asyncHandler(async (req, res) => {
  const [courses, subjects, teachers, students] = await Promise.all([
    Course.find({}).lean(),
    Subject.find({}).lean(),
    Teacher.find({}).lean(),
    Student.find({}).lean(),
  ])

  // Collect canonical departments
  const deptSet = new Set()
  courses.forEach((c) => c.department && deptSet.add(normalizeDept(c.department)))
  subjects.forEach((s) => s.department && deptSet.add(normalizeDept(s.department)))
  teachers.forEach((t) => t.department && deptSet.add(normalizeDept(t.department)))
  students.forEach((st) => st.department && deptSet.add(normalizeDept(st.department)))

  // Guarantee canonical institutional CSE is present if department records exist
  if (deptSet.size === 0) {
    deptSet.add('CSE')
  }

  const departmentList = Array.from(deptSet).sort().map((deptName) => {
    const deptCourses = courses.filter((c) => matchesDept(c.department, deptName))
    const deptSubjects = subjects.filter((s) => matchesDept(s.department, deptName))
    const deptTeachers = teachers.filter((t) => matchesDept(t.department, deptName))
    const deptStudents = students.filter((st) => matchesDept(st.department, deptName))

    return {
      name: deptName,
      programCount: deptCourses.length,
      activeProgramCount: deptCourses.filter((c) => c.isActive).length,
      subjectCount: deptSubjects.length,
      teacherCount: deptTeachers.length,
      studentCount: deptStudents.length,
    }
  })

  res.json({
    success: true,
    data: { items: departmentList, total: departmentList.length },
  })
})
