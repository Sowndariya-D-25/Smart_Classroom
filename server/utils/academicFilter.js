import mongoose from 'mongoose'
import { Subject, Teacher, Student, Attendance, AttendanceSession } from '../models/index.js'

import { escapeRegex } from './searchHelpers.js'

export const canonicalDepartment = (dept) => {
  if (!dept) return ''
  const trimmed = dept.trim()
  if (/^(computer science|cse|c\.s\.e\.|cse department)$/i.test(trimmed)) return 'CSE'
  return trimmed
}

export const getDepartmentRegex = (dept) => {
  if (!dept) return null
  const trimmed = dept.trim()
  if (/^(computer science|cse|c\.s\.e\.|cse department)$/i.test(trimmed)) {
    return /^(cse|computer science|c\.s\.e\.|cse department)$/i
  }
  return new RegExp(`^${escapeRegex(trimmed)}$`, 'i')
}

/**
 * Builds normalized, authoritative MongoDB query filters for Attendance and AttendanceSession
 * handling both direct document fields and relational mappings (Subject, Teacher, Student).
 *
 * @param {Object} params - Query parameters from request (department, year, section, semester, subject, teacher, student, dateFrom, dateTo, status, etc.)
 * @returns {Promise<{ impossible: boolean, sessQuery: Object, attQuery: Object, matchingSubjectIds: Array, matchingTeacherIds: Array }>}
 */
export async function buildAcademicFilter(params = {}) {
  const {
    department,
    year,
    section,
    semester,
    subject,
    teacher,
    student,
    date,
    dateFrom,
    dateTo,
    startDate,
    endDate,
    status,
    method,
  } = params

  // 1. Safe ObjectId validation (never crash on malformed IDs)
  if (subject && !mongoose.Types.ObjectId.isValid(subject)) {
    return { impossible: true, sessQuery: { _id: null }, attQuery: { _id: null } }
  }
  if (teacher && !mongoose.Types.ObjectId.isValid(teacher)) {
    return { impossible: true, sessQuery: { _id: null }, attQuery: { _id: null } }
  }
  if (student && !mongoose.Types.ObjectId.isValid(student)) {
    return { impossible: true, sessQuery: { _id: null }, attQuery: { _id: null } }
  }

  const deptRegex = department ? getDepartmentRegex(department) : null

  // 2. Resolve Subject Filter
  const subQuery = { isActive: true }
  let subFiltered = false

  if (deptRegex) {
    subQuery.department = deptRegex
    subFiltered = true
  }
  if (semester) {
    subQuery.semester = Number(semester)
    subFiltered = true
  } else if (year) {
    const yrNum = typeof year === 'string' ? parseInt(year.replace(/\D/g, ''), 10) : Number(year)
    if (!isNaN(yrNum)) {
      subQuery.semester = { $in: [(yrNum - 1) * 2 + 1, yrNum * 2] }
      subFiltered = true
    }
  }
  if (subject) {
    subQuery._id = subject
    subFiltered = true
  }

  const matchingSubjects = subFiltered ? await Subject.find(subQuery).select('_id teachers').lean() : null
  const matchingSubjectIds = matchingSubjects ? matchingSubjects.map((s) => s._id) : null

  if (matchingSubjectIds && matchingSubjectIds.length === 0) {
    return { impossible: true, sessQuery: { _id: null }, attQuery: { _id: null } }
  }

  // 3. Resolve Teacher Filter
  let teacherSubjectIds = null
  if (teacher) {
    if (deptRegex) {
      const validTeacher = await Teacher.findOne({ _id: teacher, department: deptRegex })
      if (!validTeacher) {
        return { impossible: true, sessQuery: { _id: null }, attQuery: { _id: null } }
      }
    }
    const teacherSubs = await Subject.find({ teachers: teacher }).distinct('_id')
    teacherSubjectIds = teacherSubs
  }

  // 4. Resolve Date Range (IST boundaries to match local Indian calendar dates)
  const effectiveStart = dateFrom || startDate
  const effectiveEnd = dateTo || endDate
  let dateQuery = null

  const parseStart = (s) => new Date(s.includes('T') ? s : `${s}T00:00:00.000+05:30`)
  const parseEnd = (s) => new Date(s.includes('T') ? s : `${s}T23:59:59.999+05:30`)

  if (date) {
    const start = parseStart(date)
    const end = parseEnd(date)
    dateQuery = { $gte: start, $lte: end }
  } else if (effectiveStart || effectiveEnd) {
    dateQuery = {}
    if (effectiveStart) dateQuery.$gte = parseStart(effectiveStart)
    if (effectiveEnd) dateQuery.$lte = parseEnd(effectiveEnd)
  }

  // 5. Build AttendanceSession Query
  const sessQuery = {}
  if (dateQuery) sessQuery.date = dateQuery

  if (matchingSubjectIds) {
    sessQuery.subject = { $in: matchingSubjectIds }
  }

  if (teacher) {
    sessQuery.$or = [
      { teacher },
      ...(teacherSubjectIds?.length ? [{ subject: { $in: teacherSubjectIds } }] : []),
    ]
  }

  if (section) {
    const secUpper = section.trim().toUpperCase()
    if (secUpper === 'A') {
      sessQuery.$or = [
        { section: new RegExp('^A$', 'i') },
        { section: { $exists: false } },
        { section: null },
      ]
    } else {
      sessQuery.section = new RegExp(`^${escapeRegex(secUpper)}$`, 'i')
    }
  }

  if (status) {
    if (['Completed', 'Active', 'Scheduled', 'Cancelled'].includes(status)) {
      sessQuery.status = status
    } else if (['Present', 'Absent', 'Late'].includes(status)) {
      const matchCriteria = { status }
      if (student) matchCriteria.student = student
      const sessWithStatus = await Attendance.distinct('session', matchCriteria)
      sessQuery._id = { $in: sessWithStatus }
    }
  }

  if (student) {
    const studentSessionIds = await Attendance.distinct('session', { student })
    if (sessQuery._id) {
      sessQuery._id = { $in: studentSessionIds.filter((id) => sessQuery._id.$in.map(String).includes(id.toString())) }
    } else {
      sessQuery._id = { $in: studentSessionIds }
    }
  }

  // Find all matching session IDs to bind Attendance query tightly
  const matchedSessions = await AttendanceSession.find(sessQuery).select('_id').lean()
  const matchedSessionIds = matchedSessions.map((s) => s._id)

  // 6. Build Attendance Query
  const attQuery = {}
  if (dateQuery) attQuery.date = dateQuery
  if (matchingSubjectIds) attQuery.subject = { $in: matchingSubjectIds }
  if (student) attQuery.student = student
  if (status && ['Present', 'Absent', 'Late'].includes(status)) attQuery.status = status
  if (method) {
    if (/face/i.test(method)) {
      attQuery.method = { $in: ['Face Recognition', 'FACE'] }
    } else {
      attQuery.method = { $in: ['Manual', 'MANUAL'] }
    }
  }

  // Constrain attendance records to matched sessions (covers section, teacher, session status)
  if (section || teacher || (status && ['Completed', 'Active', 'Scheduled', 'Cancelled'].includes(status))) {
    attQuery.session = { $in: matchedSessionIds }
  }

  return {
    impossible: false,
    sessQuery,
    attQuery,
    matchedSessionIds,
    matchingSubjectIds,
  }
}
