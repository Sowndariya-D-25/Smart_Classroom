// Single source of the low-attendance cutoff — read once here, reused
// everywhere a percentage needs to be flagged, instead of a hardcoded
// `75` scattered across multiple controllers/pages.
export const LOW_ATTENDANCE_THRESHOLD = Number(process.env.LOW_ATTENDANCE_THRESHOLD) || 75

// `null` percentage means "no applicable sessions yet" — never flagged
// as low, since there's nothing to judge yet (see docs/ATTENDANCE_MANAGEMENT.md).
export function isLowAttendance(percentage) {
  if (percentage === null || percentage === undefined) return false
  return percentage < LOW_ATTENDANCE_THRESHOLD
}

export function calculateAttendancePercentage(attended, totalSessions) {
  if (!totalSessions || totalSessions <= 0) return null
  return Math.round((attended / totalSessions) * 100)
}

/**
 * Builds the MongoDB query to count eligible sessions for a specific student,
 * ensuring students in Section A are not penalized by sessions conducted for Section B.
 */
export function getEligibleSessionQuery(subjectId, student) {
  const query = { subject: subjectId, status: 'Completed' }
  const andClauses = []

  if (student?.section) {
    const secTrimmed = String(student.section).trim()
    const escaped = secTrimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const secRegex = new RegExp(`^${escaped}$`, 'i')
    andClauses.push({
      $or: [
        { section: secRegex },
        { section: { $exists: false } },
        { section: null },
        { section: '' },
      ],
    })
  }

  if (student?.department) {
    const dept = String(student.department).trim()
    const isCse = /^(cse|computer science|c\.s\.e\.|cse department)$/i.test(dept)
    const escaped = dept.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const deptRegex = isCse
      ? /^(cse|computer science|c\.s\.e\.|cse department)$/i
      : new RegExp(`^${escaped}$`, 'i')

    andClauses.push({
      $or: [
        { department: deptRegex },
        { department: { $exists: false } },
        { department: null },
        { department: '' },
      ],
    })
  }

  if (andClauses.length === 1) {
    query.$or = andClauses[0].$or
  } else if (andClauses.length > 1) {
    query.$and = andClauses
  }

  return query
}

/**
 * Configurable institutional attendance policies for OD and Leave.
 * - 'COUNT_AS_PRESENT': Approved request credits student as attended towards percentage.
 * - 'EXCLUDE_FROM_TOTAL': Excluded from total eligible sessions denominator.
 * - 'RECORD_ONLY': Kept as excused record, does not add to attended count.
 */
export const OD_ATTENDANCE_POLICY = process.env.OD_ATTENDANCE_POLICY || 'COUNT_AS_PRESENT'
export const LEAVE_ATTENDANCE_POLICY = process.env.LEAVE_ATTENDANCE_POLICY || 'RECORD_ONLY'

export const ATTENDED_STATUSES = [
  'Present',
  'Late',
  ...(OD_ATTENDANCE_POLICY === 'COUNT_AS_PRESENT' ? ['OD'] : []),
  ...(LEAVE_ATTENDANCE_POLICY === 'COUNT_AS_PRESENT' ? ['Leave'] : []),
]

export function isAttendedStatus(status) {
  return ATTENDED_STATUSES.includes(status)
}

/**
 * Calculates the minimum consecutive classes a student must attend to reach
 * the required attendance target (e.g. 75%).
 * Formula: x = ceil((p * T - A) / (1 - p))
 *
 * @param {number} attended - Number of eligible classes attended
 * @param {number} totalSessions - Total eligible classes conducted
 * @param {number} targetPercentage - Target percentage (defaults to LOW_ATTENDANCE_THRESHOLD, normally 75)
 * @returns {number|null} Minimum consecutive classes to attend (0 if target met, null if no sessions)
 */
export function calculateConsecutiveClassesNeeded(
  attended,
  totalSessions,
  targetPercentage = LOW_ATTENDANCE_THRESHOLD,
) {
  if (totalSessions == null || totalSessions <= 0) return null
  const target = Number(targetPercentage) || 75
  if (target <= 0) return 0
  if (target >= 100) return attended >= totalSessions ? 0 : Infinity

  const safeAttended = Math.max(0, Number(attended) || 0)
  const safeTotal = Math.max(0, Number(totalSessions) || 0)

  // Current percentage check: if already at or above target, no recovery classes needed
  // Using cross-multiplication: safeAttended * 100 >= target * safeTotal
  if (safeAttended * 100 >= target * safeTotal) {
    return 0
  }

  // Integer arithmetic: x = ceil((P * T - 100 * A) / (100 - P))
  // Eliminates IEEE-754 floating point precision errors (e.g., 1 - 0.8 = 0.19999999999999996)
  const numerator = target * safeTotal - 100 * safeAttended
  const denominator = 100 - target
  const needed = Math.ceil(numerator / denominator)
  return Math.max(1, needed)
}

export default LOW_ATTENDANCE_THRESHOLD

