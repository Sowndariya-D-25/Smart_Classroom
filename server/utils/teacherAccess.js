import { Subject } from '../models/index.js'

/**
 * There's no direct Teacher↔Student relationship in this schema — a
 * teacher can reach a student only through a Subject they teach whose
 * `course` matches the student's `course` (the same relationship the
 * attendance roster already uses in attendance.controller.js's
 * getRoster). This is the ONE place that check lives, so face
 * registration and attendance recognition can't drift apart on what
 * "this teacher's student" means.
 */
export async function teacherCanAccessStudent(teacherId, student) {
  if (!student?.course) return false
  return Boolean(await Subject.exists({ teachers: teacherId, course: student.course, isActive: true }))
}

export default teacherCanAccessStudent
