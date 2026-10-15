/**
 * Canonical department normalizer.
 * Maps institutional variants like "Computer Science", "computer science",
 * "C.S.E.", or "CSE Department" to canonical "CSE".
 * Preserves specific distinct departments like "CSD", "ECE", "MECH", etc.
 */
export const normalizeDepartment = (dept, fallback = '—') => {
  if (!dept) return fallback
  const trimmed = String(dept).trim()
  if (!trimmed || trimmed === '—') return fallback
  if (/^(computer science|cse|c\.s\.e\.|cse department)$/i.test(trimmed)) {
    return 'CSE'
  }
  return trimmed
}

export const canonicalDepartment = (dept) => {
  return normalizeDepartment(dept, '')
}

export const normalizeDepartmentName = normalizeDepartment

export default normalizeDepartment
